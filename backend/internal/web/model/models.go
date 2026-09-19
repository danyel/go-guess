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
	ID    uint   `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
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
	ReferenceAnswer string   `json:"referenceAnswer"`
}

type QuestionResponse struct {
	ID              uint     `json:"id"`
	Text            string   `json:"text"`
	Type            string   `json:"type"`
	Options         []string `json:"options"`
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
	ID      uint     `json:"id"`
	Text    string   `json:"text"`
	Type    string   `json:"type"`
	Options []string `json:"options"`
}

type InterviewResponse struct {
	Invitation InvitationResponse   `json:"invitation"`
	Job        InterviewJobResponse `json:"job"`
	Answers    map[uint]string      `json:"answers"`
}

type AnswerRequest struct {
	Answer string `json:"answer"`
}
