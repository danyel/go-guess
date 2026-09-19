package mapper

import (
	"testing"

	servicemodel "github.com/danyel/go-guess/backend/internal/service/model"
)

func TestInterviewOmitsReferenceAnswer(t *testing.T) {
	response := InterviewToWeb(servicemodel.Interview{
		Job: servicemodel.JobPosting{
			Questions: []servicemodel.Question{{
				ID: 1, Type: "code_review", Text: "Review this",
				CodeSnippet: "return nil", ReferenceAnswer: "Should return the error",
			}},
		},
	}, "http://localhost")
	if len(response.Job.Questions) != 1 || response.Job.Questions[0].CodeSnippet != "return nil" {
		t.Fatalf("expected participant-safe code question, got %#v", response)
	}
}
