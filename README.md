# go-guess

Recruitment workspace for interviewers to define job profiles and a reusable
question library, manage participants, extract known traits from uploaded CVs,
invite candidates who match at least 60% of a posting's labels and skills, and run
timed assessments followed by collaborative interviews.

## Stack

- Go 1.27.1 HTTP API using Chi, GORM, PostgreSQL, Goose, bcrypt, and signed JWTs
- React 19.3, TypeScript, and Vite
- PostgreSQL 18
- RabbitMQ 4 for live interview event fanout

## Run locally

The complete stack runs with:

```bash
make dev
```

Add the local tenant hostnames once:

```text
127.0.0.1 nmbs.guess.local ypto.guess.local
127.0.0.1 auth.dev nmbs.auth.dev ypto.auth.dev
```

Start the shared TLS proxy described in
`/home/dnoulet/go/infrasctruture/docs/APPLICATIONS.md`, then open
<https://nmbs.guess.local> or <https://ypto.guess.local>. The hostname's first
label is the tenant ID: the frontend calls same-origin `/api` and sends the same value in the
`X-Tenant-Id` header on JSON, multipart, file-download, and event-stream
requests. The backend uses that tenant ID as the isolated PostgreSQL schema and
builds participant invitation and meeting links from the matching tenant browser
origin instead of the static localhost fallback.

Compose mounts the infrastructure CA from
`${LOCAL_DEV_CERTS_DIR:-/home/dnoulet/go/infrasctruture/certs}` into the API so
its HTTPS authorization calls to Go Loose validate normally.

Sign in with:

- Email: `interviewer@ypto.local`
- Password: `admin123`

To run the applications outside containers:

```bash
make db-up
make migrate
make seed
make backend
make frontend
```

The API listens on port `8080` inside Docker and is exposed to browsers only
through Traefik and the frontend's same-origin `/api` proxy. Vite permits the
documented local tenant hostnames; the API CORS policy permits `*.guess.local` development origins and
the `Authorization`, `X-API-Key`, and `X-Tenant-Id` request headers. Non-local
deployments keep using same-origin `/api`. Set a different secure `JWT_SECRET`
outside local development. Protected interviewer calls also need a Go Loose API
key, documented below.

## API contract

The backend exposes its current OpenAPI 3.0 contract at
<https://nmbs.guess.local/api/openapi.json>. The document is assembled in memory
from the same typed registrations that add routes to Chi, including request and
response schemas, status codes, authentication, tenant headers, path/query
parameters, multipart uploads, downloads, and event streams. It therefore
requires no generation command and cannot miss a newly registered route.

`/api/openapi.json` and `/api/health` are system endpoints and do not require a
tenant header. Every other route declares required `X-Tenant-Id`. Protected
operations also declare `apiKeyAuth` (`X-API-Key`) and `bearerAuth`.

## Go Loose authorization

Interviewer routes are authorized by Go Loose before the JWT check. The tenant
is read from the request `X-Tenant-Id` header and sent to Go Loose with
application slug `guess`. It is not taken from process configuration. The client
calls `POST /api/v1/authorize` on every protected request, removes `X-API-Key`
before the handler runs, and fails closed on a missing key, a denial, or a
control-plane error. There is no allow-on-error fallback. The client timeout is
2 seconds.

`GO_LOOSE_BASE_URL` is the authorize base URL. The default is
`https://%s.auth.dev`. A single `%s` is replaced with the tenant, which must
then be one DNS label (`nmbs`, not `nmbs.auth.dev` or a host with a port). A
URL without `%s` is used unchanged, while the tenant still comes from the
header. Docker Compose passes this variable to the API. Helm sets it from
`app.goLooseBaseURL`.

These routes do not require `X-API-Key` or a JWT:

- `GET /api/health` and `GET /api/openapi.json`
- `POST /api/auth/login`
- opaque-token participant interview and meeting routes under
  `/api/interviews/{token}` and `/api/participant-meetings/{token}`

Login and participant routes still require `X-Tenant-Id`. Health and OpenAPI do
not.

Issue one API key per tenant in the Go Loose console for the `guess`
application. The local installer seed creates that application for `nmbs` and
`ypto`. For a containerized frontend, pass the key at image build time:

