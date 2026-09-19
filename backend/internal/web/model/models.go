package model

import "time"

type ErrorResponse struct {
	Error string `json:"error"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type User struct {
	ID          uint   `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Role        string `json:"role"`
}

type CreateUserRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

type JobRequest struct {
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	Seniority        string   `json:"seniority"`
	Position         string   `json:"position"`
	DurationMinutes  int      `json:"durationMinutes"`
	Labels           []string `json:"labels"`
	RequiredSkills   []string `json:"requiredSkills"`
	AdditionalSkills []string `json:"additionalSkills"`
}

type JobResponse struct {
	ID               uint               `json:"id"`
	Title            string             `json:"title"`
	Description      string             `json:"description"`
	Seniority        string             `json:"seniority"`
	Position         string             `json:"position"`
	Status           string             `json:"status"`
	DurationMinutes  int                `json:"durationMinutes"`
	Labels           []string           `json:"labels"`
	RequiredSkills   []string           `json:"requiredSkills"`
	AdditionalSkills []string           `json:"additionalSkills"`
	Questions        []QuestionResponse `json:"questions"`
	CreatedAt        time.Time          `json:"createdAt"`
}

type QuestionRequest struct {
	Text            string   `json:"text"`
	Type            string   `json:"type"`
	Options         []string `json:"options"`
	CodeSnippet     string   `json:"codeSnippet"`
	ReferenceAnswer string   `json:"referenceAnswer"`
}

type QuestionResponse struct {
	ID              uint     `json:"id"`
	Text            string   `json:"text"`
	Type            string   `json:"type"`
	Options         []string `json:"options"`
	CodeSnippet     string   `json:"codeSnippet"`
	ReferenceAnswer string   `json:"referenceAnswer"`
	Deprecated      bool     `json:"deprecated"`
}

type QuestionStatusRequest struct {
	Deprecated bool `json:"deprecated"`
}

type JobStatusRequest struct {
	Status          string `json:"status"`
	DurationMinutes int    `json:"durationMinutes"`
}

type InvitationRequest struct {
	ParticipantID uint `json:"participantId"`
}

type ParticipantResponse struct {
	ID          uint      `json:"id"`
	FirstName   string    `json:"firstName"`
	LastName    string    `json:"lastName"`
	Birthday    *string   `json:"birthday,omitempty"`
	Email       string    `json:"email"`
	ContactInfo string    `json:"contactInfo"`
	PhotoURL    string    `json:"photoUrl,omitempty"`
	CVFilename  string    `json:"cvFilename,omitempty"`
	CVURL       string    `json:"cvUrl,omitempty"`
	Traits      []string  `json:"traits"`
	CreatedAt   time.Time `json:"createdAt"`
}

type CandidateResponse struct {
	Participant ParticipantResponse `json:"participant"`
	Score       float64             `json:"score"`
	Matched     []string            `json:"matchedTraits"`
	Missing     []string            `json:"missingTraits"`
}

type InvitationResponse struct {
	ID               uint       `json:"id"`
	JobID            uint       `json:"jobId"`
	ParticipantID    uint       `json:"participantId"`
	ParticipantName  string     `json:"participantName"`
	ParticipantEmail string     `json:"participantEmail"`
	Token            string     `json:"token"`
	Status           string     `json:"status"`
	Outcome          string     `json:"outcome"`
	ParticipantURL   string     `json:"participantUrl"`
	AcceptedAt       *time.Time `json:"acceptedAt,omitempty"`
	CompletedAt      *time.Time `json:"completedAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
}

type InterviewJobResponse struct {
	ID              uint                        `json:"id"`
	Title           string                      `json:"title"`
	Description     string                      `json:"description"`
	Position        string                      `json:"position"`
	Seniority       string                      `json:"seniority"`
	DurationMinutes int                         `json:"durationMinutes"`
	Questions       []InterviewQuestionResponse `json:"questions"`
}

type InterviewQuestionResponse struct {
	ID          uint     `json:"id"`
	Text        string   `json:"text"`
	Type        string   `json:"type"`
	Options     []string `json:"options"`
	CodeSnippet string   `json:"codeSnippet"`
}

type InterviewResponse struct {
	Invitation InvitationResponse   `json:"invitation"`
	Job        InterviewJobResponse `json:"job"`
	Answers    map[uint]string      `json:"answers"`
}

type InvitationReviewResponse struct {
	Invitation InvitationResponse `json:"invitation"`
	Job        JobResponse        `json:"job"`
	Answers    map[uint]string    `json:"answers"`
}

type AnswerRequest struct {
	Answer string `json:"answer"`
}

type InvitationOutcomeRequest struct {
	Outcome string `json:"outcome"`
}

type CreateScheduledInterviewRequest struct {
	InvitationID   uint      `json:"invitationId"`
	StartsAt       time.Time `json:"startsAt"`
	Location       string    `json:"location"`
	InterviewerIDs []uint    `json:"interviewerIds"`
	SharedDocument string    `json:"sharedDocument"`
}

type InterviewStatusRequest struct {
	Status string `json:"status"`
}

type InterviewDocumentRequest struct {
	SharedDocument string `json:"sharedDocument"`
}

type InterviewNoteRequest struct {
	Body string `json:"body"`
}

type AttendeeStatusRequest struct {
	Status string `json:"status"`
}

type InterviewAttendeeResponse struct {
	UserID      uint   `json:"userId"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
	Status      string `json:"status"`
}

type ScheduledInterviewResponse struct {
	ID              uint                        `json:"id"`
	JobID           uint                        `json:"jobId"`
	JobTitle        string                      `json:"jobTitle"`
	ParticipantID   uint                        `json:"participantId"`
	ParticipantName string                      `json:"participantName"`
	StartsAt        time.Time                   `json:"startsAt"`
	Location        string                      `json:"location"`
	CandidateToken  string                      `json:"candidateToken"`
	CandidateURL    string                      `json:"candidateUrl"`
	SharedDocument  string                      `json:"sharedDocument"`
	Status          string                      `json:"status"`
	Attendees       []InterviewAttendeeResponse `json:"attendees"`
	Notes           []InterviewNoteResponse     `json:"notes"`
	CreatedAt       time.Time                   `json:"createdAt"`
	UpdatedAt       time.Time                   `json:"updatedAt"`
}

type ParticipantMeetingResponse struct {
	ID              uint      `json:"id"`
	JobID           uint      `json:"jobId"`
	JobTitle        string    `json:"jobTitle"`
	ParticipantName string    `json:"participantName"`
	StartsAt        time.Time `json:"startsAt"`
	Location        string    `json:"location"`
	SharedDocument  string    `json:"sharedDocument"`
	Status          string    `json:"status"`
}

type InterviewNoteResponse struct {
	ID           uint      `json:"id"`
	AuthorUserID uint      `json:"authorUserId"`
	AuthorName   string    `json:"authorName"`
	Body         string    `json:"body"`
	CreatedAt    time.Time `json:"createdAt"`
}
