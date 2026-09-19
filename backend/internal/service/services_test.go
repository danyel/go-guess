package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/danyel/go-guess/backend/internal/database/repository"
	"github.com/danyel/go-guess/backend/internal/eventbus"
	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/service/model"
)

type fakeStore struct {
	job          model.JobPosting
	participants []model.Participant
	traits       []model.Trait
	createdUser  model.User
}

type invitationStore struct {
	*fakeStore
	interview   model.Interview
	invitations []model.Invitation
	saved       bool
}

type scheduledStore struct {
	*fakeStore
	invitation model.Invitation
	interview  model.ScheduledInterview
	note       model.InterviewNote
	createdIDs []uint
	status     string
	document   string
}

func (f *scheduledStore) GetInvitation(context.Context, uint, uint) (model.Invitation, error) {
	return f.invitation, nil
}
func (f *scheduledStore) ListUsers(context.Context) ([]model.User, error) {
	return []model.User{{ID: 1}, {ID: 2}}, nil
}
func (f *scheduledStore) CreateScheduledInterview(
	_ context.Context, value model.ScheduledInterview, ids []uint,
) (model.ScheduledInterview, error) {
	f.createdIDs = ids
	value.ID = 9
	value.Attendees = []model.InterviewAttendee{{UserID: value.CreatorID, Status: "accepted"}}
	f.interview = value
	return value, nil
}
func (f *scheduledStore) GetScheduledInterview(context.Context, uint) (model.ScheduledInterview, error) {
	return f.interview, nil
}
func (f *scheduledStore) UpdateScheduledInterviewStatus(
	_ context.Context, _ uint, status string,
) (model.ScheduledInterview, error) {
	f.status = status
	f.interview.Status = status
	return f.interview, nil
}
func (f *scheduledStore) UpdateScheduledInterviewDocument(
	_ context.Context, _ uint, document string,
) (model.ScheduledInterview, error) {
	f.document = document
	f.interview.SharedDocument = document
	return f.interview, nil
}
func (f *scheduledStore) CreateInterviewNote(
	_ context.Context, value model.InterviewNote,
) (model.InterviewNote, error) {
	value.ID = 4
	value.Author = model.User{ID: value.AuthorID, DisplayName: "Ada"}
	value.CreatedAt = time.Now()
	f.note = value
	return value, nil
}

func (f *invitationStore) CreateInvitation(_ context.Context, value model.Invitation) (model.Invitation, error) {
	value.ID = 1
	return value, nil
}
func (f *invitationStore) GetInterview(context.Context, string) (model.Interview, error) {
	return f.interview, nil
}
func (f *invitationStore) SaveAnswer(context.Context, string, uint, string) error {
	f.saved = true
	return nil
}
func (f *invitationStore) ListInvitations(context.Context, uint) ([]model.Invitation, error) {
	return f.invitations, nil
}

