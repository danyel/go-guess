package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/danyel/go-guess/backend/internal/database/repository"
	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/service/model"
	"github.com/google/uuid"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrInvalidQuestion    = errors.New("invalid question")
	ErrValidation         = errors.New("validation failed")
	ErrInvalidState       = errors.New("operation is not allowed in the current state")
)

const CandidateThreshold = 60.0

type IAuthService interface {
	Login(context.Context, string, string) (string, model.User, error)
}

type IJobService interface {
	List(context.Context) ([]model.JobPosting, error)
	Get(context.Context, uint) (model.JobPosting, error)
	Create(context.Context, model.JobPosting) (model.JobPosting, error)
	Update(context.Context, uint, string, int) (model.JobPosting, error)
	AttachQuestion(context.Context, uint, uint) error
	DetachQuestion(context.Context, uint, uint) error
	Candidates(context.Context, uint) ([]model.CandidateMatch, error)
}

type IQuestionService interface {
	List(context.Context, string) ([]model.Question, error)
	Create(context.Context, model.Question) (model.Question, error)
	Update(context.Context, uint, model.Question) (model.Question, error)
	SetDeprecated(context.Context, uint, bool) (model.Question, error)
}

type IParticipantService interface {
	List(context.Context) ([]model.Participant, error)
	Get(context.Context, uint) (model.Participant, error)
	Create(context.Context, model.Participant) (model.Participant, error)
}

type IInvitationService interface {
	List(context.Context, uint) ([]model.Invitation, error)
	Create(context.Context, uint, uint) (model.Invitation, error)
	GetInterview(context.Context, string) (model.Interview, error)
	Accept(context.Context, string) (model.Interview, error)
	SaveAnswer(context.Context, string, uint, string) error
	Finish(context.Context, string) (model.Interview, error)
}

type AuthService struct {
	store  repository.IStore
	tokens security.ITokenManager
}

func NewAuthService(store repository.IStore, tokens security.ITokenManager) *AuthService {
	return &AuthService{store: store, tokens: tokens}
}

func (s *AuthService) Login(ctx context.Context, email, password string) (string, model.User, error) {
	user, err := s.store.FindUserByEmail(ctx, strings.TrimSpace(email))
	if err != nil || !security.CheckPassword(user.PasswordHash, password) {
		return "", model.User{}, ErrInvalidCredentials
	}
	token, err := s.tokens.Issue(user.ID, user.Email, user.Role)
	if err != nil {
		return "", model.User{}, err
	}
	user.PasswordHash = ""
	return token, user, nil
}

type JobService struct {
	store repository.IStore
}

func NewJobService(store repository.IStore) *JobService {
	return &JobService{store: store}
}

func (s *JobService) List(ctx context.Context) ([]model.JobPosting, error) {
	return s.store.ListJobs(ctx)
}

func (s *JobService) Get(ctx context.Context, id uint) (model.JobPosting, error) {
	return s.store.GetJob(ctx, id)
}

func (s *JobService) Create(ctx context.Context, value model.JobPosting) (model.JobPosting, error) {
	value.Title = strings.TrimSpace(value.Title)
	value.Description = strings.TrimSpace(value.Description)
	value.Position = strings.TrimSpace(value.Position)
	value.Seniority = strings.TrimSpace(value.Seniority)
	if value.Title == "" || value.Description == "" || value.Position == "" || value.Seniority == "" {
		return model.JobPosting{}, fmt.Errorf("%w: title, description, position, and seniority are required", ErrValidation)
	}
	value.Status = "draft"
	if value.DurationMinutes == 0 {
		value.DurationMinutes = 60
	}
	if value.DurationMinutes < 1 || value.DurationMinutes > 480 {
		return model.JobPosting{}, fmt.Errorf("%w: duration must be between 1 and 480 minutes", ErrValidation)
	}
	return s.store.CreateJob(ctx, value)
}

