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

`docker compose up -d --build` serves the UI through the local Traefik edge at
<https://nmbs.guess-dev.urpi.be> and <https://ypto.guess-dev.urpi.be>. Browser
sign-in goes through the development Go Loose installation at
<https://nmbs.auth-dev.urpi.be>. Both domains must resolve to the local edge:

```text
127.0.0.1 nmbs.guess-dev.urpi.be ypto.guess-dev.urpi.be
127.0.0.1 nmbs.auth-dev.urpi.be ypto.auth-dev.urpi.be
```

Production uses `guess.urpi.be` and `auth.urpi.be` instead. `GO_LOOSE_AUTH_DOMAIN`
and `GO_LOOSE_APP_DOMAIN` select the pair; both default to the development
domains so a local run never touches the production identity provider.

Start the shared TLS proxy described in
`/home/dnoulet/go/infrastructure/docs/APPLICATIONS.md`, then open
<https://nmbs.guess-dev.urpi.be> or <https://ypto.guess-dev.urpi.be>. The
hostname's first label is the tenant ID: the frontend calls same-origin `/api` and
sends the same value in the `X-Tenant-Id` header on JSON, multipart,
file-download, and event-stream requests. The backend uses that tenant ID as the
isolated PostgreSQL schema and builds participant invitation and meeting links
from the matching tenant browser origin instead of the static localhost fallback.

Compose mounts the infrastructure CA from
`${LOCAL_CA_FILE:-../infrastructure/certs/local-ca.crt}` into the API at
`/certs/local-ca.crt`, which `GO_LOOSE_CA_FILE` points at so the API trusts the
local Traefik certificate. The browser is redirected through the matching Go Loose
tenant and returns to `/api/auth/callback`. Set the per-tenant
`GO_LOOSE_*_CLIENT_ID` and `GO_LOOSE_*_CLIENT_SECRET` variables in the
environment; never commit them.

Sign in with:

- Email: `interviewer@ypto.local`
- Password: `admin123`

Those credentials are only for hosts without Go Loose login. When Go Loose
client credentials are configured, the frontend exchanges the Go Loose session
for a JWT silently and redirects to the identity provider instead of showing the
password form.

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
documented local tenant hostnames; the API CORS policy permits the configured
tenant domain and `*.guess.local` development origins and
the `Authorization` and `X-Tenant-Id` request headers. Non-local
deployments keep using same-origin `/api`. Set a different secure `JWT_SECRET`
outside local development.

## API contract

The backend exposes its current OpenAPI 3.0 contract at
<https://nmbs.guess-dev.urpi.be/api/openapi.json>. The document is assembled in memory
from the same typed registrations that add routes to Chi, including request and
response schemas, status codes, authentication, tenant headers, path/query
parameters, multipart uploads, downloads, and event streams. It therefore
requires no generation command and cannot miss a newly registered route.

`/api/openapi.json` and `/api/health` are system endpoints and do not require a
tenant header. Every other route declares required `X-Tenant-Id`. Protected
operations also declare bearer authentication.

## Go Loose browser login

Tenant hosts start browser authentication at `GET /api/auth/login`. The API
redirects to `https://<tenant>.<GO_LOOSE_AUTH_DOMAIN>/connect/authorize`; Go Loose
returns to `/api/auth/callback`, and `GET /api/auth/session` exchanges the
resulting secure browser session for the application's bearer JWT. The tenant is
derived from the request host, or from `X-Forwarded-Host` when an ingress proxy
replaces it, and from `X-Tenant-Id` for API calls.

| Environment | `GO_LOOSE_AUTH_DOMAIN` | `GO_LOOSE_APP_DOMAIN` |
| --- | --- | --- |
| Local development | `auth-dev.urpi.be` | `guess-dev.urpi.be` |
| Kubernetes development | `auth-dev.urpi.be` | `guess-dev.urpi.be` |
| Production | `auth.urpi.be` | `guess.urpi.be` |

Those two variables, `GO_LOOSE_CA_FILE`, and per-tenant client ID and secret
variables are configured by Compose and by the chart. These routes do not
require a JWT:

- `GET /api/health` and `GET /api/openapi.json`
- browser login, callback, logout, and session routes under `/api/auth`
- `POST /api/auth/login` for password login outside configured SSO hosts
- opaque-token participant interview and meeting routes under
  `/api/interviews/{token}` and `/api/participant-meetings/{token}`

Login and participant routes still require `X-Tenant-Id`. Health and OpenAPI do
not. Browser authentication routes derive the tenant from the configured host.

The frontend decides whether to attempt browser login from the host it is served
on, then asks the API whether Go Loose is configured there: `GET /api/auth/session`
answers `404` for any host without a Go Loose login, which is the signal to show
the password form instead of redirecting. A `401` means Go Loose is configured and
the browser has no valid session yet, so the frontend redirects to
`GET /api/auth/login`.

## Switch the Git remote