```bash
VITE_GO_LOOSE_API_KEY='gl_replace_with_issued_secret' docker compose build web
```

For Vite outside Docker, put the same variable in `frontend/.env.local`. That
file is ignored. Vite inlines `VITE_` variables into the browser bundle, so this
key is visible to anyone who can load the interviewer application. It identifies
the Guess application to Go Loose; it does not replace the interviewer JWT or
the participant token. Do not commit it or reuse a key across tenants.

The published production image does not receive this build argument. A manual
production image can:

```bash
docker build --build-arg VITE_GO_LOOSE_API_KEY='gl_replace_with_issued_secret' -t go-guess .
```

## Quality commands

```bash
make test                 # full suite, including disposable infrastructure integration tests
make test-integration     # Go integration suite with PostgreSQL and RabbitMQ containers
make lint
make build
```

Run one backend test:

```bash
cd backend && go test ./internal/service -run '^TestCandidatesRequireSixtyPercent$'
```

Run one frontend test:

```bash
cd frontend && npm test -- src/app/App.test.tsx -t "filters jobs by title"
```

Run the browser-level BDD user stories against an isolated production image:

```bash
make test-bdd
```

The human-readable scenarios live in
`bdd/features/recruitment-workspace.feature`. Add, remove, or edit scenarios in
that single file; reusable Playwright-backed steps live under `bdd/steps`.
Every run creates a fresh PostgreSQL database, loads deterministic test fixtures,
starts the complete production container with RabbitMQ, and writes an HTML report
to `bdd/reports/cucumber.html`. Use `make test-bdd-down` to remove a manually
started BDD stack.

Docker must be available for `make test`. The integration suite starts PostgreSQL
18 and RabbitMQ 4 in disposable Testcontainers, applies every Goose migration,
loads deterministic test fixtures, exercises login and the complete assessment and
interview workflow, verifies live note and document fanout, and removes both containers
afterward.

Start an isolated application stack populated with test data for manual UI testing:

```bash
make test-env
# Open http://localhost:15173 and use integration@example.com / integration-password
make test-env-down
```

## Production image

Build the complete application as a single image:

```bash
docker build -t go-guess .
```

The image serves the frontend and API on port `8080`. It applies database
migrations and shared production fixtures before startup. PostgreSQL, RabbitMQ,
and these environment variables must be provided. `GO_LOOSE_BASE_URL` is
optional and defaults to `https://%s.auth.dev`:

```bash
docker run --rm -p 8080:8080 \
  -e DATABASE_URL='postgres://user:password@postgres:5432/go_guess?sslmode=disable' \
  -e RABBITMQ_URL='amqp://user:password@rabbitmq:5672/' \
  -e JWT_SECRET='replace-with-at-least-32-characters' \
  -e FRONTEND_URL='https://go-guess.example.com' \
  -e GO_LOOSE_BASE_URL='https://%s.auth.dev' \
  go-guess
```

Pushes to `master` publish `go-guess:latest` and `go-guess:<commit-sha>` to the
private registry configured in `.github/workflows/publish-image.yml`. The
repository must provide `REGISTRY_USERNAME` and `REGISTRY_PASSWORD` secrets.

## Rancher and Helm

The chart under `deploy/helm/go-guess` deploys the application, PostgreSQL, and
RabbitMQ. It works with any Kubernetes cluster managed by Rancher; Rancher's free
edition does not restrict Helm or GitHub Actions deployments.

Validate or deploy one of the environment profiles:

```bash
make helm-lint
make helm-deploy-development
make helm-deploy-production
```

For the repository's single-node Docker Rancher setup, run
`make rancher-storage` once before the first production deployment. This
installs the default persistent StorageClass documented in
`rancher-install.txt`.

The chart passes `app.goLooseBaseURL` to the API as `GO_LOOSE_BASE_URL`. The
default is `https://%s.auth.dev`. Override it when Go Loose is not reachable
at `<tenant>.auth.dev`:

```bash
helm upgrade --install go-guess deploy/helm/go-guess \
  --set-string app.goLooseBaseURL='https://%s.auth.example.com'
```