func (f *fakeStore) FindUserByEmail(context.Context, string) (model.User, error) {
	return model.User{}, errors.New("unused")
}
func (f *fakeStore) ListUsers(context.Context) ([]model.User, error) { return nil, nil }
func (f *fakeStore) CreateUser(_ context.Context, value model.User) (model.User, error) {
	f.createdUser = value
	return value, nil
}
func (f *fakeStore) ListJobs(context.Context) ([]model.JobPosting, error)   { return nil, nil }
func (f *fakeStore) GetJob(context.Context, uint) (model.JobPosting, error) { return f.job, nil }
func (f *fakeStore) CreateJob(_ context.Context, value model.JobPosting) (model.JobPosting, error) {
	return value, nil
}
func (f *fakeStore) CreateQuestion(_ context.Context, value model.Question) (model.Question, error) {
	return value, nil
}
func (f *fakeStore) UpdateQuestion(_ context.Context, _ uint, value model.Question) (model.Question, error) {
	return value, nil
}
func (f *fakeStore) ListParticipants(context.Context) ([]model.Participant, error) {
	return f.participants, nil
}
func (f *fakeStore) GetParticipant(context.Context, uint) (model.Participant, error) {
	return model.Participant{}, nil
}
func (f *fakeStore) CreateParticipant(_ context.Context, value model.Participant) (model.Participant, error) {
	return value, nil
}
func (f *fakeStore) AllTraits(context.Context) ([]model.Trait, error) { return f.traits, nil }
func (f *fakeStore) UpdateJob(_ context.Context, _ uint, _ string, _ int) (model.JobPosting, error) {
	return f.job, nil
}
func (f *fakeStore) ListQuestions(context.Context, string) ([]model.Question, error) {
	return nil, nil
}
func (f *fakeStore) GetQuestion(context.Context, uint) (model.Question, error) {
	return model.Question{}, nil
}
func (f *fakeStore) SetQuestionDeprecated(_ context.Context, _ uint, _ bool) (model.Question, error) {
	return model.Question{}, nil
}
func (f *fakeStore) AttachQuestion(context.Context, uint, uint) error { return nil }
func (f *fakeStore) DetachQuestion(context.Context, uint, uint) error { return nil }
func (f *fakeStore) ListInvitations(context.Context, uint) ([]model.Invitation, error) {
	return nil, nil
}
func (f *fakeStore) CreateInvitation(_ context.Context, value model.Invitation) (model.Invitation, error) {
	return value, nil
}
func (f *fakeStore) GetInterview(context.Context, string) (model.Interview, error) {
	return model.Interview{}, nil
}
func (f *fakeStore) AcceptInvitation(context.Context, string, time.Time) error { return nil }
func (f *fakeStore) SaveAnswer(context.Context, string, uint, string) error    { return nil }
func (f *fakeStore) CompleteInvitation(context.Context, string, time.Time) error {
	return nil
}
func (f *fakeStore) GetInvitation(context.Context, uint, uint) (model.Invitation, error) {
	return model.Invitation{}, nil
}
func (f *fakeStore) UpdateInvitationOutcome(
	_ context.Context, _, _ uint, outcome string,
) (model.Invitation, error) {
	return model.Invitation{Outcome: outcome}, nil
}
func (f *fakeStore) CreateScheduledInterview(
	_ context.Context, value model.ScheduledInterview, _ []uint,
) (model.ScheduledInterview, error) {
	return value, nil
}
func (f *fakeStore) ListScheduledInterviews(context.Context, uint) ([]model.ScheduledInterview, error) {
	return nil, nil
}
func (f *fakeStore) GetScheduledInterview(context.Context, uint) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{}, nil
}
func (f *fakeStore) GetScheduledInterviewByToken(context.Context, string) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{}, nil
}
func (f *fakeStore) UpdateScheduledInterviewStatus(
	_ context.Context, _ uint, _ string,
) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{}, nil
}
func (f *fakeStore) UpdateScheduledInterviewDocument(
	_ context.Context, _ uint, _ string,
) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{}, nil
}
func (f *fakeStore) ListInterviewNotes(context.Context, uint) ([]model.InterviewNote, error) {
	return nil, nil
}
func (f *fakeStore) CreateInterviewNote(
	_ context.Context, value model.InterviewNote,
) (model.InterviewNote, error) {
	return value, nil
}
func (f *fakeStore) ListInbox(context.Context, uint) ([]model.ScheduledInterview, error) {
	return nil, nil
}
func (f *fakeStore) UpdateAttendeeStatus(
	_ context.Context, _, _ uint, _ string,
) (model.InterviewAttendee, error) {
	return model.InterviewAttendee{}, nil
}
func (f *fakeStore) ListCalendar(context.Context, uint) ([]model.ScheduledInterview, error) {
	return nil, nil
}

func TestCandidatesRequireSixtyPercent(t *testing.T) {
	store := &fakeStore{
		job: model.JobPosting{
			Labels:         []model.Trait{{Name: "Backend"}},
			RequiredSkills: []model.Trait{{Name: "Go"}, {Name: "PostgreSQL"}, {Name: "Docker"}, {Name: "React"}},
		},
		participants: []model.Participant{
			{ID: 1, Traits: []model.Trait{{Name: "Go"}, {Name: "PostgreSQL"}, {Name: "Docker"}}},
			{ID: 2, Traits: []model.Trait{{Name: "Go"}, {Name: "React"}}},
		},
	}

	matches, err := NewJobService(store).Candidates(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(matches) != 1 || matches[0].Participant.ID != 1 || matches[0].Score != 60 {
		t.Fatalf("expected only participant 1 at 60%%, got %#v", matches)
	}
}

func TestParticipantCreateExtractsKnownTraits(t *testing.T) {
	store := &fakeStore{traits: []model.Trait{{Name: "Go"}, {Name: "React"}, {Name: "C++"}}}
	value, err := NewParticipantService(store).Create(context.Background(), model.Participant{
		FirstName: "Ada", LastName: "Lovelace", Email: "ADA@EXAMPLE.COM",
		CV: []byte("Backend engineer using Go and C++ daily."), CVFilename: "cv.txt",
	})
	if err != nil {
		t.Fatal(err)
	}
	if value.Email != "ada@example.com" || len(value.Traits) != 2 {
		t.Fatalf("unexpected participant: %#v", value)
	}
}

func TestInvitationRequiresPublishedMatchingJob(t *testing.T) {
	store := &invitationStore{fakeStore: &fakeStore{
		job: model.JobPosting{
			ID: 1, Status: "published",
			RequiredSkills: []model.Trait{{Name: "Go"}},
		},
		participants: []model.Participant{{ID: 7, Traits: []model.Trait{{Name: "Go"}}}},
	}}
	invitation, err := NewInvitationService(store, "http://localhost:5173").Create(context.Background(), 1, 7)
	if err != nil {
		t.Fatal(err)
	}
	if invitation.Status != "pending" || invitation.Token == "" {
		t.Fatalf("unexpected invitation: %#v", invitation)
	}

	store.job.Status = "draft"
	if _, err := NewInvitationService(store, "").Create(context.Background(), 1, 7); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("expected invalid state for draft job, got %v", err)
	}
}

