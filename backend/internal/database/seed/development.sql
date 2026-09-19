INSERT INTO users (email, password_hash, display_name, role)
VALUES ('interviewer@go-guess.local', crypt('admin123', gen_salt('bf')), 'Lead Interviewer', 'interviewer')
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role;

INSERT INTO users (email, password_hash, display_name, role)
VALUES ('co-interviewer@go-guess.local', crypt('admin123', gen_salt('bf')), 'Co-Interviewer', 'interviewer')
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role;

INSERT INTO job_postings (title, description, seniority, position, status, duration_minutes)
SELECT 'Senior Go Backend Engineer', 'Build reliable APIs for passenger-facing railway systems.',
       'Senior', 'Backend Engineer', 'published', 60
WHERE NOT EXISTS (SELECT 1 FROM job_postings WHERE title = 'Senior Go Backend Engineer');

INSERT INTO job_postings (title, description, seniority, position, status, duration_minutes)
SELECT 'Full-stack Product Engineer', 'Deliver accessible operational tools from database to browser.',
       'Medior', 'Full-stack Engineer', 'published', 45
WHERE NOT EXISTS (SELECT 1 FROM job_postings WHERE title = 'Full-stack Product Engineer');

INSERT INTO questions (text, type, reference_answer)
SELECT 'How do you design graceful shutdown for an HTTP service?', 'open',
       'Stop accepting work, cancel dependent operations, drain active requests, and close resources within a deadline.'
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE text = 'How do you design graceful shutdown for an HTTP service?');

INSERT INTO questions (text, type)
SELECT 'Which construct protects shared data across goroutines?', 'radio'
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE text = 'Which construct protects shared data across goroutines?');

INSERT INTO questions (text, type, reference_answer, code_snippet)
SELECT 'Review this component and identify unnecessary renders.', 'code_review',
       'Use a stable key and avoid recreating expensive derived values when the candidates input has not changed.',
       E'function CandidateList({ candidates }) {\n  return candidates.map((candidate, index) => (\n    <CandidateCard key={index} candidate={candidate} />\n  ));\n}'
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE text = 'Review this component and identify unnecessary renders.');

INSERT INTO question_options (question_id, text)
SELECT q.id, option.text
FROM questions q
CROSS JOIN (VALUES ('sync.Mutex'), ('context.Context'), ('http.Client')) AS option(text)
WHERE q.text = 'Which construct protects shared data across goroutines?'
  AND NOT EXISTS (SELECT 1 FROM question_options existing WHERE existing.question_id = q.id);

INSERT INTO job_posting_questions (job_posting_id, question_id)
SELECT j.id, q.id
FROM job_postings j
JOIN questions q ON q.text IN (
    'How do you design graceful shutdown for an HTTP service?',
    'Which construct protects shared data across goroutines?'
)
WHERE j.title = 'Senior Go Backend Engineer'
ON CONFLICT DO NOTHING;

INSERT INTO job_posting_questions (job_posting_id, question_id)
SELECT j.id, q.id
FROM job_postings j
JOIN questions q ON q.text = 'Review this component and identify unnecessary renders.'
WHERE j.title = 'Full-stack Product Engineer'
ON CONFLICT DO NOTHING;

INSERT INTO job_posting_labels (job_posting_id, trait_id)
SELECT j.id, t.id FROM job_postings j JOIN traits t ON t.normalized IN ('backend', 'go')
WHERE j.title = 'Senior Go Backend Engineer' ON CONFLICT DO NOTHING;
INSERT INTO job_required_skills (job_posting_id, trait_id)
SELECT j.id, t.id FROM job_postings j JOIN traits t ON t.normalized IN ('go', 'postgresql', 'docker')
WHERE j.title = 'Senior Go Backend Engineer' ON CONFLICT DO NOTHING;
INSERT INTO job_additional_skills (job_posting_id, trait_id)
SELECT j.id, t.id FROM job_postings j JOIN traits t ON t.normalized = 'kubernetes'
WHERE j.title = 'Senior Go Backend Engineer' ON CONFLICT DO NOTHING;

INSERT INTO job_posting_labels (job_posting_id, trait_id)
SELECT j.id, t.id FROM job_postings j JOIN traits t ON t.normalized IN ('react', 'typescript')
WHERE j.title = 'Full-stack Product Engineer' ON CONFLICT DO NOTHING;
INSERT INTO job_required_skills (job_posting_id, trait_id)
SELECT j.id, t.id FROM job_postings j JOIN traits t ON t.normalized IN ('go', 'react', 'typescript')
WHERE j.title = 'Full-stack Product Engineer' ON CONFLICT DO NOTHING;
INSERT INTO job_additional_skills (job_posting_id, trait_id)
SELECT j.id, t.id FROM job_postings j JOIN traits t ON t.normalized = 'docker'
WHERE j.title = 'Full-stack Product Engineer' ON CONFLICT DO NOTHING;

INSERT INTO participants (first_name, last_name, birthday, email, contact_info, cv, cv_filename)
VALUES
    ('Ada', 'Lovelace', '1990-12-10', 'ada@example.com', '+32 470 00 00 01',
     convert_to('Senior backend engineer with Go, PostgreSQL and Docker experience.', 'UTF8'), 'ada-cv.txt'),
    ('Grace', 'Hopper', '1988-12-09', 'grace@example.com', '+32 470 00 00 02',
     convert_to('Full-stack developer working with Go, React and TypeScript.', 'UTF8'), 'grace-cv.txt')
ON CONFLICT (email) DO NOTHING;

INSERT INTO participant_traits (participant_id, trait_id)
SELECT p.id, t.id FROM participants p JOIN traits t ON t.normalized IN ('go', 'postgresql', 'docker')
WHERE p.email = 'ada@example.com' ON CONFLICT DO NOTHING;
INSERT INTO participant_traits (participant_id, trait_id)
SELECT p.id, t.id FROM participants p JOIN traits t ON t.normalized IN ('go', 'react', 'typescript')
WHERE p.email = 'grace@example.com' ON CONFLICT DO NOTHING;