Development uses demo fixtures, ephemeral database and message-broker storage,
and NodePort `30080`. Production uses production fixtures, persistent volumes,
generated secrets that are preserved across upgrades, and larger resource
limits. It exposes the application at NodePort `31374` for the dedicated-server
Nginx proxy while PostgreSQL and RabbitMQ remain cluster-internal. The public
URL is `https://goguess.urpi.be`; one.com DNS, Nginx, Certbot, firewall, and
verification instructions are in `deploy/nginx/README.md`.

To use external managed services, disable the bundled StatefulSets and provide
full connection URLs:

```bash
helm upgrade --install go-guess deploy/helm/go-guess \
  --namespace go-guess-production --create-namespace \
  -f deploy/helm/go-guess/values-production.yaml \
  --set postgresql.enabled=false \
  --set rabbitmq.enabled=false \
  --set-string secrets.databaseURL="$DATABASE_URL" \
  --set-string secrets.rabbitmqURL="$RABBITMQ_URL"
```

`.github/workflows/deploy-rancher.yml` supports manual development or production
deployment. It also deploys production automatically after the image publishing
workflow succeeds. Create GitHub environments named `development` and
`production`, then configure:

- Secret `RANCHER_KUBE_CONFIG_BASE64`: base64-encoded kubeconfig downloaded from
  Rancher.
- Secrets `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`, and
  `GO_GUESS_JWT_SECRET`.
- Variable `RANCHER_NAMESPACE` for the target namespace.
- Optional variable `GO_GUESS_FRONTEND_URL` when overriding an environment's
  configured public URL.

Because the configured image registry uses HTTP, every Rancher cluster node must
trust `batty1039.startdedicated.net:5000` as an insecure registry. Use HTTPS for
the registry in production when possible.

## Architecture

Requests enter the Chi router and web handlers under `backend/internal/web`.
Tenant isolation runs first. The protected interviewer group then applies Go
Loose API-key authorization and JWT authentication.
Web request/response models are translated to service models before business logic
runs. Services own validation, CV trait extraction, and candidate scoring. The
repository maps service models to GORM entities and persists them in PostgreSQL.

The React application uses a typed API client and routes for authentication, job
postings, the searchable question library, participants, candidate matches, and
invitations. Public `/participant/:invitationId` routes provide an acceptance-gated
welcome screen, timed question navigation, autosaved answers, progress, and
submission without requiring an interviewer login. Interviewers can review every
saved answer from the job's invitation list. Vite proxies `/api` to the Go service
during local development.

Completed assessments can be marked passed or failed. A passed candidate can be
scheduled for an interview with a date, location or meeting link, shared document,
and selected co-interviewers. Each interviewer has an inbox for invitations and a
calendar for accepted interviews. During a started interview, attendees can add
private notes. Notes and shared-document changes are published through a durable
RabbitMQ fanout exchange and delivered over server-sent-event streams. Authenticated
interviewer sessions receive both event types; the candidate's opaque meeting link
uses a token-authorized stream that receives shared-document updates but never
private notes or assessment reference answers.

Development fixtures include `co-interviewer@go-guess.local` with password
`admin123`. Additional co-interviewers can be created from the Users screen.

Goose migrations in `backend/migrations` are schema-only and run in every
environment. Embedded SQL under `backend/internal/database/seed` separates shared
reference traits from idempotent development and test fixtures. Docker Compose
loads development fixtures by default; production loads only shared data. Uploaded
CVs are stored as bytes; plain text, PDF, and DOCX content is inspected for
normalized traits already defined by job postings.

Jobs move through `draft`, `published`, and `deprecated` states. Questions are
editable, permanent library records: jobs attach and detach links rather than
owning or deleting questions. Deprecated questions remain available for historical
jobs but cannot be newly attached. Invitations snapshot the interview duration and
can only be generated for matching participants on published jobs.

Open and code-review questions store an interviewer-only reference answer.
Multiple-choice and radio questions instead store a list of possible responses.
Reference answers are deliberately omitted from the public participant interview
payload. Code-review questions also store a participant-visible code snippet that
is presented with line numbers in a pull-request-style review panel.
