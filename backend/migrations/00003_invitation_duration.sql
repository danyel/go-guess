-- +goose Up
ALTER TABLE invitations
    ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 60
        CHECK (duration_minutes BETWEEN 1 AND 480);

UPDATE invitations i
SET duration_minutes = j.duration_minutes
FROM job_postings j
WHERE j.id = i.job_id;

-- +goose Down
ALTER TABLE invitations DROP COLUMN duration_minutes;
