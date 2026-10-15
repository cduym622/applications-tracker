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
| 5. Docker | `docker compose up` runs the frontend, the API, and PostgreSQL | Not started. |
| 6. CI | GitHub Actions on each pull request: install, migrate, test, lint, image build, frontend build | Not started. |
| 7. AWS | ECS on Fargate, RDS, ECR, S3, CloudFront | Not started. |
| 8. CD | A passing build on `main` deploys the API and the frontend | Not started. |
| 9. Monitoring | CloudWatch logs and metrics, including the result of `GET /api/health/` | Not started. |
| 10. Break and fix | Cause a database outage and a failed deploy, then fix what breaks | Not started. |

Supporting documents for this project and for each individual phase can be fount in `docs/`

## Architecture

### What runs today

Two processes and Postgres.app. No containers yet.

```text
Browser
  -> Vite dev server
       -> React screens
       -> /api proxied to Django on 127.0.0.1:8000
            -> PostgreSQL on localhost:5432
```

Vite proxies `/api`, so the browser uses one origin. The API has no CORS configuration.

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
backend/          Django project
  config/         settings, root URLs, WSGI
  tracker/        models, serializers, views, permissions, filters, urls, migrations
    tests/        pytest suite
frontend/         React and TypeScript screens
  src/pages/      landing, login, register, dashboard, list, create, edit, detail
  src/components/ application form, status badge, status menu, back link
  src/api.ts      every API call; maps snake_case responses to camelCase
  src/auth.tsx    JWT in localStorage
docs/             spec, screen description, architecture, schema, API contract
  Phase1-Docs/    planning changelog
  Phase2-Docs/    backend manual and changelog
  Phase3-Docs/    test manual and changelog
  Phase4-Docs/    frontend manual, changelog, and change summary
```

`backend/README.md` is the API setup, including Postgres.app, the virtualenv, and `.env`. `frontend/README.md` is how to run the screens against that API.

## Run it locally

Phases 5 and later are not in the repo, so local use is two processes plus Postgres.app.

From `backend/`, with PostgreSQL running and `.env` loaded:

```sh
python manage.py migrate
python manage.py runserver
```

The API listens at `http://127.0.0.1:8000/api/`.

From `frontend/`:

```sh
npm install
npm run dev
```

Open the URL Vite prints. Register an account, or log in. The dev server proxies `/api` to port 8000.

Tests, from `backend/` with `.env` loaded:

```sh
pytest
```

pytest-django creates `test_<POSTGRES_DB>` on the same PostgreSQL server and drops it when the run finishes. The suite does not use SQLite.
