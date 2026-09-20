SHELL := /bin/sh

DATABASE_URL ?= postgres://go_guess:go_guess@localhost:5432/go_guess?sslmode=disable
JWT_SECRET ?= local-development-secret-change-me-12345
GOOSE := cd backend && go run github.com/pressly/goose/v3/cmd/goose@v3.26.0

.PHONY: dev db-up db-down migrate migrate-down seed backend frontend frontend-install test test-backend test-frontend test-integration test-env test-env-down lint build

help:
	@echo "make dev        				builds the demo docker image"
	@echo "make db-up    				starts the database docker container"
	@echo "make db-down    				stops the database docker container"
	@echo "make migrate       			runs the sql scripts migration"
	@echo "make migrate-down 			revert the sql scripts migration"
	@echo "make seed        			seeds data into the database"
	@echo "make backend       			runs the backend"
	@echo "make frontend      			runs the frontend"
	@echo "make frontend-install     	installs the dependencies for the frontend"
	@echo "make test 					full test suite: test-backend test-frontend and test-integration"
	@echo "make test-backend			runs the tests for the backend"
	@echo "make test-frontend			runs the tests for the fronted"
	@echo "make test-integration		runs the integration tests"
	@echo "make test-env			    builds the docker tests image"
	@echo "make test-env-down      		stops the test image"
	@echo "make lint      				runs lint on the frontend"
	@echo "make build      				builds the entire project"
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
