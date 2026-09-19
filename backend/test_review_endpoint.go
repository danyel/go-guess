package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/service/model"
	"github.com/danyel/go-guess/backend/internal/web/handler"
	"github.com/danyel/go-guess/backend/internal/web/router"
)

type mockInvitationService struct{}

func (m mockInvitationService) List(ctx context.Context, jobID uint) ([]model.Invitation, error) {
	return []model.Invitation{{ID: 1}}, nil
}

func (m mockInvitationService) Create(ctx context.Context, jobID, participantID uint) (model.Invitation, error) {
	return model.Invitation{}, nil
}

func (m mockInvitationService) Review(ctx context.Context, jobID, invitationID uint) (model.Interview, error) {
	return model.Interview{
		Invitation: model.Invitation{ID: 1, ParticipantName: "Test", ParticipantEmail: "test@example.com", Status: "completed"},
		Job:        model.JobPosting{ID: 1, Title: "Job"},
		Answers:    map[uint]string{1: "My answer"},
	}, nil
}

func (m mockInvitationService) GetInterview(ctx context.Context, token string) (model.Interview, error) {
	return model.Interview{}, nil
}

func (m mockInvitationService) Accept(ctx context.Context, token string) (model.Interview, error) {
	return model.Interview{}, nil
}

func (m mockInvitationService) SaveAnswer(ctx context.Context, token string, questionID uint, answer string) error {
	return nil
}

func (m mockInvitationService) Finish(ctx context.Context, token string) (model.Interview, error) {
	return model.Interview{}, nil
}

type mockStubs struct{}

func (mockStubs) Login(context.Context, string, string) (string, model.User, error) {
	return "", model.User{}, nil
}

func (mockStubs) List(context.Context) ([]model.JobPosting, error) {
	return []model.JobPosting{}, nil
}
func (mockStubs) Get(context.Context, uint) (model.JobPosting, error) {
	return model.JobPosting{}, nil
}
func (mockStubs) Create(context.Context, model.JobPosting) (model.JobPosting, error) {
	return model.JobPosting{}, nil
}
func (mockStubs) Update(context.Context, uint, string, int) (model.JobPosting, error) {
	return model.JobPosting{}, nil
}
func (mockStubs) AttachQuestion(context.Context, uint, uint) error { return nil }
func (mockStubs) DetachQuestion(context.Context, uint, uint) error { return nil }
func (mockStubs) Candidates(context.Context, uint) ([]model.CandidateMatch, error) {
	return []model.CandidateMatch{}, nil
}

func (mockStubs) List2(context.Context) ([]model.Participant, error) { return nil, nil }
func (mockStubs) Get2(context.Context, uint) (model.Participant, error) {
	return model.Participant{}, nil
}
func (mockStubs) Create2(context.Context, model.Participant) (model.Participant, error) {
	return model.Participant{}, nil
}

func (mockStubs) List3(context.Context, string) ([]model.Question, error) { return nil, nil }
func (mockStubs) Create3(context.Context, model.Question) (model.Question, error) {
	return model.Question{}, nil
}
func (mockStubs) Update3(context.Context, uint, model.Question) (model.Question, error) {
	return model.Question{}, nil
}
func (mockStubs) SetDeprecated(context.Context, uint, bool) (model.Question, error) {
	return model.Question{}, nil
}

func TestReviewEndpoint(t *testing.T) {
	// Setup
	mockAuth := mockStubs{}
	mockJobs := mockStubs{}
	mockQuestions := mockStubs{}
	mockParticipants := mockStubs{}
	mockInvitations := mockInvitationService{}

	h := handler.New(mockAuth, mockJobs, mockQuestions, mockParticipants, mockInvitations, 10, "http://localhost:5173")
	tokens := security.NewTokenManager("01234567890123456789012345678901", time.Hour)
	r := router.New(h, tokens, "http://localhost:5173")

	// Create a valid token
	token, err := tokens.Issue(1, "test@example.com", "interviewer")
	if err != nil {
		t.Fatalf("Failed to create token: %v", err)
	}

	// Test the review endpoint
	req := httptest.NewRequest(http.MethodGet, "/api/jobs/1/invitations/1", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d. Response: %s", w.Code, w.Body.String())
	}

	if w.Header().Get("Content-Type") != "application/json" {
		t.Errorf("Expected JSON content type, got %s", w.Header().Get("Content-Type"))
	}
}
