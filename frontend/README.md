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
npm test -- src/app/App.test.tsx -t "filters jobs by title"
```

## Source structure

- `src/app` contains the application shell, providers, routes, and route-level tests.
- `src/features` groups pages and components by business capability.
- `src/components` contains UI shared by multiple features.
- `src/config/navigation.ts` defines configurable footer sitemap and useful-link groups.
- `src/api/client.ts` is the typed HTTP boundary.
- `src/types` contains API and domain types.
- `src/styles/global.css` contains shared tokens and layout styles.

Keep feature-only UI close to its feature instead of adding more screens to the
application shell.

## API integration

Vite proxies `/api` to `http://localhost:8080`. Login stores the returned JWT in
`sessionStorage`; protected requests send it as `Authorization: Bearer <token>`. API failures are
shown in the UI and are never replaced with demo data. A `401` from a protected
JSON, file, or event-stream request clears authentication and returns the user to
`/login`. The app also schedules logout from the JWT expiration claim so an idle
expired session cannot remain on a protected page.

Supported routes:

- `POST /api/auth/login`
- `GET|POST /api/jobs`
- `GET /api/jobs/:id`
- `PATCH /api/jobs/:id` for interview status and duration
- `POST|DELETE /api/jobs/:id/questions/:questionId`
- `GET /api/jobs/:id/candidates`
- `GET|POST /api/jobs/:id/invitations`
- `GET /api/jobs/:jobId/invitations/:invitationId` for protected answer review
- `PATCH /api/jobs/:jobId/invitations/:invitationId/outcome`
- `GET|POST /api/jobs/:jobId/interviews`
- `GET|POST /api/questions` (`GET` accepts `?search=`)
- `PUT /api/questions/:id` to update question text, type, options, reference answer, and code snippet
- `PATCH /api/questions/:id` to deprecate or restore a question
- `GET|POST /api/participants`
- `GET /api/participants/:id`
- `GET /api/participants/:id/photo`
- `GET /api/participants/:id/cv`
- `GET /api/interviews/:token`
- `POST /api/interviews/:token/accept`
- `PUT /api/interviews/:token/answers/:questionId`
- `POST /api/interviews/:token/finish`
- `GET|POST /api/users`
- `GET /api/invitations` and `PATCH /api/invitations/:interviewId`
- `GET /api/schedule`
- `GET /api/scheduled-interviews/:id`
- `PATCH /api/scheduled-interviews/:id/status`
- `PATCH /api/scheduled-interviews/:id/document`
- `GET|POST /api/scheduled-interviews/:id/notes`
- `GET /api/scheduled-interviews/:id/events` (authenticated fetch-based SSE)
- `GET /api/participant-meetings/:token` (public)
- `GET /api/participant-meetings/:token/events` (token-authorized SSE)

Participant creation uses multipart fields `firstName`, `lastName`, `birthday`, `email`,
`contactInfo`, `photo`, and `cv`.

## Interview workflow

Authenticated interviewers create and edit reusable questions at `/questions`, configure job
status and duration, attach active library questions, and generate invitations for each eligible
participant from a job detail page. Multiple-choice and radio questions require at least two
explicitly added options.
Detaching a question removes only the job association; questions can be deprecated but not deleted.
Open-answer and code-review questions include an interviewer-only reference answer that is never
rendered in the participant interview. Code-review questions also require a code snippet.
Accepted and completed invitations can be opened from the job to review every participant answer,
possible choice options, reference answers, and code-review context; unanswered questions are
called out explicitly.
Completed assessments can be marked as passed or failed. Passed candidates expose a scheduling
form for the date, location, co-interviewers, and candidate-visible shared documentation.

The authenticated workspace also includes:

- **Users** for listing and creating co-interviewers.
- **Invitations** in the top-right account navigation for accepting or declining assignments.
- **Profile** in the top-right account navigation for the logged-in user's identity and role.
- **Schedule** for interviews grouped by date.
- **Interviewer sessions** for changing status, editing prominent shared documentation, and
  posting private notes while an interview is started. Notes and shared-document changes arrive
  live through an authenticated streaming `fetch`; the app intentionally does not use
  `EventSource`, because the request needs the JWT authorization header.

The authenticated layout ends with a sitemap and useful-links footer. Update
`src/config/navigation.ts` to add, remove, or reorder footer destinations.

Participants open the generated `/participant/:invitationId` URL without signing in. The opaque
invitation ID authorizes the existing `/api/interviews/:token` API. Code-review questions are shown
in a pull-request-style code panel with a review comment field. Answers are saved when navigating
between questions and as they change, then **Submit** completes the interview. The countdown is
derived from the backend `acceptedAt` timestamp plus the job duration so refreshing cannot reset
it. Questions stay hidden until the participant explicitly accepts the invitation.

Scheduled candidates use `/participant/meeting/:token`. This public view shows the interview date,
location, status, and read-only shared documentation. A token-authorized event stream updates the
document immediately when an interviewer saves it in another browser. The participant view never
receives interviewer notes or assessment reference answers.

## Container

Build with `docker build -t go-guess-frontend .`. The production Nginx server serves the SPA and
proxies `/api` to the Docker Compose service `api:8080`.
