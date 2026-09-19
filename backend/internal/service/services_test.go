package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/danyel/go-guess/backend/internal/database/repository"
	"github.com/danyel/go-guess/backend/internal/service/model"
)

type fakeStore struct {
	job          model.JobPosting
	participants []model.Participant
	traits       []model.Trait
}

type invitationStore struct {
	*fakeStore
	interview   model.Interview
	invitations []model.Invitation
	saved       bool
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
