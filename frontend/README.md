# Frontend

This folder holds the React and TypeScript screens. They call the API described in `docs/api.md`.

The stack is Vite, React 19, TypeScript, and react-router-dom 7, with plain CSS in `src/index.css`. API calls use the browser `fetch` API. `src/api.ts` holds every call and maps the API's snake_case fields to the camelCase types in `src/types.ts`.

## Requirements

Node 20 or later.

## Run against the local API

Start the API first, following `backend/README.md`. It listens on `http://127.0.0.1:8000`. Leave it running.

Then, from `frontend/`:

```sh
npm install      # install dependencies
npm run dev      # start the Vite dev server and print a local URL
```

Open the printed URL. The Vite dev server proxies `/api` to the API on port 8000, so the browser makes every call to the same origin and the API needs no CORS setup.

Register an account, or log in with an existing one. The access token is stored in `localStorage` under `access` and lasts 24 hours.

## Build

```sh
npm run build    # type-check with tsc, then build into dist/
```

## How the client is built

`docs/Phase4-Docs/P4IMPLEMENTATIONMANUAL.md` describes the session, request, error, and paging rules the screens follow.

## Not in this phase

Docker Compose comes in Phase 5.
