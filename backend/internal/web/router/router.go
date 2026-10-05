package router

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/danyel/go-guess/backend/internal/eventbus"
	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/web/handler"
	mw "github.com/danyel/go-guess/backend/internal/web/middleware"
	webmodel "github.com/danyel/go-guess/backend/internal/web/model"
	"github.com/danyel/go-guess/backend/internal/web/openapi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func New(h *handler.Handler, tokens security.ITokenManager, frontendURL string) http.Handler {
	router := chi.NewRouter()
	spec := openapi.New()
	router.Use(middleware.RequestID, middleware.RealIP, middleware.Recoverer, middleware.Compress(5))
	router.Use(cors(frontendURL, h.AppDomain()))
	router.Use(mw.TenantSchemaMiddleware(h.Db(), h.AppDomain()))
	router.Use(middleware.Timeout(2 * time.Minute))
	register(router, spec, false, http.MethodGet, "/api/openapi.json", spec.ServeHTTP,
		openapi.Operation{Summary: "Get the current OpenAPI contract", Response: map[string]any{}, NoTenant: true})
	register(router, spec, false, http.MethodGet, "/api/health", h.Health,
		openapi.Operation{Summary: "Check API health", Response: map[string]string{}, NoTenant: true})
	register(router, spec, false, http.MethodGet, "/api/auth/login", h.BeginExternalLogin,
		openapi.Operation{Summary: "Start Go Loose browser authentication", NoTenant: true})
	register(router, spec, false, http.MethodGet, "/api/auth/callback", h.CompleteExternalLogin,
		openapi.Operation{Summary: "Complete Go Loose browser authentication", NoTenant: true})
	register(router, spec, false, http.MethodGet, "/api/auth/logout", h.ExternalLogout,
		openapi.Operation{Summary: "End the Go Loose browser session", NoTenant: true})
	register(router, spec, false, http.MethodPost, "/api/auth/logout", h.ExternalLogout,
		openapi.Operation{Summary: "End the Go Loose browser session", NoTenant: true})
	register(router, spec, false, http.MethodGet, "/api/auth/session", h.ExternalSession,
		openapi.Operation{Summary: "Exchange a Go Loose browser session for an API token", Response: webmodel.LoginResponse{}, NoTenant: true})
	register(router, spec, false, http.MethodPost, "/api/auth/login", h.Login,
		openapi.Operation{Summary: "Authenticate an interviewer", Request: webmodel.LoginRequest{}, Response: webmodel.LoginResponse{}})
	register(router, spec, false, http.MethodGet, "/api/interviews/{token}", h.GetInterview,
		openapi.Operation{Summary: "Get a participant assessment", Response: webmodel.InterviewResponse{}})
	register(router, spec, false, http.MethodPost, "/api/interviews/{token}/accept", h.AcceptInterview,
		openapi.Operation{Summary: "Accept a participant assessment", Response: webmodel.InterviewResponse{}})
	register(router, spec, false, http.MethodPut, "/api/interviews/{token}/answers/{questionId}", h.SaveAnswer,
		openapi.Operation{Summary: "Save a participant answer", Request: webmodel.AnswerRequest{}, SuccessStatus: http.StatusNoContent})
	register(router, spec, false, http.MethodPost, "/api/interviews/{token}/finish", h.FinishInterview,
		openapi.Operation{Summary: "Finish a participant assessment", Response: webmodel.InterviewResponse{}})
	register(router, spec, false, http.MethodGet, "/api/participant-meetings/{token}", h.GetParticipantMeeting,
		openapi.Operation{Summary: "Get a participant meeting", Response: webmodel.ParticipantMeetingResponse{}})
	register(router, spec, false, http.MethodGet, "/api/participant-meetings/{token}/events", h.ParticipantMeetingEvents,
		openapi.Operation{Summary: "Stream participant meeting events", Response: eventbus.InterviewEvent{}, ResponseContentType: "text/event-stream"})
	router.Group(func(protected chi.Router) {
		protected.Use(authenticate(tokens))
		register(protected, spec, true, http.MethodGet, "/api/jobs", h.ListJobs,
			openapi.Operation{Summary: "List job postings", Response: []webmodel.JobResponse{}})
		register(protected, spec, true, http.MethodPost, "/api/jobs", h.CreateJob,
			openapi.Operation{Summary: "Create a job posting", Request: webmodel.JobRequest{}, Response: webmodel.JobResponse{}, SuccessStatus: http.StatusCreated})
		register(protected, spec, true, http.MethodGet, "/api/jobs/{id}", h.GetJob,
			openapi.Operation{Summary: "Get a job posting", Response: webmodel.JobResponse{}})
		register(protected, spec, true, http.MethodPatch, "/api/jobs/{id}", h.UpdateJob,
			openapi.Operation{Summary: "Update job status and duration", Request: webmodel.JobStatusRequest{}, Response: webmodel.JobResponse{}})
		register(protected, spec, true, http.MethodPost, "/api/jobs/{id}/questions/{questionId}", h.AttachQuestion,
			openapi.Operation{Summary: "Attach a question to a job", SuccessStatus: http.StatusNoContent})
		register(protected, spec, true, http.MethodDelete, "/api/jobs/{id}/questions/{questionId}", h.DetachQuestion,
			openapi.Operation{Summary: "Detach a question from a job", SuccessStatus: http.StatusNoContent})
		register(protected, spec, true, http.MethodGet, "/api/jobs/{id}/candidates", h.Candidates,
			openapi.Operation{Summary: "List matching candidates", Response: []webmodel.CandidateResponse{}})
		register(protected, spec, true, http.MethodGet, "/api/jobs/{id}/invitations", h.ListInvitations,
			openapi.Operation{Summary: "List job invitations", Response: []webmodel.InvitationResponse{}})
		register(protected, spec, true, http.MethodPost, "/api/jobs/{id}/invitations", h.CreateInvitation,
			openapi.Operation{Summary: "Create a participant invitation", Request: webmodel.InvitationRequest{}, Response: webmodel.InvitationResponse{}, SuccessStatus: http.StatusCreated})
		register(protected, spec, true, http.MethodGet, "/api/jobs/{id}/invitations/{invitationId}", h.ReviewInvitation,
			openapi.Operation{Summary: "Review invitation answers", Response: webmodel.InvitationReviewResponse{}})
		register(protected, spec, true, http.MethodPatch, "/api/jobs/{id}/invitations/{invitationId}/outcome", h.SetInvitationOutcome,
			openapi.Operation{Summary: "Set an invitation outcome", Request: webmodel.InvitationOutcomeRequest{}, Response: webmodel.InvitationResponse{}})
		register(protected, spec, true, http.MethodGet, "/api/jobs/{id}/interviews", h.ListScheduledInterviews,
			openapi.Operation{Summary: "List scheduled job interviews", Response: []webmodel.ScheduledInterviewResponse{}})
		register(protected, spec, true, http.MethodPost, "/api/jobs/{id}/interviews", h.CreateScheduledInterview,
			openapi.Operation{Summary: "Schedule an interview", Request: webmodel.CreateScheduledInterviewRequest{}, Response: webmodel.ScheduledInterviewResponse{}, SuccessStatus: http.StatusCreated})
		register(protected, spec, true, http.MethodGet, "/api/scheduled-interviews/{id}", h.GetScheduledInterview,
			openapi.Operation{Summary: "Get a scheduled interview", Response: webmodel.ScheduledInterviewResponse{}})
		register(protected, spec, true, http.MethodPatch, "/api/scheduled-interviews/{id}/status", h.UpdateScheduledInterviewStatus,
			openapi.Operation{Summary: "Update interview status", Request: webmodel.InterviewStatusRequest{}, Response: webmodel.ScheduledInterviewResponse{}})
		register(protected, spec, true, http.MethodPatch, "/api/scheduled-interviews/{id}/document", h.UpdateScheduledInterviewDocument,
			openapi.Operation{Summary: "Update shared interview document", Request: webmodel.InterviewDocumentRequest{}, Response: webmodel.ScheduledInterviewResponse{}})
		register(protected, spec, true, http.MethodGet, "/api/scheduled-interviews/{id}/notes", h.ListInterviewNotes,
			openapi.Operation{Summary: "List interview notes", Response: []webmodel.InterviewNoteResponse{}})
		register(protected, spec, true, http.MethodPost, "/api/scheduled-interviews/{id}/notes", h.CreateInterviewNote,
			openapi.Operation{Summary: "Create an interview note", Request: webmodel.InterviewNoteRequest{}, Response: webmodel.InterviewNoteResponse{}, SuccessStatus: http.StatusCreated})
		register(protected, spec, true, http.MethodGet, "/api/scheduled-interviews/{id}/events", h.InterviewEvents,
			openapi.Operation{Summary: "Stream interview events", Response: eventbus.InterviewEvent{}, ResponseContentType: "text/event-stream"})
		register(protected, spec, true, http.MethodGet, "/api/users", h.ListUsers,
			openapi.Operation{Summary: "List interviewer users", Response: []webmodel.User{}})
		register(protected, spec, true, http.MethodPost, "/api/users", h.CreateUser,
			openapi.Operation{Summary: "Create an interviewer user", Request: webmodel.CreateUserRequest{}, Response: webmodel.User{}, SuccessStatus: http.StatusCreated})
		register(protected, spec, true, http.MethodGet, "/api/invitations", h.ListInbox,
			openapi.Operation{Summary: "List interviewer invitations", Response: []webmodel.ScheduledInterviewResponse{}})
		register(protected, spec, true, http.MethodPatch, "/api/invitations/{id}", h.UpdateInbox,
			openapi.Operation{Summary: "Respond to an interviewer invitation", Request: webmodel.AttendeeStatusRequest{}, Response: webmodel.ScheduledInterviewResponse{}})
		register(protected, spec, true, http.MethodGet, "/api/schedule", h.ListCalendar,
			openapi.Operation{Summary: "List accepted interview schedule", Response: []webmodel.ScheduledInterviewResponse{}})
		register(protected, spec, true, http.MethodGet, "/api/questions", h.ListQuestions,
			openapi.Operation{Summary: "List questions", Response: []webmodel.QuestionResponse{}, QueryParameters: []string{"search"}})
		register(protected, spec, true, http.MethodPost, "/api/questions", h.CreateQuestion,
			openapi.Operation{Summary: "Create a question", Request: webmodel.QuestionRequest{}, Response: webmodel.QuestionResponse{}, SuccessStatus: http.StatusCreated})
		register(protected, spec, true, http.MethodPut, "/api/questions/{id}", h.UpdateQuestion,
			openapi.Operation{Summary: "Update a question", Request: webmodel.QuestionRequest{}, Response: webmodel.QuestionResponse{}})
		register(protected, spec, true, http.MethodPatch, "/api/questions/{id}", h.SetQuestionDeprecated,
			openapi.Operation{Summary: "Change question deprecation", Request: webmodel.QuestionStatusRequest{}, Response: webmodel.QuestionResponse{}})
		register(protected, spec, true, http.MethodGet, "/api/participants", h.ListParticipants,
			openapi.Operation{Summary: "List participants", Response: []webmodel.ParticipantResponse{}})
		register(protected, spec, true, http.MethodPost, "/api/participants", h.CreateParticipant,
			openapi.Operation{Summary: "Create a participant", Request: openapi.ParticipantForm{}, Response: webmodel.ParticipantResponse{}, SuccessStatus: http.StatusCreated, RequestContentType: "multipart/form-data"})
		register(protected, spec, true, http.MethodGet, "/api/participants/{id}", h.GetParticipant,
			openapi.Operation{Summary: "Get a participant", Response: webmodel.ParticipantResponse{}})
		register(protected, spec, true, http.MethodPut, "/api/participants/{id}/cv", h.UpdateParticipantCV,
			openapi.Operation{Summary: "Replace a participant CV", Request: openapi.CVForm{}, Response: webmodel.ParticipantResponse{}, RequestContentType: "multipart/form-data"})
		register(protected, spec, true, http.MethodGet, "/api/participants/{id}/photo", h.ParticipantPhoto,
			openapi.Operation{Summary: "Download a participant photo", Response: []byte{}, ResponseContentType: "application/octet-stream"})
		register(protected, spec, true, http.MethodGet, "/api/participants/{id}/cv", h.ParticipantCV,
			openapi.Operation{Summary: "Download a participant CV", Response: []byte{}, ResponseContentType: "application/octet-stream"})
	})
	return router
}

