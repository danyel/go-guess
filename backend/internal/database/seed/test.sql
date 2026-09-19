INSERT INTO users (email, password_hash, role)
VALUES ('integration@example.com', crypt('integration-password', gen_salt('bf')), 'interviewer')
ON CONFLICT (email) DO NOTHING;

INSERT INTO job_postings (title, description, seniority, position, status, duration_minutes)
SELECT 'Integration Backend Engineer', 'Deterministic job fixture for API and UI integration tests.',
       'Senior', 'Backend Engineer', 'published', 30
WHERE NOT EXISTS (SELECT 1 FROM job_postings WHERE title = 'Integration Backend Engineer');

INSERT INTO questions (text, type, reference_answer)
SELECT 'Explain graceful shutdown.', 'open',
       'Stop new work, cancel dependencies, drain requests, and close resources.'
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE text = 'Explain graceful shutdown.');

INSERT INTO questions (text, type, reference_answer, code_snippet)
SELECT 'Review the error handling.', 'code_review', 'Return or log the error instead of discarding it.',
       E'func save() error {\n  persist()\n  return nil\n}'
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE text = 'Review the error handling.');

INSERT INTO job_posting_questions (job_posting_id, question_id)
SELECT j.id, q.id FROM job_postings j
JOIN questions q ON q.text IN ('Explain graceful shutdown.', 'Review the error handling.')
WHERE j.title = 'Integration Backend Engineer'
ON CONFLICT DO NOTHING;

INSERT INTO job_posting_labels (job_posting_id, trait_id)
SELECT j.id, t.id FROM job_postings j JOIN traits t ON t.normalized = 'backend'
WHERE j.title = 'Integration Backend Engineer' ON CONFLICT DO NOTHING;
INSERT INTO job_required_skills (job_posting_id, trait_id)
SELECT j.id, t.id FROM job_postings j JOIN traits t ON t.normalized IN ('go', 'postgresql')
WHERE j.title = 'Integration Backend Engineer' ON CONFLICT DO NOTHING;

INSERT INTO participants (first_name, last_name, birthday, email, contact_info, cv, cv_filename)
VALUES ('Integration', 'Candidate', '1992-04-15', 'candidate.integration@example.com',
        '+32 470 00 00 99', convert_to('Backend engineer using Go and PostgreSQL.', 'UTF8'), 'integration-cv.txt')
ON CONFLICT (email) DO NOTHING;

INSERT INTO participant_traits (participant_id, trait_id)
SELECT p.id, t.id FROM participants p JOIN traits t ON t.normalized IN ('backend', 'go', 'postgresql')
WHERE p.email = 'candidate.integration@example.com' ON CONFLICT DO NOTHING;