func (s *JobService) Update(ctx context.Context, id uint, status string, durationMinutes int) (model.JobPosting, error) {
	if !validJobStatus(status) {
		return model.JobPosting{}, fmt.Errorf("%w: unsupported job status", ErrValidation)
	}
	if durationMinutes < 1 || durationMinutes > 480 {
		return model.JobPosting{}, fmt.Errorf("%w: duration must be between 1 and 480 minutes", ErrValidation)
	}
	if status == "published" {
		job, err := s.store.GetJob(ctx, id)
		if err != nil {
			return model.JobPosting{}, err
		}
		if len(job.Questions) == 0 {
			return model.JobPosting{}, fmt.Errorf("%w: a published job requires at least one question", ErrInvalidState)
		}
	}
	return s.store.UpdateJob(ctx, id, status, durationMinutes)
}

func (s *JobService) AttachQuestion(ctx context.Context, jobID, questionID uint) error {
	question, err := s.store.GetQuestion(ctx, questionID)
	if err != nil {
		return err
	}
	if question.Deprecated {
		return fmt.Errorf("%w: deprecated questions cannot be newly attached", ErrInvalidState)
	}
	return s.store.AttachQuestion(ctx, jobID, questionID)
}

func (s *JobService) DetachQuestion(ctx context.Context, jobID, questionID uint) error {
	return s.store.DetachQuestion(ctx, jobID, questionID)
}

type QuestionService struct {
	store repository.IStore
}

func NewQuestionService(store repository.IStore) *QuestionService {
	return &QuestionService{store: store}
}

func (s *QuestionService) List(ctx context.Context, search string) ([]model.Question, error) {
	return s.store.ListQuestions(ctx, search)
}

func (s *QuestionService) Create(ctx context.Context, value model.Question) (model.Question, error) {
	value, err := validateQuestion(value)
	if err != nil {
		return model.Question{}, err
	}
	return s.store.CreateQuestion(ctx, value)
}

func (s *QuestionService) Update(ctx context.Context, id uint, value model.Question) (model.Question, error) {
	value, err := validateQuestion(value)
	if err != nil {
		return model.Question{}, err
	}
	return s.store.UpdateQuestion(ctx, id, value)
}

func validateQuestion(value model.Question) (model.Question, error) {
	value.Text = strings.TrimSpace(value.Text)
	value.ReferenceAnswer = strings.TrimSpace(value.ReferenceAnswer)
	switch value.Type {
	case "open", "multiple_choice", "radio", "code_review":
	default:
		return model.Question{}, fmt.Errorf("%w: unsupported type", ErrInvalidQuestion)
	}
	if value.Text == "" {
		return model.Question{}, fmt.Errorf("%w: text is required", ErrInvalidQuestion)
	}
	options := make([]string, 0, len(value.Options))
	for _, option := range value.Options {
		if option = strings.TrimSpace(option); option != "" {
			options = append(options, option)
		}
	}
	value.Options = options
	if (value.Type == "multiple_choice" || value.Type == "radio") && len(value.Options) < 2 {
		return model.Question{}, fmt.Errorf("%w: at least two options are required", ErrInvalidQuestion)
	}
	if (value.Type == "open" || value.Type == "code_review") && value.ReferenceAnswer == "" {
		return model.Question{}, fmt.Errorf("%w: a reference answer is required", ErrInvalidQuestion)
	}
	if value.Type == "open" || value.Type == "code_review" {
		value.Options = nil
	} else {
		value.ReferenceAnswer = ""
	}
	return value, nil
}

func (s *QuestionService) SetDeprecated(ctx context.Context, id uint, deprecated bool) (model.Question, error) {
	return s.store.SetQuestionDeprecated(ctx, id, deprecated)
}