func TestExpiredInterviewRejectsAnswers(t *testing.T) {
	acceptedAt := time.Now().Add(-61 * time.Minute)
	store := &invitationStore{
		fakeStore: &fakeStore{},
		interview: model.Interview{
			Invitation: model.Invitation{Status: "accepted", AcceptedAt: &acceptedAt},
			Job: model.JobPosting{
				Status: "published", DurationMinutes: 60,
				Questions: []model.Question{{ID: 9}},
			},
		},
	}
	err := NewInvitationService(store, "").SaveAnswer(context.Background(), "token", 9, "answer")
	if !errors.Is(err, ErrInvalidState) || store.saved {
		t.Fatalf("expected expired answer to be rejected, got %v", err)
	}
}

func TestQuestionReferenceAnswerValidation(t *testing.T) {
	service := NewQuestionService(&fakeStore{})
	if _, err := service.Create(context.Background(), model.Question{
		Text: "Explain cancellation", Type: "open",
	}); !errors.Is(err, ErrInvalidQuestion) {
		t.Fatalf("expected missing reference answer error, got %v", err)
	}

	question, err := service.Create(context.Background(), model.Question{
		Text: "Choose", Type: "radio", Options: []string{" One ", "Two"},
		ReferenceAnswer: "must be cleared",
	})
	if err != nil {
		t.Fatal(err)
	}
	if question.ReferenceAnswer != "" || question.Options[0] != "One" {
		t.Fatalf("unexpected normalized question: %#v", question)
	}

	if _, err := service.Create(context.Background(), model.Question{
		Text: "Review this change", Type: "code_review", ReferenceAnswer: "Spot the race",
	}); !errors.Is(err, ErrInvalidQuestion) {
		t.Fatalf("expected missing code snippet error, got %v", err)
	}
}

func TestInvitationReviewIsScopedToJob(t *testing.T) {
	store := &invitationStore{
		fakeStore:   &fakeStore{},
		invitations: []model.Invitation{{ID: 3, JobID: 8, Token: "opaque-token"}},
		interview:   model.Interview{Invitation: model.Invitation{ID: 3, JobID: 8}},
	}
	service := NewInvitationService(store, "")
	review, err := service.Review(context.Background(), 8, 3)
	if err != nil || review.Invitation.ID != 3 {
		t.Fatalf("expected invitation review, got %#v, %v", review, err)
	}
	if _, err := service.Review(context.Background(), 8, 4); !errors.Is(err, repository.ErrNotFound) {
		t.Fatalf("expected missing invitation error, got %v", err)
	}
}

func TestInvitationOutcomeRequiresCompletedAssessment(t *testing.T) {
	store := &scheduledStore{
		fakeStore: &fakeStore{}, invitation: model.Invitation{Status: "accepted"},
	}
	invitations := NewInvitationService(store, "")
	if _, err := invitations.SetOutcome(context.Background(), 1, 2, "passed"); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("expected incomplete assessment rejection, got %v", err)
	}
	store.invitation.Status = "completed"
	outcome, err := invitations.SetOutcome(context.Background(), 1, 2, "passed")
	if err != nil || outcome.Outcome != "passed" {
		t.Fatalf("expected passed outcome, got %#v, %v", outcome, err)
	}
}

func TestScheduledInterviewRequiresPassedAssessmentAndAddsCreator(t *testing.T) {
	store := &scheduledStore{
		fakeStore: &fakeStore{},
		invitation: model.Invitation{
			Status: "completed", Outcome: "passed", ParticipantID: 7,
		},
	}
	interviews := NewScheduledInterviewService(store, eventbus.NewMemoryBus())
	created, err := interviews.Create(context.Background(), 1, 5, model.ScheduledInterview{
		InvitationID: 3, StartsAt: time.Now().Add(time.Hour), Location: "Room 4",
	}, []uint{2})
	if err != nil {
		t.Fatal(err)
	}
	if created.CreatorID != 1 || created.ParticipantID != 7 || created.CandidateToken == "" ||
		len(store.createdIDs) != 2 {
		t.Fatalf("unexpected scheduled interview: %#v ids=%v", created, store.createdIDs)
	}
	store.invitation.Outcome = "failed"
	if _, err := interviews.Create(context.Background(), 1, 5, model.ScheduledInterview{
		InvitationID: 3, StartsAt: time.Now(), Location: "Room 4",
	}, nil); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("expected failed assessment rejection, got %v", err)
	}
}

