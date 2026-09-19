package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	dbmodel "github.com/danyel/go-guess/backend/internal/database/entity"
	dbmapper "github.com/danyel/go-guess/backend/internal/database/mapper"
	servicemodel "github.com/danyel/go-guess/backend/internal/service/model"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrNotFound = errors.New("record not found")
	ErrConflict = errors.New("record conflicts with existing data")
)

type IStore interface {
	FindUserByEmail(context.Context, string) (servicemodel.User, error)
	ListJobs(context.Context) ([]servicemodel.JobPosting, error)
	GetJob(context.Context, uint) (servicemodel.JobPosting, error)
	CreateJob(context.Context, servicemodel.JobPosting) (servicemodel.JobPosting, error)
	UpdateJob(context.Context, uint, string, int) (servicemodel.JobPosting, error)
	ListQuestions(context.Context, string) ([]servicemodel.Question, error)
	GetQuestion(context.Context, uint) (servicemodel.Question, error)
	CreateQuestion(context.Context, servicemodel.Question) (servicemodel.Question, error)
	UpdateQuestion(context.Context, uint, servicemodel.Question) (servicemodel.Question, error)
	SetQuestionDeprecated(context.Context, uint, bool) (servicemodel.Question, error)
	AttachQuestion(context.Context, uint, uint) error
	DetachQuestion(context.Context, uint, uint) error
	ListParticipants(context.Context) ([]servicemodel.Participant, error)
	GetParticipant(context.Context, uint) (servicemodel.Participant, error)
	CreateParticipant(context.Context, servicemodel.Participant) (servicemodel.Participant, error)
	AllTraits(context.Context) ([]servicemodel.Trait, error)
	ListInvitations(context.Context, uint) ([]servicemodel.Invitation, error)
	CreateInvitation(context.Context, servicemodel.Invitation) (servicemodel.Invitation, error)
	GetInterview(context.Context, string) (servicemodel.Interview, error)
	AcceptInvitation(context.Context, string, time.Time) error
	SaveAnswer(context.Context, string, uint, string) error
	CompleteInvitation(context.Context, string, time.Time) error
}

type Store struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Store {
	return &Store{db: db}
}

func (s *Store) FindUserByEmail(ctx context.Context, email string) (servicemodel.User, error) {
	var value dbmodel.User
	if err := s.db.WithContext(ctx).Where("lower(email) = ?", strings.ToLower(email)).First(&value).Error; err != nil {
		return servicemodel.User{}, mapError(err)
	}
	return dbmapper.UserToService(value), nil
}

func (s *Store) ListJobs(ctx context.Context) ([]servicemodel.JobPosting, error) {
	var values []dbmodel.JobPosting
	if err := preloadJob(s.db.WithContext(ctx)).Order("created_at DESC").Find(&values).Error; err != nil {
		return nil, err
	}
	result := make([]servicemodel.JobPosting, len(values))
	for i, value := range values {
		result[i] = dbmapper.JobToService(value)
	}
	return result, nil
}

func (s *Store) GetJob(ctx context.Context, id uint) (servicemodel.JobPosting, error) {
	var value dbmodel.JobPosting
	if err := preloadJob(s.db.WithContext(ctx)).First(&value, id).Error; err != nil {
		return servicemodel.JobPosting{}, mapError(err)
	}
	return dbmapper.JobToService(value), nil
}

func (s *Store) CreateJob(ctx context.Context, value servicemodel.JobPosting) (servicemodel.JobPosting, error) {
	entity := dbmodel.JobPosting{
		Title: value.Title, Description: value.Description, Seniority: value.Seniority,
		Position: value.Position, Status: value.Status, DurationMinutes: value.DurationMinutes,
	}
	var err error
	entity.Labels, err = s.resolveTraits(ctx, value.Labels)
	if err != nil {
		return servicemodel.JobPosting{}, err
	}
	entity.RequiredSkills, err = s.resolveTraits(ctx, value.RequiredSkills)
	if err != nil {
		return servicemodel.JobPosting{}, err
	}
	entity.AdditionalSkills, err = s.resolveTraits(ctx, value.AdditionalSkills)
	if err != nil {
		return servicemodel.JobPosting{}, err
	}
	if err := s.db.WithContext(ctx).Create(&entity).Error; err != nil {
		return servicemodel.JobPosting{}, mapError(err)
	}
	return s.GetJob(ctx, entity.ID)
}

