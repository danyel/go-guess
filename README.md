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

Open <http://localhost:5173> and sign in with:

- Email: `interviewer@go-guess.local`
- Password: `admin123`

To run the applications outside containers:

```bash
make db-up
make migrate
make seed
make backend
make frontend
```

The API listens on <http://localhost:8080>. Set a different secure `JWT_SECRET`
outside local development.

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
and these environment variables must be provided:

```bash
docker run --rm -p 8080:8080 \
  -e DATABASE_URL='postgres://user:password@postgres:5432/go_guess?sslmode=disable' \
  -e RABBITMQ_URL='amqp://user:password@rabbitmq:5672/' \
  -e JWT_SECRET='replace-with-at-least-32-characters' \
  -e FRONTEND_URL='https://go-guess.example.com' \
  go-guess
```

Pushes to `master` publish `go-guess:latest` and `go-guess:<commit-sha>` to the
private registry configured in `.github/workflows/publish-image.yml`. The
repository must provide `REGISTRY_USERNAME` and `REGISTRY_PASSWORD` secrets.

## Architecture

Requests enter the Chi router and web handlers under `backend/internal/web`.
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
