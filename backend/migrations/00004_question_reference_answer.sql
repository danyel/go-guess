-- +goose Up
ALTER TABLE questions
    ADD COLUMN reference_answer TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE questions DROP COLUMN reference_answer;
