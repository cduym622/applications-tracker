# Phase 4 changes

Phase 4 connected the React screens in `frontend/` to the Django API. The screens used to read sample rows from `frontend/src/mockData.ts`. They now call the endpoints in `docs/api.md` with the browser `fetch` API. `P4IMPLEMENTATIONMANUAL.md` set the rules. This file records what was built on 2026-10-12, how to test it, and what to know before Phase 5.

## What changed

### New files


| File                                | What it does                                                                                                                                                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/api.ts`               | Holds every API call. It is the only module that reads or writes snake_case keys. It maps each response to the camelCase types by hand, sends the token, and turns error bodies into an `ApiError` with `status`, `message`, and `fieldErrors`. |
| `frontend/src/format.ts`            | `formatDate` and `formatDateTime`, copied unchanged from `mockData.ts`.                                                                                                                                                                         |
| `frontend/README.md`                | How to run the screens against the local API. Replaces `RECAP.md`.                                                                                                                                                                              |
| `docs/Phase4-Docs/P4DOCSCHANGES.md` | The docs changelog for this phase.                                                                                                                                                                                                              |
| `docs/Phase4-Docs/P4-CHANGES.md`    | This file.                                                                                                                                                                                                                                      |




### Deleted files

- `frontend/src/mockData.ts`
- `frontend/RECAP.md`



### Changed files


| File                                                       | Change                                                                                                                                                                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/vite.config.ts`                                  | The dev server proxies `/api` to `http://127.0.0.1:8000` with `changeOrigin: true`.                                                                                                                                                          |
| `frontend/src/types.ts`                                    | Types match the read shapes in `api.md`. `Application` has `company: {id, name}`, `nextInterview`, `createdAt`, and `updatedAt` in place of `companyId`. `Interview` and `Note` no longer carry `applicationId`. Optional fields are `string |
| `frontend/src/auth.tsx`                                    | Stores the JWT in `localStorage` under `access`. On startup it decodes the token payload and treats the visitor as signed in only when `exp` is in the future. It registers the handler that `api.ts` runs on a 401.                         |
| `pages/Login.tsx`, `pages/Register.tsx`                    | The mock checks are gone. Both forms post to the API and show its field errors under the inputs and its `detail` text in the alert.                                                                                                          |
| `pages/Dashboard.tsx`                                      | Reads counts and upcoming interviews from `GET /api/dashboard/`.                                                                                                                                                                             |
| `pages/ApplicationList.tsx`                                | Sends search, dates, status, and page to `GET /api/applications/`. The browser no longer filters or pages. Page size is 10. A status change sends `PATCH` and then reloads the list.                                                         |
| `components/ApplicationForm.tsx`                           | Takes the company list, field errors, and a busy flag as props. Shows each API error under its field. Exports `toApplicationInput`, which turns the form's company field into `company_name`.                                                |
| `pages/ApplicationCreate.tsx`, `pages/ApplicationEdit.tsx` | Load companies from `GET /api/companies/`. Create posts and opens the new detail page. Edit loads the application, sends `PATCH`, and returns to the detail page with the router state it received.                                          |
| `pages/ApplicationDetail.tsx`                              | Loads the application, then its interviews and notes. Adds and deletes interviews. Each interview's outcome is a dropdown that saves with `PATCH`. Adds, edits, and deletes notes.                                                           |
| `docs/architecture.md`                                     | The repository layout lists `Phase4-Docs/`.                                                                                                                                                                                                  |


These files did not change: `main.tsx`, `App.tsx`, `index.css`, `Landing.tsx`, `StatusBadge.tsx`, `StatusMenu.tsx`, `BackLink.tsx`. Nothing under `backend/` changed. No npm package was added.

## How to test



### 1. Build

From `frontend/`:

```sh
npm run build
```

This runs `tsc -b` and `vite build`. It passed on 2026-10-12. The manual names this as the required check.

### 2. Start the API

Follow `backend/README.md` steps 3 to 5. In short, from `backend/`:

```sh
source .venv/bin/activate
pg_isready -h localhost
set -a; source .env; set +a
python manage.py migrate
python manage.py runserver
```

Leave it running. `.env` must keep `127.0.0.1` in `ALLOWED_HOSTS`. The proxy sends that host.

### 3. Start the screens

In a second terminal, from `frontend/`:

```sh
npm install
npm run dev
```

Open the URL Vite prints.

### 4. Click through

Each group below matches an item in the manual's Definition of done.

Auth:

- [x] Register with a new email and an 8+ character password. The dashboard opens. DevTools > Application > Local Storage shows an `access` key.
- [x] Register again with the same email. The email field shows the duplicate message.
- [x] Register with `short`. The password field shows the length message.
- [x] Register with `password123`. The password field shows the common-password message.
- [x] Log out. The landing page opens and `access` is gone.
- [x] Log in with a wrong password. The alert says `Email or password is incorrect.`
- [x] Log in correctly, then refresh. You stay on the dashboard.
- [x] While signed in, delete the last character of `access` in Local Storage, then open the list. The payload still decodes, so the client counts you as signed in. The API rejects the signature with a 401, and you land on `/login`.

Applications:

- [x] Create an application with a new company name. The hint `A new company will be created.` shows. Saving opens the new detail page.
- [x] Create a second application. The company field suggests the first company.
- [x] Submit a create with a bad job posting URL, such as `notaurl`. The URL field shows the API error.
- [x] Edit an application and save. The detail page shows the change, and Back still names the screen you came from.
- [x] Delete an application from its detail page. You return to the Back target.

List:

- [x] Create 11 or more applications. The list shows 10 and a pager reading `Page 1 of 2`.
- [x] Search, pick a status, and set a date range. The address bar holds each value, and Back from a detail page restores them.
- [x] Set `Applied from` later than `Applied to`. An alert shows the API's message.
- [x] Go to page 2 when it has one row, then change that row's status so it leaves the filter. The list steps back to page 1.
- [x] Type `?page=99` in the address. The list steps back until it finds a page.

Detail:

- [x] Add an interview in the future with outcome Scheduled. It appears in date order and on the dashboard.
- [x] Change its outcome in the dropdown. It saves, and the dashboard drops it once it is no longer Scheduled.
- [x] Delete the interview.
- [x] Add a note. It shows `Added` and no `Edited`.
- [x] Edit the note. It now shows `Edited` with a time.
- [x] Delete the note.

Failure cases:

- [x] Stop `runserver` and click around. Screens show `The request failed.` in an alert.
- [x] Submit login 11 times within a minute. The 11th shows the throttle message with a seconds count.



## Things to know



### Behavior

- **No refresh token.** The access token lasts 24 hours. After that, the next call returns 401 and the user logs in again. `architecture.md` sets this.
- **The client trusts** `exp`**, not the signature.** On startup it reads `exp` from the token payload without calling the API. A tampered token looks signed in until the first API call returns 401.
- **Development makes each GET twice.** React strict mode runs effects twice in dev. Each load effect ignores the stale response. A production build runs them once.
- `next` **and** `previous` **are ignored as URLs.** Through the proxy, Django builds them on `127.0.0.1:8000`. The list only checks whether they are null and builds its own page number.
- **Interview times go out as UTC.** The `datetime-local` value is converted with `new Date(value).toISOString()`. Display uses the browser's time zone.
- **Edit sends every field.** Saving the edit form sends the whole application, not only the fields you changed. The API accepts this as a `PATCH`.
- **Blank optional fields go out as** `null`**.** That covers salary, job posting URL, date applied, description, round name, and interviewer name.



### Choices beyond the manual

- **Detail errors.** The manual did not say how the interview and note forms show a 400. Each section shows one alert with the first message for each field.
- **Middle dots replaced.** The detail screen's separators were `·`. Rewritten lines use `-` to keep new strings ASCII. Unchanged lines, such as the `Add a note…` placeholder and the arrow characters, kept their original characters.
- **Load errors on the list hide the table.** A 400 such as `from` later than `to` shows the alert alone instead of the previous results under it.



### Known limits

- **The list's status menu cannot be disabled during its save.** `StatusMenu.tsx` was on the do-not-change list and has no disabled prop. A second click before the first `PATCH` finishes sends a second request.
- **Not tested against the live API.** `npm run build` is the only check that ran. The field names in `backend/tracker/serializers.py` match `api.md`, so no mismatch is expected, but the click-through above has not been done.
- **No frontend tests.** The manual leaves a test runner out.



### Still out of scope

Docker, Docker Compose, gunicorn, lint, formatting, GitHub Actions, AWS, and a repo-root README stay in later phases. `docker compose up` is Phase 5.