func (s *Store) UpdateJob(ctx context.Context, id uint, status string, durationMinutes int) (servicemodel.JobPosting, error) {
	result := s.db.WithContext(ctx).Model(&dbmodel.JobPosting{}).Where("id = ?", id).
		Updates(map[string]any{"status": status, "duration_minutes": durationMinutes})
	if result.Error != nil {
		return servicemodel.JobPosting{}, result.Error
	}
	if result.RowsAffected == 0 {
		return servicemodel.JobPosting{}, ErrNotFound
	}
	return s.GetJob(ctx, id)
}

func (s *Store) ListQuestions(ctx context.Context, search string) ([]servicemodel.Question, error) {
	query := s.db.WithContext(ctx).Preload("Options").Order("deprecated, created_at DESC")
	if search = strings.TrimSpace(search); search != "" {
		query = query.Where("text ILIKE ?", "%"+search+"%")
	}
	var values []dbmodel.Question
	if err := query.Find(&values).Error; err != nil {
		return nil, err
	}
	result := make([]servicemodel.Question, len(values))
	for i, value := range values {
		result[i] = dbmapper.QuestionToService(value)
	}
	return result, nil
}

func (s *Store) GetQuestion(ctx context.Context, id uint) (servicemodel.Question, error) {
	var value dbmodel.Question
	if err := s.db.WithContext(ctx).Preload("Options").First(&value, id).Error; err != nil {
		return servicemodel.Question{}, mapError(err)
	}
	return dbmapper.QuestionToService(value), nil
}

func (s *Store) CreateQuestion(ctx context.Context, value servicemodel.Question) (servicemodel.Question, error) {
	options := make([]dbmodel.QuestionOption, len(value.Options))
	for i, option := range value.Options {
		options[i] = dbmodel.QuestionOption{Text: option}
	}
	entity := dbmodel.Question{
		Text: value.Text, Type: value.Type, Options: options,
		CodeSnippet: value.CodeSnippet, ReferenceAnswer: value.ReferenceAnswer,
		Deprecated: value.Deprecated,
	}
	if err := s.db.WithContext(ctx).Create(&entity).Error; err != nil {
		return servicemodel.Question{}, mapError(err)
	}
	return s.GetQuestion(ctx, entity.ID)
}

func (s *Store) UpdateQuestion(ctx context.Context, id uint, value servicemodel.Question) (servicemodel.Question, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&dbmodel.Question{}).Where("id = ?", id).
			Updates(map[string]any{
				"text": value.Text, "type": value.Type, "code_snippet": value.CodeSnippet,
				"reference_answer": value.ReferenceAnswer,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrNotFound
		}
		if err := tx.Where("question_id = ?", id).Delete(&dbmodel.QuestionOption{}).Error; err != nil {
			return err
		}
		if len(value.Options) == 0 {
			return nil
		}
		options := make([]dbmodel.QuestionOption, len(value.Options))
		for i, option := range value.Options {
			options[i] = dbmodel.QuestionOption{QuestionID: id, Text: option}
		}
		return tx.Create(&options).Error
	})
	if err != nil {
		return servicemodel.Question{}, mapError(err)
	}
	return s.GetQuestion(ctx, id)
}

func (s *Store) SetQuestionDeprecated(ctx context.Context, id uint, deprecated bool) (servicemodel.Question, error) {
	result := s.db.WithContext(ctx).Model(&dbmodel.Question{}).Where("id = ?", id).
		Update("deprecated", deprecated)
	if result.Error != nil {
		return servicemodel.Question{}, result.Error
	}
	if result.RowsAffected == 0 {
		return servicemodel.Question{}, ErrNotFound
	}
	return s.GetQuestion(ctx, id)
}

