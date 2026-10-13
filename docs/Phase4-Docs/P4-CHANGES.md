# Phase 4 changes

Phase 4 connected the React screens in `frontend/` to the Django API. The screens used to read sample rows from `frontend/src/mockData.ts`. They now call the endpoints in `docs/api.md` with the browser `fetch` API. `P4IMPLEMENTATIONMANUAL.md` set the rules. This file records what was built on 2026-10-12, how to test it, and what to know before Phase 5.

The change is not committed yet.

## What changed

### New files

| File | What it does |
| --- | --- |
| `frontend/src/api.ts` | Holds every API call. It is the only module that reads or writes snake_case keys. It maps each response to the camelCase types by hand, sends the token, and turns error bodies into an `ApiError` with `status`, `message`, and `fieldErrors`. |
| `frontend/src/format.ts` | `formatDate` and `formatDateTime`, copied unchanged from `mockData.ts`. |
| `frontend/README.md` | How to run the screens against the local API. Replaces `RECAP.md`. |
| `docs/Phase4-Docs/P4DOCSCHANGES.md` | The docs changelog for this phase. |
| `docs/Phase4-Docs/P4-CHANGES.md` | This file. |

### Deleted files

- `frontend/src/mockData.ts`
- `frontend/RECAP.md`

### Changed files

| File | Change |
| --- | --- |
| `frontend/vite.config.ts` | The dev server proxies `/api` to `http://127.0.0.1:8000` with `changeOrigin: true`. |
| `frontend/src/types.ts` | Types match the read shapes in `api.md`. `Application` has `company: {id, name}`, `nextInterview`, `createdAt`, and `updatedAt` in place of `companyId`. `Interview` and `Note` no longer carry `applicationId`. Optional fields are `string \| null`. New types: `NextInterview`, `UpcomingInterview`, `DashboardData`, `ApplicationPage`. |
| `frontend/src/auth.tsx` | Stores the JWT in `localStorage` under `access`. On startup it decodes the token payload and treats the visitor as signed in only when `exp` is in the future. It registers the handler that `api.ts` runs on a 401. |
| `pages/Login.tsx`, `pages/Register.tsx` | The mock checks are gone. Both forms post to the API and show its field errors under the inputs and its `detail` text in the alert. |
| `pages/Dashboard.tsx` | Reads counts and upcoming interviews from `GET /api/dashboard/`. |
| `pages/ApplicationList.tsx` | Sends search, dates, status, and page to `GET /api/applications/`. The browser no longer filters or pages. Page size is 10. A status change sends `PATCH` and then reloads the list. |
| `components/ApplicationForm.tsx` | Takes the company list, field errors, and a busy flag as props. Shows each API error under its field. Exports `toApplicationInput`, which turns the form's company field into `company_name`. |
| `pages/ApplicationCreate.tsx`, `pages/ApplicationEdit.tsx` | Load companies from `GET /api/companies/`. Create posts and opens the new detail page. Edit loads the application, sends `PATCH`, and returns to the detail page with the router state it received. |
| `pages/ApplicationDetail.tsx` | Loads the application, then its interviews and notes. Adds and deletes interviews. Each interview's outcome is a dropdown that saves with `PATCH`. Adds, edits, and deletes notes. |
| `docs/architecture.md` | The repository layout lists `Phase4-Docs/`. |

These files did not change: `main.tsx`, `App.tsx`, `index.css`, `Landing.tsx`, `StatusBadge.tsx`, `StatusMenu.tsx`, `BackLink.tsx`. Nothing under `backend/` changed. No npm package was added.

## How to test

### 1. Build

From `frontend/`:

```sh
npm run build
```

This runs `tsc -b` and `vite build`. It passed on 2026-10-12. The manual names this as the required check.

### 2. Start the API

Open Postgres.app and check that the server shows as running. `backend/README.md` steps 1 to 4 cover the one-time setup: the virtualenv, the database, and `.env`.

In a terminal, starting from the repository root:

```sh
cd backend
source .venv/bin/activate
/Applications/Postgres.app/Contents/Versions/latest/bin/pg_isready -h localhost
set -a; source .env; set +a
python manage.py migrate
python manage.py runserver
```

`pg_isready` should print `localhost:5432 - accepting connections`. The full path is there because the Postgres.app tools are not on `PATH` unless you did the optional `PATH` step in `backend/README.md`. With that step done, plain `pg_isready -h localhost` also works.

`python` exists only inside the virtualenv. Run `source .venv/bin/activate` from `backend/` in every new terminal before any `python` command.

`runserver` prints `Starting development server at http://127.0.0.1:8000/`. Leave this terminal running. `.env` must keep `127.0.0.1` in `ALLOWED_HOSTS`, because the proxy sends that host.

To check it, open http://127.0.0.1:8000/api/health/ in a browser. It returns `{"status": "ok"}`.

### 3. Start the screens

Open a second terminal, starting from the repository root:

```sh
cd frontend
npm install
npm run dev
```

Vite prints `Local: http://localhost:5173/`. Open that URL. To check the proxy, open http://localhost:5173/api/health/. It returns the same `{"status": "ok"}` as the API.

### If startup fails

