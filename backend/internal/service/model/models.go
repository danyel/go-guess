package model

import "time"

type User struct {
	ID           uint
	Email        string
	PasswordHash string
	DisplayName  string
	Role         string
}

type Trait struct {
	ID   uint
	Name string
}

type JobPosting struct {
	ID               uint
	Title            string
	Description      string
	Seniority        string
	Position         string
	Status           string
	DurationMinutes  int
	Labels           []Trait
	RequiredSkills   []Trait
	AdditionalSkills []Trait
	Questions        []Question
	CreatedAt        time.Time
}

type Question struct {
	ID              uint
	Text            string
	Type            string
	Options         []string
	CodeSnippet     string
	ReferenceAnswer string
	Deprecated      bool
}

type Participant struct {
	ID          uint
	FirstName   string
	LastName    string
	Birthday    *time.Time
	Email       string
	ContactInfo string
	Photo       []byte
	PhotoType   string
	CV          []byte
	CVFilename  string
	Traits      []Trait
	CreatedAt   time.Time
}

type CandidateMatch struct {
	Participant Participant
	Score       float64
	Matched     []string
	Missing     []string
}

type Invitation struct {
	ID               uint
	JobID            uint
	ParticipantID    uint
	ParticipantName  string
	ParticipantEmail string
	Token            string
	Status           string
	Outcome          string
	DurationMinutes  int
	AcceptedAt       *time.Time
	CompletedAt      *time.Time
	CreatedAt        time.Time
}

type ScheduledInterview struct {
	ID             uint
	JobID          uint
	InvitationID   uint
	ParticipantID  uint
	CreatorID      uint
	StartsAt       time.Time
	Location       string
	CandidateToken string
	SharedDocument string
	Status         string
	Job            JobPosting
	Invitation     Invitation
	Participant    Participant
	Creator        User
	Attendees      []InterviewAttendee
	Notes          []InterviewNote
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type InterviewAttendee struct {
	ID          uint
	InterviewID uint
	UserID      uint
	Status      string
	User        User
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type InterviewNote struct {
	ID          uint
	InterviewID uint
	AuthorID    uint
	Author      User
	Body        string
	CreatedAt   time.Time
}

type Interview struct {
	Invitation Invitation
	Job        JobPosting
	Answers    map[uint]string
}