func (s *Store) AttachQuestion(ctx context.Context, jobID, questionID uint) error {
	var job dbmodel.JobPosting
	if err := s.db.WithContext(ctx).First(&job, jobID).Error; err != nil {
		return mapError(err)
	}
	var question dbmodel.Question
	if err := s.db.WithContext(ctx).First(&question, questionID).Error; err != nil {
		return mapError(err)
	}
	var invitations int64
	if err := s.db.WithContext(ctx).Model(&dbmodel.Invitation{}).Where("job_id = ?", jobID).
		Count(&invitations).Error; err != nil {
		return err
	}
	if invitations > 0 {
		return ErrConflict
	}
	return mapError(s.db.WithContext(ctx).Model(&job).Association("Questions").Append(&question))
}

func (s *Store) DetachQuestion(ctx context.Context, jobID, questionID uint) error {
	var job dbmodel.JobPosting
	if err := s.db.WithContext(ctx).First(&job, jobID).Error; err != nil {
		return mapError(err)
	}
	var invitations int64
	if err := s.db.WithContext(ctx).Model(&dbmodel.Invitation{}).Where("job_id = ?", jobID).
		Count(&invitations).Error; err != nil {
		return err
	}
	if invitations > 0 {
		return ErrConflict
	}
	return s.db.WithContext(ctx).Model(&job).Association("Questions").
		Delete(&dbmodel.Question{ID: questionID})
}

func (s *Store) ListParticipants(ctx context.Context) ([]servicemodel.Participant, error) {
	var values []dbmodel.Participant
	if err := s.db.WithContext(ctx).Preload("Traits").Order("last_name, first_name").Find(&values).Error; err != nil {
		return nil, err
	}
	result := make([]servicemodel.Participant, len(values))
	for i, value := range values {
		result[i] = dbmapper.ParticipantToService(value)
	}
	return result, nil
}

func (s *Store) GetParticipant(ctx context.Context, id uint) (servicemodel.Participant, error) {
	var value dbmodel.Participant
	if err := s.db.WithContext(ctx).Preload("Traits").First(&value, id).Error; err != nil {
		return servicemodel.Participant{}, mapError(err)
	}
	return dbmapper.ParticipantToService(value), nil
}

func (s *Store) CreateParticipant(ctx context.Context, value servicemodel.Participant) (servicemodel.Participant, error) {
	entity := dbmodel.Participant{
		FirstName: value.FirstName, LastName: value.LastName, Birthday: value.Birthday,
		Email: value.Email, ContactInfo: value.ContactInfo, Photo: value.Photo,
		PhotoType: value.PhotoType, CV: value.CV, CVFilename: value.CVFilename,
	}
	var err error
	entity.Traits, err = s.resolveTraits(ctx, value.Traits)
	if err != nil {
		return servicemodel.Participant{}, err
	}
	if err := s.db.WithContext(ctx).Create(&entity).Error; err != nil {
		return servicemodel.Participant{}, mapError(err)
	}
	return s.GetParticipant(ctx, entity.ID)
}

func (s *Store) AllTraits(ctx context.Context) ([]servicemodel.Trait, error) {
	var values []dbmodel.Trait
	if err := s.db.WithContext(ctx).Order("name").Find(&values).Error; err != nil {
		return nil, err
	}
	result := make([]servicemodel.Trait, len(values))
	for i, value := range values {
		result[i] = servicemodel.Trait{ID: value.ID, Name: value.Name}
	}
	return result, nil
}

func (s *Store) ListInvitations(ctx context.Context, jobID uint) ([]servicemodel.Invitation, error) {
	var values []dbmodel.Invitation
	if err := s.db.WithContext(ctx).Preload("Participant").Where("job_id = ?", jobID).
		Order("created_at DESC").Find(&values).Error; err != nil {
		return nil, err
	}
	result := make([]servicemodel.Invitation, len(values))
	for i, value := range values {
		result[i] = dbmapper.InvitationToService(value)
	}
	return result, nil
}

