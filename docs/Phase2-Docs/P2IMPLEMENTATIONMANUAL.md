# Phase 2 implementation manual

This file tells an implementer how to build the Django and Django REST Framework API. `api.md` and `database.md` stay the contract. This manual points at them and only spells out what they leave open.

Phase 2 is the API: models, migrations, serializers, views, authentication, permissions, filtering, pagination, and OpenAPI documentation.

## Out of scope

This manual does not explain how to create a virtualenv, start PostgreSQL, or run the process.

pytest, lint, formatting, Docker, gunicorn, CI, and AWS are later phases. The ECS task-IP addition to `ALLOWED_HOSTS` in `architecture.md` is Phase 7.

The React app is out of scope. `frontend/src/types.ts` is stale. It uses camelCase, `companyId`, and `applicationId` on interviews. When that file and `api.md` disagree, follow `api.md`.

## Module map

`backend/` holds one Django project package, `config`, and one app, `tracker`. `config` holds settings and the root URLconf. The project package is separate from the app so settings do not live inside `tracker`.

`tracker` holds the modules `architecture.md` already names:

- `models.py` holds the five models, check constraints, and indexes.
- `serializers.py` holds auth, read, and write serializers.
- `views.py` holds the endpoints.
- `permissions.py` holds the rule that every authenticated queryset is limited to the signed-in user.
- `filters.py` holds the application list query parameters from `api.md`.
- `urls.py` holds the routes, included at `/api/`.

There is no service package. Company find-or-create stays on the application write serializer. There are no Django admin screens.

## Build order

1. Models and `AUTH_USER_MODEL`. The user model comes before the others. Django needs `AUTH_USER_MODEL` set before the first migration.
2. Serializers, including the read and write split and auth.
3. Ownership scoping, then views and routes in this order: auth, applications, list filtering and pagination, interviews, notes, companies, dashboard, health.
4. drf-spectacular, then a check that the generated schema matches `api.md`.

## Decisions

### Versions and libraries

Use Python 3.12 and Django 5.2 LTS. The application list index in `database.md` is an expression index with nulls last, and Django 5.2 supports that index. Django 5.2 is also the long-term support release.

Use the current Django REST Framework, `djangorestframework-simplejwt`, `drf-spectacular`, and `psycopg` releases that support Django 5.2. `architecture.md` already records why each one is required.

List filtering is query-parameter code in `filters.py`. `django-filter` is not a dependency. Same-origin deployment in `architecture.md` is why there is no CORS library. gunicorn waits for the container phase.

### User model

Use `AbstractBaseUser` with `email` as `USERNAME_FIELD`, and a manager that hashes the password. The spec account is email and password only, so the model has no username.

Columns beyond the `database.md` table are the password hash and `last_login`. `AbstractBaseUser` requires `last_login`. The model has no `PermissionsMixin` and no `is_staff`. Those exist for Django admin and group permissions, and this API has neither.

Keep `django.contrib.auth` and `contenttypes` installed. Leave out admin, sessions, and messages. The API uses JWT, so it has no session.

The API lowercases email before the unique check and before save. `Chris@x.com` and `chris@x.com` are one account. The column stays a plain unique `varchar`, as `database.md` specifies. Use `EmailField` so a bad address is a 400 on `email`.

### Password rules

Use `MinimumLengthValidator` with minimum length 8, and `CommonPasswordValidator`. Those are the two rules in the spec.

A duplicate email uses the message in `api.md`: `A user with this email already exists.` A short password and a common password use Django's validator messages. Both are 400 field errors on `password`.

### Tokens

Register returns 201 and login returns 200. Each body is only `{"access": "<jwt>"}`. The access token lasts 24 hours. There is no refresh token and no blacklist. `architecture.md` records that choice.

The login view is custom. simplejwt's pair view also returns a refresh token, and its failure text is different from the required message. A missing account and a wrong password both return 401 with `{"detail": "Email or password is incorrect."}`.

`DEFAULT_AUTHENTICATION_CLASSES` is JWT only. The API does not use session auth, so it does not use CSRF.

