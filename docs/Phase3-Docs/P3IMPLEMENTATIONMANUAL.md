# Phase 3 implementation manual

This file tells an implementer how to add the pytest suite. `api.md` and `P2IMPLEMENTATIONMANUAL.md` stay the contract. This manual points at them and only spells out how to test them.

Phase 3 is the tests listed in PROJECTSPEC.md, the Phase 2 acceptance checks, and a check that the OpenAPI schema matches `api.md`.

## Out of scope

The React app, Docker, Docker Compose, gunicorn, lint, formatting, GitHub Actions, and AWS stay in later phases.

The only new libraries are `pytest` and `pytest-django`. Coverage tools, factory libraries, `freezegun`, and a SQLite settings module are out. The suite uses the PostgreSQL engine already in `config/settings.py`.

This manual does not explain how to create a virtualenv or install Python. Those steps are in `backend/README.md`.

## How to run

Tests connect to the Phase 2 Postgres.app server on `localhost:5432`. This phase does not add a container. `docker compose up` is Phase 5, when the frontend, backend, and database run together.

Start the server the way `backend/README.md` already describes. Open Postgres.app and initialize it if the server is not already running.

Confirm the server before pytest:

```sh
pg_isready -h localhost
```

`pg_isready` exits 0 when the server accepts connections. Leave Postgres.app running for the whole suite. The health test raises a connection error inside that test, and the server stays up.

From `backend/`, load the same environment the API uses, then run pytest:

```sh
set -a; source .env; set +a
pytest
```

Settings read `SECRET_KEY`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, and `POSTGRES_PORT` from that environment. `SECRET_KEY` has no default. A missing key raises `KeyError` at startup, the same as the API. Tests use `config.settings`. A test secret stays out of Git.

pytest-django creates `test_<POSTGRES_DB>` on that server and drops it when the run finishes. The recorded command is plain `pytest`, with no `--reuse-db`, so the test database does not stay behind. The Postgres.app role is a superuser and can create that database. If it cannot, pytest fails before any test runs.

When this phase is implemented, add that `pytest` command to the useful commands in `backend/README.md`, point the README at this manual, and remove the sentence that says the project has no tests.

## Layout

`backend/pytest.ini` sets `DJANGO_SETTINGS_MODULE = config.settings`. Run pytest from `backend/` so `config` and `tracker` import.

Tests live in `backend/tracker/tests/`. The directory is a package. `conftest.py` holds shared fixtures. One module covers each group in Required cases:

- `test_auth.py`
- `test_applications.py`
- `test_interviews.py`
- `test_notes.py`
- `test_list.py`
- `test_dashboard.py`
- `test_ownership.py`
- `test_constraints.py`
- `test_health.py`
- `test_schema.py`

HTTP tests use Django REST Framework's `APIClient`. Constraint tests that the API cannot express use the ORM.

## Build order

1. Pin `pytest` and `pytest-django` in `backend/requirements.txt`, and add `pytest.ini`.
2. Add `conftest.py` with a database fixture and a signed-in client.
3. Write the modules above in the listed order. Later modules reuse the client fixture.

## Decisions

### Libraries

Add `pytest` and `pytest-django` only. Pin the exact versions in `requirements.txt` the same way the existing packages are pinned. Install them into the virtualenv from `backend/README.md` before pinning.

### Database access

Mark every test that touches the database with pytest-django's `django_db` marker. The signed-in client fixture needs database access too.

The suite stays on PostgreSQL. List order with nulls last, and company names that differ only by case, depend on that engine.

### Clients and users

Only the auth tests call register and login. Each of those endpoints allows 10 requests per minute per client IP. A suite that logs in through the API for every test will receive 429.

Create those users with `User.objects.create_user`. Build the access token with `AccessToken.for_user` and send `Authorization: Bearer <access>` on the `APIClient`. `create_user` hashes the password and does not run the password validators. Register and login tests are the ones that call the endpoints.

Auth tests call `django.core.cache.cache.clear()` before they count requests, so an earlier test does not use up the limit.

### Time

Build interview times from `django.utils.timezone.now` plus or minus a `timedelta`. No clock library. A time an hour ahead is upcoming. A time an hour behind is in the past, so it is left out of upcoming interviews.

### Throttles

