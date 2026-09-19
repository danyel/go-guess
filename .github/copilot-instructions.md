# Copilot instructions

## Build, test, and lint

Run repository-wide commands from the root:

```bash
make dev                 # run PostgreSQL, RabbitMQ, API, and frontend with development fixtures
make test                # complete suite, including disposable infrastructure integration tests
make test-integration    # Go tests; starts PostgreSQL and RabbitMQ Testcontainers
make test-env            # isolated seeded UI stack at http://localhost:15173
make test-env-down       # remove the test stack and its PostgreSQL volume
make lint                # go vet and ESLint
make build               # compile the API and production frontend
```

Focused tests:

```bash
cd backend && go test ./internal/service -run '^TestCandidatesRequireSixtyPercent$'
cd backend && go test -tags=integration ./internal/integration -run '^TestCompleteInterviewWorkflow$'
cd frontend && npm test -- src/App.test.tsx -t "filters jobs by title"
```

The required toolchain is Go 1.27.1 and React 19.3 with TypeScript/Vite. Use
`cd frontend && npm run format:check` for frontend formatting and `gofmt` for Go.

## Architecture

- `backend/cmd/api` wires configuration, PostgreSQL, security, services, handlers,
  and the Chi router. Requests flow through `internal/web/{router,handler,model,mapper}`
  to `internal/service/{model,services}` and then
  `internal/database/{repository,mapper,entity}`. Never expose GORM entities from
  handlers.
- `backend/cmd/seed` applies embedded environment-aware fixtures.
- `backend/internal/eventbus` publishes persisted interview notes to the durable
  `go-guess.interview-notes` RabbitMQ fanout exchange. Each API instance consumes
  through its own exclusive queue and distributes events to authenticated SSE
  subscribers.
- `frontend/src/App.tsx` owns routing/layout/screens, `src/api.ts` is the typed HTTP
  boundary, and `src/types.ts` contains client domain types. Vite proxies `/api` to
  the Go service in development.

Goose files in `backend/migrations` are schema-only and run in every environment.
`internal/database/seed/common.sql` contains shared reference data;
`development.sql` and `test.sql` contain idempotent environment-specific fixtures.
Every entity change requires a migration plus corresponding fixture and integration
test updates. Never put demo users or test records in schema migrations.

Authentication uses bcrypt passwords and HMAC-signed bearer JWTs. Domain routes are
protected except `/api/health`, `/api/auth/login`, and opaque-token participant
interview routes. Never expose password hashes, CV/photo bytes, or interviewer
reference answers in public JSON.

Questions are permanent reusable records linked to jobs through
`job_posting_questions`; detach links rather than deleting questions. Deprecated
questions remain searchable but cannot be newly attached. Question values are
`open`, `multiple_choice`, `radio`, and `code_review`. Choice types require at least
two options. Open/code-review types require `referenceAnswer`; code review also
requires `codeSnippet`.

Jobs move through `draft`, `published`, and `deprecated`. Publishing requires a
question, only published jobs can create invitations, and candidate matching uses
labels plus both skill groups with a 60% threshold. Invitation URLs use
`/participant/:invitationId`, where the identifier is an opaque token. Participant
questions are acceptance-gated and answers are saved before final submission;
interviewer review uses
`GET /api/jobs/{id}/invitations/{invitationId}`.

Only completed assessment invitations can receive a `passed` or `failed` outcome,
and only passed candidates can be scheduled for an interview. Scheduled
interviews include the creator plus selected co-interviewers. Attendees manage
their invitation through `/api/inbox`, see accepted interviews in `/api/calendar`,
and can write notes only after the interview has started. Notes are private to
authenticated attendees. The opaque `/participant/meeting/:candidateToken` view
exposes only candidate-safe schedule and shared-document data.

## Repository conventions

- Prefix every Go interface name with `I`.
- Keep web, service, and persistence models separate and convert them in adjacent
  `mapper` packages.
- Participant creation uses multipart fields `firstName`, `lastName`, `birthday`,
  `email`, `contactInfo`, `photo`, and `cv`.
- Return explicit errors; map expected failures to HTTP status codes and log
  unexpected failures instead of silently falling back.
- Commit every repository change with a meaningful conventional prefix such as
  `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, or `chore:`.
