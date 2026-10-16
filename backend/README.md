# Backend

Django and Django REST Framework API for the applications tracker. The API contract is in `../docs/api.md`, the schema in `../docs/database.md`, and the Phase 2 decisions in `../docs/Phase2-Docs/P2IMPLEMENTATIONMANUAL.md`. The test suite is described in `../docs/Phase3-Docs/P3IMPLEMENTATIONMANUAL.md`.

These steps run the API directly on macOS with a local PostgreSQL. To run the frontend, the API, and PostgreSQL in containers instead, run `docker compose up` from the repository root (see `../README.md`). The tests still run on the host with these steps.

## Requirements

- Python 3.12
- PostgreSQL (these steps use Postgres.app)

## 1. Install Python 3.12 with uv

uv installs Python and creates virtualenvs without Homebrew or sudo.

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh   # installs to ~/.local/bin
uv python install 3.12
```

If `uv` is not found, open a new terminal or add `~/.local/bin` to your `PATH`.

## 2. Create the virtualenv and install dependencies

From `backend/`:

```sh
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

`requirements.txt` pins exact versions. `.venv/` is ignored by Git.

To add a dependency, install it, then pin its exact version in `requirements.txt`.

## 3. Start PostgreSQL

1. Download Postgres.app from [https://postgresapp.com](https://postgresapp.com) and move it to `/Applications`.
2. Open it and click **Initialize**. The server listens on `localhost:5432`.
3. Optional: put its command-line tools on your `PATH`:
  ```sh
   sudo mkdir -p /etc/paths.d
   echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp
  ```
   Open a new terminal afterwards.
4. Check that it is running, then create the database:
  ```sh
   pg_isready -h localhost
   createdb -h localhost applications_tracker
  ```

Postgres.app creates a superuser with your macOS username and no password. Use that as `POSTGRES_USER` and leave `POSTGRES_PASSWORD` empty.

Postgres.app must be running whenever you run the API or any `manage.py` command that touches the database.

## 4. Configure the environment

Settings read every value from environment variables (`config/settings.py`). Nothing secret is committed.

```sh
cp .env.example .env
```

Edit `.env`:


| Variable            | Local value            | Notes                                                                                                                 |
| ------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `SECRET_KEY`        | a random string        | Required. Startup fails without it. Signs JWTs. Use at least 32 characters, or PyJWT warns about key length.          |
| `DEBUG`             | `true`                 | Defaults to `false`.                                                                                                  |
| `ALLOWED_HOSTS`     | `localhost,127.0.0.1`  | Comma-separated.                                                                                                      |
| `POSTGRES_DB`       | `applications_tracker` |                                                                                                                       |
| `POSTGRES_USER`     | your macOS username    | Postgres.app default.                                                                                                 |
| `POSTGRES_PASSWORD` | empty                  | Postgres.app default.                                                                                                 |
| `POSTGRES_HOST`     | `localhost`            |                                                                                                                       |
| `POSTGRES_PORT`     | `5432`                 | Defaults to 5432.                                                                                                     |
| `NUM_PROXIES`       | `0`                    | Proxies in front of Django. Production sets 2 (CloudFront and the load balancer) so the throttle reads the client IP. |


Generate a secret key:

```sh
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

Django does not read `.env` itself. Export it into your shell before you run `manage.py`:

```sh
set -a; source .env; set +a
```

Do this in every new terminal.

## 5. Migrate and run

```sh
python manage.py migrate
python manage.py runserver
```

The API is at `http://localhost:8000/api/`.

- Swagger UI: [http://localhost:8000/api/schema/swagger-ui/](http://localhost:8000/api/schema/swagger-ui/)
- OpenAPI schema: [http://localhost:8000/api/schema/](http://localhost:8000/api/schema/)
- Health checks: `/api/health/live/` (no database) and `/api/health/` (queries the database)

To try it out, register, then use the token:

```sh
curl -s -X POST localhost:8000/api/auth/register/ \
  -H 'Content-Type: application/json' \
  -d '{"email": "me@example.com", "password": "a-long-passphrase"}'

curl -s localhost:8000/api/dashboard/ -H "Authorization: Bearer <access>"
```

In Swagger UI, click **Authorize** and paste the access token.

## 6. Run the tests

The suite uses pytest and pytest-django against the same Postgres.app server. `../docs/Phase3-Docs/P3IMPLEMENTATIONMANUAL.md` lists what it covers and why.

From `backend/`, confirm the server is up, load the environment, and run pytest:

```sh
pg_isready -h localhost
set -a; source .env; set +a
pytest
```

pytest-django creates `test_<POSTGRES_DB>` on the server and drops it when the run finishes. The Postgres.app role is a superuser, so it can create that database. Tests live in `tracker/tests/`, one module per area, with shared fixtures in `conftest.py`.

If `pg_isready` is not found, the Postgres.app tools are not on your `PATH` (step 3). Run `/Applications/Postgres.app/Contents/Versions/latest/bin/pg_isready -h localhost` instead.

## Useful commands


| Command                                                                                  | What it does                                                               |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pytest`                                                                                 | Runs the test suite against Postgres.app. Load `.env` first.               |
| `python manage.py makemigrations`                                                        | Creates a migration after a model change. Commit it with the model change. |
| `python manage.py makemigrations --check --dry-run`                                      | Fails if a model change has no migration.                                  |
| `python manage.py migrate`                                                               | Applies migrations.                                                        |
| `python manage.py spectacular --validate --fail-on-warn --file schema.yaml`              | Generates the OpenAPI schema and fails on any warning.                     |
| `python manage.py check`                                                                 | Django system checks.                                                      |
| `python manage.py flush`                                                                 | Deletes all rows and keeps the tables.                                     |
| `dropdb -h localhost applications_tracker && createdb -h localhost applications_tracker` | Starts the database over. Run `migrate` afterwards.                        |


Migrations run before new code during deploys (`../docs/architecture.md`). Each migration must work with the code that is still running: add a column before code uses it, and remove it only after code stops using it.

## Layout

```text
Dockerfile         API image: gunicorn with one worker, no migrate on start
config/            Django project: settings, root URLconf, WSGI/ASGI
tracker/
  models.py        User, Company, Application, Interview, Note; constraints and indexes
  serializers.py   Auth, read and write serializers, company find-or-create
  views.py         Endpoints, the shared 404 handler
  permissions.py   Scopes every queryset to the signed-in user
  filters.py       Application list query parameters and pagination
  urls.py          Routes, included at /api/
  migrations/
  tests/           pytest suite: conftest.py fixtures and one module per area
pytest.ini         Points pytest-django at config.settings
```



## How it behaves

These are the behaviors that are easy to miss. `api.md` and the manual have the details.

- **Auth.** The API uses JWT only, with no sessions and no CSRF. Register and login return just `{"access": ...}`, which is valid for 24 hours. There is no refresh token. Emails are lowercased, so `Chris@x.com` and `chris@x.com` are one account.
- **Throttling.** Register and login each allow 10 requests per minute per client IP, in separate scopes. The counts live in process memory, so the image runs gunicorn with one worker.
- **Ownership.** Every queryset is filtered to the signed-in user. Another user's record and a missing record return the same 404, `{"detail": "Not found."}`. Every 404 uses that body, including a page past the end and an unknown route. With `DEBUG=true`, an unknown route shows Django's HTML debug page instead.
- **Companies.** Application writes send `company_name`. The server trims it, matches it against the user's companies ignoring case, and creates the company only if there is no match. That happens in the same transaction as the application save.
- **Deletes.** Django's ORM handles cascade and protect. The foreign keys in PostgreSQL have no `ON DELETE` action, so a raw SQL delete of a referenced row fails instead of cascading.
- **Interviews.** PATCH changes `outcome` only. Any other key is a 400 on that key.
- **Notes.** `updated_at` moves only when `text` changes.



## Troubleshooting

- `KeyError: 'SECRET_KEY'`: the environment is not loaded. Run `set -a; source .env; set +a`.
- `connection refused` **on port 5432**: Postgres.app is not running. Open it and start the server.
- `runserver` **exits with an** `OperationalError`: runserver checks migrations against the database at startup, so it cannot start while PostgreSQL is down. The API itself still answers `/api/health/live/` with 200 and `/api/health/` with 503 during an outage.
- `InsecureKeyLengthWarning`: `SECRET_KEY` is shorter than 32 characters.
- `check --deploy` **warnings**: CSRF is off on purpose (JWT only). HSTS and SSL redirect are set up with TLS in Phase 7.



## Not in this phase

There is no lint or CI (Phase 6), and no AWS (Phase 7).