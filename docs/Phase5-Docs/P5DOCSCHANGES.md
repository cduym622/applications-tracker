# Phase 5 docs changes

This file lists changes to the docs made while putting the frontend, the API, and PostgreSQL in containers on 2026-10-15. Each entry says what changed and why. The code already matches every entry. `api.md`, `database.md`, and the schema are unchanged.

Phase 5 added `compose.yaml`, `.env.example`, `backend/Dockerfile`, `backend/.dockerignore`, `frontend/Dockerfile`, and `frontend/.dockerignore`. It pinned `gunicorn==26.2.0` in `backend/requirements.txt` and changed `frontend/vite.config.ts` to read its proxy target from `API_PROXY_TARGET`.

## architecture.md

| Change | Why |
| --- | --- |
| Services says the Vite proxy target comes from `API_PROXY_TARGET`, set to `http://backend:8000` by Compose and defaulting to `http://127.0.0.1:8000` | Inside the frontend container, `127.0.0.1` is that container, so the old fixed target could not reach the API. The default keeps the host steps in `frontend/README.md` working unchanged. |
| Services gains the local ports, the `migrate` step, and a diagram of the three containers | The section said `docker compose up` starts three containers but not how they connect. |
| Services says PostgreSQL publishes no port | Only the API needs the database. Publishing 5432 would also collide with Postgres.app, which Phase 3 still uses for `pytest`. |
| Repository layout lists `compose.yaml`, `.env.example`, both Dockerfiles, and `Phase5-Docs/` | Phase 5 adds them. |
| Repository layout lists `P5-INFO.md` under `Phase5-Docs/` | The owner asked for a summary of Phase 5, with run steps and the reasons behind each choice, in that folder. The layout lists every file in the phase folders. |
| Repository layout says the API image does not migrate on start, and Compose runs `migrate` first | CD runs migrations as a one-off ECS task that must succeed before the service updates. If the image migrated on start, every new task would migrate too, and a failed migration would not stop the deploy. |
| Known tradeoffs gains the single-worker throttle entry | The open question at the end of `P2DOCSCHANGES.md` asked Phase 5 or 7 to add a shared cache or record the tradeoff. Redis is excluded by the spec unless a requirement needs it, so gunicorn runs one worker and the multi-task limit is recorded instead. |
| Configuration says Compose has development-only fallbacks, a root `.env` overrides them, and `backend/.env` is separate | The old sentence said Compose reads `.env` without saying which one. `backend/.env` points at Postgres.app on `localhost` with your macOS user, which does not match the database container. The fallbacks let the spec's one command, `docker compose up`, start the stack with no setup. |

## README.md

This file is outside `docs/`. It is listed here because it describes how to run the project.

| Change | Why |
| --- | --- |
| Phase 5 marked done | Phase 5 adds the Compose stack. |
| "What runs today" shows the three containers | It described two host processes and Postgres.app. |
| "Run it locally" leads with `docker compose up`, adds a Compose command table, and keeps `pytest` on the host | The spec makes `docker compose up` the way to run the project locally. Tests stay on Postgres.app, as Phase 3 recorded. |
| "Run it locally" says PostgreSQL reads its user and password only when it creates its volume | Changing them in `.env` after the first run has no effect until `docker compose down -v`. That is easy to miss. |
| The rebuild command after a `package.json` change includes `--renew-anon-volumes` | `node_modules` in the frontend container is an anonymous volume. Compose reuses it when it recreates the container, so a plain `--build` would keep the old packages. |
| Repository section lists `compose.yaml`, `.env.example`, both Dockerfiles, and `Phase5-Docs/` with its changelog and summary | Phase 5 adds them. |

## Phase5-Docs

| Change | Why |
| --- | --- |
| New `P5-INFO.md` | Records what Phase 5 built, how to run and stop the stack, how configuration works, why each choice was made, the checks that ran, a click-through list, troubleshooting, and limits to know before Phase 6. The owner asked for it. |

## backend/README.md

| Change | Why |
| --- | --- |
| The opening points to `docker compose up` and says tests still use these steps | The old line said Docker Compose comes in Phase 5. |
| Layout lists `Dockerfile` | Phase 5 adds it. |
| Throttling notes that gunicorn runs one worker | The single-worker choice exists because of the throttle. A reader changing the worker count should see why. |
| "Not in this phase" drops Docker and gunicorn | Phase 5 adds both. |

## frontend/README.md

| Change | Why |
| --- | --- |
| "Not in this phase" replaced with "Run in Docker" | The old section said Docker Compose comes in Phase 5. The new one covers the URL, the bind mount, `API_PROXY_TARGET`, and rebuilding after a `package.json` change. |
