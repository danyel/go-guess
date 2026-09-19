package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/danyel/go-guess/backend/internal/database/repository"
	"github.com/danyel/go-guess/backend/internal/service"
	servicemodel "github.com/danyel/go-guess/backend/internal/service/model"
	webmapper "github.com/danyel/go-guess/backend/internal/web/mapper"
	webmodel "github.com/danyel/go-guess/backend/internal/web/model"
)

type Handler struct {
	auth         service.IAuthService
	jobs         service.IJobService
	questions    service.IQuestionService
	participants service.IParticipantService
	invitations  service.IInvitationService
	maxUpload    int64
	frontendURL  string
}

func New(
	auth service.IAuthService,
	jobs service.IJobService,
	questions service.IQuestionService,
	participants service.IParticipantService,
	invitations service.IInvitationService,
	maxUploadMB int64,
	frontendURL string,
) *Handler {
	return &Handler{
		auth: auth, jobs: jobs, questions: questions, participants: participants,
		invitations: invitations, maxUpload: maxUploadMB << 20,
		frontendURL: strings.TrimRight(frontendURL, "/"),
	}
}

func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var request webmodel.LoginRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	token, user, err := h.auth.Login(r.Context(), request.Email, request.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			writeError(w, http.StatusUnauthorized, err)
			return
		}
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, webmodel.LoginResponse{
		Token: token, User: webmodel.User{ID: user.ID, Email: user.Email, Role: user.Role},
	})
}

func (h *Handler) ListJobs(w http.ResponseWriter, r *http.Request) {
	values, err := h.jobs.List(r.Context())
	if err != nil {
		internalError(w, r, err)
		return
	}
	response := make([]webmodel.JobResponse, len(values))
	for i, value := range values {
		response[i] = webmapper.JobToWeb(value)
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) GetJob(w http.ResponseWriter, r *http.Request) {
	value, err := h.jobs.Get(r.Context(), idParam(r))
	if handleServiceError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, webmapper.JobToWeb(value))
}

func (h *Handler) CreateJob(w http.ResponseWriter, r *http.Request) {
	var request webmodel.JobRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	value, err := h.jobs.Create(r.Context(), webmapper.JobToService(request))
	if err != nil {
		handleServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, webmapper.JobToWeb(value))
}

func (h *Handler) UpdateJob(w http.ResponseWriter, r *http.Request) {
	var request webmodel.JobStatusRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	value, err := h.jobs.Update(r.Context(), idParam(r), request.Status, request.DurationMinutes)
	if handleServiceError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, webmapper.JobToWeb(value))
}

func (h *Handler) ListQuestions(w http.ResponseWriter, r *http.Request) {
	values, err := h.questions.List(r.Context(), r.URL.Query().Get("search"))
	if err != nil {
		internalError(w, r, err)
		return
	}
	response := make([]webmodel.QuestionResponse, len(values))
	for i, value := range values {
		response[i] = webmapper.QuestionToWeb(value)
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) CreateQuestion(w http.ResponseWriter, r *http.Request) {
	var request webmodel.QuestionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	value, err := h.questions.Create(r.Context(), webmapper.QuestionToService(request))
	if err != nil {
		handleServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, webmapper.QuestionToWeb(value))
}

func (h *Handler) UpdateQuestion(w http.ResponseWriter, r *http.Request) {
	var request webmodel.QuestionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	value, err := h.questions.Update(r.Context(), idParam(r), webmapper.QuestionToService(request))
	if handleServiceError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, webmapper.QuestionToWeb(value))
}

func (h *Handler) SetQuestionDeprecated(w http.ResponseWriter, r *http.Request) {
	var request webmodel.QuestionStatusRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	value, err := h.questions.SetDeprecated(r.Context(), idParam(r), request.Deprecated)
	if handleServiceError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, webmapper.QuestionToWeb(value))
}