func TestScheduledInterviewAuthorizationAndState(t *testing.T) {
	store := &scheduledStore{
		fakeStore: &fakeStore{},
		interview: model.ScheduledInterview{
			ID: 9, Status: "scheduled",
			Attendees: []model.InterviewAttendee{{UserID: 1, Status: "accepted"}},
		},
	}
	interviews := NewScheduledInterviewService(store, eventbus.NewMemoryBus())
	if _, err := interviews.Get(context.Background(), 2, 9); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if _, err := interviews.UpdateStatus(context.Background(), 1, 9, "completed"); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("expected invalid transition, got %v", err)
	}
	if _, err := interviews.UpdateStatus(context.Background(), 1, 9, "started"); err != nil || store.status != "started" {
		t.Fatalf("expected started transition, got %v", err)
	}
	if _, err := interviews.UpdateDocument(context.Background(), 2, 9, "secret"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected document authorization, got %v", err)
	}
}

func TestCreateNotePersistsThenPublishesSafeEvent(t *testing.T) {
	store := &scheduledStore{
		fakeStore: &fakeStore{},
		interview: model.ScheduledInterview{
			ID: 9, Status: "started", Attendees: []model.InterviewAttendee{{UserID: 1}},
		},
	}
	bus := eventbus.NewMemoryBus()
	events, err := bus.SubscribeInterviewEvents(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	interviews := NewScheduledInterviewService(store, bus)
	note, err := interviews.CreateNote(context.Background(), 1, 9, "  useful note  ")
	if err != nil {
		t.Fatal(err)
	}
	event := <-events
	if note.Body != "useful note" || event.Type != "note.created" || event.Note == nil ||
		event.Note.ID != note.ID || event.Note.AuthorName != "Ada" {
		t.Fatalf("unexpected note/event: %#v %#v", note, event)
	}
}

func TestUpdateDocumentPublishesEvent(t *testing.T) {
	store := &scheduledStore{
		fakeStore: &fakeStore{},
		interview: model.ScheduledInterview{
			ID: 9, Status: "scheduled", Attendees: []model.InterviewAttendee{{UserID: 1}},
		},
	}
	bus := eventbus.NewMemoryBus()
	events, err := bus.SubscribeInterviewEvents(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	interviews := NewScheduledInterviewService(store, bus)
	updated, err := interviews.UpdateDocument(context.Background(), 1, 9, "New agenda")
	if err != nil {
		t.Fatal(err)
	}
	event := <-events
	if updated.SharedDocument != "New agenda" || event.Type != "document.updated" ||
		event.InterviewID != 9 || event.SharedDocument != "New agenda" {
		t.Fatalf("unexpected document/event: %#v %#v", updated, event)
	}
}

func TestParticipantSubscriptionFiltersPrivateNotes(t *testing.T) {
	bus := eventbus.NewMemoryBus()
	interviews := NewScheduledInterviewService(&fakeStore{}, bus)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	events, err := interviews.SubscribeParticipant(ctx, "candidate-token")
	if err != nil {
		t.Fatal(err)
	}
	initial := <-events
	if initial.Type != "document.updated" {
		t.Fatalf("participant did not receive initial document snapshot: %#v", initial)
	}
	if err := bus.PublishInterviewEvent(ctx, eventbus.InterviewEvent{
		Type: "note.created", InterviewID: 0,
		Note: &eventbus.InterviewNoteEvent{ID: 4, Body: "private"},
	}); err != nil {
		t.Fatal(err)
	}
	if err := bus.PublishInterviewEvent(ctx, eventbus.InterviewEvent{
		Type: "document.updated", InterviewID: 0, SharedDocument: "candidate-safe",
	}); err != nil {
		t.Fatal(err)
	}
	select {
	case event := <-events:
		if event.Type != "document.updated" || event.SharedDocument != "candidate-safe" {
			t.Fatalf("participant received unexpected event: %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("participant did not receive document event")
	}
}

func TestUserCreationHashesPasswordAndUsesCoInterviewerRole(t *testing.T) {
	store := &fakeStore{}
	user, err := NewUserService(store).Create(context.Background(), " CO@Example.com ", "password1", " Ada ")
	if err != nil {
		t.Fatal(err)
	}
	if user.Email != "co@example.com" || user.DisplayName != "Ada" || user.Role != "co_interviewer" {
		t.Fatalf("unexpected user: %#v", user)
	}
	if user.PasswordHash != "" {
		t.Fatal("created user exposed password hash")
	}
	if !security.CheckPassword(store.createdUser.PasswordHash, "password1") {
		t.Fatal("password was not bcrypt hashed before persistence")
	}
}
