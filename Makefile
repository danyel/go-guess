SHELL := /bin/sh
REGISTRY_IMAGE ?= batty1039.startdedicated.net:5000/go-tell
DATABASE_URL ?= postgres://go_guess:go_guess@localhost:5432/go_guess?sslmode=disable
JWT_SECRET ?= local-development-secret-change-me-12345
GOOSE := cd backend && go run github.com/pressly/goose/v3/cmd/goose@v3.26.0
BDD_COMPOSE := docker compose -f docker-compose.bdd.yml
HELM ?= helm
HELM_CHART := deploy/helm/go-guess
HELM_RELEASE ?= go-guess
HELM_NAMESPACE ?= go-insane
KUBECONFIG ?= $(HOME)/.kube/config
HELM_KUBECTL := KUBECONFIG="$(KUBECONFIG)" $(HELM)
GO_LOOSE_SET ?= --set-string api.goLoose.tenants.nmbs.clientID="$${GO_LOOSE_NMBS_CLIENT_ID:-}" \
	--set-string api.goLoose.tenants.nmbs.clientSecret="$${GO_LOOSE_NMBS_CLIENT_SECRET:-}" \
	--set-string api.goLoose.tenants.ypto.clientID="$${GO_LOOSE_YPTO_CLIENT_ID:-}" \
	--set-string api.goLoose.tenants.ypto.clientSecret="$${GO_LOOSE_YPTO_CLIENT_SECRET:-}"

.PHONY: help dev db-up db-down migrate migrate-down seed backend frontend frontend-install test test-backend test-frontend test-integration test-bdd test-bdd-down test-env test-env-down lint build rancher-storage ingress-nginx-install cert-manager-install cluster-prepare helm-lint helm-deploy-development helm-deploy-production helm-down-production helm-down-development

help:
	@echo "make dev        		builds the demo docker image"
	@echo "make db-up    			starts the database docker container"
	@echo "make db-down    		stops the database docker container"
	@echo "make migrate       		runs the sql scripts migration"
	@echo "make migrate-down 		revert the sql scripts migration"
	@echo "make seed        		seeds data into the database"
	@echo "make backend       		runs the backend"
	@echo "make frontend      		runs the frontend"
	@echo "make frontend-install     	installs the dependencies for the frontend"
	@echo "make test 			full test suite: frontend, integration, and browser BDD"
	@echo "make test-backend		runs the tests for the backend"
	@echo "make test-frontend		runs the tests for the frontend"
	@echo "make test-integration		runs the integration tests"
	@echo "make test-bdd			runs browser BDD stories against the production image"
	@echo "make test-bdd-down		removes the isolated BDD stack and database"
	@echo "make test-env			builds the docker tests image"
	@echo "make test-env-down      	stops the test image"
	@echo "make lint      			runs lint on the frontend"
	@echo "make build      		builds the entire project"
	@echo "make docker     		build the all-in-one image"
	@echo "make docker-push		build and push the image to the private registry"
	@echo "make docker-run 		run the image on :8080"
	@echo "make rancher-storage		installs the persistent local-path StorageClass"
	@echo "make ingress-nginx-install	installs the ingress-nginx controller serving 80/443"
	@echo "make cert-manager-install	installs cert-manager for chart-issued TLS certificates"
	@echo "make cluster-prepare		runs every cluster prerequisite in order"
	@echo "make helm-lint			lints development and production Helm configurations"
	@echo "make helm-deploy-development	deploys the development Helm release"
	@echo "make helm-deploy-production	deploys the production Helm release"
	@echo "make helm-down-development	shuts down the development Helm release"
	@echo "make helm-down-production	shuts down the production Helm release"
dev:
	docker compose up --build

db-up:
	docker compose up -d db rabbitmq

db-down:
	docker compose down

migrate:
	$(GOOSE) -dir migrations postgres "host=localhost user=go_guess password=go_guess dbname=go_guess port=5432 sslmode=disable search_path=ypto" up

