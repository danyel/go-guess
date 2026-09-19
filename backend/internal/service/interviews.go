package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/danyel/go-guess/backend/internal/database/repository"
	"github.com/danyel/go-guess/backend/internal/eventbus"
	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/service/model"
	"github.com/google/uuid"
)

type IUserService interface {
	List(context.Context) ([]model.User, error)
	Create(context.Context, string, string, string) (model.User, error)
}

type IScheduledInterviewService interface {
	Create(context.Context, uint, uint, model.ScheduledInterview, []uint) (model.ScheduledInterview, error)
	List(context.Context, uint, uint) ([]model.ScheduledInterview, error)
	Get(context.Context, uint, uint) (model.ScheduledInterview, error)
	GetParticipantMeeting(context.Context, string) (model.ScheduledInterview, error)
	UpdateStatus(context.Context, uint, uint, string) (model.ScheduledInterview, error)
	UpdateDocument(context.Context, uint, uint, string) (model.ScheduledInterview, error)
	ListNotes(context.Context, uint, uint) ([]model.InterviewNote, error)
	CreateNote(context.Context, uint, uint, string) (model.InterviewNote, error)
	ListInbox(context.Context, uint) ([]model.ScheduledInterview, error)
	UpdateInbox(context.Context, uint, uint, string) (model.ScheduledInterview, error)
	ListCalendar(context.Context, uint) ([]model.ScheduledInterview, error)
	Subscribe(context.Context, uint, uint) (<-chan eventbus.InterviewNoteEvent, error)
}

type UserService struct {
	store repository.IStore
}

func NewUserService(store repository.IStore) *UserService {
	return &UserService{store: store}
}

func (s *UserService) List(ctx context.Context) ([]model.User, error) {
	return s.store.ListUsers(ctx)
}

func (s *UserService) Create(ctx context.Context, email, password, displayName string) (model.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	displayName = strings.TrimSpace(displayName)
	if email == "" || displayName == "" || len(password) < 8 {
		return model.User{}, fmt.Errorf("%w: email, displayName, and an 8-character password are required", ErrValidation)
	}
	passwordHash, err := security.HashPassword(password)
	if err != nil {
		return model.User{}, err
	}
	user, err := s.store.CreateUser(ctx, model.User{
		Email: email, PasswordHash: passwordHash, DisplayName: displayName, Role: "co_interviewer",
	})
	if err != nil {
		return model.User{}, err
	}
	user.PasswordHash = ""
	return user, nil
}

type ScheduledInterviewService struct {
	store repository.IStore
	bus   eventbus.IEventBus
}

func NewScheduledInterviewService(store repository.IStore, bus eventbus.IEventBus) *ScheduledInterviewService {
	return &ScheduledInterviewService{store: store, bus: bus}
}

func (s *ScheduledInterviewService) Create(
	ctx context.Context,
	userID, jobID uint,
	value model.ScheduledInterview,
	interviewerIDs []uint,
) (model.ScheduledInterview, error) {
	invitation, err := s.store.GetInvitation(ctx, jobID, value.InvitationID)
	if err != nil {
		return model.ScheduledInterview{}, err
	}
	if invitation.Status != "completed" || invitation.Outcome != "passed" {
		return model.ScheduledInterview{}, fmt.Errorf("%w: a passed completed assessment is required", ErrInvalidState)
	}
	value.Location = strings.TrimSpace(value.Location)
	if value.StartsAt.IsZero() || value.Location == "" {
		return model.ScheduledInterview{}, fmt.Errorf("%w: startsAt and location are required", ErrValidation)
	}
	users, err := s.store.ListUsers(ctx)
	if err != nil {
		return model.ScheduledInterview{}, err
	}
	validUsers := make(map[uint]struct{}, len(users))
	for _, user := range users {
		validUsers[user.ID] = struct{}{}
	}
	unique := map[uint]struct{}{userID: {}}
	for _, id := range interviewerIDs {
		if _, ok := validUsers[id]; !ok {
			return model.ScheduledInterview{}, fmt.Errorf("%w: interviewer %d does not exist", ErrValidation, id)
		}
		unique[id] = struct{}{}
	}
	ids := make([]uint, 0, len(unique))
	for id := range unique {
		ids = append(ids, id)
	}
	value.JobID = jobID
	value.ParticipantID = invitation.ParticipantID
	value.CreatorID = userID
	value.CandidateToken = uuid.NewString()
	value.Status = "scheduled"
	return s.store.CreateScheduledInterview(ctx, value, ids)
}

func (s *ScheduledInterviewService) List(
	ctx context.Context, userID, jobID uint,
) ([]model.ScheduledInterview, error) {
	values, err := s.store.ListScheduledInterviews(ctx, jobID)
	if err != nil {
		return nil, err
	}
	result := make([]model.ScheduledInterview, 0, len(values))
	for _, value := range values {
		if isAttendee(value, userID) {
			result = append(result, value)
		}
	}
	return result, nil
}

