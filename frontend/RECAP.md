# Frontend recap

## What this is

This folder holds clickable UI frames for the eight screens described in `docs/PROJECTDESCRIPTION.md` and `docs/PROJECTSPEC.md`. They let you see how the app looks and moves between screens. Nothing calls a backend. Every screen reads from a static mock file.

The stack is Vite, React 19, TypeScript, and react-router-dom 7. Styling is plain CSS in one file. There are no other dependencies, because the spec says to add a technology only when a requirement needs it.

## What changed

The first pass built the seven screens. The second pass followed the doc changes in b04ef11: a landing page, status cards that open a filtered list, a status filter and an inline status menu on the list, list state in the address, and a detail Back that returns to the previous screen.

## Running it

Requires Node 20 or later:

```bash
cd frontend
npm install      # install dependencies
npm run dev      # start the dev server and print a local URL
npm run build    # type-check and build into dist/
```

## Project structure

```text
frontend/
  index.html                 page shell that loads src/main.tsx
  package.json               scripts and dependencies
  vite.config.ts             Vite with the React plugin
  tsconfig*.json             strict TypeScript settings
  src/
    main.tsx                 mounts the app inside the router and AuthProvider
    App.tsx                  route table and the two redirect guards
    auth.tsx                 mock session (signIn, signOut, signedIn)
    types.ts                 Application, Interview, Note, Company, and the enum values from the spec
    mockData.ts              sample companies, applications, interviews, notes, plus date and lookup helpers
    index.css                all styles
    components/
      ApplicationForm.tsx    form shared by create and edit
      StatusBadge.tsx        colored label for an application status
      StatusMenu.tsx         status badge on the list that opens a menu of the seven statuses
      BackLink.tsx           back link, plus useBackTarget() for the detail screen's Back
    pages/
      Landing.tsx            public page at /, the only screen with a top bar
      Login.tsx
      Register.tsx
      Dashboard.tsx
      ApplicationList.tsx
      ApplicationCreate.tsx
      ApplicationEdit.tsx
      ApplicationDetail.tsx  application fields, then the interviews section, then the notes section
```

## Routes

| Path | Screen | Who can open it |
| --- | --- | --- |
| `/` | Landing | Signed out. Signed-in visitors go to `/dashboard`. |
| `/login` | Login | Signed out. Signed-in visitors go to `/dashboard`. |
| `/register` | Register | Signed out. Signed-in visitors go to `/dashboard`. |
| `/dashboard` | Dashboard | Signed in. Signed-out visitors go to `/login`. |
| `/applications?q=&from=&to=&status=&page=` | Application list | Signed in |
| `/applications/new` | Create | Signed in |
| `/applications/:id` | Detail | Signed in |
| `/applications/:id/edit` | Edit | Signed in |
| any other path | Redirects to `/` (and from there to `/dashboard` when signed in) | |

## Spec rules the frames follow

- The landing page is the only screen with a top bar. No screen has a sidebar. The dashboard links to the list, to create, and to log out. The list links to create and back to the dashboard. Create and edit have a "← Dashboard" link.
- Log out opens the landing page. A signed-out visitor who opens a signed-in screen directly still goes to `/login`. In `Dashboard.tsx`, log out calls `navigate('/')` and `signOut()` together inside one `startTransition`. The router applies navigation as a transition, so a plain `signOut()` would render first. `RequireAuth` would then see a signed-out user on `/dashboard` and redirect to `/login` before the move to `/` landed.
- Each status card on the dashboard opens `/applications?status=X`, including cards with a count of zero. All applications opens the list with no status limit.
- The list keeps search, the date range, the status, and the page in its address, so Back from detail shows the same list.
- Status can change on the edit screen, or from the status badge on the list. On the detail screen it is a label. If the list is limited to one status and a row's status changes away from it, the row leaves the list.
- The detail screen remembers the address it was opened from in router state. Back goes there with a label naming it: All applications, the status name, or Dashboard. A detail address opened on its own goes back to `/applications`, labeled All applications. Delete goes to the same place as Back. Edit carries this along, so Back still works after saving.
- Interviews can be added and deleted but not edited. Notes can be added, edited in place, and deleted.
- The create form starts with status Saved. The add-interview form starts with outcome Scheduled.
- An interview counts as upcoming when its outcome is Scheduled and its date is in the future. The dashboard list and the list's "Next interview" column both use this rule.
- When either applied date is set, applications with no applied date drop out of the list. When both are empty, every application shows.
- Each note shows the time it was added, and the time it was edited if that differs.

## What is mocked, and how to try it

- **Login.** Any email and password sign you in. A password containing "wrong" shows the single generic error.
- **Register.** The email `taken@example.com` shows the duplicate-email error. A password shorter than 8 characters shows the length error.
- **Session.** A `mock-session` flag in localStorage stands in for the JWT, so you stay signed in after a refresh. Log out clears it.
- **Create.** Saving does not store anything. It opens application #1 as a stand-in for the new one.
- **Edit and delete.** Saving an edit returns to the detail screen without changing data. Deleting an application asks for confirmation, then removes it, its interviews, and its notes from the in-memory mock until refresh.
- **Status menu.** Choosing a status from a list badge changes the in-memory mock record, so the dashboard and detail screen show it until refresh.
- **Interviews and notes.** Adds, edits, and deletes change only the open page and reset on refresh.
- **List.** Search, the date and status filters, and paging (5 rows per page) run in the browser on the mock data. The real API does this on the server.

## Next steps when the backend exists

1. Replace `mockData.ts` with an API client that calls the endpoints in `PROJECTSPEC.md`.
2. Change `auth.tsx` to store the JWT from `/api/auth/login/`, send it on each request, and sign out when it expires. Keep log out's navigation and sign-out in the same transition, as described above.
3. Send search, the date range, the status, and the page number to `GET /api/applications/` as query parameters, and drop the in-browser filtering. Send status changes from the list badge to `PATCH /api/applications/{id}/`.
4. On submit, send the company name as `company_name` with the application. The server finds or creates the company in the same transaction. There is no `POST /api/companies/`.
5. Update `types.ts` to match `docs/api.md`. `Application` gets `company: {id, name}`, `nextInterview`, `createdAt`, and `updatedAt` in place of `companyId`. `Interview` and `Note` drop `applicationId`. Optional fields become `| null`. Map snake_case to camelCase in the API client.
6. Remove the demo error triggers in `Login.tsx` and `Register.tsx` and show the errors the API returns.
7. Add the frontend to Docker Compose in Phase 5.
