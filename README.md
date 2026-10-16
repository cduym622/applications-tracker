# Applications Tracker

This project allows for users to track their job applications in a structured, simple user interface. 

After authentication, users can:
* Add, modify, and delete applications
* Submit details and notes regarding an application
* Update the status of their application
* Keep track of interviews related to each application
* View a dashboard showing the number of applications of each status type
* View upcoming interviews on that same dashboard

Stack in the repo today: Python 3.12, Django 5.2, Django REST Framework, PostgreSQL, React 19, TypeScript, and Vite. JWT authentication uses `djangorestframework-simplejwt`. OpenAPI and Swagger UI use `drf-spectacular`.

Requirements are in [docs/PROJECTSPEC.md](docs/PROJECTSPEC.md). Screen flow is in [docs/PROJECTDESCRIPTION.md](docs/PROJECTDESCRIPTION.md).

## Phase status

[docs/PROJECTSPEC.md](docs/PROJECTSPEC.md) defines ten phases. Each phase finishes before the next starts.

| Phase | Work | Status |
| --- | --- | --- |
| 1. Planning | `docs/architecture.md`, `docs/database.md`, `docs/api.md` | Done, 2026-10-09. |
| 2. Backend | Django REST API and the PostgreSQL schema | Done, 2026-10-10. |
| 3. Testing | pytest suite against PostgreSQL | Done, 2026-10-11. |
| 4. Frontend | React screens calling the API | Done, 2016-10-15. |
| 5. Docker | `docker compose up` runs the frontend, the API, and PostgreSQL | Done, 2026-10-15. |
| 6. CI | GitHub Actions on each pull request: install, migrate, test, lint, image build, frontend build | Not started. |
| 7. AWS | ECS on Fargate, RDS, ECR, S3, CloudFront | Not started. |
| 8. CD | A passing build on `main` deploys the API and the frontend | Not started. |
| 9. Monitoring | CloudWatch logs and metrics, including the result of `GET /api/health/` | Not started. |
| 10. Break and fix | Cause a database outage and a failed deploy, then fix what breaks | Not started. |

Supporting documents for this project and for each individual phase can be fount in `docs/`

## Architecture

### What runs today

`docker compose up` starts three containers.

```text
Browser on 127.0.0.1:5173
  -> frontend container: Vite dev server
       -> React screens
       -> /api proxied to the backend container
            -> gunicorn and Django on port 8000
                 -> db container: PostgreSQL
```

Vite proxies `/api`, so the browser uses one origin. The API has no CORS configuration. The database publishes no port. `pytest` still runs on the host against Postgres.app.

Register and login return an access token. The frontend stores it in `localStorage` under `access` and sends `Authorization: Bearer` on later requests. The token lasts 24 hours. There is no refresh token. Logout deletes the token in the browser.

### Data

PostgreSQL holds five entities. The Django models in `backend/tracker/models.py` match [docs/database.md](docs/database.md).

- A user has many companies and many applications.
- A company has many applications. The name is unique for that user, ignoring case. Two users can each have a company with the same name.
- An application has many interviews and many notes.
- Deleting an application deletes its interviews and notes. The company stays.
- An interview update changes `outcome` only. Changing the date, type, round, or interviewer means deleting the interview and adding another.

Every query is limited to the signed-in user. Another user's record and a missing record both return 404 with `{"detail": "Not found."}`.

Application writes send `company_name`. The API matches that name against the user's companies, ignoring case, or creates the company in the same transaction as the application.

### API

