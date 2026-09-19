//go:build integration

package repository

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/danyel/go-guess/backend/internal/service/model"
)

func TestStoreEditsQuestionWithoutDeletingIt(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	store := New(db)
	created, err := store.CreateQuestion(context.Background(), model.Question{
		Text: "Original?", Type: "open",
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Exec("DELETE FROM questions WHERE id = ?", created.ID) })

	updated, err := store.UpdateQuestion(context.Background(), created.ID, model.Question{
		Text: "Choose two", Type: "multiple_choice", Options: []string{"One", "Two"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.ID != created.ID || updated.Text != "Choose two" || len(updated.Options) != 2 {
		t.Fatalf("unexpected updated question: %#v", updated)
	}
}

func TestStorePersistsJobWithTraits(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	store := New(db)
	suffix := uuid.NewString()
	created, err := store.CreateJob(context.Background(), model.JobPosting{
		Title: "Integration " + suffix, Description: "Database mapping test",
		Seniority: "Senior", Position: "Backend Engineer",
		Labels:         []model.Trait{{Name: "integration-" + suffix}},
		RequiredSkills: []model.Trait{{Name: "Go"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Exec("DELETE FROM job_postings WHERE id = ?", created.ID) })

	found, err := store.GetJob(context.Background(), created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if found.Title != created.Title || len(found.Labels) != 1 || len(found.RequiredSkills) != 1 {
		t.Fatalf("unexpected stored job: %#v", found)
	}
}