Register and login keep separate `ScopedRateThrottle` scopes, 10 requests per minute each, as the Phase 2 manual describes. Clear the cache, send 10 requests to one scope, and assert the 11th returns 429. Give each of those register requests its own email, so a duplicate-email 400 is not confused with the limit. The `detail` string starts with `Request was throttled.` The seconds in that message vary. Assert the prefix, not the example number in `api.md`.

After one scope is exhausted, one request to the other scope returns a status other than 429. A client who has used the register limit can still log in. A client who has used the login limit can still register.

### A failed application save

`ApplicationWriteSerializer.create` finds or creates the company and saves the application inside one `transaction.atomic()`. Validation runs before that block, so a 400 body never creates a company.

To prove the rollback, patch `Application.save` to raise `django.db.DatabaseError` during one create. Use a company name that the user does not already have. The request fails. The company row is gone after the request.

### Health failure

`HealthView` catches `django.db.Error` around `connection.cursor()` and returns 503. Patch `tracker.views.connection.cursor` to raise `django.db.Error`. Postgres.app stays up, and the rest of the suite still has a database.

With that patch active, `GET /api/health/` returns 503 and `{"status": "error"}`. `GET /api/health/live/` still returns 200 and `{"status": "ok"}`, because the live view never opens a cursor.

### Expired tokens

Build an expired access token in the test. Set its expiry in the past with `AccessToken.set_exp` and a negative lifetime. The suite does not wait 24 hours.

The response is 401 and the simplejwt body in `api.md`, including `code` of `token_not_valid`.

### OpenAPI

The schema check is a pytest against `GET /api/schema/`. Keep the schema in that response. `backend/README.md` already has a `spectacular` command that fails on generator warnings. That command checks the generator. This test compares the schema to `api.md`.

`GET /api/schema/` with no token returns 200. `GET /api/schema/swagger-ui/` with no token returns 200.

Read `paths` from the schema JSON. Every route in `api.md` is present. Match the static parts of each path. Spectacular names path parameters from the URL pattern in `tracker/urls.py`, so a parameter may be `application_id` or `pk` rather than the word `id` in `api.md`.

`COMPONENT_SPLIT_REQUEST` is already on, so write and read schemas differ. Follow `$ref` into `components.schemas` when an operation points at a component. The POST and PATCH application request schemas include `company_name` and do not include `company`. The GET application response schema includes `company` and does not include `company_name`.

### Constraints the API cannot reach

Serializers reject a bad status, interview type, or outcome before the database sees it. The API has no company delete. Those rules still need a direct database test.

Use the ORM, and expect `django.db.IntegrityError` from PostgreSQL:

- `QuerySet.update` on an application with a status outside the seven values.
- The same for an interview `type` outside `PHONE`, `VIDEO`, and `ONSITE`.
- The same for an interview `outcome` outside the five outcomes.
- A second `Company.objects.create` for one user whose name differs only by case.

Deleting a company that still has an application raises `django.db.models.ProtectedError`.

The API tests cover the same company rule through `company_name`. The ORM test covers the constraint when the serializer is not in the path.

## Required cases

Bodies, status codes, and error text are the ones in `api.md` unless this manual names a different assertion.

### Auth

`test_auth.py`

- Register returns 201 and login returns 200. Each body has one key, `access`.
- A second register with the same email in a different case is 400 on `email`, with `A user with this email already exists.`
- A password shorter than 8 characters is 400 on `password`.
- A common password, `password`, is 400 on `password`.
- Login with an unknown email, and login with a wrong password, each return 401 and `{"detail": "Email or password is incorrect."}`. The body has no `email` field.
- A request with no token to an authenticated route returns 401 and `Authentication credentials were not provided.`
- An expired token returns the simplejwt 401 body in `api.md`.
- The 11th register in a minute, each with its own email, is 429. A login during that window is not 429. The 11th login in a minute is 429. A register during that window is not 429.

### Applications

`test_applications.py`

- Create, read, update, and delete an application. Create returns 201, read and update return 200, delete returns 204 and an empty body.
- A create that omits `status` stores `SAVED`.
- A required string that is empty after trim is 400. A `company_name` that is blank after trim is 400. A `job_posting_url` that is not a URL is 400. A `status` outside the seven values is 400.
- A new `company_name` creates one company. A later application with that name in a different case uses the same company and keeps the stored spelling. `Stripe` stays `Stripe` when the client sends `stripe`.
- The patched `Application.save` failure leaves no new company.
- Delete removes that application's interviews and notes. The company remains.

