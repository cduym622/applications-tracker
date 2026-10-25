# Changes

This file records what each phase changed and why. It keeps the decisions and their reasons. `architecture.md`, `database.md`, and `api.md` are the contracts, and they win when this file disagrees with them. `README.md`, `backend/README.md`, and `frontend/README.md` describe how to run the project.

## Phase 1. Planning, 2026-10-09

The design review wrote `architecture.md`, `database.md`, and `api.md`, and reversed two choices in `PROJECTSPEC.md`.

### Interview outcome can be updated

`PATCH /api/applications/{id}/interviews/{interview_id}/` changes `outcome` and nothing else. Any other field in the body is a 400, and `PUT` is a 405. Changing the date, type, round, or interviewer still means deleting the interview and adding another.

The spec first allowed no interview update at all. Recording how an interview went is the most common edit, and under that rule it meant delete and re-add. Interviews that were never re-added stayed `SCHEDULED` after their date passed.

### The server finds or creates the company

Application writes send `company_name`. The server trims it, matches it against the user's companies ignoring case, and creates the company when nothing matches. That happens in one `transaction.atomic()` with the application save. `POST /api/companies/` was removed, and `GET` stays.

The first design had the client create the company and then send `company_id`, in two requests with no transaction. When the second request failed, the new company stayed. The API has no company delete, so a typo stayed in the user's list for good.

### Other review decisions

`architecture.md` records the reason for each of these.

- **Routing.** The Vite dev server proxies `/api`, so the browser sees one origin and the API needs no CORS. On CloudFront, a CloudFront Function on the S3 behavior serves `index.html` for frontend routes. Custom error responses would apply to every behavior and turn an API 404 into HTML with status 200.
- **CloudFront and the API.** The `/api/*` behavior uses `CachingDisabled` and `AllViewerExceptHostHeader`. Django sends no `Cache-Control`, so CloudFront could otherwise cache API responses, including a health check that reports success while the database is down. With that policy Django sees the load balancer's DNS name as `Host`, so `ALLOWED_HOSTS` holds that name.
- **Networking.** RDS and ECS run in private subnets. The load balancer accepts traffic only from the CloudFront managed prefix list. One NAT gateway gives the tasks a route to ECR, SSM, and CloudWatch Logs, and costs less than VPC endpoints for one small service.
- **Auth.** `CommonPasswordValidator` and a `ScopedRateThrottle` on login and register slow password guessing and email probing. `NUM_PROXIES` is 2 in production so the throttle reads the client IP from `X-Forwarded-For`. The known tradeoffs are a 24-hour token in `localStorage`, no revocation on logout, and register revealing which emails have accounts.
- **Configuration.** Secrets come from SSM Parameter Store through the task definition's `secrets` field. The task IP joins `ALLOWED_HOSTS` from the ECS metadata endpoint, because load balancer health checks send it as `Host`.
- **Deploy order.** A one-off ECS task runs migrations before the service updates, and a failed migration stops the deploy while the old version keeps serving. Hashed assets get long cache headers, `index.html` gets `no-cache`, and the deploy invalidates `/index.html`.
- **Health checks.** `/api/health/live/` skips the database and is what the load balancer calls. `/api/health/` queries PostgreSQL for monitoring. If the load balancer used the database check, a short RDS outage would restart every task at once.
- **Monitoring.** A Route 53 health check calls `/api/health/`, and alarms on target 5xx and health status send email through SNS.
- **API contract.** The default list order is `date_applied` descending with nulls last, then `id` descending, so pages stay stable. `status` and `outcome` are optional on create, with defaults `SAVED` and `SCHEDULED`. `from` later than `to` is a 400 on `from`. A 404 on a page above 1 tells the client to request the page before it. The dashboard caps upcoming interviews at 10. A missing token and an expired token return different 401 bodies, because simplejwt and DRF word them differently.
- **Schema.** Check constraints guard `status`, interview `type`, and `outcome`, because Django `choices` validate only in Python. Company names are unique per user on `lower(name)`. `job_posting_url` is `varchar(2000)`, since real job links run past `URLField`'s default of 200. An index on `user_id, date_applied DESC NULLS LAST, id DESC` serves the default order. The database does not check that an application's owner matches its company's owner. Django has no composite foreign key, so the API and a two-user test cover that rule.

