package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/service"
	"github.com/danyel/go-guess/backend/internal/service/model"
	"github.com/danyel/go-guess/backend/internal/web/handler"
)

type authStub struct{}

func (authStub) Login(context.Context, string, string) (string, model.User, error) {
	return "", model.User{}, service.ErrInvalidCredentials
}

type jobStub struct{}

func (jobStub) List(context.Context) ([]model.JobPosting, error)    { return []model.JobPosting{}, nil }
func (jobStub) Get(context.Context, uint) (model.JobPosting, error) { return model.JobPosting{}, nil }
func (jobStub) Create(context.Context, model.JobPosting) (model.JobPosting, error) {
	return model.JobPosting{}, nil
}
func (jobStub) Update(context.Context, uint, string, int) (model.JobPosting, error) {
	return model.JobPosting{}, nil
}
func (jobStub) AttachQuestion(context.Context, uint, uint) error { return nil }
func (jobStub) DetachQuestion(context.Context, uint, uint) error { return nil }
func (jobStub) Candidates(context.Context, uint) ([]model.CandidateMatch, error) {
	return []model.CandidateMatch{}, nil
}

type participantStub struct{}

func (participantStub) List(context.Context) ([]model.Participant, error) { return nil, nil }
func (participantStub) Get(context.Context, uint) (model.Participant, error) {
	return model.Participant{}, nil
}
func (participantStub) Create(context.Context, model.Participant) (model.Participant, error) {
	return model.Participant{}, nil
}

type questionStub struct{}

func (questionStub) List(context.Context, string) ([]model.Question, error) { return nil, nil }
func (questionStub) Create(context.Context, model.Question) (model.Question, error) {
	return model.Question{}, nil
}
func (questionStub) Update(context.Context, uint, model.Question) (model.Question, error) {
	return model.Question{}, nil
}
func (questionStub) SetDeprecated(context.Context, uint, bool) (model.Question, error) {
	return model.Question{}, nil
}

type invitationStub struct{}

func (invitationStub) List(context.Context, uint) ([]model.Invitation, error) { return nil, nil }
func (invitationStub) Create(context.Context, uint, uint) (model.Invitation, error) {
	return model.Invitation{}, nil
}
func (invitationStub) Review(context.Context, uint, uint) (model.Interview, error) {
	return model.Interview{}, nil
}
func (invitationStub) GetInterview(context.Context, string) (model.Interview, error) {
	return model.Interview{}, nil
}
func (invitationStub) Accept(context.Context, string) (model.Interview, error) {
	return model.Interview{}, nil
}
func (invitationStub) SaveAnswer(context.Context, string, uint, string) error { return nil }
func (invitationStub) Finish(context.Context, string) (model.Interview, error) {
	return model.Interview{}, nil
}

func TestHealthDoesNotRequireAuthentication(t *testing.T) {
	h := handler.New(authStub{}, jobStub{}, questionStub{}, participantStub{}, invitationStub{}, 10, "http://localhost:5173")
	tokens := security.NewTokenManager("01234567890123456789012345678901", time.Hour)
	router := New(h, tokens, "http://localhost:5173")
	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", response.Code)
	}
}

func TestProtectedRouteRequiresValidToken(t *testing.T) {
	h := handler.New(authStub{}, jobStub{}, questionStub{}, participantStub{}, invitationStub{}, 10, "http://localhost:5173")
	tokens := security.NewTokenManager("01234567890123456789012345678901", time.Hour)
	router := New(h, tokens, "http://localhost:5173")

	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/jobs", nil))
	if unauthorized.Code != http.StatusUnauthorized || unauthorized.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("expected JSON 401, got %d %q", unauthorized.Code, unauthorized.Header().Get("Content-Type"))
	}

	token, err := tokens.Issue(1, "interviewer@example.com", "interviewer")
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/api/jobs", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	authorized := httptest.NewRecorder()
	router.ServeHTTP(authorized, request)
	if authorized.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", authorized.Code)
	}
}
