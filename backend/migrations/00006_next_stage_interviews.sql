-- +goose Up
ALTER TABLE users
    ADD COLUMN display_name VARCHAR(200) NOT NULL DEFAULT '';

UPDATE users
SET display_name = split_part(email, '@', 1)
WHERE display_name = '';

ALTER TABLE invitations
    ADD COLUMN outcome VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (outcome IN ('pending', 'passed', 'failed'));

CREATE TABLE scheduled_interviews (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    invitation_id BIGINT NOT NULL UNIQUE REFERENCES invitations(id) ON DELETE RESTRICT,
    participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
    creator_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    starts_at TIMESTAMPTZ NOT NULL,
    location VARCHAR(500) NOT NULL,
    candidate_token VARCHAR(64) NOT NULL UNIQUE,
    shared_document TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'started', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scheduled_interviews_job_id_idx ON scheduled_interviews(job_id);
CREATE INDEX scheduled_interviews_participant_id_idx ON scheduled_interviews(participant_id);

CREATE TABLE interview_attendees (
    id BIGSERIAL PRIMARY KEY,
    interview_id BIGINT NOT NULL REFERENCES scheduled_interviews(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'invited'
        CHECK (status IN ('invited', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (interview_id, user_id)
);

CREATE INDEX interview_attendees_user_id_idx ON interview_attendees(user_id);

CREATE TABLE interview_notes (
    id BIGSERIAL PRIMARY KEY,
    interview_id BIGINT NOT NULL REFERENCES scheduled_interviews(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX interview_notes_interview_id_idx ON interview_notes(interview_id);

-- +goose Down
DROP TABLE IF EXISTS interview_notes;
DROP TABLE IF EXISTS interview_attendees;
DROP TABLE IF EXISTS scheduled_interviews;
ALTER TABLE invitations DROP COLUMN outcome;
ALTER TABLE users DROP COLUMN display_name;
