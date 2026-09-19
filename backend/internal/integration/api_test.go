//go:build integration

package integration

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/pressly/goose/v3"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/danyel/go-guess/backend/internal/database/repository"
	"github.com/danyel/go-guess/backend/internal/database/seed"
	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/service"
	"github.com/danyel/go-guess/backend/internal/web/handler"
	webmodel "github.com/danyel/go-guess/backend/internal/web/model"
	"github.com/danyel/go-guess/backend/internal/web/router"
)

var testServer *httptest.Server

func TestMain(m *testing.M) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	container, err := tcpostgres.Run(
		ctx,
		"postgres:18-alpine",
		tcpostgres.WithDatabase("go_guess_test"),
		tcpostgres.WithUsername("go_guess"),
		tcpostgres.WithPassword("go_guess"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, "start PostgreSQL test container:", err)
		os.Exit(1)
	}

	databaseURL, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		fmt.Fprintln(os.Stderr, "get PostgreSQL connection string:", err)
		os.Exit(1)
	}
	sqlDB, err := sql.Open("pgx", databaseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open PostgreSQL:", err)
		_ = container.Terminate(context.Background())
		os.Exit(1)
	}

	if err := goose.SetDialect("postgres"); err != nil {
		fmt.Fprintln(os.Stderr, "set Goose dialect:", err)
		os.Exit(1)
	}
	_, filename, _, _ := runtime.Caller(0)
	migrations := filepath.Join(filepath.Dir(filename), "..", "..", "migrations")
	if err := goose.Up(sqlDB, migrations); err != nil {
		fmt.Fprintln(os.Stderr, "apply migrations:", err)
		os.Exit(1)
	}
	if err := seed.Apply(ctx, sqlDB, "test"); err != nil {
		fmt.Fprintln(os.Stderr, "apply test seed:", err)
		os.Exit(1)
	}
	if err := seed.Apply(ctx, sqlDB, "test"); err != nil {
		fmt.Fprintln(os.Stderr, "reapply idempotent test seed:", err)
		os.Exit(1)
	}

	gormDB, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		fmt.Fprintln(os.Stderr, "open GORM connection:", err)
		os.Exit(1)
	}
	store := repository.New(gormDB)
	tokens := security.NewTokenManager("integration-test-secret-at-least-32-bytes", time.Hour)
	invitations := service.NewInvitationService(store, "http://example.test")
	testServer = httptest.NewServer(router.New(
		handler.New(
			service.NewAuthService(store, tokens),
			service.NewJobService(store),
			service.NewQuestionService(store),
			service.NewParticipantService(store),
			invitations,
			10,
			"http://example.test",
		),
		tokens,
		"http://example.test",
	))

	code := m.Run()
	testServer.Close()
	_ = sqlDB.Close()
	cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 30*time.Second)
	_ = container.Terminate(cleanupCtx)
	cleanupCancel()
	os.Exit(code)
}