Routes live in `backend/tracker/urls.py` and are mounted at `/api/`. The contract is [docs/api.md](docs/api.md).

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register/`, `POST /api/auth/login/` |
| Dashboard | `GET /api/dashboard/` |
| Applications | list, create, retrieve, patch, delete under `/api/applications/` |
| Companies | `GET /api/companies/` |
| Interviews | list, create, patch outcome, delete under `/api/applications/{id}/interviews/` |
| Notes | list, create, patch, delete under `/api/applications/{id}/notes/` |
| Health | `GET /api/health/`, `GET /api/health/live/` |
| Schema | `/api/schema/`, Swagger UI at `/api/schema/swagger-ui/` |

`GET /api/health/live/` returns 200 and does not query the database. `GET /api/health/` queries PostgreSQL and returns 503 when that query fails.

The list endpoint searches job title and company name, filters by an applied-date range and one status, and returns one page at a time. The dashboard returns a count for every status, including zero, and the soonest 10 upcoming interviews.

### Production design

This is specified in [docs/architecture.md](docs/architecture.md) and is not deployed. Phases 5 through 9 build it.

```text
Browser
  -> CloudFront
       -> S3 for the Vite build
       -> Application Load Balancer -> ECS on Fargate -> RDS PostgreSQL
          for /api
```

Amazon ECR stores the API image. `main` is the release branch. After CI passes, GitHub Actions pushes the image, runs migrations as a one-off ECS task, updates the service, uploads the frontend to S3, and invalidates `/index.html`. `SECRET_KEY` and `POSTGRES_PASSWORD` come from SSM Parameter Store. CloudWatch receives application logs, ECS logs, HTTP errors, ECS CPU and memory, and the result of `GET /api/health/`.

## Repository

```text
compose.yaml      local stack: frontend, backend, db
.env.example      optional overrides for compose.yaml
backend/          Django project
  Dockerfile      API image (gunicorn)
  config/         settings, root URLs, WSGI
  tracker/        models, serializers, views, permissions, filters, urls, migrations
    tests/        pytest suite
frontend/         React and TypeScript screens
  Dockerfile      Vite dev server image
  src/pages/      landing, login, register, dashboard, list, create, edit, detail
  src/components/ application form, status badge, status menu, back link
  src/api.ts      every API call; maps snake_case responses to camelCase
  src/auth.tsx    JWT in localStorage
docs/             spec, screen description, architecture, schema, API contract
  Phase1-Docs/    planning changelog
  Phase2-Docs/    backend manual and changelog
  Phase3-Docs/    test manual and changelog
  Phase4-Docs/    frontend manual, changelog, and change summary
  Phase5-Docs/    Docker changelog and phase summary
```

`backend/README.md` is the API setup on the host, including Postgres.app, the virtualenv, and `.env`. `frontend/README.md` is how to run the screens against that API.

## Run it locally

You need Docker Desktop running. From the repository root:

```sh
docker compose up
```

The first run builds both images. Open `http://127.0.0.1:5173`, then register an account or log in. The API is also at `http://127.0.0.1:8000/api/`, with Swagger UI at `/api/schema/swagger-ui/`.

The stack starts with development-only defaults for `SECRET_KEY` and the database password. To change them, copy `.env.example` to `.env` in the repository root and edit it. PostgreSQL reads `POSTGRES_USER` and `POSTGRES_PASSWORD` only when it first creates its volume. After changing them, run `docker compose down -v` to delete that volume and its data.

| Command | What it does |
| --- | --- |
| `docker compose up` | Builds if needed, migrates, and starts all three containers. |
| `docker compose up --build` | Rebuilds the images first. Run it after a backend change. |
| `docker compose up --build --renew-anon-volumes` | Also replaces the frontend container's `node_modules`. Run it after changing `package.json`. |
| `docker compose down` | Stops the containers and keeps the database. |
| `docker compose down -v` | Stops the containers and deletes the database volume. |
| `docker compose logs -f backend` | Follows the API logs. |

Frontend source is bind-mounted, so Vite reloads on save. Backend code is copied into the image, so restart with `docker compose up --build` after a backend change.

To run the API and screens as host processes instead, follow `backend/README.md` and `frontend/README.md`.

Tests run on the host against Postgres.app, from `backend/` with `.env` loaded:

```sh
pytest
```

pytest-django creates `test_<POSTGRES_DB>` on the same PostgreSQL server and drops it when the run finishes. The suite does not use SQLite.