## Phase 2. Backend, 2026-10-10

Phase 2 built the Django REST API and the schema. These choices fill gaps that `api.md` and `database.md` leave open.

### Contract clarifications

- A note PATCH requires `text`, and `updated_at` moves only when `text` differs from the stored text. A PATCH that sends the same text should not look like an edit.
- A login body with a missing field or a malformed email is a 400 field error. The 401 is only for a mismatch.
- Interview and note detail paths have no `GET`, and note detail has no `PUT`. Each returns 405. The list endpoints already return every row.
- Django enforces `CASCADE` and `PROTECT` in the ORM. The PostgreSQL foreign keys have no `ON DELETE` action, so a raw SQL delete of a referenced row fails.

### Implementation decisions

- **Versions.** Python 3.12 and Django 5.2 LTS. Django 5.2 supports the nulls-last expression index the list order needs. List filtering is hand-written query-parameter code in `filters.py`, so `django-filter` is not a dependency.
- **User model.** `AbstractBaseUser` with `email` as `USERNAME_FIELD` and no username. The model has no `PermissionsMixin` or `is_staff`, because the API has no admin and no group permissions. The API lowercases email before the unique check, so `Chris@x.com` and `chris@x.com` are one account.
- **Passwords.** `MinimumLengthValidator` with length 8 and `CommonPasswordValidator`, the two rules in the spec.
- **Tokens.** Register and login each return only `{"access": ...}`, valid for 24 hours, with no refresh token and no blacklist. The login view is custom, because simplejwt's pair view returns a refresh token and different failure text. An unknown email and a wrong password return the same 401.
- **Throttles.** Register and login have separate scopes of 10 requests per minute per client IP. A client who used up one limit can still use the other endpoint.
- **Ownership.** Querysets are filtered to `request.user`, so another user's record and a missing record are the same 404. A permission check that loaded the row first could return 403 and reveal that the row exists. Nested views load the parent application through the same filter.
- **Company race.** Two requests that create the same new name at once can hit the unique constraint. The serializer catches the `IntegrityError`, loads the winning row, and saves the application with it.
- **Strings.** Required strings are trimmed, and an empty result is a 400. Optional strings that are blank after trim are stored as null. Email is 254 characters, the other short text fields are 255, and description and note text are `TextField`.
- **Lists.** Page size is fixed at 10 with no `page_size` parameter. A page past the end returns the same `{"detail": "Not found."}` body as a missing record. Company, interview, and note lists are not paginated, because the form needs every company and the detail screen needs every interview and note.
- **Reads.** The list and detail load the company and the soonest upcoming interview in bulk, so a page does not run one query per row. An interview is upcoming when it is in the future and `SCHEDULED`, and ties on time go to the lower `id`.
- **Dashboard.** One aggregate query counts statuses, and the view fills missing statuses with 0, since `api.md` requires a count for each.
- **Schema.** Separate read and write serializers keep `company` on reads and `company_name` on writes, in the API and in the OpenAPI schema.

The throttle counts live in Django's default cache, which is per process. Phase 5 resolved this.

## Phase 3. Testing, 2026-10-11

Phase 3 added the pytest suite in `backend/tracker/tests/`, one module per area.

- **PostgreSQL only.** The suite runs on the PostgreSQL engine in `config/settings.py`, with no SQLite settings module. The nulls-last list order and case-insensitive company names depend on PostgreSQL.
- **Two libraries.** `pytest` and `pytest-django` are the only additions. Coverage tools, factory libraries, and clock libraries stayed out. Times come from `timezone.now()` plus or minus a `timedelta`.
- **No `--reuse-db`.** pytest-django creates `test_<POSTGRES_DB>` and drops it after the run, so no test database stays behind.
- **Users without the API.** Only the auth tests call register and login, because the 10-per-minute throttle would return 429 to a suite that logs in for every test. Other tests create users with `create_user` and build a token with `AccessToken.for_user`. Auth tests clear the cache before counting requests.
- **Rollback proof.** A test patches `Application.save` to raise `DatabaseError` during a create with a new company name, and checks that the company row is gone.
- **Health failure.** A test patches `tracker.views.connection.cursor` to raise `django.db.Error`. `/api/health/` returns 503 and `/api/health/live/` still returns 200, while PostgreSQL stays up for the rest of the suite.
- **Expired tokens.** A test builds a token whose expiry is already past, so the suite does not wait 24 hours.
- **OpenAPI.** A test reads `GET /api/schema/` and checks that every route in `api.md` is present and that application writes expose `company_name` and reads expose `company`.
- **Constraints the API cannot reach.** Serializers reject bad values before the database sees them, and the API has no company delete. ORM tests check that the database itself rejects a bad status, type, or outcome, a second company name that differs only by case, and a delete of a company that still has an application.