func TestCompleteInterviewWorkflow(t *testing.T) {
	var login webmodel.LoginResponse
	requestJSON(t, http.MethodPost, "/api/auth/login", "", map[string]any{
		"email": "integration@example.com", "password": "integration-password",
	}, http.StatusOK, &login)
	if login.Token == "" {
		t.Fatal("login did not return a token")
	}

	var participants []webmodel.ParticipantResponse
	requestJSON(t, http.MethodGet, "/api/participants", login.Token, nil, http.StatusOK, &participants)
	var participantID uint
	for _, participant := range participants {
		if participant.Email == "candidate.integration@example.com" {
			participantID = participant.ID
		}
	}
	if participantID == 0 {
		t.Fatal("test participant was not seeded")
	}

	var question webmodel.QuestionResponse
	requestJSON(t, http.MethodPost, "/api/questions", login.Token, map[string]any{
		"text": "Review this error handling.", "type": "code_review",
		"codeSnippet": "func run() error {\n  execute()\n  return nil\n}",
		"referenceAnswer": "Return the execute error.", "options": []string{},
	}, http.StatusCreated, &question)
	requestJSON(t, http.MethodPut, fmt.Sprintf("/api/questions/%d", question.ID), login.Token, map[string]any{
		"text": "Review this ignored error.", "type": "code_review",
		"codeSnippet": "func run() error {\n  execute()\n  return nil\n}",
		"referenceAnswer": "Propagate the execute error.", "options": []string{},
	}, http.StatusOK, &question)

	var jobs []webmodel.JobResponse
	requestJSON(t, http.MethodGet, "/api/jobs", login.Token, nil, http.StatusOK, &jobs)
	var jobID uint
	for _, job := range jobs {
		if job.Title == "Integration Backend Engineer" {
			jobID = job.ID
		}
	}
	if jobID == 0 {
		t.Fatal("test job was not seeded")
	}

	requestJSON(t, http.MethodPost,
		fmt.Sprintf("/api/jobs/%d/questions/%d", jobID, question.ID),
		login.Token, nil, http.StatusNoContent, nil)

	var matches []webmodel.CandidateResponse
	requestJSON(t, http.MethodGet, fmt.Sprintf("/api/jobs/%d/candidates", jobID),
		login.Token, nil, http.StatusOK, &matches)
	if len(matches) == 0 || matches[0].Participant.ID != participantID {
		t.Fatalf("seeded participant was not a candidate: %#v", matches)
	}

	var invitation webmodel.InvitationResponse
	requestJSON(t, http.MethodPost, fmt.Sprintf("/api/jobs/%d/invitations", jobID),
		login.Token, map[string]any{"participantId": participantID}, http.StatusCreated, &invitation)
	if invitation.Token == "" || invitation.ParticipantURL != "http://example.test/participant/"+invitation.Token {
		t.Fatalf("unexpected invitation: %#v", invitation)
	}

	var welcome webmodel.InterviewResponse
	publicBody := requestJSON(t, http.MethodGet, "/api/interviews/"+invitation.Token,
		"", nil, http.StatusOK, &welcome)
	if bytes.Contains(publicBody, []byte("referenceAnswer")) || welcome.Invitation.Status != "pending" {
		t.Fatalf("invalid public welcome response: %s", publicBody)
	}

	var started webmodel.InterviewResponse
	requestJSON(t, http.MethodPost, "/api/interviews/"+invitation.Token+"/accept",
		"", nil, http.StatusOK, &started)
	if started.Invitation.Status != "accepted" || started.Invitation.AcceptedAt == nil {
		t.Fatalf("interview was not accepted: %#v", started.Invitation)
	}

	answer := "The execute error must be returned to the caller."
	requestJSON(t, http.MethodPut,
		fmt.Sprintf("/api/interviews/%s/answers/%d", invitation.Token, question.ID),
		"", map[string]any{"answer": answer}, http.StatusNoContent, nil)
	requestJSON(t, http.MethodPost, "/api/interviews/"+invitation.Token+"/finish",
		"", nil, http.StatusOK, &started)
	if started.Invitation.Status != "completed" {
		t.Fatalf("interview was not completed: %#v", started.Invitation)
	}

	var review webmodel.InvitationReviewResponse
	requestJSON(t, http.MethodGet,
		fmt.Sprintf("/api/jobs/%d/invitations/%d", jobID, invitation.ID),
		login.Token, nil, http.StatusOK, &review)
	if review.Answers[question.ID] != answer {
		t.Fatalf("saved answer missing from review: %#v", review.Answers)
	}
	found := false
	for _, item := range review.Job.Questions {
		if item.ID == question.ID {
			found = item.ReferenceAnswer == "Propagate the execute error." && item.CodeSnippet != ""
		}
	}
	if !found {
		t.Fatalf("review did not include interviewer question context: %#v", review.Job.Questions)
	}
}

func requestJSON(
	t *testing.T,
	method string,
	path string,
	token string,
	body any,
	wantStatus int,
	target any,
) []byte {
	t.Helper()
	var requestBody io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		requestBody = bytes.NewReader(encoded)
	}
	request, err := http.NewRequest(method, testServer.URL+path, requestBody)
	if err != nil {
		t.Fatal(err)
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	content, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != wantStatus {
		t.Fatalf("%s %s: expected %d, got %d: %s", method, path, wantStatus, response.StatusCode, content)
	}
	if target != nil {
		if err := json.Unmarshal(content, target); err != nil {
			t.Fatalf("decode %s %s: %v: %s", method, path, err, content)
		}
	}
	return content
}
