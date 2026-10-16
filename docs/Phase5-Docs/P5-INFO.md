# Phase 5 info

Phase 5 put the frontend, the API, and PostgreSQL in containers. One command, `docker compose up`, now starts all three, and a user can sign in and use the screens. This is the Phase 5 requirement in `PROJECTSPEC.md`. This file records what was built on 2026-10-15, how to run it, how it works, and what to know before Phase 6.

`P5DOCSCHANGES.md` in this folder lists each change to the other docs and why. `architecture.md` is still the design source of truth.

## What runs

```text
Browser
  -> http://127.0.0.1:5173
       frontend container: Vite dev server (React screens)
         -> /api proxied to http://backend:8000
              backend container: gunicorn running Django
                -> db:5432
                     db container: PostgreSQL 17
```

The browser only ever talks to port 5173. Vite serves the React screens and forwards every `/api` request to the API container. The browser therefore sees one origin, as it did in Phase 4 and as it will behind CloudFront, so the API still needs no CORS setup.

The three containers share a private network that Compose creates. On that network each container is reachable by its service name, so the API connects to the database at host `db` and Vite proxies to host `backend`.


| Service    | Image                            | Host port        | Purpose                                                 |
| ---------- | -------------------------------- | ---------------- | ------------------------------------------------------- |
| `frontend` | built from `frontend/Dockerfile` | `127.0.0.1:5173` | Vite dev server. Serves the screens and proxies `/api`. |
| `backend`  | built from `backend/Dockerfile`  | `127.0.0.1:8000` | Django REST API under gunicorn.                         |
| `db`       | `postgres:17`                    | none             | The database. Only the API can reach it.                |


Every published port is bound to `127.0.0.1`, so other machines on your network cannot reach the stack.

## What changed



### New files


| File                                | What it does                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `compose.yaml`                      | Defines the three services, their settings, start order, health checks, and the database volume.                  |
| `.env.example`                      | Lists the values a root `.env` can override. Copy it to `.env` to change them.                                    |
| `backend/Dockerfile`                | Builds the API image: Python 3.12, the pinned requirements, the Django code, and gunicorn as the default command. |
| `backend/.dockerignore`             | Keeps `.env`, `.venv/`, caches, and docs out of the API image.                                                    |
| `frontend/Dockerfile`               | Builds the dev server image: Node 22, `npm ci` from the lockfile, and `npm run dev`.                              |
| `frontend/.dockerignore`            | Keeps `node_modules/`, `dist/`, `.env` files, and `.npmrc` out of the frontend image.                             |
| `docs/Phase5-Docs/P5DOCSCHANGES.md` | The docs changelog for this phase.                                                                                |
| `docs/Phase5-Docs/P5-INFO.md`       | This file.                                                                                                        |




### Changed files


| File                                      | Change                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `backend/requirements.txt`                | Adds `gunicorn==26.2.0`.                                                                                           |
| `frontend/vite.config.ts`                 | Reads the proxy target from `API_PROXY_TARGET`. When it is unset, the target is still `http://127.0.0.1:8000`.     |
| `docs/architecture.md`                    | Describes the local containers, the repository layout, the single-worker tradeoff, and which `.env` Compose reads. |
| `README.md`                               | Phase 5 is marked done. "Run it locally" now starts with `docker compose up`.                                      |
| `backend/README.md`, `frontend/README.md` | Point to Compose for the three-container run and keep the host steps.                                              |


Nothing in the Django code, the React code, the schema, or the API contract changed. No npm package was added.

## How to run it



### Requirements

Docker Desktop, running. Nothing else is needed on the host for the stack itself. Python, Node, and PostgreSQL all run inside the containers.

### Start

From the repository root:

```sh
docker compose up
```

The first run downloads the base images and builds the two app images, which takes a few minutes. Later runs start in seconds.

Open `http://127.0.0.1:5173`. Register an account, or log in. The dashboard opens.

The API is also reachable directly:

- `http://127.0.0.1:8000/api/health/live/` returns 200 without touching the database.
- `http://127.0.0.1:8000/api/health/` returns 200 when the API can query PostgreSQL, and 503 when it cannot.
- `http://127.0.0.1:8000/api/schema/swagger-ui/` is Swagger UI.

