# Copilot instructions

## Build, test, and lint

Run repository-wide commands from the root:

```bash
make dev                 # build and run PostgreSQL, API, and frontend
make db-up               # start only PostgreSQL
make migrate             # apply Goose migrations
make migrate-down        # roll back one migration
make test                # backend and frontend unit/component tests
make test-integration    # PostgreSQL-backed repository tests; database must be running
make lint                # go vet and ESLint
make build               # compile the API and production frontend
```

Run focused tests from the owning application:

```bash
cd backend && go test ./internal/service -run '^TestCandidatesRequireSixtyPercent$'
cd frontend && npm test -- src/App.test.tsx -t "filters jobs by title"
```

The required toolchain is Go 1.27.1 and React 19.3 with TypeScript/Vite. Frontend
formatting can be checked with `cd frontend && npm run format:check`; backend files
are formatted with `gofmt`.

## Architecture

The repository has two applications:

- `backend/` is a Go HTTP API. `cmd/api` wires configuration, PostgreSQL, security,
  services, handlers, and routing. Requests flow through
  `internal/web/{router,handler,model,mapper}` to
  `internal/service/{model,services}` and then
  `internal/database/{repository,mapper,entity}`. Do not bypass these mapping
  boundaries by exposing GORM entities from handlers.
- `frontend/` is a React SPA. `src/App.tsx` owns routing/layout/screens,
  `src/api.ts` is the typed HTTP boundary, and `src/types.ts` contains client domain
  types. Vite proxies `/api` to the Go service in development.

Goose SQL files in `backend/migrations/` are the database schema source of truth.
The initial migration also supplies representative jobs, questions, participants,
traits, and the local interviewer account.

Authentication is custom bearer-token authentication: passwords are bcrypt hashes,
`POST /api/auth/login` issues an HMAC-signed JWT, and all domain routes require that
token. Never return password hashes or participant photo/CV bytes in JSON; those
files have dedicated endpoints.

CV ingestion stores the original bytes and extracts text from plain text, PDF, or
DOCX input. Trait extraction only considers normalized traits already present in
the database. Candidate matching compares a participant's extracted traits with a
job's labels, required skills, and additional skills; include matches only at the
`service.CandidateThreshold` of 60% or higher.

Questions are permanent, reusable library records and jobs own many-to-many links
to them. Detaching removes only the link. The lifecycle is
`draft -> published -> deprecated`; publishing requires at least one question, and
only published jobs can create invitations. Once an invitation exists, its question
set cannot be changed, and its duration is snapshotted so later job edits do not
alter an active interview.

Invitation URLs use an opaque UUID token and public `/api/interviews/{token}` routes;
they do not use interviewer JWT authentication. An invitation progresses from
`pending` to `accepted` to `completed`. Answers may only be saved while accepted
and before the snapshotted timer expires.

## Repository conventions

- Every Go interface name starts with `I` (`IStore`, `IJobService`,
  `IParticipantService`, `ITokenManager`).
- Keep transport, service, and persistence structs separate. Conversion belongs in
  the adjacent `mapper` package, not in handlers or GORM entities.
- Question types are the exact API values `open`, `multiple_choice`, `radio`, and
  `code_review`. Multiple-choice and radio questions require at least two options.
- Never delete question records through job operations. Use
  `job_posting_questions` to attach/detach, and use the `deprecated` flag to retire
  library questions. Full question edits use `PUT /api/questions/{id}`; deprecation
  remains a separate `PATCH`.
- The question create/edit form builds multiple-choice and radio options one at a
  time. Keep option editing state separate from the saved options array and require
  at least two options for those types. Open and code-review questions instead
  require a `referenceAnswer` textarea. Never include that interviewer-only answer
  in public interview responses.
- Traits are de-duplicated case-insensitively through their normalized database
  value. Labels and both skill groups all reuse the same `traits` table.
- Participant creation is multipart form data using `firstName`, `lastName`,
  `birthday`, `email`, `contactInfo`, `photo`, and `cv`.
- Return explicit errors. Handlers convert expected validation/not-found/authentication
  failures to HTTP responses and log unexpected failures rather than silently
  falling back to demo data.