| What you see | Cause and fix |
| --- | --- |
| `command not found: pg_isready` | The Postgres.app tools are not on `PATH`. Use the full path shown in step 2. |
| `command not found: python` | The virtualenv is not active. Run `cd backend` and `source .venv/bin/activate`. |
| `no such file or directory: .venv/bin/activate` or `.env` | You are not in `backend/`. Run `cd backend` from the repository root. |
| `KeyError: 'SECRET_KEY'` | `.env` is not loaded in this terminal. Run `set -a; source .env; set +a` from `backend/`. |
| `connection to server at "localhost" ... failed` | Postgres.app is not running. Open it and start the server. |
| `database "applications_tracker" does not exist` | Run `/Applications/Postgres.app/Contents/Versions/latest/bin/createdb -h localhost applications_tracker`, then `migrate`. |
| `Error: That port is already in use.` | Another `runserver` is still running. Stop it, or find it with `lsof -nP -iTCP:8000 -sTCP:LISTEN`. |
| Vite prints `http proxy error: /api/... ECONNREFUSED`, and screens show `The request failed.` | The API is not running. Start it in the first terminal. |
| `npm error enoent Could not read package.json` | You are not in `frontend/`. Run `cd frontend` from the repository root. |
| The browser shows `Bad Request (400)` on API calls | `ALLOWED_HOSTS` in `.env` lost `127.0.0.1`. Restore `localhost,127.0.0.1`, reload `.env`, and restart `runserver`. |

### 4. Click through

Each group below matches an item in the manual's Definition of done.

Auth:

- [ ] Register with a new email and an 8+ character password. The dashboard opens. DevTools > Application > Local Storage shows an `access` key.
- [ ] Register again with the same email. The email field shows the duplicate message.
- [ ] Register with `short`. The password field shows the length message.
- [ ] Register with `password123`. The password field shows the common-password message.
- [ ] Log out. The landing page opens and `access` is gone.
- [ ] Log in with a wrong password. The alert says `Email or password is incorrect.`
- [ ] Log in correctly, then refresh. You stay on the dashboard.
- [ ] While signed in, delete the last character of `access` in Local Storage, then open the list. The payload still decodes, so the client counts you as signed in. The API rejects the signature with a 401, and you land on `/login`.

Applications:

- [ ] Create an application with a new company name. The hint `A new company will be created.` shows. Saving opens the new detail page.
- [ ] Create a second application. The company field suggests the first company.
- [ ] Submit a create with a bad job posting URL, such as `notaurl`. The URL field shows the API error.
- [ ] Edit an application and save. The detail page shows the change, and Back still names the screen you came from.
- [ ] Delete an application from its detail page. You return to the Back target.

List:

- [ ] Create 11 or more applications. The list shows 10 and a pager reading `Page 1 of 2`.
- [ ] Search, pick a status, and set a date range. The address bar holds each value, and Back from a detail page restores them.
- [ ] Set `Applied from` later than `Applied to`. An alert shows the API's message.
- [ ] Go to page 2 when it has one row, then change that row's status so it leaves the filter. The list steps back to page 1.
- [ ] Type `?page=99` in the address. The list steps back until it finds a page.

Detail:

- [ ] Add an interview in the future with outcome Scheduled. It appears in date order and on the dashboard.
- [ ] Change its outcome in the dropdown. It saves, and the dashboard drops it once it is no longer Scheduled.
- [ ] Delete the interview.
- [ ] Add a note. It shows `Added` and no `Edited`.
- [ ] Edit the note. It now shows `Edited` with a time.
- [ ] Delete the note.

Failure cases:

- [ ] Stop `runserver` and click around. Screens show `The request failed.` in an alert.
- [ ] Submit login 11 times within a minute. The 11th shows the throttle message with a seconds count.

## Things to know

### Behavior

- **No refresh token.** The access token lasts 24 hours. After that, the next call returns 401 and the user logs in again. `architecture.md` sets this.
- **The client trusts `exp`, not the signature.** On startup it reads `exp` from the token payload without calling the API. A tampered token looks signed in until the first API call returns 401.
- **Development makes each GET twice.** React strict mode runs effects twice in dev. Each load effect ignores the stale response. A production build runs them once.
- **`next` and `previous` are ignored as URLs.** Through the proxy, Django builds them on `127.0.0.1:8000`. The list only checks whether they are null and builds its own page number.
- **Interview times go out as UTC.** The `datetime-local` value is converted with `new Date(value).toISOString()`. Display uses the browser's time zone.
- **Edit sends every field.** Saving the edit form sends the whole application, not only the fields you changed. The API accepts this as a `PATCH`.
- **Blank optional fields go out as `null`.** That covers salary, job posting URL, date applied, description, round name, and interviewer name.

### Choices beyond the manual

- **Detail errors.** The manual did not say how the interview and note forms show a 400. Each section shows one alert with the first message for each field.
- **Middle dots replaced.** The detail screen's separators were `·`. Rewritten lines use ` - ` to keep new strings ASCII. Unchanged lines, such as the `Add a note…` placeholder and the arrow characters, kept their original characters.
- **Load errors on the list hide the table.** A 400 such as `from` later than `to` shows the alert alone instead of the previous results under it.

### Known limits

- **The list's status menu cannot be disabled during its save.** `StatusMenu.tsx` was on the do-not-change list and has no disabled prop. A second click before the first `PATCH` finishes sends a second request.
- **Only a smoke test ran against the live API.** On 2026-10-12, calls through the Vite proxy returned 200 for health, 201 for register, and 200 for the dashboard and list. That run left one `p4-smoke-...@example.com` user in the local database. The browser click-through above has not been done.
- **No frontend tests.** The manual leaves a test runner out.

### Still out of scope

Docker, Docker Compose, gunicorn, lint, formatting, GitHub Actions, AWS, and a repo-root README stay in later phases. `docker compose up` is Phase 5.
