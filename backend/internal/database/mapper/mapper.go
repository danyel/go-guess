package mapper

import (
	dbmodel "github.com/danyel/go-guess/backend/internal/database/entity"
	servicemodel "github.com/danyel/go-guess/backend/internal/service/model"
)

func UserToService(value dbmodel.User) servicemodel.User {
	return servicemodel.User{
		ID: value.ID, Email: value.Email, PasswordHash: value.PasswordHash,
		DisplayName: value.DisplayName, Role: value.Role,
	}
}

func JobToService(value dbmodel.JobPosting) servicemodel.JobPosting {
	return servicemodel.JobPosting{
		ID: value.ID, Title: value.Title, Description: value.Description,
		Seniority: value.Seniority, Position: value.Position, Status: value.Status,
		DurationMinutes: value.DurationMinutes,
		Labels:          traitsToService(value.Labels), RequiredSkills: traitsToService(value.RequiredSkills),
		AdditionalSkills: traitsToService(value.AdditionalSkills),
		Questions:        questionsToService(value.Questions), CreatedAt: value.CreatedAt,
	}
}

func ParticipantToService(value dbmodel.Participant) servicemodel.Participant {
	return servicemodel.Participant{
		ID: value.ID, FirstName: value.FirstName, LastName: value.LastName,
		Birthday: value.Birthday, Email: value.Email, ContactInfo: value.ContactInfo,
		Photo: value.Photo, PhotoType: value.PhotoType, CV: value.CV,
		CVFilename: value.CVFilename, Traits: traitsToService(value.Traits), CreatedAt: value.CreatedAt,
	}
}

func traitsToService(values []dbmodel.Trait) []servicemodel.Trait {
	result := make([]servicemodel.Trait, len(values))
	for i, value := range values {
		result[i] = servicemodel.Trait{ID: value.ID, Name: value.Name}
	}
	return result
}

func questionsToService(values []dbmodel.Question) []servicemodel.Question {
	result := make([]servicemodel.Question, len(values))
	for i, value := range values {
		options := make([]string, len(value.Options))
		for j, option := range value.Options {
			options[j] = option.Text
		}
		result[i] = servicemodel.Question{
			ID: value.ID, Text: value.Text, Type: value.Type,
			Options: options, CodeSnippet: value.CodeSnippet,
			ReferenceAnswer: value.ReferenceAnswer,
			Deprecated:      value.Deprecated,
		}
	}
	return result
}

func QuestionToService(value dbmodel.Question) servicemodel.Question {
	return questionsToService([]dbmodel.Question{value})[0]
}

func InvitationToService(value dbmodel.Invitation) servicemodel.Invitation {
	return servicemodel.Invitation{
		ID: value.ID, JobID: value.JobID, ParticipantID: value.ParticipantID,
		ParticipantName:  value.Participant.FirstName + " " + value.Participant.LastName,
		ParticipantEmail: value.Participant.Email, Token: value.Token, Status: value.Status,
		Outcome:         value.Outcome,
		DurationMinutes: value.DurationMinutes, AcceptedAt: value.AcceptedAt,
		CompletedAt: value.CompletedAt, CreatedAt: value.CreatedAt,
	}
}

func ScheduledInterviewToService(value dbmodel.ScheduledInterview) servicemodel.ScheduledInterview {
	attendees := make([]servicemodel.InterviewAttendee, len(value.Attendees))
	for i, attendee := range value.Attendees {
		attendees[i] = servicemodel.InterviewAttendee{
			ID: attendee.ID, InterviewID: attendee.InterviewID, UserID: attendee.UserID,
			Status: attendee.Status, User: UserToService(attendee.User),
			CreatedAt: attendee.CreatedAt, UpdatedAt: attendee.UpdatedAt,
		}
		attendees[i].User.PasswordHash = ""
	}
	creator := UserToService(value.Creator)
	creator.PasswordHash = ""
	notes := make([]servicemodel.InterviewNote, len(value.Notes))
	for i, note := range value.Notes {
		notes[i] = InterviewNoteToService(note)
	}
	return servicemodel.ScheduledInterview{
		ID: value.ID, JobID: value.JobID, InvitationID: value.InvitationID,
		ParticipantID: value.ParticipantID, CreatorID: value.CreatorID,
		StartsAt: value.StartsAt, Location: value.Location, CandidateToken: value.CandidateToken,
		SharedDocument: value.SharedDocument, Status: value.Status,
		Job: JobToService(value.Job), Invitation: InvitationToService(value.Invitation),
		Participant: ParticipantToService(value.Participant), Creator: creator,
		Attendees: attendees, Notes: notes,
		CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt,
	}
}

func InterviewNoteToService(value dbmodel.InterviewNote) servicemodel.InterviewNote {
	author := UserToService(value.Author)
	author.PasswordHash = ""
	return servicemodel.InterviewNote{
		ID: value.ID, InterviewID: value.InterviewID, AuthorID: value.AuthorID,
		Author: author, Body: value.Body, CreatedAt: value.CreatedAt,
	}
}
