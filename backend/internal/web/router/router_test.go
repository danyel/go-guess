package router

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/danyel/go-guess/backend/internal/eventbus"
	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/service"
	"github.com/danyel/go-guess/backend/internal/service/model"
	"github.com/danyel/go-guess/backend/internal/web/handler"
	"github.com/danyel/go-loose/client"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const (
	testTenant = "ypto"
	testAPIKey = "gl_test_key_that_is_long_enough_for_client"
)

func init() {
	sql.Register("router-stub", stubDriver{})
}

func openStubDB(t *testing.T) *gorm.DB {
	t.Helper()
	sqlDB, err := sql.Open("router-stub", "")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{DisableAutomaticPing: true})
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func allowGoLoose(t *testing.T) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"allowed":true,"tenant_slug":"ypto","application_slug":"guess","api_key_name":"guess"}`))
	}))
	t.Cleanup(server.Close)
	t.Setenv("GO_LOOSE_BASE_URL", server.URL)
}

func newTestHandler(t *testing.T, interviews service.IScheduledInterviewService) *handler.Handler {
	t.Helper()
	if interviews == nil {
		interviews = interviewStub{}
	}
	return handler.New(
		openStubDB(t),
		authStub{}, jobStub{}, questionStub{}, participantStub{}, invitationStub{},
		userStub{}, interviews, 10, "http://localhost:5173",
	)
}

func withTenant(request *http.Request) {
	request.Header.Set(client.XTenantId, testTenant)
}

func withAPIKey(request *http.Request) {
	request.Header.Set(client.DefaultHeader, testAPIKey)
}

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
func (participantStub) Update(context.Context, model.Participant) (model.Participant, error) {
	return model.Participant{}, nil
}
func (participantStub) UpdateTraits(context.Context, uint) error { return nil }

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
func (invitationStub) SetOutcome(context.Context, uint, uint, string) (model.Invitation, error) {
	return model.Invitation{}, nil
}

type userStub struct{}

func (userStub) List(context.Context) ([]model.User, error) { return nil, nil }
func (userStub) Create(context.Context, string, string, string) (model.User, error) {
	return model.User{}, nil
}

type interviewStub struct{}

func (interviewStub) Create(
	context.Context, uint, uint, model.ScheduledInterview, []uint,
) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{}, nil
}
func (interviewStub) List(context.Context, uint, uint) ([]model.ScheduledInterview, error) {
	return nil, nil
}
func (interviewStub) Get(context.Context, uint, uint) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{}, nil
}
func (interviewStub) GetParticipantMeeting(context.Context, string) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{}, nil
}
func (interviewStub) UpdateStatus(context.Context, uint, uint, string) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{}, nil
}
func (interviewStub) UpdateDocument(context.Context, uint, uint, string) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{}, nil
}
func (interviewStub) ListNotes(context.Context, uint, uint) ([]model.InterviewNote, error) {
	return nil, nil
}
func (interviewStub) CreateNote(context.Context, uint, uint, string) (model.InterviewNote, error) {
	return model.InterviewNote{}, nil
}
func (interviewStub) ListInbox(context.Context, uint) ([]model.ScheduledInterview, error) {
	return nil, nil
}
func (interviewStub) UpdateInbox(context.Context, uint, uint, string) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{}, nil
}
func (interviewStub) ListCalendar(context.Context, uint) ([]model.ScheduledInterview, error) {
	return nil, nil
}
func (interviewStub) Subscribe(context.Context, uint, uint) (<-chan eventbus.InterviewEvent, error) {
	return make(chan eventbus.InterviewEvent), nil
}
func (interviewStub) SubscribeParticipant(context.Context, string) (<-chan eventbus.InterviewEvent, error) {
	return make(chan eventbus.InterviewEvent), nil
}

type interviewCapture struct {
	interviewStub
	userID uint
}

func (s *interviewCapture) Get(
	_ context.Context, userID, interviewID uint,
) (model.ScheduledInterview, error) {
	s.userID = userID
	return model.ScheduledInterview{
		ID: interviewID,
		Attendees: []model.InterviewAttendee{{
			ID: 3, UserID: userID, User: model.User{ID: userID, DisplayName: "Interviewer"},
		}},
	}, nil
}

func (s *interviewCapture) GetParticipantMeeting(
	context.Context, string,
) (model.ScheduledInterview, error) {
	return model.ScheduledInterview{
		ID: 4, JobID: 5, Job: model.JobPosting{Title: "Backend Engineer"},
		Participant:    model.Participant{FirstName: "Candidate", LastName: "Person", Email: "private@example.com"},
		SharedDocument: "candidate document",
	}, nil
}

func TestHealthDoesNotRequireAuthentication(t *testing.T) {
	tokens := security.NewTokenManager("01234567890123456789012345678901", time.Hour)
	router := New(newTestHandler(t, nil), tokens, "http://localhost:5173")
	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", response.Code)
	}
}

func TestProtectedRouteRequiresValidToken(t *testing.T) {
	allowGoLoose(t)
	tokens := security.NewTokenManager("01234567890123456789012345678901", time.Hour)
	router := New(newTestHandler(t, nil), tokens, "http://localhost:5173")

	unauthorizedRequest := httptest.NewRequest(http.MethodGet, "/api/jobs", nil)
	withTenant(unauthorizedRequest)
	withAPIKey(unauthorizedRequest)
	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, unauthorizedRequest)
	if unauthorized.Code != http.StatusUnauthorized || unauthorized.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("expected JSON 401, got %d %q %s", unauthorized.Code, unauthorized.Header().Get("Content-Type"), unauthorized.Body.String())
	}
	token, err := tokens.Issue(1, "interviewer@example.com", "interviewer")
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/api/jobs", nil)
	withTenant(request)
	withAPIKey(request)
	request.Header.Set("Authorization", "Bearer "+token)
	authorized := httptest.NewRecorder()
	router.ServeHTTP(authorized, request)
	if authorized.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d %s", authorized.Code, authorized.Body.String())
	}
}

func TestProtectedInterviewUsesAuthenticatedUserID(t *testing.T) {
	allowGoLoose(t)
	interviews := &interviewCapture{}
	tokens := security.NewTokenManager("01234567890123456789012345678901", time.Hour)
	api := New(newTestHandler(t, interviews), tokens, "http://localhost:5173")
	token, err := tokens.Issue(42, "co@example.com", "co_interviewer")
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/api/scheduled-interviews/9", nil)
	withTenant(request)
	withAPIKey(request)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	api.ServeHTTP(response, request)
	if response.Code != http.StatusOK || interviews.userID != 42 {
		t.Fatalf("expected authenticated user 42, got status=%d user=%d body=%s", response.Code, interviews.userID, response.Body.String())
	}
}

func TestParticipantMeetingDoesNotExposeInternalCandidateData(t *testing.T) {
	interviews := &interviewCapture{}
	api := New(
		newTestHandler(t, interviews),
		security.NewTokenManager("01234567890123456789012345678901", time.Hour),
		"http://localhost:5173",
	)
	request := httptest.NewRequest(http.MethodGet, "/api/participant-meetings/token", nil)
	withTenant(request)
	response := httptest.NewRecorder()
	api.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d %s", response.Code, response.Body.String())
	}
	body := response.Body.Bytes()
	if bytes.Contains(body, []byte("private@example.com")) ||
		bytes.Contains(body, []byte("referenceAnswer")) ||
		bytes.Contains(body, []byte("notes")) {
		t.Fatalf("public response leaked internal data: %s", body)
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil || payload["sharedDocument"] != "candidate document" {
		t.Fatalf("unexpected public response: %s", body)
	}
}

type stubDriver struct{}

func (stubDriver) Open(string) (driver.Conn, error) { return stubConn{}, nil }

type stubConn struct{}

func (stubConn) Prepare(string) (driver.Stmt, error) { return stubStmt{}, nil }
func (stubConn) Close() error                        { return nil }
func (stubConn) Begin() (driver.Tx, error)           { return stubTx{}, nil }
func (stubConn) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	return stubTx{}, nil
}
func (stubConn) ExecContext(context.Context, string, []driver.NamedValue) (driver.Result, error) {
	return driver.RowsAffected(0), nil
}
func (stubConn) QueryContext(context.Context, string, []driver.NamedValue) (driver.Rows, error) {
	return &stubRows{}, nil
}

type stubTx struct{}

func (stubTx) Commit() error   { return nil }
func (stubTx) Rollback() error { return nil }

type stubStmt struct{}

func (stubStmt) Close() error  { return nil }
func (stubStmt) NumInput() int { return -1 }
func (stubStmt) Exec([]driver.Value) (driver.Result, error) {
	return driver.RowsAffected(0), nil
}
func (stubStmt) Query([]driver.Value) (driver.Rows, error) { return &stubRows{}, nil }

type stubRows struct{}

func (stubRows) Columns() []string { return nil }
func (stubRows) Close() error      { return nil }
func (stubRows) Next([]driver.Value) error {
	return io.EOF
}
