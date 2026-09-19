package mapper

import (
	"fmt"

	servicemodel "github.com/danyel/go-guess/backend/internal/service/model"
	webmodel "github.com/danyel/go-guess/backend/internal/web/model"
)

func JobToService(value webmodel.JobRequest) servicemodel.JobPosting {
	return servicemodel.JobPosting{
		Title: value.Title, Description: value.Description, Seniority: value.Seniority,
		Position: value.Position, DurationMinutes: value.DurationMinutes,
		Labels: traitsToService(value.Labels), RequiredSkills: traitsToService(value.RequiredSkills),
		AdditionalSkills: traitsToService(value.AdditionalSkills),
	}
}

func QuestionToService(value webmodel.QuestionRequest) servicemodel.Question {
	return servicemodel.Question{
		Text: value.Text, Type: value.Type, Options: value.Options,
		CodeSnippet: value.CodeSnippet, ReferenceAnswer: value.ReferenceAnswer,
	}
}

func JobToWeb(value servicemodel.JobPosting) webmodel.JobResponse {
	questions := make([]webmodel.QuestionResponse, len(value.Questions))
	for i, question := range value.Questions {
		questions[i] = QuestionToWeb(question)
	}
	return webmodel.JobResponse{
		ID: value.ID, Title: value.Title, Description: value.Description,
		Seniority: value.Seniority, Position: value.Position, Status: value.Status,
		DurationMinutes: value.DurationMinutes,
		Labels:          traitsToWeb(value.Labels), RequiredSkills: traitsToWeb(value.RequiredSkills),
		AdditionalSkills: traitsToWeb(value.AdditionalSkills), Questions: questions,
		CreatedAt: value.CreatedAt,
	}
}

func QuestionToWeb(value servicemodel.Question) webmodel.QuestionResponse {
	return webmodel.QuestionResponse{
		ID: value.ID, Text: value.Text, Type: value.Type, Options: value.Options,
		CodeSnippet: value.CodeSnippet, ReferenceAnswer: value.ReferenceAnswer,
		Deprecated: value.Deprecated,
	}
}

func ParticipantToWeb(value servicemodel.Participant) webmodel.ParticipantResponse {
	result := webmodel.ParticipantResponse{
		ID: value.ID, FirstName: value.FirstName, LastName: value.LastName,
		Email: value.Email, ContactInfo: value.ContactInfo, CVFilename: value.CVFilename,
		Traits: traitsToWeb(value.Traits), CreatedAt: value.CreatedAt,
	}
	if value.Birthday != nil {
		birthday := value.Birthday.Format("2006-01-02")
		result.Birthday = &birthday
	}
	if len(value.Photo) > 0 {
		result.PhotoURL = fmt.Sprintf("/api/participants/%d/photo", value.ID)
	}
	if len(value.CV) > 0 {
		result.CVURL = fmt.Sprintf("/api/participants/%d/cv", value.ID)
	}
	return result
}

func CandidateToWeb(value servicemodel.CandidateMatch) webmodel.CandidateResponse {
	matched := value.Matched
	if matched == nil {
		matched = []string{}
	}
	missing := value.Missing
	if missing == nil {
		missing = []string{}
	}
	return webmodel.CandidateResponse{
		Participant: ParticipantToWeb(value.Participant), Score: value.Score,
		Matched: matched, Missing: missing,
	}
}

func InvitationToWeb(value servicemodel.Invitation, frontendURL string) webmodel.InvitationResponse {
	return webmodel.InvitationResponse{
		ID: value.ID, JobID: value.JobID, ParticipantID: value.ParticipantID,
		ParticipantName: value.ParticipantName, ParticipantEmail: value.ParticipantEmail,
		Token: value.Token, Status: value.Status,
		Outcome:        value.Outcome,
		ParticipantURL: frontendURL + "/participant/" + value.Token,
		AcceptedAt:     value.AcceptedAt, CompletedAt: value.CompletedAt, CreatedAt: value.CreatedAt,
	}
}