Press Ctrl+C to stop the stack. Run `docker compose up -d` instead to start it in the background.

### Start order

Compose starts the containers in a fixed order, and each one waits for the one before it to report healthy.

1. `db` starts. Its health check runs `pg_isready` every 5 seconds until PostgreSQL accepts connections.
2. `backend` starts once `db` is healthy. It runs `python manage.py migrate --noinput`, then starts gunicorn. Its health check requests `/api/health/live/` until it returns 200.
3. `frontend` starts once `backend` is healthy, so the screens never load before the API can answer.

If the migration fails, the API container exits and the frontend never starts. `docker compose logs backend` shows the error.

### Everyday commands


| Command                                                  | What it does                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `docker compose up`                                      | Builds if needed, migrates, and starts all three containers.                       |
| `docker compose up -d`                                   | The same, in the background.                                                       |
| `docker compose ps`                                      | Shows each container and whether it is healthy.                                    |
| `docker compose logs -f backend`                         | Follows the API logs. Use `frontend` or `db` for the others.                       |
| `docker compose up --build`                              | Rebuilds the images first. Run it after a backend change.                          |
| `docker compose up --build --renew-anon-volumes`         | Also replaces the frontend's `node_modules`. Run it after changing `package.json`. |
| `docker compose down`                                    | Stops and removes the containers. The database is kept.                            |
| `docker compose down -v`                                 | Also deletes the database volume and every row in it.                              |
| `docker compose exec backend python manage.py <command>` | Runs a `manage.py` command inside the running API container.                       |




### Editing code while it runs

Frontend edits show up right away. Compose mounts the host's `frontend/` folder into the container, so Vite sees each save and reloads the page.

Backend edits do not. The API image holds a copy of the code made at build time, and gunicorn does not watch files. After a backend change, run `docker compose up --build`.

### Running the tests

The tests did not move into Docker. Run them on the host against Postgres.app, as Phase 3 set up. From `backend/`:

```sh
source .venv/bin/activate
pg_isready -h localhost
set -a; source .env; set +a
pytest
```

The stack and the tests can run at the same time. The database container publishes no port, so it does not take port 5432 from Postgres.app.

## Configuration

Django reads every setting from environment variables, as it has since Phase 2. Compose sets them in the `environment` block of each service.

To make `docker compose up` work with no setup, each secret has a development-only fallback in `compose.yaml`, written as `${VAR:-fallback}`.


| Variable            | Fallback                                             | Who reads it     |
| ------------------- | ---------------------------------------------------- | ---------------- |
| `SECRET_KEY`        | `local-dev-only-secret-key-do-not-use-in-production` | API              |
| `DEBUG`             | `true`                                               | API              |
| `POSTGRES_DB`       | `applications_tracker`                               | API and database |
| `POSTGRES_USER`     | `postgres`                                           | API and database |
| `POSTGRES_PASSWORD` | `local-dev-only-password`                            | API and database |


The API and the database read the same three `POSTGRES_` values, so they always agree on the database name, user, and password.

These values are fixed in `compose.yaml`, with no override:


| Variable           | Value                         | Why                                                                                                 |
| ------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `POSTGRES_HOST`    | `db`                          | The database's service name on the Compose network.                                                 |
| `POSTGRES_PORT`    | `5432`                        | PostgreSQL's port inside its container.                                                             |
| `ALLOWED_HOSTS`    | `backend,localhost,127.0.0.1` | `backend` is the `Host` header the Vite proxy sends. The other two allow direct calls to port 8000. |
| `NUM_PROXIES`      | `0`                           | No proxy that adds `X-Forwarded-For` sits in front of Django locally. Production sets 2.            |
| `API_PROXY_TARGET` | `http://backend:8000`         | Where Vite forwards `/api`.                                                                         |




### Overriding the fallbacks

Copy `.env.example` to `.env` in the repository root and edit it. Compose reads that file automatically. Git ignores it.

PostgreSQL reads `POSTGRES_USER` and `POSTGRES_PASSWORD` only when it first creates its data volume. If you change them after the first run, the database still has the old password and the API cannot log in. Run `docker compose down -v` to delete the volume, then `docker compose up` to create it again with the new values. This deletes the data.

### Two different .env files