### Throttles

Register and login each have their own `ScopedRateThrottle` scope. Each scope allows 10 requests per minute per client IP. Two scopes means a client can still log in after using the register limit, and the reverse.

`NUM_PROXIES` is read from the environment and defaults to 0. `architecture.md` sets it to 2 in production so the throttle reads the client IP. This manual names that setting and does not describe deployment.

### Ownership

A missing record and another user's record are the same 404, `{"detail": "Not found."}`. Querysets are filtered to `request.user`, so the view never learns that a foreign row exists. A permission check that loads the row first would be able to return 403 and reveal that the row exists.

Nested interview and note views load the parent application through that same filter first. A child that belongs to a different application is also 404.

### Companies

Trim `company_name`. Match `lower(name)` among that user's companies. When one matches, keep the stored spelling. `Stripe` stays `Stripe` when the client sends `stripe`.

Create a company only when none matches. Finding or creating the company and saving the application happen inside one `transaction.atomic()`. A failed application save then leaves no new company.

If two requests create the same new name at once, the unique constraint can raise `IntegrityError`. Catch it, load the row that won, and save the application with that company.

The client cannot send `user` or `company` id. The API sets the application user from the signed-in user and only finds or creates companies for that user. A blank name after trim is a 400.

### Application writes

Read responses return `company` as an object with `id` and `name`, plus read-only `next_interview`, `created_at`, and `updated_at`. Write bodies take `company_name`. Separate read and write serializers keep those shapes apart, including in the OpenAPI schema.

Omitted `status` on create is `SAVED`. On PATCH, an omitted field stays as it is, and `null` clears a nullable field.

Required strings are trimmed. A required string that is empty after trim is a 400. Optional strings that are blank after trim are stored as null. `job_posting_url` allows at most 2000 characters, and when present it must be a valid URL.

### String lengths

`database.md` leaves most `varchar` lengths open. Use these:

- Email is 254 characters, the `EmailField` default.
- Company name, job title, location, salary, round name, and interviewer name are 255 characters.
- Status, interview type, and outcome are long enough for the longest allowed value, and each also has a check constraint.
- Description and note text are `TextField`.
- Password uses Django's hash field.

### Constraints and indexes

`choices` validate only in Python. `status`, interview `type`, and `outcome` each get a `CheckConstraint` listing the values in `database.md`. A bulk update or a raw query then cannot store any other string.

Company uniqueness is `UniqueConstraint` on `Lower('name')` and `user`. A plain unique pair on `user` and `name` is case-sensitive, so `Stripe` and `stripe` could both exist for one user.

The application list index is an expression index on `user_id`, `date_applied` descending with nulls last, and `id` descending. A plain index on `date_applied` does not match that order. The default list order and the applied-date filter use this index.

Company delete is `PROTECT`. The database then refuses to delete a company that still has applications. Deleting an application cascades to its interviews and notes, as `database.md` says. The API does not delete the company when an application is deleted.

### List behavior

Page size is fixed at 10. There is no `page_size` query parameter. A client cannot ask for a different page size.

Order is `date_applied` descending, nulls last, then `id` descending. The order is fixed so pages stay stable between requests.

`q` is a case-insensitive substring match on job title or company name. An empty `q` applies no search filter.

When `from` or `to` is set, applications with no `date_applied` are left out. When both are empty, those applications stay in the list. A bad `status` or date is 400. A `from` later than `to` is 400 on `from`.

A page past the end is 404 with `{"detail": "Not found."}`, the same body as a missing record. `api.md` tells the client to request the previous page when a page above 1 returns 404. Django REST Framework's default invalid-page message is different, so the page error uses this body.

Company, interview, and note lists are not paginated. The form needs every company, and an application detail screen needs every interview and note. Companies are ordered by name. Interviews are ordered by `scheduled_at` ascending. Notes are ordered by `created_at` descending.

### Related objects on reads

The application list and detail load `company` and the soonest upcoming interview in bulk. One query per row would run once for every application on the page.