func (s *JobService) Candidates(ctx context.Context, jobID uint) ([]model.CandidateMatch, error) {
	job, err := s.store.GetJob(ctx, jobID)
	if err != nil {
		return nil, err
	}
	participants, err := s.store.ListParticipants(ctx)
	if err != nil {
		return nil, err
	}
	required := uniqueTraits(job.Labels, job.RequiredSkills, job.AdditionalSkills)
	if len(required) == 0 {
		return []model.CandidateMatch{}, nil
	}
	result := make([]model.CandidateMatch, 0)
	for _, participant := range participants {
		owned := make(map[string]struct{}, len(participant.Traits))
		for _, trait := range participant.Traits {
			owned[normalize(trait.Name)] = struct{}{}
		}
		text, err := extractCVText(participant.CVFilename, participant.CV)
		if err != nil {
			return nil, fmt.Errorf("extract participant %d CV text: %w", participant.ID, err)
		}
		for name := range required {
			if containsTerm(normalize(text), name) {
				owned[name] = struct{}{}
			}
		}
		match := model.CandidateMatch{Participant: participant}
		for name, display := range required {
			if _, ok := owned[name]; ok {
				match.Matched = append(match.Matched, display)
			} else {
				match.Missing = append(match.Missing, display)
			}
		}
		match.Score = math.Round(float64(len(match.Matched))/float64(len(required))*1000) / 10
		if match.Score >= CandidateThreshold {
			sort.Strings(match.Matched)
			sort.Strings(match.Missing)
			result = append(result, match)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Score > result[j].Score })
	return result, nil
}

type ParticipantService struct {
	store repository.IStore
}

func NewParticipantService(store repository.IStore) *ParticipantService {
	return &ParticipantService{store: store}
}

func (s *ParticipantService) List(ctx context.Context) ([]model.Participant, error) {
	return s.store.ListParticipants(ctx)
}

func (s *ParticipantService) Get(ctx context.Context, id uint) (model.Participant, error) {
	return s.store.GetParticipant(ctx, id)
}

func (s *ParticipantService) Create(ctx context.Context, value model.Participant) (model.Participant, error) {
	value.FirstName = strings.TrimSpace(value.FirstName)
	value.LastName = strings.TrimSpace(value.LastName)
	value.Email = strings.ToLower(strings.TrimSpace(value.Email))
	if value.FirstName == "" || value.LastName == "" || value.Email == "" {
		return model.Participant{}, fmt.Errorf("%w: first name, last name, and email are required", ErrValidation)
	}
	allTraits, err := s.store.AllTraits(ctx)
	if err != nil {
		return model.Participant{}, err
	}
	text, err := extractCVText(value.CVFilename, value.CV)
	if err != nil {
		return model.Participant{}, fmt.Errorf("%w: extract CV text: %v", ErrValidation, err)
	}
	value.Traits = extractTraits(text, allTraits)
	return s.store.CreateParticipant(ctx, value)
}

func extractTraits(content string, traits []model.Trait) []model.Trait {
	text := normalize(content)
	result := make([]model.Trait, 0)
	for _, trait := range traits {
		name := normalize(trait.Name)
		if name != "" && containsTerm(text, name) {
			result = append(result, trait)
		}
	}
	return result
}

func containsTerm(text, term string) bool {
	return strings.Contains(" "+text+" ", " "+term+" ")
}

func uniqueTraits(groups ...[]model.Trait) map[string]string {
	result := make(map[string]string)
	for _, group := range groups {
		for _, trait := range group {
			if name := normalize(trait.Name); name != "" {
				result[name] = trait.Name
			}
		}
	}
	return result
}

func normalize(value string) string {
	return strings.Join(strings.FieldsFunc(strings.ToLower(value), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r) && r != '+' && r != '#'
	}), " ")
}

type InvitationService struct {
	store       repository.IStore
	frontendURL string
	now         func() time.Time
}

func NewInvitationService(store repository.IStore, frontendURL string) *InvitationService {
	return &InvitationService{store: store, frontendURL: strings.TrimRight(frontendURL, "/"), now: time.Now}
}

