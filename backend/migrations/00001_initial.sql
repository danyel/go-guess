-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE traits (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    normalized VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE job_postings (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    seniority VARCHAR(50) NOT NULL,
    position VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questions (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('open', 'multiple_choice', 'radio', 'code_review')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE question_options (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL
);

CREATE TABLE participants (
    id BIGSERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birthday DATE,
    email VARCHAR(320) NOT NULL UNIQUE,
    contact_info TEXT,
    photo BYTEA,
    photo_type VARCHAR(100),
    cv BYTEA,
    cv_filename VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_posting_labels (
    job_posting_id BIGINT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    trait_id BIGINT NOT NULL REFERENCES traits(id) ON DELETE CASCADE,
    PRIMARY KEY (job_posting_id, trait_id)
);

CREATE TABLE job_required_skills (
    job_posting_id BIGINT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    trait_id BIGINT NOT NULL REFERENCES traits(id) ON DELETE CASCADE,
    PRIMARY KEY (job_posting_id, trait_id)
);

CREATE TABLE job_additional_skills (
    job_posting_id BIGINT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
    trait_id BIGINT NOT NULL REFERENCES traits(id) ON DELETE CASCADE,
    PRIMARY KEY (job_posting_id, trait_id)
);

CREATE TABLE participant_traits (
    participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    trait_id BIGINT NOT NULL REFERENCES traits(id) ON DELETE CASCADE,
    PRIMARY KEY (participant_id, trait_id)
);

-- +goose Down
DROP TABLE IF EXISTS participant_traits;
DROP TABLE IF EXISTS job_additional_skills;
DROP TABLE IF EXISTS job_required_skills;
DROP TABLE IF EXISTS job_posting_labels;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS question_options;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS job_postings;
DROP TABLE IF EXISTS traits;
DROP TABLE IF EXISTS users;