The dashboard loads its ten interviews in one query.

An interview is upcoming when `scheduled_at` is in the future and `outcome` is `SCHEDULED`. Soonest means the earliest `scheduled_at`. When two interviews share that time, the lower `id` comes first, so the chosen interview does not change between requests.

### Interviews

Omitted `outcome` on create is `SCHEDULED`. PATCH accepts `outcome` only. Any other key is 400 on that key. Django REST Framework ignores unknown keys unless the serializer rejects them, so this serializer rejects them. `PUT` on this path returns 405.

Interviews have no `updated_at` and no note field. To change the date, type, round, or interviewer, the client deletes the interview and adds another.

### Notes

`created_at` is set on insert and never changes. `updated_at` changes only when `text` actually changes. `auto_now` would change `updated_at` on every save, including a PATCH that sends the same text. `database.md` says `updated_at` changes when the text changes.

Application `updated_at` does use `auto_now`. `database.md` says that column changes on every change.

### Dashboard

Counts include every status. Run one aggregate query, then fill any missing status with 0. A grouped query that omits empty statuses would drop those zeros, and `api.md` requires a count for each status.

Upcoming interviews are at most 10, soonest first. Each item has the fields in `api.md`, including `application_id`.

### Health and schema

`GET /api/health/live/` returns 200 and `{"status": "ok"}`. It does not query the database. The load balancer uses it, and a database outage must not fail this check.

`GET /api/health/` runs a database query. It returns 200 and `{"status": "ok"}` when the query succeeds. It returns 503 and `{"status": "error"}` when the query fails, including a connection error that would otherwise be 500. Both health routes are public.

`/api/schema/` and `/api/schema/swagger-ui/` are public. Write and read serializers stay separate so the schema shows `company_name` on write and `company` on read.

## Acceptance checks

These are observable API behaviors that are easy to miss. `api.md` has the full bodies. This list is not a test plan. Phase 3 writes the tests.

- Register and login return only an access token. A duplicate email, a short password, and a common password are 400 field errors. A login mismatch is the single 401 message, for an unknown email and a wrong password alike.
- A missing token, an expired token, another user's id, and a missing id behave as `api.md` states. Nested routes return 404 when the parent application is not the caller's.
- Creating an application with a new company name, and again with that name in a different case, leaves one company for that user, with the original spelling. A failed application save leaves no new company. Two users may each have a company with the same name.
- Deleting an application removes its interviews and notes and leaves the company.
- List search, date range, status, null `date_applied`, order, and page size match `api.md`. The page size cannot be changed from the query string.
- Interview PATCH can change `outcome` and rejects any other field. Note PATCH leaves `created_at` unchanged and moves `updated_at` only when the text changes.
- Dashboard counts include zeros. Upcoming interviews are the soonest ones still in the future with outcome `SCHEDULED`, capped at 10.
- The live health check does not touch the database. The other health check returns 503 when the database query fails.
- Swagger UI lists the routes in `api.md`, with `company_name` on application writes and `company` on reads.

## Definition of done

Phase 2 is finished only when every item below is true. Phase 3 does not start before that.

- `backend/` contains the `config` project and the `tracker` app. `tracker` has models, serializers, views, permissions, filters, and urls, as the module map describes. `AUTH_USER_MODEL` points at the custom user.
- Migrations create the schema in `database.md`. That includes the lowercased email unique column, the company unique constraint on `Lower('name')` and user, check constraints on status, interview type, and outcome, the application list expression index, `PROTECT` on company delete, and cascades when an application is deleted. Field lengths match this manual.
- Every route in `api.md` is implemented, including both health checks, `/api/schema/`, and Swagger UI. Status codes, bodies, defaults, pagination, filters, and errors match `api.md` and the decisions in this manual.
- Every acceptance check in the previous section holds.
- Settings read `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, and `NUM_PROXIES` from the environment. No secret is committed.
- The Phase 2 change has no pytest suite, Docker, gunicorn, lint setup, GitHub Actions, AWS, or frontend API client. Those belong to later phases.
