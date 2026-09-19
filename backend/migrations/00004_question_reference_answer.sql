-- +goose Up
ALTER TABLE questions
    ADD COLUMN reference_answer TEXT NOT NULL DEFAULT '';

UPDATE questions
SET reference_answer = CASE
    WHEN type = 'open' THEN 'Use context cancellation, stop accepting work, drain active requests, and close dependencies within a deadline.'
    WHEN type = 'code_review' THEN 'Identify unstable dependencies or state updates that cause avoidable renders and propose memoization only where measured.'
    ELSE reference_answer
END;

-- +goose Down
ALTER TABLE questions DROP COLUMN reference_answer;