func UserToWeb(value servicemodel.User) webmodel.User {
	return webmodel.User{
		ID: value.ID, Email: value.Email, DisplayName: value.DisplayName, Role: value.Role,
	}
}

func ScheduledInterviewToWeb(
	value servicemodel.ScheduledInterview, frontendURL string,
) webmodel.ScheduledInterviewResponse {
	attendees := make([]webmodel.InterviewAttendeeResponse, len(value.Attendees))
	for i, attendee := range value.Attendees {
		attendees[i] = InterviewAttendeeToWeb(attendee)
	}
	notes := make([]webmodel.InterviewNoteResponse, len(value.Notes))
	for i, note := range value.Notes {
		notes[i] = InterviewNoteToWeb(note)
	}
	return webmodel.ScheduledInterviewResponse{
		ID: value.ID, JobID: value.JobID, JobTitle: value.Job.Title,
		ParticipantID:   value.ParticipantID,
		ParticipantName: value.Participant.FirstName + " " + value.Participant.LastName,
		StartsAt:        value.StartsAt, Location: value.Location, CandidateToken: value.CandidateToken,
		CandidateURL:   frontendURL + "/participant/meeting/" + value.CandidateToken,
		SharedDocument: value.SharedDocument, Status: value.Status,
		Attendees: attendees, Notes: notes,
		CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt,
	}
}

func ParticipantMeetingToWeb(value servicemodel.ScheduledInterview) webmodel.ParticipantMeetingResponse {
	return webmodel.ParticipantMeetingResponse{
		ID: value.ID, JobID: value.JobID, JobTitle: value.Job.Title,
		ParticipantName: value.Participant.FirstName + " " + value.Participant.LastName,
		StartsAt:        value.StartsAt, Location: value.Location,
		SharedDocument: value.SharedDocument, Status: value.Status,
	}
}

func InterviewAttendeeToWeb(value servicemodel.InterviewAttendee) webmodel.InterviewAttendeeResponse {
	return webmodel.InterviewAttendeeResponse{
		UserID: value.UserID, DisplayName: value.User.DisplayName,
		Email: value.User.Email, Status: value.Status,
	}
}

func InterviewNoteToWeb(value servicemodel.InterviewNote) webmodel.InterviewNoteResponse {
	return webmodel.InterviewNoteResponse{
		ID: value.ID, AuthorUserID: value.AuthorID, AuthorName: value.Author.DisplayName,
		Body: value.Body, CreatedAt: value.CreatedAt,
	}
}

func InterviewToWeb(value servicemodel.Interview, frontendURL string) webmodel.InterviewResponse {
	questions := make([]webmodel.InterviewQuestionResponse, len(value.Job.Questions))
	for i, question := range value.Job.Questions {
		questions[i] = webmodel.InterviewQuestionResponse{
			ID: question.ID, Text: question.Text, Type: question.Type,
			Options: question.Options, CodeSnippet: question.CodeSnippet,
		}
	}
	return webmodel.InterviewResponse{
		Invitation: InvitationToWeb(value.Invitation, frontendURL),
		Job: webmodel.InterviewJobResponse{
			ID: value.Job.ID, Title: value.Job.Title, Description: value.Job.Description,
			Position: value.Job.Position, Seniority: value.Job.Seniority,
			DurationMinutes: value.Job.DurationMinutes, Questions: questions,
		},
		Answers: value.Answers,
	}
}

func InvitationReviewToWeb(value servicemodel.Interview, frontendURL string) webmodel.InvitationReviewResponse {
	return webmodel.InvitationReviewResponse{
		Invitation: InvitationToWeb(value.Invitation, frontendURL),
		Job:        JobToWeb(value.Job),
		Answers:    value.Answers,
	}
}

func traitsToService(values []string) []servicemodel.Trait {
	result := make([]servicemodel.Trait, len(values))
	for i, value := range values {
		result[i] = servicemodel.Trait{Name: value}
	}
	return result
}

func traitsToWeb(values []servicemodel.Trait) []string {
	result := make([]string, len(values))
	for i, value := range values {
		result[i] = value.Name
	}
	return result
}
