//go:build integration

package integration

import (
	"bufio"
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
	"strings"
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
	"github.com/danyel/go-guess/backend/internal/eventbus"
	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/service"
	"github.com/danyel/go-guess/backend/internal/web/handler"
	webmodel "github.com/danyel/go-guess/backend/internal/web/model"
	"github.com/danyel/go-guess/backend/internal/web/router"
)

var (
	testServer *httptest.Server
	testBus    eventbus.IEventBus
)

func TestMain(m *testing.M) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	rabbitContainer, err := testcontainers.Run(
		ctx,
		"rabbitmq:4-management-alpine",
		testcontainers.WithExposedPorts("5672/tcp"),
		testcontainers.WithEnv(map[string]string{
			"RABBITMQ_DEFAULT_USER": "go_guess",
			"RABBITMQ_DEFAULT_PASS": "go_guess",
		}),
		testcontainers.WithWaitStrategy(
			wait.ForListeningPort("5672/tcp").WithStartupTimeout(90*time.Second),
		),
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, "start RabbitMQ test container:", err)
		os.Exit(1)
	}

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
		_ = rabbitContainer.Terminate(context.Background())
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
	rabbitEndpoint, err := rabbitContainer.PortEndpoint(ctx, "5672/tcp", "amqp")
	if err != nil {
		fmt.Fprintln(os.Stderr, "get RabbitMQ endpoint:", err)
		os.Exit(1)
	}
	rabbitURL := strings.Replace(rabbitEndpoint, "amqp://", "amqp://go_guess:go_guess@", 1) + "/"
	amqpBus, err := eventbus.NewAMQPBus(rabbitURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "connect RabbitMQ:", err)
		os.Exit(1)
	}
	testBus = amqpBus
	interviews := service.NewScheduledInterviewService(store, testBus)
	testServer = httptest.NewServer(router.New(
		handler.New(
			service.NewAuthService(store, tokens),
			service.NewJobService(store),
			service.NewQuestionService(store),
			service.NewParticipantService(store),
			invitations,
			service.NewUserService(store),
			interviews,
			10,
			"http://example.test",
		),
		tokens,
		"http://example.test",
	))

	code := m.Run()
	testServer.Close()
	_ = amqpBus.Close()
	_ = sqlDB.Close()
	cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 30*time.Second)
	_ = container.Terminate(cleanupCtx)
	_ = rabbitContainer.Terminate(cleanupCtx)
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
		"codeSnippet":     "func run() error {\n  execute()\n  return nil\n}",
		"referenceAnswer": "Return the execute error.", "options": []string{},
	}, http.StatusCreated, &question)
	requestJSON(t, http.MethodPut, fmt.Sprintf("/api/questions/%d", question.ID), login.Token, map[string]any{
		"text": "Review this ignored error.", "type": "code_review",
		"codeSnippet":     "func run() error {\n  execute()\n  return nil\n}",
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

	requestJSON(t, http.MethodPatch,
		fmt.Sprintf("/api/jobs/%d/invitations/%d/outcome", jobID, invitation.ID),
		login.Token, map[string]any{"outcome": "passed"}, http.StatusOK, &invitation)
	if invitation.Outcome != "passed" {
		t.Fatalf("assessment outcome was not updated: %#v", invitation)
	}

	var coInterviewer webmodel.User
	requestJSON(t, http.MethodPost, "/api/users", login.Token, map[string]any{
		"email": "co.integration@example.com", "password": "integration-password",
		"displayName": "Co Interviewer",
	}, http.StatusCreated, &coInterviewer)
	if coInterviewer.Role != "co_interviewer" {
		t.Fatalf("unexpected co-interviewer: %#v", coInterviewer)
	}

	var scheduled webmodel.ScheduledInterviewResponse
	requestJSON(t, http.MethodPost, fmt.Sprintf("/api/jobs/%d/interviews", jobID),
		login.Token, map[string]any{
			"invitationId": invitation.ID, "startsAt": time.Now().Add(time.Hour),
			"location": "Meeting room", "interviewerIds": []uint{coInterviewer.ID},
			"sharedDocument": "Collaborative notes",
		}, http.StatusCreated, &scheduled)
	if scheduled.CandidateURL != "http://example.test/participant/meeting/"+scheduled.CandidateToken ||
		len(scheduled.Attendees) != 2 || scheduled.JobTitle == "" || scheduled.ParticipantName == "" {
		t.Fatalf("unexpected scheduled interview: %#v", scheduled)
	}

	var coLogin webmodel.LoginResponse
	requestJSON(t, http.MethodPost, "/api/auth/login", "", map[string]any{
		"email": "co.integration@example.com", "password": "integration-password",
	}, http.StatusOK, &coLogin)

	var inbox []webmodel.ScheduledInterviewResponse
	requestJSON(t, http.MethodGet, "/api/inbox", coLogin.Token, nil, http.StatusOK, &inbox)
	if len(inbox) != 1 || inbox[0].ID != scheduled.ID {
		t.Fatalf("scheduled interview missing from co-interviewer inbox: %#v", inbox)
	}
	requestJSON(t, http.MethodPatch, fmt.Sprintf("/api/inbox/%d", scheduled.ID),
		coLogin.Token, map[string]any{"status": "accepted"}, http.StatusOK, &scheduled)
	var calendar []webmodel.ScheduledInterviewResponse
	requestJSON(t, http.MethodGet, "/api/calendar", coLogin.Token, nil, http.StatusOK, &calendar)
	if len(calendar) != 1 || calendar[0].ID != scheduled.ID {
		t.Fatalf("accepted interview missing from calendar: %#v", calendar)
	}

	requestJSON(t, http.MethodPost, fmt.Sprintf("/api/scheduled-interviews/%d/notes", scheduled.ID),
		login.Token, map[string]any{"body": "Too early"}, http.StatusConflict, nil)
	requestJSON(t, http.MethodPatch, fmt.Sprintf("/api/scheduled-interviews/%d/status", scheduled.ID),
		login.Token, map[string]any{"status": "started"}, http.StatusOK, &scheduled)

	streamContext, cancelStream := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelStream()
	streamRequest, err := http.NewRequestWithContext(
		streamContext, http.MethodGet,
		testServer.URL+"/api/participant-meetings/"+scheduled.CandidateToken+"/events", nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	streamResponse, err := http.DefaultClient.Do(streamRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer streamResponse.Body.Close()
	if streamResponse.StatusCode != http.StatusOK {
		t.Fatalf("candidate event stream returned %d", streamResponse.StatusCode)
	}
	const updatedDocument = "Updated collaborative exercise"
	requestJSON(t, http.MethodPatch, fmt.Sprintf("/api/scheduled-interviews/%d/document", scheduled.ID),
		login.Token, map[string]any{"sharedDocument": updatedDocument}, http.StatusOK, &scheduled)
	var documentEvent eventbus.InterviewEvent
	scanner := bufio.NewScanner(streamResponse.Body)
	for scanner.Scan() {
		if strings.HasPrefix(scanner.Text(), "data: ") {
			if err := json.Unmarshal([]byte(strings.TrimPrefix(scanner.Text(), "data: ")), &documentEvent); err != nil {
				t.Fatal(err)
			}
			if documentEvent.Type == "document.updated" &&
				documentEvent.SharedDocument == updatedDocument {
				break
			}
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatal(err)
	}
	if documentEvent.Type != "document.updated" ||
		documentEvent.InterviewID != scheduled.ID ||
		documentEvent.SharedDocument != updatedDocument {
		t.Fatalf("candidate received unexpected document event: %#v", documentEvent)
	}

	subscriptionContext, cancelSubscriptions := context.WithCancel(context.Background())
	defer cancelSubscriptions()
	firstEvents, err := testBus.SubscribeInterviewEvents(subscriptionContext)
	if err != nil {
		t.Fatal(err)
	}
	secondEvents, err := testBus.SubscribeInterviewEvents(subscriptionContext)
	if err != nil {
		t.Fatal(err)
	}

	var note webmodel.InterviewNoteResponse
	requestJSON(t, http.MethodPost, fmt.Sprintf("/api/scheduled-interviews/%d/notes", scheduled.ID),
		coLogin.Token, map[string]any{"body": "Candidate explained the trade-offs clearly."},
		http.StatusCreated, &note)
	if note.AuthorUserID != coInterviewer.ID || note.AuthorName != "Co Interviewer" {
		t.Fatalf("unexpected note response: %#v", note)
	}
	for index, events := range []<-chan eventbus.InterviewEvent{firstEvents, secondEvents} {
		select {
		case received := <-events:
			if received.Type != "note.created" || received.Note == nil ||
				received.Note.ID != note.ID || received.Note.AuthorUserID != coInterviewer.ID {
				t.Fatalf("subscriber %d received unexpected RabbitMQ event: %#v", index+1, received)
			}
			encoded, err := json.Marshal(received)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Contains(encoded, []byte(`"id":`)) || bytes.Contains(encoded, []byte(`"noteId":`)) {
				t.Fatalf("subscriber %d received an incompatible note contract: %s", index+1, encoded)
			}
		case <-time.After(5 * time.Second):
			t.Fatalf("subscriber %d did not receive RabbitMQ note event", index+1)
		}
	}
	var notes []webmodel.InterviewNoteResponse
	requestJSON(t, http.MethodGet, fmt.Sprintf("/api/scheduled-interviews/%d/notes", scheduled.ID),
		login.Token, nil, http.StatusOK, &notes)
	if len(notes) != 1 || notes[0].Body != note.Body {
		t.Fatalf("persisted interview note missing: %#v", notes)
	}

	var meeting webmodel.ParticipantMeetingResponse
	body := requestJSON(t, http.MethodGet, "/api/participant-meetings/"+scheduled.CandidateToken,
		"", nil, http.StatusOK, &meeting)
	if meeting.SharedDocument != updatedDocument ||
		bytes.Contains(body, []byte("participantEmail")) ||
		bytes.Contains(body, []byte("referenceAnswer")) ||
		bytes.Contains(body, []byte(`"notes":`)) {
		t.Fatalf("invalid candidate-safe meeting response: %s", body)
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