| File                          | Used by                              | Points at                   |
| ----------------------------- | ------------------------------------ | --------------------------- |
| `.env` in the repository root | `docker compose`                     | The `db` container          |
| `backend/.env`                | `pytest` and `runserver` on the host | Postgres.app on `localhost` |


Compose does not read `backend/.env`. That file's host, user, and empty password are right for Postgres.app and wrong for the container.

## Why it is built this way



### One Dockerfile per app, one Compose file at the root

The frontend and backend use different languages and build steps, so each folder has its own `Dockerfile` and `.dockerignore`, and each image builds from its own folder. `compose.yaml` at the root ties them together. This is Docker's usual layout for a repository with more than one app.

### gunicorn instead of runserver

Django's `runserver` is for development only. The API image runs gunicorn, a production WSGI server, so the image Phase 7 deploys to ECS is the same one that runs locally. `architecture.md` recorded gunicorn as a needed library in Phase 1, and this phase added it.

### One gunicorn worker

Login and register each allow 10 requests per minute per client. DRF counts those requests in Django's default cache, which lives in the memory of one process. With 4 workers, each would keep its own count, and a client could make about 40 attempts a minute. One worker keeps the limit at 10 per container.

A shared cache such as Redis would fix this for any number of workers. The spec excludes Redis unless a requirement needs it, and one worker is enough for this project's load. `architecture.md` records the tradeoff, including that each ECS task in production still keeps its own count.

### Migrations run in Compose, not in the image

The image's default command starts gunicorn and nothing else. In production, CD runs `migrate` as a separate one-off ECS task, and a failed migration stops the deploy before the service switches to the new image. If the image migrated on every start, each new task would also migrate, and a failed migration would not stop anything.

Locally that safety matters less than a one-command start, so `compose.yaml` replaces the command with `migrate`, then gunicorn. Migrations are idempotent, so running them on every start is harmless.

### No published database port

Only the API needs the database, and it connects over the Compose network. Leaving port 5432 unpublished also keeps it free for Postgres.app, which the tests still use.

### A configurable proxy target

Inside the frontend container, `127.0.0.1` means the frontend container itself, not the API. The old fixed target of `http://127.0.0.1:8000` therefore reached nothing. `vite.config.ts` now reads `API_PROXY_TARGET`. Compose sets it to `http://backend:8000`. When it is unset, as in the host steps from Phase 4, the target is still `http://127.0.0.1:8000`.

The config reads the variable with Vite's `loadEnv`, which already returns shell variables. Reading `process.env` directly would have meant adding `@types/node` for the type check.

The browser still calls the relative path `/api`. Nothing in the React code knows the API's address.

### Non-root containers

Both images run their process as an unprivileged user. The API runs as `app` (uid 1001). The frontend runs as Node's built-in `node` user. A bug in the app then cannot change files owned by root inside the container.

The frontend installs its packages as `node`, not as root. Vite writes a cache to `node_modules/.vite` when it starts, and a root-owned `node_modules` would make that write fail.

### The frontend's node_modules volume

`compose.yaml` mounts the host's `frontend/` folder over `/app`, which would hide the `node_modules` that the image installed. A second, anonymous volume at `/app/node_modules` keeps the image's copy visible. The container also never uses the host's `node_modules`, which holds macOS builds of esbuild and rollup that cannot run on Linux.

Compose keeps an anonymous volume when it recreates a container. After `package.json` changes, `--renew-anon-volumes` makes it replace the old copy with the rebuilt image's packages.

### File watching on macOS

File changes in a bind mount on macOS do not always raise file events inside the Linux container. `CHOKIDAR_USEPOLLING=true` makes Vite's file watcher poll for changes, so saves reload the page.

### Secrets stay out of images

Neither Dockerfile sets a secret. Both `.dockerignore` files exclude `.env`, so a real `.env` on disk cannot be copied into an image layer. Secrets reach the containers only as runtime environment variables. In production, ECS will inject `SECRET_KEY` and `POSTGRES_PASSWORD` from SSM Parameter Store, as `architecture.md` describes.

### Build caching

Each Dockerfile installs dependencies before it copies the source. Docker reuses the dependency layer until `requirements.txt` or `package-lock.json` changes, so a code-only change rebuilds in seconds. BuildKit cache mounts keep pip's and npm's download caches between builds without putting them in the image.