`api.md` changed once. The expired-token example now reads `Token is expired`, and a malformed or badly signed token reads `Token is invalid`. The pinned simplejwt 5.5.1 uses those strings, and the old example came from an older release.

## Phase 4. Frontend, 2026-10-12

Phase 4 connected the React screens to the API. `frontend/src/mockData.ts` and `frontend/RECAP.md` were deleted. No npm package and no backend change were added.

### Client rules

- **One origin.** Every call uses the relative path `/api`. Vite proxies it with `changeOrigin: true`, so Django sees a host already in `ALLOWED_HOSTS`. There is no CORS library and no `VITE_` variable for the API host.
- **One API module.** `src/api.ts` holds every call and is the only module that reads or writes snake_case keys. It maps each type by hand, since a recursive key converter is easy to get wrong on `company_name` versus `company`.
- **Session.** The token lives in `localStorage` under `access`. On startup, `auth.tsx` decodes the payload with `atob` and counts the visitor as signed in only while `exp` is in the future. It does not check the signature or call the API. An authenticated 401 removes the token and opens `/login`. Login and register keep their 401 on the form.
- **Errors.** A 400 with field names shows the first message under each field. A `detail` string, `non_field_errors`, and a 429 go in the `.alert` element. A thrown `fetch` shows `The request failed.` A write disables its button until it finishes.
- **Stale responses.** Each load effect sets a flag on cleanup and skips `setState` afterwards, so an older search response cannot overwrite a newer one. React strict mode runs each effect twice in development.
- **Paging.** The list sends `q`, `from`, `to`, `status`, and `page` only when they are set, and the server does all filtering. The client reads `next` and `previous` only to see whether another page exists, because Django builds them on the proxy's host. A 404 above page 1 steps back one page at a time until it finds rows. After a status change the list refetches, so a row that no longer matches the filter disappears.
- **Writes.** Blank optional fields go out as `null`, because an empty string is not a valid URL. `datetime-local` values go out through `toISOString()`, so interview times are UTC. Edit sends every field as a `PATCH`.

### Known limits

- The list's status menu cannot be disabled during its save, because `StatusMenu.tsx` has no disabled prop. A second click sends a second request.
- The frontend has no test runner. The spec stops frontend work once the screens call the API.

## Phase 5. Docker, 2026-10-15

Phase 5 added `compose.yaml`, `.env.example`, and a Dockerfile and `.dockerignore` for each app. `docker compose up` starts PostgreSQL, then the API once the database is healthy, then the frontend once the API is healthy.

- **gunicorn.** The API image runs gunicorn, a production WSGI server, so the image Compose runs is the one ECS will run.
- **One gunicorn worker.** DRF keeps throttle counts in process memory, so 4 workers would allow about 40 login attempts a minute. One worker keeps the limit at 10 per container. A shared cache such as Redis would fix this for any number of processes, and the spec excludes Redis unless a requirement needs it. Each ECS task in production still keeps its own count, as `architecture.md` records.
- **Migrations.** The image's default command is gunicorn alone, because production migrates in a one-off ECS task that must succeed first. `compose.yaml` runs `migrate` before gunicorn locally. Migrations are idempotent, so that is harmless.
- **No published database port.** Only the API needs PostgreSQL, and leaving 5432 free keeps Postgres.app working for `pytest` on the host.
- **Proxy target.** Inside the frontend container, `127.0.0.1` is that container. `vite.config.ts` reads `API_PROXY_TARGET` with `loadEnv`, Compose sets it to `http://backend:8000`, and the default stays `http://127.0.0.1:8000` for host runs. `loadEnv` avoids adding `@types/node`.
- **Configuration.** Each secret in `compose.yaml` has a development-only fallback, so the stack starts with no setup. A root `.env` overrides them. `backend/.env` is a separate file for host runs against Postgres.app, and Compose does not read it. PostgreSQL reads its user and password only when it creates its volume, so changing them takes `docker compose down -v`.
- **Non-root containers.** The API runs as `app` and the frontend as Node's `node` user. The frontend installs its packages as `node`, because Vite writes a cache into `node_modules/.vite` at startup.
- **`node_modules` volume.** An anonymous volume at `/app/node_modules` keeps the image's Linux packages visible under the bind mount. The host's copy holds macOS builds of esbuild and rollup. Compose reuses that volume, so a `package.json` change needs `--renew-anon-volumes`.
- **File watching.** `CHOKIDAR_USEPOLLING=true` makes Vite poll, because bind mounts on macOS do not always raise file events in the container.
- **Secrets.** Neither Dockerfile sets a secret, and both `.dockerignore` files exclude `.env`. Secrets reach containers only as runtime environment variables.
- **Build caching.** Each Dockerfile installs dependencies before copying source, and BuildKit cache mounts keep pip and npm downloads out of the image.

