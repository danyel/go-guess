SHELL := /bin/sh

DATABASE_URL ?= postgres://go_guess:go_guess@localhost:5432/go_guess?sslmode=disable
JWT_SECRET ?= local-development-secret-change-me-12345
GOOSE := cd backend && go run github.com/pressly/goose/v3/cmd/goose@v3.26.0
BDD_COMPOSE := docker compose -f docker-compose.bdd.yml
HELM ?= helm
HELM_CHART := deploy/helm/go-guess
HELM_RELEASE ?= go-guess
HELM_NAMESPACE ?= go-guess
KUBECONFIG ?= $(HOME)/.config/kubectl/rancher.urpi.local.yaml

.PHONY: help dev db-up db-down migrate migrate-down seed backend frontend frontend-install test test-backend test-frontend test-integration test-bdd test-bdd-down test-env test-env-down lint build helm-lint helm-deploy-development helm-deploy-production

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
	@echo "make test 					full test suite: frontend, integration, and browser BDD"
	@echo "make test-backend			runs the tests for the backend"
	@echo "make test-frontend			runs the tests for the fronted"
	@echo "make test-integration		runs the integration tests"
	@echo "make test-bdd				runs browser BDD stories against the production image"
	@echo "make test-bdd-down			removes the isolated BDD stack and database"
	@echo "make test-env			    builds the docker tests image"
	@echo "make test-env-down      		stops the test image"
	@echo "make lint      				runs lint on the frontend"
	@echo "make build      				builds the entire project"
	@echo "make helm-lint				lints development and production Helm configurations"
	@echo "make helm-deploy-development	deploys the development Helm release"
	@echo "make helm-deploy-production	deploys the production Helm release"
dev:
	docker compose up --build

db-up:
	docker compose up -d db rabbitmq

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

test: frontend-install test-integration test-frontend test-bdd

test-backend:
	cd backend && go test ./...

test-frontend:
	cd frontend && npm test

test-integration:
	cd backend && go test -tags=integration ./...

test-bdd:
	@set -eu; \
	$(BDD_COMPOSE) down -v --remove-orphans; \
	trap '$(BDD_COMPOSE) down -v --remove-orphans >/dev/null 2>&1' EXIT INT TERM; \
	$(BDD_COMPOSE) up --build --abort-on-container-exit --exit-code-from bdd

test-bdd-down:
	$(BDD_COMPOSE) down -v --remove-orphans

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

helm-lint:
	KUBECONFIG="$(KUBECONFIG)" $(HELM) lint $(HELM_CHART) -f $(HELM_CHART)/values-development.yaml
	KUBECONFIG="$(KUBECONFIG)" $(HELM) lint $(HELM_CHART) -f $(HELM_CHART)/values-production.yaml
	KUBECONFIG="$(KUBECONFIG)" $(HELM) template $(HELM_RELEASE) $(HELM_CHART) \
		-f $(HELM_CHART)/values-development.yaml >/dev/null
	KUBECONFIG="$(KUBECONFIG)" $(HELM) template $(HELM_RELEASE) $(HELM_CHART) \
		-f $(HELM_CHART)/values-production.yaml >/dev/null

helm-deploy-development:
	KUBECONFIG="$(KUBECONFIG)" $(HELM) upgrade --install $(HELM_RELEASE) $(HELM_CHART) \
		--namespace $(HELM_NAMESPACE)-development --create-namespace \
		-f $(HELM_CHART)/values-development.yaml \
		--rollback-on-failure --wait --timeout 10m

helm-deploy-production:
	KUBECONFIG="$(KUBECONFIG)" $(HELM) upgrade --install $(HELM_RELEASE) $(HELM_CHART) \
		--namespace $(HELM_NAMESPACE)-production --create-namespace \
		-f $(HELM_CHART)/values-production.yaml \
		--rollback-on-failure --wait --timeout 10m
