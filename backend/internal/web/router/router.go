package router

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/web/handler"
)

func New(h *handler.Handler, tokens security.ITokenManager, frontendURL string) http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.RequestID, middleware.RealIP, middleware.Recoverer, middleware.Compress(5))
	router.Use(cors(frontendURL))
	router.Get("/api/health", h.Health)
	router.Post("/api/auth/login", h.Login)
	router.Get("/api/interviews/{token}", h.GetInterview)
	router.Post("/api/interviews/{token}/accept", h.AcceptInterview)
	router.Put("/api/interviews/{token}/answers/{questionId}", h.SaveAnswer)
	router.Post("/api/interviews/{token}/finish", h.FinishInterview)
	router.Get("/api/participant-meetings/{token}", h.GetParticipantMeeting)
	router.Get("/api/participant-meetings/{token}/events", h.ParticipantMeetingEvents)
	router.Group(func(protected chi.Router) {
		protected.Use(authenticate(tokens))
		protected.Get("/api/jobs", h.ListJobs)
		protected.Post("/api/jobs", h.CreateJob)
		protected.Get("/api/jobs/{id}", h.GetJob)
		protected.Patch("/api/jobs/{id}", h.UpdateJob)
		protected.Post("/api/jobs/{id}/questions/{questionId}", h.AttachQuestion)
		protected.Delete("/api/jobs/{id}/questions/{questionId}", h.DetachQuestion)
		protected.Get("/api/jobs/{id}/candidates", h.Candidates)
		protected.Get("/api/jobs/{id}/invitations", h.ListInvitations)
		protected.Post("/api/jobs/{id}/invitations", h.CreateInvitation)
		protected.Get("/api/jobs/{id}/invitations/{invitationId}", h.ReviewInvitation)
		protected.Patch("/api/jobs/{id}/invitations/{invitationId}/outcome", h.SetInvitationOutcome)
		protected.Get("/api/jobs/{id}/interviews", h.ListScheduledInterviews)
		protected.Post("/api/jobs/{id}/interviews", h.CreateScheduledInterview)
		protected.Get("/api/scheduled-interviews/{id}", h.GetScheduledInterview)
		protected.Patch("/api/scheduled-interviews/{id}/status", h.UpdateScheduledInterviewStatus)
		protected.Patch("/api/scheduled-interviews/{id}/document", h.UpdateScheduledInterviewDocument)
		protected.Get("/api/scheduled-interviews/{id}/notes", h.ListInterviewNotes)
		protected.Post("/api/scheduled-interviews/{id}/notes", h.CreateInterviewNote)
		protected.Get("/api/scheduled-interviews/{id}/events", h.InterviewEvents)
		protected.Get("/api/users", h.ListUsers)
		protected.Post("/api/users", h.CreateUser)
		protected.Get("/api/invitations", h.ListInbox)
		protected.Patch("/api/invitations/{id}", h.UpdateInbox)
		protected.Get("/api/schedule", h.ListCalendar)
		protected.Get("/api/questions", h.ListQuestions)
		protected.Post("/api/questions", h.CreateQuestion)
		protected.Put("/api/questions/{id}", h.UpdateQuestion)
		protected.Patch("/api/questions/{id}", h.SetQuestionDeprecated)
		protected.Get("/api/participants", h.ListParticipants)
		protected.Post("/api/participants", h.CreateParticipant)
		protected.Get("/api/participants/{id}", h.GetParticipant)
		protected.Get("/api/participants/{id}/photo", h.ParticipantPhoto)
		protected.Get("/api/participants/{id}/cv", h.ParticipantCV)
	})
	return router
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

func cors(origin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
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
