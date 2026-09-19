# Go Guess frontend

React and TypeScript recruitment workspace built with Vite.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run format
npm run format:check
npm test
npm run build
```

Run one test:

```bash
npm test -- src/App.test.tsx -t "shows answer inputs"
```

## API integration

Vite proxies `/api` to `http://localhost:8080`. Login stores the returned JWT in
`sessionStorage`; protected requests send it as `Authorization: Bearer <token>`. API failures are
shown in the UI and are never replaced with demo data.

Supported routes:

- `POST /api/auth/login`
- `GET|POST /api/jobs`
- `GET /api/jobs/:id`
- `PATCH /api/jobs/:id` for interview status and duration
- `POST|DELETE /api/jobs/:id/questions/:questionId`
- `GET /api/jobs/:id/candidates`
- `GET|POST /api/jobs/:id/invitations`
- `GET|POST /api/questions` (`GET` accepts `?search=`)
- `PUT /api/questions/:id` to update question text, type, options, and reference answer
- `PATCH /api/questions/:id` to deprecate or restore a question
- `GET|POST /api/participants`
- `GET /api/participants/:id`
- `GET /api/participants/:id/photo`
- `GET /api/participants/:id/cv`
- `GET /api/interviews/:token`
- `POST /api/interviews/:token/accept`
- `PUT /api/interviews/:token/answers/:questionId`
- `POST /api/interviews/:token/finish`

Participant creation uses multipart fields `firstName`, `lastName`, `birthday`, `email`,
`contactInfo`, `photo`, and `cv`.

## Interview workflow

Authenticated interviewers create and edit reusable questions at `/questions`, configure job
status and duration, attach active library questions, and issue participant invitations from a job
detail page. Multiple-choice and radio questions require at least two explicitly added options.
Detaching a question removes only the job association; questions can be deprecated but not deleted.
Open-answer and code-review questions include an interviewer-only reference answer that is never
rendered in the participant interview.

Participants open the generated `/interview/:token` URL without signing in. The invitation token
authorizes the public interview API. Answers are saved when navigating between questions or
finishing, and the countdown is derived from the backend `acceptedAt` timestamp plus the job
duration so refreshing cannot reset it.

## Container

Build with `docker build -t go-guess-frontend .`. The production Nginx server serves the SPA and
proxies `/api` to the Docker Compose service `api:8080`.
