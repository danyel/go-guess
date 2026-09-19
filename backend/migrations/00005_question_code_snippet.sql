-- +goose Up
ALTER TABLE questions
    ADD COLUMN code_snippet TEXT NOT NULL DEFAULT '';

UPDATE questions
SET code_snippet = E'function CandidateList({ candidates }) {\n  return candidates.map(candidate => (\n    <CandidateCard candidate={candidate} />\n  ));\n}'
WHERE type = 'code_review' AND code_snippet = '';

-- +goose Down
ALTER TABLE questions DROP COLUMN code_snippet;
