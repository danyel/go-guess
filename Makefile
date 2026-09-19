SHELL := /bin/sh

DATABASE_URL ?= postgres://go_guess:go_guess@localhost:5432/go_guess?sslmode=disable
JWT_SECRET ?= local-development-secret-change-me-12345
GOOSE := cd backend && go run github.com/pressly/goose/v3/cmd/goose@v3.26.0

.PHONY: dev db-up db-down migrate migrate-down seed backend frontend frontend-install test test-backend test-frontend test-integration test-env test-env-down lint build

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

seed:
	cd backend && DATABASE_URL="$(DATABASE_URL)" APP_ENV="$${APP_ENV:-development}" go run ./cmd/seed

backend:
	cd backend && DATABASE_URL="$(DATABASE_URL)" JWT_SECRET="$(JWT_SECRET)" go run ./cmd/api

frontend:
	cd frontend && npm run dev

frontend-install:
	cd frontend && npm ci

test: frontend-install test-integration test-frontend

test-backend:
	cd backend && go test ./...

test-frontend:
	cd frontend && npm test

test-integration:
	cd backend && go test -tags=integration ./...

test-env:
	COMPOSE_PROJECT_NAME=go-guess-test APP_ENV=test DB_PORT=15432 API_PORT=18080 \
		WEB_PORT=15173 FRONTEND_URL=http://localhost:15173 RABBITMQ_AMQP_PORT=15673 \
		RABBITMQ_MANAGEMENT_PORT=25673 docker compose up -d --build

test-env-down:
	COMPOSE_PROJECT_NAME=go-guess-test docker compose down -v --remove-orphans

lint:
	cd backend && go vet ./...
	cd frontend && npm run lint

build:
	cd backend && go build ./...
	cd frontend && npm run build