func (h *Handler) AttachQuestion(w http.ResponseWriter, r *http.Request) {
	if err := h.jobs.AttachQuestion(r.Context(), idParam(r), secondaryIDParam(r, "questionId")); handleServiceError(w, r, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DetachQuestion(w http.ResponseWriter, r *http.Request) {
	if err := h.jobs.DetachQuestion(r.Context(), idParam(r), secondaryIDParam(r, "questionId")); handleServiceError(w, r, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) Candidates(w http.ResponseWriter, r *http.Request) {
	values, err := h.jobs.Candidates(r.Context(), idParam(r))
	if handleServiceError(w, r, err) {
		return
	}
	response := make([]webmodel.CandidateResponse, len(values))
	for i, value := range values {
		response[i] = webmapper.CandidateToWeb(value)
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) ListParticipants(w http.ResponseWriter, r *http.Request) {
	values, err := h.participants.List(r.Context())
	if err != nil {
		internalError(w, r, err)
		return
	}
	response := make([]webmodel.ParticipantResponse, len(values))
	for i, value := range values {
		response[i] = webmapper.ParticipantToWeb(value)
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) GetParticipant(w http.ResponseWriter, r *http.Request) {
	value, err := h.participants.Get(r.Context(), idParam(r))
	if handleServiceError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, webmapper.ParticipantToWeb(value))
}

func (h *Handler) CreateParticipant(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUpload)
	if err := r.ParseMultipartForm(h.maxUpload); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid multipart form or upload too large"))
		return
	}
	participant := servicemodel.Participant{
		FirstName: r.FormValue("firstName"), LastName: r.FormValue("lastName"),
		Email: r.FormValue("email"), ContactInfo: r.FormValue("contactInfo"),
	}
	if raw := r.FormValue("birthday"); raw != "" {
		birthday, err := time.Parse("2006-01-02", raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Errorf("birthday must use YYYY-MM-DD"))
			return
		}
		participant.Birthday = &birthday
	}
	var err error
	participant.Photo, participant.PhotoType, _, err = readUpload(r, "photo")
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	participant.CV, _, participant.CVFilename, err = readUpload(r, "cv")
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	value, err := h.participants.Create(r.Context(), participant)
	if err != nil {
		handleServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, webmapper.ParticipantToWeb(value))
}

func (h *Handler) ParticipantPhoto(w http.ResponseWriter, r *http.Request) {
	value, err := h.participants.Get(r.Context(), idParam(r))
	if handleServiceError(w, r, err) {
		return
	}
	if len(value.Photo) == 0 {
		http.NotFound(w, r)
		return
	}
	contentType := value.PhotoType
	switch contentType {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
	default:
		contentType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(value.Photo)
}

func (h *Handler) ParticipantCV(w http.ResponseWriter, r *http.Request) {
	value, err := h.participants.Get(r.Context(), idParam(r))
	if handleServiceError(w, r, err) {
		return
	}
	if len(value.CV) == 0 {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", value.CVFilename))
	_, _ = w.Write(value.CV)
}

func (h *Handler) ListInvitations(w http.ResponseWriter, r *http.Request) {
	values, err := h.invitations.List(r.Context(), idParam(r))
	if err != nil {
		internalError(w, r, err)
		return
	}
	response := make([]webmodel.InvitationResponse, len(values))
	for i, value := range values {
		response[i] = webmapper.InvitationToWeb(value, h.frontendURL)
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) CreateInvitation(w http.ResponseWriter, r *http.Request) {
	var request webmodel.InvitationRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	value, err := h.invitations.Create(r.Context(), idParam(r), request.ParticipantID)
	if handleServiceError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusCreated, webmapper.InvitationToWeb(value, h.frontendURL))
}

func (h *Handler) GetInterview(w http.ResponseWriter, r *http.Request) {
	value, err := h.invitations.GetInterview(r.Context(), chi.URLParam(r, "token"))
	if handleServiceError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, webmapper.InterviewToWeb(value, h.frontendURL))
}

func (h *Handler) AcceptInterview(w http.ResponseWriter, r *http.Request) {
	value, err := h.invitations.Accept(r.Context(), chi.URLParam(r, "token"))
	if handleServiceError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, webmapper.InterviewToWeb(value, h.frontendURL))
}

func (h *Handler) SaveAnswer(w http.ResponseWriter, r *http.Request) {
	var request webmodel.AnswerRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	err := h.invitations.SaveAnswer(
		r.Context(), chi.URLParam(r, "token"), secondaryIDParam(r, "questionId"), request.Answer,
	)
	if handleServiceError(w, r, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) FinishInterview(w http.ResponseWriter, r *http.Request) {
	value, err := h.invitations.Finish(r.Context(), chi.URLParam(r, "token"))
	if handleServiceError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, webmapper.InterviewToWeb(value, h.frontendURL))
}

func readUpload(r *http.Request, field string) ([]byte, string, string, error) {
	file, header, err := r.FormFile(field)
	if errors.Is(err, http.ErrMissingFile) {
		return nil, "", "", nil
	}
	if err != nil {
		return nil, "", "", fmt.Errorf("read %s: %w", field, err)
	}
	defer file.Close()
	content, err := io.ReadAll(file)
	if err != nil {
		return nil, "", "", fmt.Errorf("read %s: %w", field, err)
	}
	return content, header.Header.Get("Content-Type"), safeFilename(header), nil
}

func safeFilename(header *multipart.FileHeader) string {
	return strings.ReplaceAll(strings.ReplaceAll(header.Filename, "/", "_"), "\\", "_")
}

func idParam(r *http.Request) uint {
	id, _ := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	return uint(id)
}

func secondaryIDParam(r *http.Request, name string) uint {
	id, _ := strconv.ParseUint(chi.URLParam(r, name), 10, 64)
	return uint(id)
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("invalid request body: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return fmt.Errorf("request body must contain one JSON value")
	}
	return nil
}

func handleServiceError(w http.ResponseWriter, r *http.Request, err error) bool {
	if err == nil {
		return false
	}

	switch {
	case errors.Is(err, repository.ErrNotFound):
		writeError(w, http.StatusNotFound, err)
	case errors.Is(err, repository.ErrConflict):
		writeError(w, http.StatusConflict, err)
	case errors.Is(err, service.ErrValidation), errors.Is(err, service.ErrInvalidQuestion):
		writeError(w, http.StatusBadRequest, err)
	case errors.Is(err, service.ErrInvalidState):
		writeError(w, http.StatusConflict, err)
	case errors.Is(err, service.ErrNotAvailable):
		writeError(w, http.StatusNotFound, err)
	default:
		internalError(w, r, err)
	}
	return true
}

func internalError(w http.ResponseWriter, r *http.Request, err error) {
	slog.ErrorContext(r.Context(), "request failed", "method", r.Method, "path", r.URL.Path, "error", err)
	writeError(w, http.StatusInternalServerError, errors.New("internal server error"))
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, webmodel.ErrorResponse{Error: err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		slog.Error("encode response", "error", err)
	}
}
