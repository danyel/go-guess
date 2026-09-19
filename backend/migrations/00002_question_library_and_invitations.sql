-- +goose Up
ALTER TABLE job_postings
    ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'deprecated')),
    ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 60
        CHECK (duration_minutes BETWEEN 1 AND 480);

UPDATE job_postings SET status = 'published';

ALTER TABLE questions ADD COLUMN deprecated BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE job_posting_questions (
    job_posting_id BIGINT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    PRIMARY KEY (job_posting_id, question_id)
);

INSERT INTO job_posting_questions (job_posting_id, question_id)
SELECT job_id, id FROM questions WHERE job_id IS NOT NULL;

ALTER TABLE questions DROP COLUMN job_id;

CREATE TABLE invitations (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'completed')),
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (job_id, participant_id)
);

CREATE TABLE invitation_answers (
    id BIGSERIAL PRIMARY KEY,
    invitation_id BIGINT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    answer TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (invitation_id, question_id)
);

-- +goose Down
DROP TABLE IF EXISTS invitation_answers;
DROP TABLE IF EXISTS invitations;
ALTER TABLE questions ADD COLUMN job_id BIGINT REFERENCES job_postings(id) ON DELETE CASCADE;
UPDATE questions q
SET job_id = links.job_posting_id
FROM (
    SELECT question_id, min(job_posting_id) AS job_posting_id
    FROM job_posting_questions
    GROUP BY question_id
) links
WHERE links.question_id = q.id;
DROP TABLE IF EXISTS job_posting_questions;
ALTER TABLE questions DROP COLUMN deprecated;
ALTER TABLE job_postings DROP COLUMN duration_minutes;
ALTER TABLE job_postings DROP COLUMN status;
