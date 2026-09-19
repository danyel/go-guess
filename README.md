# go-guess

Recruitment workspace for interviewers to define job profiles and a reusable
question library, manage participants, extract known traits from uploaded CVs,
invite candidates who match at least 60% of a posting's labels and skills, and run
timed participant interviews.

## Stack

- Go 1.27.1 HTTP API using Chi, GORM, PostgreSQL, Goose, bcrypt, and signed JWTs
- React 19.3, TypeScript, and Vite
- PostgreSQL 18

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
make backend
make frontend
```

The API listens on <http://localhost:8080>. Set a different secure `JWT_SECRET`
outside local development.

## Quality commands

```bash
make test
make test-integration
make lint
make build
```

Run one backend test:

```bash
cd backend && go test ./internal/service -run '^TestCandidatesRequireSixtyPercent$'
```

Run one frontend test:

```bash
cd frontend && npm test -- src/App.test.tsx -t "filters jobs by title"
```

## Architecture

Requests enter the Chi router and web handlers under `backend/internal/web`.
Web request/response models are translated to service models before business logic
runs. Services own validation, CV trait extraction, and candidate scoring. The
repository maps service models to GORM entities and persists them in PostgreSQL.

The React application uses a typed API client and routes for authentication, job
postings, the searchable question library, participants, candidate matches, and
invitations. Public `/interview/:token` routes provide the participant welcome,
timed question navigation, autosaved answers, and completion flow without requiring
an interviewer login. Vite proxies `/api` to the Go service during local development.

Goose migrations in `backend/migrations` are the schema source of truth and include
representative local data. Uploaded CVs are stored as bytes; plain text, PDF, and
DOCX content is inspected for normalized traits already defined by job postings.

Jobs move through `draft`, `published`, and `deprecated` states. Questions are
editable, permanent library records: jobs attach and detach links rather than
owning or deleting questions. Deprecated questions remain available for historical
jobs but cannot be newly attached. Invitations snapshot the interview duration and
can only be generated for matching participants on published jobs.

Open and code-review questions store an interviewer-only reference answer.
Multiple-choice and radio questions instead store a list of possible responses.
Reference answers are deliberately omitted from the public participant interview
payload.
