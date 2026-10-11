# Phase 4 implementation manual

This file tells an implementer how to connect the existing React screens to the API. `api.md` stays the contract. This manual points at it and only spells out how the screens call it.

Phase 4 is the screens listed in the Frontend section of PROJECTSPEC.md. The folder `frontend/` already has those screens, the routes, and the styles. They read from `frontend/src/mockData.ts`. Replace that file with calls to the API.

`frontend/RECAP.md` describes the mock. Read it, then delete it. It is not part of the finished phase.

## Out of scope

Docker, Docker Compose, gunicorn, lint, formatting, GitHub Actions, AWS, and a repo-root README stay in later phases. `docker compose up` is Phase 5.

Do not change the Django project, `backend/requirements.txt`, or backend settings. Do not add a CORS library. `architecture.md` already requires one origin and no CORS.

Do not add an npm package. The browser `fetch` API is enough. Axios, a data-fetching library, a JWT library, and a date library stay out. Do not add a frontend test runner. PROJECTSPEC.md says to stop frontend work once the screens call the API and show the result.

Do not add a `VITE_` variable for the API host. Every call uses the relative path `/api`.

## How to run

This phase does not start a container. The API and the screens run as two processes.

Start PostgreSQL and the API the way `backend/README.md` already describes. From `backend/`, load `.env`, migrate, and run:

```sh
python manage.py runserver
```

The API listens on `http://127.0.0.1:8000`. Leave that process running while you check the screens.

The screens need Node 20 or later. From `frontend/`:

```sh
npm install
npm run dev
```

`npm run dev` starts the Vite dev server and prints a local URL. Open that URL. The browser talks to Vite. Vite forwards `/api` to the API, as Decisions describes.

The check for this phase is a production build, from `frontend/`:

```sh
npm run build
```

That command runs `tsc -b` and then `vite build`. TypeScript is strict. `noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax` are on. A type-only import uses the `type` modifier already used in these files. `npm run build` must pass.

Do not start `npm run dev` or `runserver` as the record that the phase is done. The person who uses the app starts those. `npm run build` is the command this phase requires.

## Layout

Keep the files that are already here:

```text
frontend/
  index.html
  package.json
  vite.config.ts          add the /api proxy
  src/
    main.tsx              unchanged
    App.tsx               unchanged
    index.css             unchanged
    auth.tsx              JWT session
    types.ts              camelCase types matched to api.md
    format.ts             formatDate and formatDateTime, moved out of mockData.ts
    api.ts                fetch, snake_case mapping, and the endpoint functions
    components/
      ApplicationForm.tsx companies and field errors come in as props
      StatusBadge.tsx     unchanged
      StatusMenu.tsx      unchanged
      BackLink.tsx        unchanged
    pages/
      Landing.tsx         unchanged
      Login.tsx
      Register.tsx
      Dashboard.tsx
      ApplicationList.tsx
      ApplicationCreate.tsx
      ApplicationEdit.tsx
      ApplicationDetail.tsx
```

Delete `frontend/src/mockData.ts` and `frontend/RECAP.md`. Add `frontend/README.md`.

`api.ts` is the only module that reads or writes a snake_case JSON key. Pages and components use the camelCase types in `types.ts`.

## Build order

1. Add the Vite proxy.
2. Update `types.ts`, and add `format.ts` with the two date functions from `mockData.ts`.
3. Add `api.ts` and change `auth.tsx`.
4. Point login and register at the auth endpoints.
5. Point the dashboard at `GET /api/dashboard/`.
6. Point the list at `GET /api/applications/` and status changes at `PATCH`.
7. Point the shared form, create, and edit at companies and applications.
8. Point the detail screen at the application, its interviews, and its notes, including the outcome control.
9. Delete `mockData.ts`. Fix every import that still names it.
10. Delete `RECAP.md`, add `frontend/README.md`, and update the docs named under Docs to update.
11. Run `npm run build` from `frontend/`.