func register(
	router chi.Router,
	spec *openapi.Builder,
	protected bool,
	method, path string,
	handler http.HandlerFunc,
	operation openapi.Operation,
) {
	operation.Protected = protected
	spec.Add(method, path, operation)
	router.MethodFunc(method, path, handler)
}

func writeUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func authenticate(tokens security.ITokenManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			scheme, raw, ok := strings.Cut(r.Header.Get("Authorization"), " ")
			if !ok || !strings.EqualFold(scheme, "Bearer") {
				writeUnauthorized(w, "missing bearer token")
				return
			}
			claims, err := tokens.Parse(raw)
			if err != nil {
				writeUnauthorized(w, "invalid bearer token")
				return
			}

			next.ServeHTTP(w, r.WithContext(security.WithClaims(r.Context(), claims)))
		})
	}
}

func cors(origin, appDomain string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestOrigin := r.Header.Get("Origin")
			if allowedCORSOrigin(requestOrigin, origin, appDomain) {
				w.Header().Set("Access-Control-Allow-Origin", requestOrigin)
			}
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key, X-Tenant-Id")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Add("Vary", "Origin")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// allowedCORSOrigin accepts the configured frontend origin plus any tenant host
// of the configured application domain, which is what the Vite dev server on
// http://<tenant>.<appDomain>:5173 sends. *.guess.local stays allowed for the
// offline BDD and local password-only setups.
func allowedCORSOrigin(requestOrigin, configuredOrigin, appDomain string) bool {
	if requestOrigin == "" {
		return false
	}
	if requestOrigin == configuredOrigin {
		return true
	}
	parsed, err := url.Parse(requestOrigin)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return false
	}
	hostname := strings.ToLower(parsed.Hostname())
	for _, suffix := range []string{"." + appDomain, ".guess.local"} {
		if suffix != "." && strings.HasSuffix(hostname, suffix) {
			return true
		}
	}
	return false
}