migrate-down:
	$(GOOSE) -dir migrations postgres "host=localhost user=go_guess password=go_guess dbname=go_guess port=5432 sslmode=disable search_path=ypto" down

seed:
	cd backend && DATABASE_URL="$(DATABASE_URL)&search_path=ypto,public" APP_ENV="$${APP_ENV:-development}" go run ./cmd/seed

backend:
	cd backend && DATABASE_URL="$(DATABASE_URL)" JWT_SECRET="$(JWT_SECRET)" go run ./cmd/api

frontend:
	cd frontend && npm run dev --host

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

docker:
	docker build -t $(IMAGE):$(TAG) .

docker-push: docker
	docker tag $(IMAGE):$(TAG) $(REGISTRY_IMAGE):$(TAG)
	docker push $(REGISTRY_IMAGE):$(TAG)

docker-run:
	docker run --rm -p 8080:8080 --env-file .env $(IMAGE):$(TAG)


rancher-storage:
	KUBECONFIG="$(KUBECONFIG)" kubectl apply -f deploy/rancher/local-path.yaml

ingress-nginx-install:
	$(HELM_KUBECTL) repo add ingress-nginx https://kubernetes.github.io/ingress-nginx --force-update
	$(HELM_KUBECTL) repo update
	$(HELM_KUBECTL) upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
		--namespace ingress-nginx --create-namespace \
		--set controller.service.type=NodePort \
		--set controller.hostPort.enabled=true \
		--set controller.kind=DaemonSet \
		--set controller.admissionWebhooks.enabled=false \
		--wait --timeout 10m

cert-manager-install:
	$(HELM_KUBECTL) repo add jetstack https://charts.jetstack.io --force-update
	$(HELM_KUBECTL) repo update
	$(HELM_KUBECTL) upgrade --install cert-manager jetstack/cert-manager \
		--namespace cert-manager --create-namespace \
		--set crds.enabled=true \
		--wait --timeout 10m

cluster-prepare: rancher-storage ingress-nginx-install cert-manager-install

helm-lint:
	KUBECONFIG="$(KUBECONFIG)" $(HELM) lint $(HELM_CHART) -f $(HELM_CHART)/values-development.yaml
	KUBECONFIG="$(KUBECONFIG)" $(HELM) lint $(HELM_CHART) -f $(HELM_CHART)/values-production.yaml
	KUBECONFIG="$(KUBECONFIG)" $(HELM) template $(HELM_RELEASE) $(HELM_CHART) \
		-f $(HELM_CHART)/values-development.yaml >/dev/null
	KUBECONFIG="$(KUBECONFIG)" $(HELM) template $(HELM_RELEASE) $(HELM_CHART) \
		-f $(HELM_CHART)/values-production.yaml >/dev/null

helm-deploy-development:
	$(HELM_KUBECTL) upgrade --install $(HELM_RELEASE) $(HELM_CHART) \
		--namespace $(HELM_NAMESPACE)-development --create-namespace \
		-f $(HELM_CHART)/values-development.yaml \
		--set secrets.postgresqlPassword="go_guess" \
		--set secrets.rabbitmqPassword="guest" \
		$(GO_LOOSE_SET) \
		--rollback-on-failure --wait --timeout 10m

helm-deploy-production:
	$(HELM_KUBECTL) upgrade --install $(HELM_RELEASE) $(HELM_CHART) \
		--namespace $(HELM_NAMESPACE)-production --create-namespace \
		-f $(HELM_CHART)/values-production.yaml \
		--set secrets.postgresqlPassword="go_guess" \
		--set secrets.rabbitmqPassword="guest" \
		$(GO_LOOSE_SET) \
		--wait --timeout 10m

helm-down-production:
	$(HELM_KUBECTL) uninstall $(HELM_RELEASE) -n $(HELM_NAMESPACE)-production

helm-down-development:
	$(HELM_KUBECTL) uninstall $(HELM_RELEASE) -n $(HELM_NAMESPACE)-development