Known limits: the API does not reload on code changes, so a backend edit needs `docker compose up --build`. Base images use version tags, so a rebuild can pick up a newer patch release. The tests still run on the host.

## Phase 6. CI, 2026-10-16

Phase 6 added `.github/workflows/ci.yml`, Ruff for Python, and ESLint and Prettier for the frontend.

- **Three jobs.** The spec's steps need three different machines, one for Python and PostgreSQL, one for Node, and one for Docker. The jobs run in parallel, so a run takes as long as the slowest job, and one failure does not hide another.
- **Triggers.** The workflow runs on every pull request and every push to `main`. A new push to a pull request cancels its older run. Runs on `main` are never cancelled, so a later deploy job cannot be stopped halfway.
- **Least privilege.** `permissions: contents: read` is all the workflow token gets.
- **PostgreSQL 17.** A service container runs `postgres:17`, the version Compose runs. Its health check holds the job until `pg_isready` passes.
- **Migrate before pytest.** pytest-django builds its own test database, but `migrate --noinput` against an empty database checks the same path the first production deploy takes.
- **CI values in the file.** `SECRET_KEY` and the database password are plain text in `ci.yml`. They protect a throwaway database on the runner, and GitHub does not pass repository secrets to pull requests from forks. The real values stay in SSM Parameter Store.
- **Ruff.** One pinned tool lints and formats. Lines go up to 120 characters, since 93 existing lines were over the default 88. The rules are `E4`, `E7`, `E9`, and `F`, written out so a Ruff upgrade cannot add rules. That leaves out `RUF012`, which flags Django `Meta.fields` and DRF `permission_classes` as mutable class attributes. `migrations/` is excluded. Ruff lives in `requirements-dev.txt`, so the API image does not carry it.
- **ESLint and Prettier.** ESLint catches what `tsc` does not, including the rules of hooks. Type-aware rules are off, since they would run the compiler a second time. Prettier matches the Phase 4 style with single quotes, no semicolons, and 120-character lines. `eslint-config-prettier` turns off ESLint's formatting rules. `--max-warnings 0` fails the job on warnings, because ESLint exits 0 on them by default. ESLint 10 needs Node 20.19 or later.
- **One lint exception.** The list effect in `ApplicationList.tsx` depends on `[key, reload]`. `key` is the whole query string. Listing the separate values would change nothing, and listing `update` would refetch on every render, so that line disables `exhaustive-deps` with the reason in a comment.
- **Node 22.** CI uses the same major version as `frontend/Dockerfile`.
- **API image only.** CI builds `backend/Dockerfile` with no push. Production serves the frontend's `npm run build` output from S3 and never runs the frontend image, so CI builds those files instead.
- **Pins and caching.** Ruff has an exact pin, and `npm ci` installs the lockfile, so a tool release cannot fail a pull request that changed nothing. The setup actions cache pip and npm downloads.

### Known limits

- GitHub allows a merge with a failed check until a ruleset on `main` requires `Backend tests and lint`, `Frontend lint and build`, and `API image build`.
- `postgres:17`, `ubuntu-latest`, and the action major tags can move between runs, so a failure can appear with no code change.
- The image job has no layer cache between runs.
- CI does not check for a missing migration. `python manage.py makemigrations --check --dry-run` does that by hand.
- Every job runs on every pull request, including docs-only changes, because a required check that never runs blocks the merge.