## Verification

Checks that ran on 2026-10-15:

- [x] `docker compose config --quiet` passed.
- [x] `npm run build` passed on the host with the new `vite.config.ts`. It runs `tsc -b`, which type-checks the config file.
- [x] `docker compose up` built both images and started all three containers. `docker compose ps` showed `db` and `backend` as healthy.
- [x] `GET http://127.0.0.1:5173/api/health/live/` returned 200 with `{"status":"ok"}`. That request went through the Vite proxy to gunicorn.
- [x] `GET http://127.0.0.1:5173/api/health/` returned 200 with `{"status":"ok"}`. That request also reached PostgreSQL in the `db` container.

Click-through in the browser, which the Phase 5 requirement asks for:

- [x] Open `http://127.0.0.1:5173`. The landing page loads.
- [x] Register a new account. The dashboard opens.
- [x] Create an application, open it, add an interview and a note.
- [x] Log out, log back in, and refresh. You stay on the dashboard.
- [x] Run `docker compose down`, then `docker compose up`. Log in again. Your data is still there.
- [x] Run `docker compose stop db`. `http://127.0.0.1:8000/api/health/` returns 503 and `/api/health/live/` still returns 200. Run `docker compose start db` and `/api/health/` returns 200 again.
- [x] Change a line of text in a screen under `frontend/src/` and save. The browser updates without a rebuild.



## Troubleshooting


| Symptom                                                                        | Cause                                                                        | Fix                                                                                |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `failed to connect to the docker API` or `Cannot connect to the Docker daemon` | Docker Desktop is not running.                                               | Open Docker Desktop and wait until it says it is running.                          |
| `port is already allocated` for 5173 or 8000                                   | `npm run dev` or `runserver` from the host steps is still running.           | Stop the host process, then run `docker compose up` again.                         |
| The frontend container never starts                                            | The API never became healthy.                                                | Run `docker compose logs backend` and fix the error it shows.                      |
| `password authentication failed for user` in the API logs                      | `POSTGRES_USER` or `POSTGRES_PASSWORD` changed after the volume was created. | `docker compose down -v`, then `docker compose up`. This deletes the data.         |
| `Bad Request (400)` from the API                                               | The request used a hostname that is not in `ALLOWED_HOSTS`.                  | Use `127.0.0.1` or `localhost`.                                                    |
| A new npm package is missing in the container                                  | The frontend reused its old `node_modules` volume.                           | `docker compose up --build --renew-anon-volumes`.                                  |
| A backend change has no effect                                                 | The API image still holds the old code.                                      | `docker compose up --build`.                                                       |
| Saving a frontend file does not reload the page                                | The file watcher missed the change.                                          | Refresh the browser. If that does not help, run `docker compose restart frontend`. |




## Things to know



### Behavior

- The local database is separate from Postgres.app. Accounts and applications created in Docker live in the `applications-tracker_db-data` volume. Accounts created in Phase 4 against Postgres.app do not appear in Docker.
- `DEBUG` defaults to `true` in Compose. An unknown route shows Django's HTML debug page instead of the JSON 404, as `backend/README.md` already notes.
- The API's paginated `next` and `previous` links now name `backend:8000`, because that is the host the proxy sends. The list screen already ignores those URLs and builds its own page numbers, as `P4-CHANGES.md` notes, so nothing breaks.
- The frontend container runs the Vite dev server, not a production build. Production serves the built files from S3 and does not use this image. React strict mode still runs each effect twice in this mode.



### Known limits

- The throttle limit is per process. It is correct for one container, and it multiplies with the number of ECS tasks in production. `architecture.md` records this.
- The API does not reload when code changes. Rebuild after a backend edit.
- Base images use version tags (`python:3.12-slim`, `node:22-slim`, `postgres:17`), not image digests. A rebuild can pick up a newer minor or patch release of each.
- The tests do not run in Docker. CI in Phase 6 will start its own PostgreSQL.



### Next phase

Phase 6 adds the GitHub Actions workflow. It will build `backend/Dockerfile` as the "Build the Docker image" step in `PROJECTSPEC.md`, and build the frontend with `npm run build`. Phase 7 pushes the same API image to ECR and runs it on ECS.