Run `scripts/toggle-origin.sh` to inspect `origin` and switch it between
`https://github.com/danyel/go-guess.git` and
`https://forgejo.dev/exr462/go-guess.git`. The script exits without changing an
unrecognized remote URL.

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

Two images are published to the private registry: `go-guess-api:0.0.1` for the Go
service and `go-guess-web:0.0.1` for the React front end behind nginx.

```bash
docker build -t batty1039.startdedicated.net:5000/go-guess-api:0.0.1 ./backend
docker build -t batty1039.startdedicated.net:5000/go-guess-web:0.0.1 ./frontend
```

The API image listens on `8080` and applies database migrations and shared
fixtures before serving. The web image listens on `80`, serves the built assets,
and proxies `/api/` to `http://api:8080`, so both containers must share a
network with the API reachable under the DNS name `api`. PostgreSQL, RabbitMQ,
and these environment variables must be provided to the API:

```bash
docker run --rm -p 8080:8080 \
  -e DATABASE_URL='postgres://user:password@postgres:5432/go_guess?sslmode=disable' \
  -e RABBITMQ_URL='amqp://user:password@rabbitmq:5672/' \
  -e JWT_SECRET='replace-with-at-least-32-characters' \
  -e FRONTEND_URL='https://nmbs.guess-dev.urpi.be' \
  batty1039.startdedicated.net:5000/go-guess-api:0.0.1
```

The `Dockerfile` at the repository root still builds one combined image that
serves both halves on port `8080`. It is convenient for local runs and browser
BDD tests, while Kubernetes deploys the two images separately.

Pushes to `master` publish `go-guess:latest` and `go-guess:<commit-sha>` to the
private registry configured in `.github/workflows/publish-image.yml`. The
repository must provide `REGISTRY_USERNAME` and `REGISTRY_PASSWORD` secrets.

## Rancher and Helm

The chart under `deploy/helm/go-guess` deploys the API image, the web image, and
their PostgreSQL and RabbitMQ. Every tenant gets its own HTTPS host at
`https://<tenant>.guess.urpi.be` in production and
`https://<tenant>.guess-dev.urpi.be` in the development profile. The chart values are documented in
[deploy/helm/go-guess/README.md](deploy/helm/go-guess/README.md).

One web deployment serves every tenant host because the API resolves the tenant
from the request `Host` header, so a new tenant is one entry in `tenants`.

Install the cluster prerequisites once per cluster. Storage for persistent
volumes, an ingress-nginx controller for the `nginx` ingress class, and
cert-manager for the chart-issued certificate:

```bash
make cluster-prepare
```

Then validate or deploy one of the environment profiles:

```bash
make helm-lint
make helm-deploy-development
make helm-deploy-production
```

Development uses `latest` images, development fixtures, and ephemeral database
and broker storage in namespace `go-insane-development`. Production uses the
released `0.0.1` tags, production fixtures, and persistent volumes in namespace
`go-insane-production`.

Certificates are self-signed and issued by the chart, so every browser or client
that opens a tenant host needs the CA from the release:

```bash
kubectl -n go-insane-production get secret go-guess-web-ca \
  -o jsonpath='{.data.ca\.crt}' | base64 -d > go-guess-ca.crt
```

Point each tenant host at the ingress controller address, then open
`https://nmbs.guess.urpi.be` and `https://ypto.guess.urpi.be`. Browser sign-in
through Go Loose needs the per-tenant client credentials; pass them from the
environment to `make helm-deploy-production`:

```bash
export GO_LOOSE_NMBS_CLIENT_ID=... GO_LOOSE_NMBS_CLIENT_SECRET=...
export GO_LOOSE_YPTO_CLIENT_ID=... GO_LOOSE_YPTO_CLIENT_SECRET=...
```

Without credentials for a tenant, that host keeps password login. The cluster
served by `~/.kube/config` is managed by Rancher at `rancher.urpi.be`, which is
the management interface and not the deployment target. One.com DNS, Nginx,
Certbot, and firewall instructions for the single-node dedicated server are in
`deploy/nginx/README.md`.

To use external managed services, disable the bundled StatefulSets and provide
full connection URLs:

```bash
helm upgrade --install go-guess deploy/helm/go-guess \
  --namespace go-insane-production --create-namespace \
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
- Optional secrets `GO_LOOSE_NMBS_CLIENT_ID`, `GO_LOOSE_NMBS_CLIENT_SECRET`,
  `GO_LOOSE_YPTO_CLIENT_ID`, and `GO_LOOSE_YPTO_CLIENT_SECRET`.

Because the configured image registry uses HTTP, every Rancher cluster node must
trust `batty1039.startdedicated.net:5000` as an insecure registry. Use HTTPS for
the registry in production when possible.

## Architecture

Requests enter the Chi router and web handlers under `backend/internal/web`.
Tenant isolation runs first. The protected interviewer group then requires a
bearer JWT, issued either by `POST /api/auth/login` or by exchanging a Go Loose
browser session.
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