func (s *Store) CreateInvitation(ctx context.Context, value servicemodel.Invitation) (servicemodel.Invitation, error) {
	entity := dbmodel.Invitation{
		JobID: value.JobID, ParticipantID: value.ParticipantID,
		Token: value.Token, Status: value.Status, DurationMinutes: value.DurationMinutes,
	}
	if err := s.db.WithContext(ctx).Create(&entity).Error; err != nil {
		return servicemodel.Invitation{}, mapError(err)
	}
	var created dbmodel.Invitation
	if err := s.db.WithContext(ctx).Preload("Participant").First(&created, entity.ID).Error; err != nil {
		return servicemodel.Invitation{}, mapError(err)
	}
	return dbmapper.InvitationToService(created), nil
}

func (s *Store) GetInterview(ctx context.Context, token string) (servicemodel.Interview, error) {
	var invitation dbmodel.Invitation
	err := s.db.WithContext(ctx).Preload("Participant").Preload("Answers").
		Preload("Job.Labels").Preload("Job.RequiredSkills").Preload("Job.AdditionalSkills").
		Preload("Job.Questions.Options").Where("token = ?", token).First(&invitation).Error
	if err != nil {
		return servicemodel.Interview{}, mapError(err)
	}
	answers := make(map[uint]string, len(invitation.Answers))
	for _, answer := range invitation.Answers {
		answers[answer.QuestionID] = answer.Answer
	}
	return servicemodel.Interview{
		Invitation: dbmapper.InvitationToService(invitation),
		Job:        dbmapper.JobToService(invitation.Job),
		Answers:    answers,
	}, nil
}

func (s *Store) AcceptInvitation(ctx context.Context, token string, acceptedAt time.Time) error {
	result := s.db.WithContext(ctx).Model(&dbmodel.Invitation{}).
		Where("token = ? AND status = ?", token, "pending").
		Updates(map[string]any{"status": "accepted", "accepted_at": acceptedAt})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrConflict
	}
	return nil
}

func (s *Store) SaveAnswer(ctx context.Context, token string, questionID uint, answer string) error {
	var invitation dbmodel.Invitation
	if err := s.db.WithContext(ctx).Where("token = ?", token).First(&invitation).Error; err != nil {
		return mapError(err)
	}
	value := dbmodel.InvitationAnswer{InvitationID: invitation.ID, QuestionID: questionID, Answer: answer}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "invitation_id"}, {Name: "question_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"answer", "updated_at"}),
	}).Create(&value).Error
}

func (s *Store) CompleteInvitation(ctx context.Context, token string, completedAt time.Time) error {
	result := s.db.WithContext(ctx).Model(&dbmodel.Invitation{}).
		Where("token = ? AND status = ?", token, "accepted").
		Updates(map[string]any{"status": "completed", "completed_at": completedAt})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrConflict
	}
	return nil
}

func (s *Store) resolveTraits(ctx context.Context, values []servicemodel.Trait) ([]dbmodel.Trait, error) {
	result := make([]dbmodel.Trait, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		name := strings.TrimSpace(value.Name)
		normalized := strings.ToLower(name)
		if normalized == "" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		var trait dbmodel.Trait
		if err := s.db.WithContext(ctx).Where(dbmodel.Trait{Normalized: normalized}).
			Attrs(dbmodel.Trait{Name: name}).FirstOrCreate(&trait).Error; err != nil {
			return nil, err
		}
		result = append(result, trait)
	}
	return result, nil
}

func preloadJob(db *gorm.DB) *gorm.DB {
	return db.Preload("Labels").Preload("RequiredSkills").Preload("AdditionalSkills").
		Preload("Questions.Options")
}

func mapError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrNotFound
	}
	var pgError *pgconn.PgError
	if errors.As(err, &pgError) && pgError.Code == "23505" {
		return ErrConflict
	}
	return err
}
