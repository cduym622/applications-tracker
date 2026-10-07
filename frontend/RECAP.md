# Frontend recap

## What this is

This folder holds clickable UI frames for the seven screens described in `PROJECTDESCRIPTION.md` and `PROJECTSPEC.md`. They let you see how the app looks and moves between screens. Nothing calls a backend. Every screen reads from a static mock file.

The stack is Vite, React 19, TypeScript, and react-router-dom 7. Styling is plain CSS in one file. There are no other dependencies, because the spec says to add a technology only when a requirement needs it.

## What changed

Everything under `frontend/` is new. No file outside this folder was changed.

## Running it

Node is not installed on this machine. A temporary copy of Node was downloaded into a scratch folder only to confirm that `npm run build` passes. Install Node 20 or later, then run:

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
      BackLink.tsx           "← Dashboard" link
    pages/
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
| `/login` | Login | Signed out. Signed-in visitors go to `/dashboard`. |
| `/register` | Register | Signed out. Signed-in visitors go to `/dashboard`. |
| `/dashboard` | Dashboard | Signed in. Signed-out visitors go to `/login`. |
| `/applications` | Application list | Signed in |
| `/applications/new` | Create | Signed in |
| `/applications/:id` | Detail | Signed in |
| `/applications/:id/edit` | Edit | Signed in |
| any other path | Redirects to `/dashboard` | |

## Spec rules the frames follow

- No screen has a sidebar or a top bar that stays on every page. The dashboard links to the list, to create, and to log out. The list links to create. Every other signed-in screen has a "← Dashboard" link.
- Status can change only on the edit screen. The detail screen shows it but has no control to change it.
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
- **Edit and delete.** Saving an edit returns to the detail screen without changing data. Deleting an application asks for confirmation, then opens the list without removing anything.
- **Interviews and notes.** Adds, edits, and deletes change only the open page and reset on refresh.
- **List.** Search, the date filter, and paging (5 rows per page) run in the browser on the mock data. The real API does this on the server.

## Next steps when the backend exists

1. Replace `mockData.ts` with an API client that calls the endpoints in `PROJECTSPEC.md`.
2. Change `auth.tsx` to store the JWT from `/api/auth/login/`, send it on each request, and sign out when it expires.
3. Send search, the date range, and the page number to `GET /api/applications/` as query parameters, and drop the in-browser filtering.
4. On submit, if the company name is new, call `POST /api/companies/` before creating or updating the application.
5. Keep `types.ts`. Field names may need mapping if the API returns snake_case.
6. Remove the demo error triggers in `Login.tsx` and `Register.tsx` and show the errors the API returns.
7. Add the frontend to Docker Compose in Phase 5.