func (s *InvitationService) List(ctx context.Context, jobID uint) ([]model.Invitation, error) {
	return s.store.ListInvitations(ctx, jobID)
}

func (s *InvitationService) Create(ctx context.Context, jobID, participantID uint) (model.Invitation, error) {
	job, err := s.store.GetJob(ctx, jobID)
	if err != nil {
		return model.Invitation{}, err
	}
	if job.Status != "published" {
		return model.Invitation{}, fmt.Errorf("%w: invitations require a published job", ErrInvalidState)
	}
	if _, err := s.store.GetParticipant(ctx, participantID); err != nil {
		return model.Invitation{}, err
	}
	matches, err := NewJobService(s.store).Candidates(ctx, jobID)
	if err != nil {
		return model.Invitation{}, err
	}
	eligible := false
	for _, match := range matches {
		if match.Participant.ID == participantID {
			eligible = true
			break
		}
	}
	if !eligible {
		return model.Invitation{}, fmt.Errorf("%w: participant does not meet the %.0f%% threshold", ErrInvalidState, CandidateThreshold)
	}
	return s.store.CreateInvitation(ctx, model.Invitation{
		JobID: jobID, ParticipantID: participantID, Token: uuid.NewString(),
		Status: "pending", DurationMinutes: job.DurationMinutes,
	})
}

func (s *InvitationService) GetInterview(ctx context.Context, token string) (model.Interview, error) {
	interview, err := s.store.GetInterview(ctx, token)
	if err != nil {
		return model.Interview{}, err
	}
	if interview.Job.Status != "published" && interview.Invitation.Status == "pending" {
		return model.Interview{}, ErrNotAvailable
	}
	interview.Job.DurationMinutes = interview.Invitation.DurationMinutes
	return interview, nil
}

var ErrNotAvailable = errors.New("interview is not available")

func (s *InvitationService) Accept(ctx context.Context, token string) (model.Interview, error) {
	interview, err := s.GetInterview(ctx, token)
	if err != nil {
		return model.Interview{}, err
	}
	if interview.Invitation.Status != "pending" {
		return model.Interview{}, ErrInvalidState
	}
	if err := s.store.AcceptInvitation(ctx, token, s.now()); err != nil {
		return model.Interview{}, err
	}
	return s.GetInterview(ctx, token)
}

func (s *InvitationService) SaveAnswer(ctx context.Context, token string, questionID uint, answer string) error {
	interview, err := s.GetInterview(ctx, token)
	if err != nil {
		return err
	}
	if interview.Invitation.Status != "accepted" || interviewExpired(interview, s.now()) {
		return ErrInvalidState
	}
	found := false
	for _, question := range interview.Job.Questions {
		if question.ID == questionID {
			found = true
			break
		}
	}
	if !found {
		return repository.ErrNotFound
	}
	return s.store.SaveAnswer(ctx, token, questionID, strings.TrimSpace(answer))
}

func (s *InvitationService) Finish(ctx context.Context, token string) (model.Interview, error) {
	interview, err := s.GetInterview(ctx, token)
	if err != nil {
		return model.Interview{}, err
	}
	if interview.Invitation.Status != "accepted" {
		return model.Interview{}, ErrInvalidState
	}
	if err := s.store.CompleteInvitation(ctx, token, s.now()); err != nil {
		return model.Interview{}, err
	}
	return s.GetInterview(ctx, token)
}

func interviewExpired(interview model.Interview, now time.Time) bool {
	return interview.Invitation.AcceptedAt != nil &&
		!now.Before(interview.Invitation.AcceptedAt.Add(time.Duration(interview.Job.DurationMinutes)*time.Minute))
}

func validJobStatus(status string) bool {
	switch status {
	case "draft", "published", "deprecated":
		return true
	default:
		return false
	}
}
