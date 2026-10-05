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

For tenant hosts such as `nmbs.guess-dev.urpi.be` locally and
`nmbs.guess.urpi.be` in production, `src/api/client.ts` derives tenant `nmbs`,
calls same-origin `/api` through the shared HTTPS proxy, and sends
`X-Tenant-Id: nmbs` on every JSON, multipart, file-download, and event-stream
request. `ypto.guess-dev.urpi.be` behaves identically for tenant `ypto`. Other
hostnames use same-origin `/api`; Vite retains its `/api` proxy for that case.

`src/components/actions/Account.tsx` treats any host whose first DNS label is a
tenant as a possible Go Loose host and asks `/api/auth/session` whether browser
login is available there. A `404` means the API has no Go Loose login for the
host, so the password form is shown; any other unauthenticated answer means Go
Loose is configured and the app redirects to `/api/auth/login`. The callback
exchanges that session for the bearer token used by the typed API client.
Invitation and participant-meeting URLs use the validated request origin so
links stay on the tenant hostname. Copy actions fall back to a temporary selected
textarea when the Clipboard API is unavailable on local HTTP domains.

Login stores the returned JWT in
`sessionStorage`; protected requests send it as `Authorization: Bearer <token>`. API failures are
shown in the UI and are never replaced with demo data. A `401` from a protected
JSON, file, or event-stream request clears authentication and returns the user to
`/login`. On a tenant host with Go Loose configured, the app restores
`/api/auth/session` or redirects to `/api/auth/login`; participant routes stay
token-based. The app also schedules logout from the JWT expiration claim so an idle
expired session cannot remain on a protected page.

The machine-readable OpenAPI 3.0 contract at `/api/openapi.json` is the source
of truth for supported routes and schemas. It is assembled by the backend from
the same typed calls that register Chi routes, so there is no generated file or
manual update command. Do not duplicate a route inventory here; inspect the
contract instead.

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

Build with `docker build -t go-guess-frontend .`. The production Nginx server
serves the SPA and proxies `/api` to the Docker Compose service `api:8080`.
