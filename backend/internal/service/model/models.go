package model

import "time"

type User struct {
	ID           uint
	Email        string
	PasswordHash string
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
	DurationMinutes  int
	AcceptedAt       *time.Time
	CompletedAt      *time.Time
	CreatedAt        time.Time
}

type Interview struct {
	Invitation Invitation
	Job        JobPosting
	Answers    map[uint]string
}