## Decisions

### Same origin

In `frontend/vite.config.ts`, proxy `/api` to `http://127.0.0.1:8000` and set `changeOrigin` to true:

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  },
},
```

`changeOrigin` sends `Host: 127.0.0.1:8000`, which is already in `ALLOWED_HOSTS`. Django then builds `next` and `previous` on that host. The list must ignore those absolute URLs. It already keeps `page` in the address and sends that number itself. The browser stays on the Vite origin in development and on the CloudFront origin in production.

Leave `NUM_PROXIES` at 0. The dev proxy is one local client. Production sets `NUM_PROXIES` later, as `architecture.md` describes.

### Session

`auth.tsx` stores the access token in `localStorage` under the key `access`. Delete the `mock-session` flag. There is no refresh token and no second storage key. `architecture.md` sets the access token lifetime at 24 hours.

`signIn` takes the access string, writes it to `localStorage`, and sets the signed-in flag. `signOut` removes the key and clears the flag. Log out on the dashboard still calls `navigate('/')` and `signOut()` inside one `startTransition`. Keep that order. A plain `signOut()` renders first, and `RequireAuth` would send the user to `/login` before the landing page opens.

A stored token counts as signed in when its payload has an `exp` in the future. Read the payload without a library. Split the token on `.` and take the second segment. Replace `-` with `+` and `_` with `/`. Pad the end with `=` until the length is a multiple of 4. Decode with `atob`, parse the JSON, and read `exp` as seconds. Multiply by 1000 and compare with `Date.now()`. If any step throws, or `exp` is missing or already past, remove the key and treat the visitor as signed out. Do not check the signature. The API does that.

On startup, derive the signed-in flag from that check. Do not call the API to learn if the token is still good.

`AuthProvider` sits inside `BrowserRouter` in `main.tsx`, so it can call `useNavigate`. Register an unauthorized handler from `AuthProvider`. `api.ts` exports a function that stores that handler.

### Requests

Every URL starts with `/api`. Send `Content-Type: application/json` on `POST` and `PATCH`. `GET` and `DELETE` have no body.

Authenticated calls send `Authorization: Bearer` plus the token currently in `localStorage`. Read the key inside the request so a login that just stored a token is visible. Login and register do not send that header.

A response of 204 has an empty body. Do not parse it as JSON. Any other response is JSON. If the body is not JSON, treat the call as failed.

An authenticated call that returns 401 removes the `access` key and runs the unauthorized handler. The handler clears the signed-in flag and navigates to `/login` with `replace`. Login and register do not use that path. Their 401 stays on the form.

Show a 400 as field errors when the body is an object of field names to lists of strings. Show the first string in each list. A `detail` string, and `non_field_errors`, go in the existing `.alert` element. A 429 has the same `detail` shape. Show that string. It includes a seconds count that varies, so show the text the API returned.

If `fetch` throws, show the sentence `The request failed.` in `.alert`. While a screen's first load is in flight, show `Loading...` with the existing `.muted` class. Disable the button that started a write until that write finishes. Do not add a spinner.

Ignore a stale response. In each load effect, set a flag on cleanup and skip `setState` after cleanup. A fast search must not let an older response overwrite a newer one. React strict mode runs effects twice in development. `GET` in an effect is safe. Do not `POST` from an effect.

New strings are ASCII. Leave `Landing.tsx`, `App.tsx`, `main.tsx`, `index.css`, `StatusBadge.tsx`, `StatusMenu.tsx`, and `BackLink.tsx` unchanged, including characters already in them. When a rewritten line in another file contains a non-ASCII dash or ellipsis, use a hyphen or three periods.

### Types

Update `types.ts` to the read shapes in `api.md`. Keep `STATUSES`, `INTERVIEW_TYPES`, `INTERVIEW_OUTCOMES`, and `label`.

`Company` stays `id` and `name`.

`NextInterview` is `id`, `scheduledAt`, and `type`.

`Interview` drops `applicationId`. Fields are `id`, `scheduledAt`, `type`, `outcome`, `roundName`, and `interviewerName`. The two names are `string | null`.

`Note` drops `applicationId`. Fields are `id`, `text`, `createdAt`, and `updatedAt`.

`Application` drops `companyId`. Fields are `id`, `jobTitle`, `company`, `location`, `status`, `salary`, `jobPostingUrl`, `dateApplied`, `description`, `nextInterview`, `createdAt`, and `updatedAt`. `company` is a `Company`. `nextInterview` is `NextInterview | null`. `salary`, `jobPostingUrl`, `dateApplied`, and `description` are `string | null`.

`UpcomingInterview` is `id`, `jobTitle`, `companyName`, `scheduledAt`, `type`, and `applicationId`.

`DashboardData` is `counts` and `upcomingInterviews`. `counts` has every status in `STATUSES` as a number. `upcomingInterviews` is an array of `UpcomingInterview`.

`ApplicationPage` is `count`, `next`, `previous`, and `results`. `next` and `previous` are `string | null`. `results` is an array of `Application`. The client uses `next` and `previous` only to see whether another page exists.

Map names in `api.ts` by hand for each type. A recursive key converter is easy to get wrong on `company_name` versus `company`.

Write bodies use snake_case. An application write sends `job_title`, `company_name`, `location`, `status`, `salary`, `job_posting_url`, `date_applied`, and `description`. Blank `salary`, `job_posting_url`, `date_applied`, and `description` go out as `null`. An empty string is not a valid job posting URL. Do not send a company id.

An interview create sends `scheduled_at`, `type`, `outcome`, `round_name`, and `interviewer_name`. Blank names go out as `null`. An interview update sends `outcome` and no other field.

A note create and a note update send `text`.

`datetime-local` values are local and have no offset. Convert with `new Date(value).toISOString()` before sending `scheduled_at`. Display with `formatDateTime` and `formatDate` from `format.ts`. Copy those two functions from `mockData.ts` unchanged. Delete the rest of that file once nothing imports it.

### List pages

The API page size is 10, from `ApplicationPagination` in `backend/tracker/filters.py`. The mock used 5 and filtered in the browser. Delete that filtering. One address produces one `GET /api/applications/`.

Send `q`, `from`, `to`, and `status` only when they are non-empty. Send `page` only when it is greater than 1. The API defaults to page 1. Keep the current address helper: a filter change clears `page`, and the search box writes `q` with replace.

If `status` in the address is not one of the seven statuses, do not send it. The screen already does this. A bad `page` value becomes 1 before the request, using the same `Number(...) || 1` rule as the mock.

`page_size` in the query does nothing on the server. Do not send it.

The pager is visible when `next` or `previous` is non-null. The label is `Page X of Y`. `Y` is `Math.ceil(count / 10)`. When `count` is 0, hide the pager.

A 404 on a page above 1 means that page is gone. Request the previous page and write that page into the address with replace. Do this again if the previous page is also 404, and stop at page 1. A 400, such as a `from` later than `to`, stays on the screen as an alert. Leave the address as the user set it.

After a status `PATCH` returns 200, refetch the current address. A row whose new status does not match the filter disappears because the server left it out. If that refetch is a 404 above page 1, step back as above. If the `PATCH` fails, show the error and leave the row as it was.

## Screens

Leave the route table in `App.tsx` as it is. A signed-out visitor to a signed-in screen still goes to `/login`. A signed-in visitor to `/`, `/login`, or `/register` still goes to `/dashboard`. Login and register do not call `navigate` themselves. Storing the token flips the signed-in flag, and the guard opens the dashboard.

### Login and register

Remove the mock checks. A password containing `wrong` is no longer special. The address `taken@example.com` is no longer special.

Both forms use `noValidate` and submit the typed email and password. The API is the check for a duplicate email, a short password, a common password, and a bad email.

`POST /api/auth/login/` with `email` and `password`. Status 200 returns `access`. Pass that string to `signIn`. Status 401 shows the `detail` string. The API text is `Email or password is incorrect.` Show that string in `.alert`. Do not add a hint about which field was wrong. Status 400 shows field errors on `email` and `password`. Status 429 shows `detail` in `.alert`.

`POST /api/auth/register/` with `email` and `password`. Status 201 returns `access`. Pass that string to `signIn`. Status 400 shows the first `email` message and the first `password` message with the existing `.field-error` class and the `invalid` class on the input. Those messages cover a duplicate email, a password shorter than 8 characters, and a common password. Keep the hint `At least 8 characters.` when the password field has no error. Status 429 shows `detail` in `.alert`.

### Dashboard

`GET /api/dashboard/` supplies the counts and the interviews. Render one card per status in `STATUSES` order. Read each count from `counts`. The API sends all seven statuses, including zeros.

Each card still links to `/applications?status=` plus that status. `All applications` still links to `/applications` with no status. `New application` still links to `/applications/new`.

Render `upcomingInterviews` in the order the API returned. Do not filter or sort them again. The API already keeps at most 10, all in the future, all `SCHEDULED`. Each row shows `jobTitle`, `companyName`, the formatted `scheduledAt`, and the type label. The link goes to `/applications/` plus `applicationId`, with router state `{ from: '/dashboard' }`.

An empty list still says `No upcoming interviews.`

### Application list

Keep the filters, the table columns, the status menu, and the row click. The row still navigates to `/applications/` plus the id, with state `{ from: pathname + search }`.

The company cell is `company.name`. The date cell uses `formatDate` when `dateApplied` is non-null, and is empty when it is null. The next-interview cell uses `formatDateTime` on `nextInterview.scheduledAt` when `nextInterview` is non-null, and is empty when it is null.

The status menu calls `PATCH /api/applications/{id}/` with `{ status }` and then refetches, as Decisions describes. Clicks on the menu still do not open the row. `StatusMenu.tsx` stays as it is.

An empty page still says `No applications match.`

### Create and edit

`ApplicationForm` stops importing `mockData.ts`. It takes the company list and the field errors as props. The datalist and the `A new company will be created.` hint stay. Compare the typed name to the list without case. Wait until the company request has finished before showing that hint. If the company request fails, show an alert and still allow a typed name. The server creates the company.

Load companies with `GET /api/companies/` on create and on edit. The response is a JSON list of `{ id, name }`.

Map API field names onto the form: `job_title` to job title, `company_name` to company, `location`, `status`, `salary`, `job_posting_url` to job posting URL, `date_applied` to date applied, and `description`. Show each message under that field. A `detail` string goes in an alert above the form.

Create is `POST /api/applications/`. The form always has a status, and it still starts at `SAVED`. On 201, open `/applications/` plus the returned `id`. Do not pass a `from` state. Back on that new detail screen then goes to the unfiltered list, which is the rule for a detail address opened on its own.

Edit loads `GET /api/applications/{id}/`. Fill the form from that object. `company.name` is the company field. Null optional fields become empty strings. On 404, keep the existing `Application not found.` card. On 200 from `PATCH /api/applications/{id}/`, return to `/applications/` plus the id and pass along the router state the edit page received, so Back still names the screen that opened the detail page.

Cancel stays as it is. Create returns to `/dashboard`. Edit returns to the detail screen with that same state. Both screens still use the default back link to the dashboard.

### Application detail

Load `GET /api/applications/{id}/`, `GET /api/applications/{id}/interviews/`, and `GET /api/applications/{id}/notes/`. If the application returns 404, show `Application not found.` and skip the other two calls. Back and the delete destination still come from `useBackTarget`.

The application section keeps every field it shows now. Status stays a `StatusBadge`. Empty optional fields show a hyphen. The edit link still passes `location.state`.

Delete still asks `Delete this application? Its interviews and notes will be deleted too.` On confirm, `DELETE /api/applications/{id}/`. On 204, navigate to `back.to`.

The interview list is the API list, in that order. The API sorts by `scheduled_at` ascending. Do not sort again. The add form stays, and its outcome still starts at `SCHEDULED`. On submit, `POST /api/applications/{id}/interviews/` and append the returned interview in `scheduledAt` order. Blank round and interviewer names are `null`.

Replace the outcome tag on each interview with a `select` of `INTERVIEW_OUTCOMES`, labeled with `label`. Changing it sends `PATCH /api/applications/{id}/interviews/{interview_id}/` with only `{ outcome }`. On 200, replace that interview with the response. On failure, show the error and put the select back on the previous outcome. Disable that select while its request is in flight. No other interview field is editable. Delete still asks `Delete this interview?` and then calls `DELETE`.

The note list is the API list, in that order. The API returns the newest `created_at` first. Do not sort again. Add sends `POST` with `{ text }`. Edit sends `PATCH` with `{ text }`. Delete still asks `Delete this note?` and then calls `DELETE`.

Show `Edited` and the formatted `updatedAt` only when `updatedAt` is later than `createdAt`. Compare the parsed times. On insert, `updated_at` is the field default and `created_at` is set when the row is saved, so the two values differ. An edit moves `updated_at` to a time after `created_at`.

## Docs to update

Add `frontend/README.md`. It replaces `RECAP.md`. Include these facts:

- The folder is the React and TypeScript screens. They call the API in `docs/api.md`.
- Node 20 or later.
- From `frontend/`: `npm install`, `npm run dev`, and `npm run build`.
- Start the API first, using `backend/README.md`. It listens on port 8000. The Vite dev server proxies `/api` there.
- This manual is the description of how the client is built.
- Docker Compose is Phase 5.

Do not describe mock logins, `mock-session`, or sample rows.

In the repository layout in `docs/architecture.md`, add this line after the `Phase3-Docs/` line:

```text
  Phase4-Docs/           P4IMPLEMENTATIONMANUAL.md, P4DOCSCHANGES.md
