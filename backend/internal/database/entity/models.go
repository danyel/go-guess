package entity

import "time"

type User struct {
	ID           uint   `gorm:"primaryKey"`
	Email        string `gorm:"uniqueIndex;size:320;not null"`
	PasswordHash string `gorm:"not null"`
	DisplayName  string `gorm:"size:200;not null"`
	Role         string `gorm:"size:32;not null"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type JobPosting struct {
	ID               uint         `gorm:"primaryKey"`
	Title            string       `gorm:"size:200;not null"`
	Description      string       `gorm:"type:text;not null"`
	Seniority        string       `gorm:"size:50;not null"`
	Position         string       `gorm:"size:120;not null"`
	Status           string       `gorm:"size:32;not null;default:draft"`
	DurationMinutes  int          `gorm:"not null;default:60"`
	Labels           []Trait      `gorm:"many2many:job_posting_labels"`
	RequiredSkills   []Trait      `gorm:"many2many:job_required_skills"`
	AdditionalSkills []Trait      `gorm:"many2many:job_additional_skills"`
	Questions        []Question   `gorm:"many2many:job_posting_questions"`
	Invitations      []Invitation `gorm:"foreignKey:JobID;constraint:OnDelete:CASCADE"`
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type Trait struct {
	ID         uint   `gorm:"primaryKey"`
	Name       string `gorm:"uniqueIndex;size:100;not null"`
	Normalized string `gorm:"uniqueIndex;size:100;not null"`
}

type Question struct {
	ID              uint             `gorm:"primaryKey"`
	Text            string           `gorm:"type:text;not null"`
	Type            string           `gorm:"size:32;not null"`
	CodeSnippet     string           `gorm:"type:text;not null;default:''"`
	ReferenceAnswer string           `gorm:"type:text;not null;default:''"`
	Deprecated      bool             `gorm:"not null;default:false"`
	Options         []QuestionOption `gorm:"foreignKey:QuestionID;constraint:OnDelete:CASCADE"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type QuestionOption struct {
	ID         uint   `gorm:"primaryKey"`
	QuestionID uint   `gorm:"index;not null"`
	Text       string `gorm:"type:text;not null"`
}

type Participant struct {
	ID          uint   `gorm:"primaryKey"`
	FirstName   string `gorm:"size:100;not null"`
	LastName    string `gorm:"size:100;not null"`
	Birthday    *time.Time
	Email       string  `gorm:"uniqueIndex;size:320;not null"`
	ContactInfo string  `gorm:"type:text"`
	Photo       []byte  `gorm:"type:bytea"`
	PhotoType   string  `gorm:"size:100"`
	CV          []byte  `gorm:"type:bytea"`
	CVFilename  string  `gorm:"size:255"`
	Traits      []Trait `gorm:"many2many:participant_traits"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Invitation struct {
	ID              uint   `gorm:"primaryKey"`
	JobID           uint   `gorm:"index;not null"`
	ParticipantID   uint   `gorm:"index;not null"`
	Token           string `gorm:"uniqueIndex;size:64;not null"`
	Status          string `gorm:"size:32;not null;default:pending"`
	Outcome         string `gorm:"size:32;not null;default:pending"`
	DurationMinutes int    `gorm:"not null"`
	AcceptedAt      *time.Time
	CompletedAt     *time.Time
	Answers         []InvitationAnswer `gorm:"foreignKey:InvitationID;constraint:OnDelete:CASCADE"`
	Job             JobPosting
	Participant     Participant
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type ScheduledInterview struct {
	ID             uint `gorm:"primaryKey"`
	JobID          uint `gorm:"index;not null"`
	InvitationID   uint `gorm:"uniqueIndex;not null"`
	ParticipantID  uint `gorm:"index;not null"`
	CreatorID      uint `gorm:"index;not null"`
	StartsAt       time.Time
	Location       string `gorm:"size:500;not null"`
	CandidateToken string `gorm:"uniqueIndex;size:64;not null"`
	SharedDocument string `gorm:"type:text;not null;default:''"`
	Status         string `gorm:"size:32;not null;default:scheduled"`
	Job            JobPosting
	Invitation     Invitation
	Participant    Participant
	Creator        User
	Attendees      []InterviewAttendee `gorm:"foreignKey:InterviewID;constraint:OnDelete:CASCADE"`
	Notes          []InterviewNote     `gorm:"foreignKey:InterviewID;constraint:OnDelete:CASCADE"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type InterviewAttendee struct {
	ID          uint   `gorm:"primaryKey"`
	InterviewID uint   `gorm:"uniqueIndex:interview_user;not null"`
	UserID      uint   `gorm:"uniqueIndex:interview_user;index;not null"`
	Status      string `gorm:"size:32;not null;default:invited"`
	User        User
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type InterviewNote struct {
	ID          uint   `gorm:"primaryKey"`
	InterviewID uint   `gorm:"index;not null"`
	AuthorID    uint   `gorm:"index;not null"`
	Body        string `gorm:"type:text;not null"`
	Author      User
	CreatedAt   time.Time
}

type InvitationAnswer struct {
	ID           uint   `gorm:"primaryKey"`
	InvitationID uint   `gorm:"uniqueIndex:invitation_question;not null"`
	QuestionID   uint   `gorm:"uniqueIndex:invitation_question;not null"`
	Answer       string `gorm:"type:text;not null"`
	UpdatedAt    time.Time
}