### Interviews

`test_interviews.py`

- Add an interview and delete it. Add returns 201. Delete returns 204.
- A create that omits `outcome` stores `SCHEDULED`.
- PATCH of `outcome` returns 200 and stores the new outcome.
- PATCH with any other field is 400 on that field. The outcome stays as it was.
- `PUT` on the interview path returns 405.

### Notes

`test_notes.py`

- Create, update, and delete a note. Create returns 201, update returns 200, delete returns 204.
- After an update, `created_at` is unchanged.
- `updated_at` changes when `text` changes. `updated_at` stays the same when the PATCH sends the stored text.

### List

`test_list.py`

- `q` matches job title or company name, ignoring case. A query that matches neither returns an empty page.
- An applied-date range keeps applications whose `date_applied` falls on `from`, on `to`, or between them. An application with no `date_applied` stays in the list when both bounds are empty, and drops out when either bound is set.
- `status` keeps one status.
- An invalid `status` or date is 400. A `from` later than `to` is 400 on `from`.
- Page size is 10. Eleven applications return 10 on page 1 and 1 on page 2. `page_size` in the query string does not change that size.
- Order is `date_applied` descending, rows with no `date_applied` last, then `id` descending. Two rows with the same date come back with the higher `id` first.
- A page past the end is 404 and `{"detail": "Not found."}`.

### Dashboard

`test_dashboard.py`

- `counts` has all seven statuses. A status with no applications is 0.
- Upcoming interviews are in the future and have outcome `SCHEDULED`. A past `SCHEDULED` interview is absent. A future interview with another outcome is absent. Another user's interview is absent.
- Eleven upcoming interviews return the soonest 10. Soonest is the earliest `scheduled_at`. When two share that time, the lower `id` comes first.
- Each item includes `job_title`, `company_name`, `scheduled_at`, `type`, and `application_id`.

### Two users

`test_ownership.py`

- Each user sees only their own applications and companies. Both users can have a company with the same name. Those are two rows.
- User B's application with that shared name points at user B's company, not user A's.
- User B's request for user A's application id is 404 and `{"detail": "Not found."}`, the same body as an id that does not exist.
- User B's request for an interview or note under user A's application is that same 404. An interview or note id that belongs to a different application of the caller is also 404.

### Relationships and constraints

`test_constraints.py`

- The check constraints reject a bad application status, a bad interview type, and a bad interview outcome, through the ORM updates in Decisions.
- The company unique constraint rejects a second company for one user when the names differ only by case.
- Deleting a company that still has an application raises `ProtectedError`.
- The API delete in `test_applications.py` is the cascade check. It removes the application's interviews and notes and leaves the company.

### Health

`test_health.py`

- Both health routes return 200 and `{"status": "ok"}` with no token while PostgreSQL answers.
- With `tracker.views.connection.cursor` raising `django.db.Error`, `GET /api/health/` returns 503 and `{"status": "error"}`, and `GET /api/health/live/` still returns 200 and `{"status": "ok"}`.

### Schema

`test_schema.py`

- `GET /api/schema/` and `GET /api/schema/swagger-ui/` return 200 with no token.
- The schema paths cover every route in `api.md`, matched as Decisions describes.
- Application writes expose `company_name`. Application reads expose `company`.

## Definition of done

Phase 3 is finished only when every item below is true. Phase 4 does not start before that.

- `backend/requirements.txt` pins `pytest` and `pytest-django`. `backend/pytest.ini` sets `DJANGO_SETTINGS_MODULE = config.settings`. No other test dependency is added.
- `pytest` from `backend/`, against the running Postgres.app server, passes. The run uses `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, and `POSTGRES_PORT`. pytest-django creates the test database and drops it when the run finishes.
- The modules in Layout exist and cover every case in Required cases.
- The suite has no SQLite settings module and no `--reuse-db` in the recorded command.
- `backend/README.md` tells a reader to confirm Postgres.app with `pg_isready -h localhost`, to run `pytest` from `backend/` after loading `.env`, and where this manual is. It no longer says the project has no tests.
- The Phase 3 change has no Docker Compose, gunicorn, lint setup, GitHub Actions, AWS, or frontend API client. Those belong to later phases.
