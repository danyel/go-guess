SHELL := /bin/sh

DATABASE_URL ?= postgres://go_guess:go_guess@localhost:5432/go_guess?sslmode=disable
JWT_SECRET ?= local-development-secret-change-me-12345
GOOSE := cd backend && go run github.com/pressly/goose/v3/cmd/goose@v3.26.0

.PHONY: dev db-up db-down migrate migrate-down backend frontend test test-backend test-frontend test-integration lint build

dev:
	docker compose up --build

db-up:
	docker compose up -d db

db-down:
	docker compose down

migrate:
	$(GOOSE) -dir migrations postgres "$(DATABASE_URL)" up

migrate-down:
	$(GOOSE) -dir migrations postgres "$(DATABASE_URL)" down

backend:
	cd backend && DATABASE_URL="$(DATABASE_URL)" JWT_SECRET="$(JWT_SECRET)" go run ./cmd/api

frontend:
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && go test ./...

test-frontend:
	cd frontend && npm test

test-integration:
	cd backend && TEST_DATABASE_URL="$(DATABASE_URL)" go test -tags=integration ./internal/database/repository

lint:
	cd backend && go vet ./...
	cd frontend && npm run lint

build:
	cd backend && go build ./...
	cd frontend && npm run build