```

Add `docs/Phase4-Docs/P4DOCSCHANGES.md`, in the same shape as `docs/Phase3-Docs/P3DOCSCHANGES.md`. Date it with the day the frontend change lands. Record the layout line and why it was added. The expected entry is that one layout change. `api.md` and the schema stay as they are.

If a screen cannot be built because the running API disagrees with `api.md`, stop and record the disagreement in `P4DOCSCHANGES.md`. Do not change the API to match the screen, and do not hide the mismatch in the client.

## Definition of done

Phase 4 is finished only when every item below is true. Phase 5 does not start before that.

- The screens in PROJECTSPEC.md call the API and show its results. `frontend/src/mockData.ts` and `frontend/RECAP.md` are gone.
- The access token lives in `localStorage` under `access`. Login and register store it. Log out removes it and opens `/`. A refresh keeps the session while `exp` is in the future. An authenticated 401 clears the token and opens `/login`.
- Register shows the API field errors for a duplicate email, a short password, and a common password. Login shows one mismatch message.
- The list uses the server's search, date range, status, and pages of 10. The address still holds those values. A 404 above page 1 loads the previous page.
- Create and edit send `company_name`. The company control lists `GET /api/companies/`.
- The detail screen can add and delete interviews, change an outcome in place, and add, edit, and delete notes.
- `frontend/README.md` describes how to run the screens against the local API. `docs/architecture.md` lists `Phase4-Docs/`. `P4DOCSCHANGES.md` records that layout change.
- `npm run build` from `frontend/` passes.
- This phase adds no npm package, no CORS library, no backend change, no Docker Compose file, and no GitHub Actions workflow.