func (s *ScheduledInterviewService) Get(
	ctx context.Context, userID, interviewID uint,
) (model.ScheduledInterview, error) {
	value, err := s.store.GetScheduledInterview(ctx, interviewID)
	if err != nil {
		return model.ScheduledInterview{}, err
	}
	if !isAttendee(value, userID) {
		return model.ScheduledInterview{}, ErrForbidden
	}
	return value, nil
}

func (s *ScheduledInterviewService) GetParticipantMeeting(
	ctx context.Context, token string,
) (model.ScheduledInterview, error) {
	return s.store.GetScheduledInterviewByToken(ctx, token)
}

func (s *ScheduledInterviewService) UpdateStatus(
	ctx context.Context, userID, interviewID uint, status string,
) (model.ScheduledInterview, error) {
	current, err := s.Get(ctx, userID, interviewID)
	if err != nil {
		return model.ScheduledInterview{}, err
	}
	valid := (current.Status == "scheduled" && (status == "started" || status == "cancelled")) ||
		(current.Status == "started" && (status == "completed" || status == "cancelled"))
	if !valid {
		return model.ScheduledInterview{}, fmt.Errorf("%w: invalid interview status transition", ErrInvalidState)
	}
	return s.store.UpdateScheduledInterviewStatus(ctx, interviewID, status)
}

func (s *ScheduledInterviewService) UpdateDocument(
	ctx context.Context, userID, interviewID uint, document string,
) (model.ScheduledInterview, error) {
	if _, err := s.Get(ctx, userID, interviewID); err != nil {
		return model.ScheduledInterview{}, err
	}
	return s.store.UpdateScheduledInterviewDocument(ctx, interviewID, document)
}

func (s *ScheduledInterviewService) ListNotes(
	ctx context.Context, userID, interviewID uint,
) ([]model.InterviewNote, error) {
	if _, err := s.Get(ctx, userID, interviewID); err != nil {
		return nil, err
	}
	return s.store.ListInterviewNotes(ctx, interviewID)
}

func (s *ScheduledInterviewService) CreateNote(
	ctx context.Context, userID, interviewID uint, body string,
) (model.InterviewNote, error) {
	interview, err := s.Get(ctx, userID, interviewID)
	if err != nil {
		return model.InterviewNote{}, err
	}
	if interview.Status != "started" {
		return model.InterviewNote{}, fmt.Errorf("%w: notes require a started interview", ErrInvalidState)
	}
	body = strings.TrimSpace(body)
	if body == "" {
		return model.InterviewNote{}, fmt.Errorf("%w: note body is required", ErrValidation)
	}
	note, err := s.store.CreateInterviewNote(ctx, model.InterviewNote{
		InterviewID: interviewID, AuthorID: userID, Body: body,
	})
	if err != nil {
		if errors.Is(err, repository.ErrInterviewNotStarted) {
			return model.InterviewNote{}, fmt.Errorf("%w: notes require a started interview", ErrInvalidState)
		}
		return model.InterviewNote{}, err
	}
	if err := s.bus.PublishInterviewNote(ctx, eventbus.InterviewNoteEvent{
		InterviewID: note.InterviewID, ID: note.ID, AuthorUserID: note.AuthorID,
		AuthorName: note.Author.DisplayName, Body: note.Body, CreatedAt: note.CreatedAt,
	}); err != nil {
		return model.InterviewNote{}, fmt.Errorf("publish persisted interview note: %w", err)
	}
	return note, nil
}

func (s *ScheduledInterviewService) ListInbox(
	ctx context.Context, userID uint,
) ([]model.ScheduledInterview, error) {
	return s.store.ListInbox(ctx, userID)
}

func (s *ScheduledInterviewService) UpdateInbox(
	ctx context.Context, userID, interviewID uint, status string,
) (model.ScheduledInterview, error) {
	if status != "accepted" && status != "declined" {
		return model.ScheduledInterview{}, fmt.Errorf("%w: attendee status must be accepted or declined", ErrValidation)
	}
	if _, err := s.store.UpdateAttendeeStatus(ctx, interviewID, userID, status); err != nil {
		return model.ScheduledInterview{}, err
	}
	return s.Get(ctx, userID, interviewID)
}

func (s *ScheduledInterviewService) ListCalendar(
	ctx context.Context, userID uint,
) ([]model.ScheduledInterview, error) {
	return s.store.ListCalendar(ctx, userID)
}

func (s *ScheduledInterviewService) Subscribe(
	ctx context.Context, userID, interviewID uint,
) (<-chan eventbus.InterviewNoteEvent, error) {
	if _, err := s.Get(ctx, userID, interviewID); err != nil {
		return nil, err
	}
	return s.bus.SubscribeInterviewNotes(ctx)
}

func isAttendee(value model.ScheduledInterview, userID uint) bool {
	for _, attendee := range value.Attendees {
		if attendee.UserID == userID {
			return true
		}
	}
	return false
}
