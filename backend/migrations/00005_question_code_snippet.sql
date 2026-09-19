-- +goose Up
ALTER TABLE questions
    ADD COLUMN code_snippet TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE questions DROP COLUMN code_snippet;
