# API

Base path `/api/`. JSON field names are snake_case. The React types in `frontend/src/types.ts` are camelCase. The frontend maps them when it calls this API.

Every endpoint except register, login, and the two health checks requires `Authorization: Bearer <access>`. A missing or expired token returns 401.

A missing record and another user's record both return 404 with the same body.

Deletes return 204 and an empty body.

OpenAPI JSON is at `/api/schema/`. Swagger UI is at `/api/schema/swagger-ui/`.

## Errors

Validation failures return 400 and an object of field names to lists of messages.

```json
{"email": ["A user with this email already exists."]}
```

A login that does not match an account returns 401 and one message, whether or not the email exists.

```json
{"detail": "Email or password is incorrect."}
```

A missing token returns 401.

```json
{"detail": "Authentication credentials were not provided."}
```

An expired or invalid token returns 401 with simplejwt's body. The client treats any 401 the same way: it clears the token and opens login.

```json
{
  "detail": "Given token not valid for any token type",
  "code": "token_not_valid",
  "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "Token is invalid or expired"}]
}
```

A missing route, a missing record, or another user's record returns 404.

```json
{"detail": "Not found."}
```

A `PUT` on an interview returns 405. Only `outcome` can change, through `PATCH`.

Too many login or register requests from one client IP returns 429.

```json
{"detail": "Request was throttled. Expected available in 42 seconds."}
```

## Authentication

### POST /api/auth/register/

Body:

| Field | Rules |
| --- | --- |
| email | Required, unique |
| password | Required, at least 8 characters, not a common password |

Success is 201.

```json
{"access": "<jwt>"}
```

A duplicate email, a short password, or a common password is a 400 field error. Register allows 10 requests per minute per client IP.

### POST /api/auth/login/

Body: `email`, `password`.

Success is 200 and the same `access` object as register. A mismatch is the 401 message above. Login allows 10 requests per minute per client IP.

## Dashboard

### GET /api/dashboard/

Returns the signed-in user's count for each status, including zero, and that user's upcoming interviews. An interview is upcoming when `scheduled_at` is in the future and `outcome` is `SCHEDULED`. Items are ordered by `scheduled_at` ascending. The list holds at most 10 interviews, the soonest ones.

```json
{
  "counts": {
    "SAVED": 1,
    "APPLIED": 0,
    "SCREENING": 0,
    "INTERVIEW": 2,
    "OFFER": 0,
    "REJECTED": 0,
    "WITHDRAWN": 0
  },
  "upcoming_interviews": [
    {
      "id": 4,
      "job_title": "Backend engineer",
      "company_name": "Northwind",
      "scheduled_at": "2026-10-12T15:00:00Z",
      "type": "VIDEO",
      "application_id": 9
    }
  ]
}
```

## Applications

Application JSON on read:

| Field | Rules |
| --- | --- |
| id | Integer |
| job_title | String |
| company | Object with `id` and `name` |
| location | String |
| status | One of the seven statuses |
| salary | String or null |
| job_posting_url | String or null |
| date_applied | `YYYY-MM-DD` or null |
| description | String or null |
| next_interview | Object or null. The soonest upcoming interview for this application: `id`, `scheduled_at`, `type` |
| created_at | ISO 8601. Read-only, set on insert |
| updated_at | ISO 8601. Read-only, set on every change |

Write bodies send `company_name`. Read bodies return `company` as an object with `id` and `name`.

The server trims `company_name` and looks for one of the user's companies with that name, ignoring case. If one exists, the application uses it. If none exists, the server creates it. Finding or creating the company and saving the application happen in one database transaction, so a failed save never leaves a new company behind.

### GET /api/applications/

Returns one page of the signed-in user's applications. Page size is 10. The response is page-number pagination.

```json
{
  "count": 24,
  "next": "http://example.com/api/applications/?page=2",
  "previous": null,
  "results": []
}
```

Query parameters:

| Param | Rules |
| --- | --- |
| q | Optional. Case-insensitive match on job title or company name |
| from | Optional `YYYY-MM-DD`. Keeps applications whose `date_applied` is on or after this day |
| to | Optional `YYYY-MM-DD`. Keeps applications whose `date_applied` is on or before this day |
| status | Optional. One status value |
| page | Optional, 1-based. Defaults to 1 |

Results are ordered by `date_applied` descending, with no `date_applied` last, then by `id` descending. The order is fixed, so pages do not shift between requests.

When `from` or `to` is set, applications with no `date_applied` are left out. When both are empty, those applications stay in the list. An invalid `status` or date is 400. A `from` later than `to` is 400 on `from`. A `page` past the last page is 404.

The list can get shorter while a user is on it, for example when a status change removes the only row on the last page. When the client gets a 404 for a page above 1, it requests the page before it.

### POST /api/applications/

Required: `job_title`, `company_name`, `location`. Optional: `status`, `salary`, `job_posting_url`, `date_applied`, `description`.

`status` defaults to `SAVED` when omitted. `company_name` must not be blank after trimming. `job_posting_url`, when present, must be a valid URL of at most 2000 characters.

Success is 201 and the application object.

### GET /api/applications/{id}/

Success is 200 and one application object.

### PATCH /api/applications/{id}/

Partial update. Same field rules as create. Sending `company_name` finds or creates the company the same way. Success is 200 and the application object.

### DELETE /api/applications/{id}/

Deletes the application, its interviews, and its notes. The company remains. Success is 204.

## Companies

### GET /api/companies/

Returns every company for the signed-in user, as one JSON list ordered by name. The form needs the full list for its suggestions.

There is no endpoint that creates a company on its own. Application writes create companies through `company_name`.

```json
[{"id": 1, "name": "Northwind"}]
```

## Interviews

Interview JSON:

| Field | Rules |
| --- | --- |
| id | Integer |
| scheduled_at | ISO 8601 date and time |
| type | `PHONE`, `VIDEO`, or `ONSITE` |
| outcome | `SCHEDULED`, `COMPLETED`, `PASSED`, `FAILED`, or `CANCELLED` |
| round_name | String or null |
| interviewer_name | String or null |

### GET /api/applications/{id}/interviews/

Returns that application's interviews as a JSON list, ordered by `scheduled_at` ascending. The application must belong to the signed-in user.

### POST /api/applications/{id}/interviews/

Required: `scheduled_at`, `type`. Optional: `outcome`, `round_name`, `interviewer_name`.

`outcome` defaults to `SCHEDULED` when omitted. Success is 201 and the interview object.

### PATCH /api/applications/{id}/interviews/{interview_id}/

Body: `outcome`, required. Success is 200 and the interview object.

Only `outcome` can change. A body with any other field is 400 on that field. To change the date, type, round, or interviewer, the user deletes the interview and adds another. `PUT` on this path returns 405.

### DELETE /api/applications/{id}/interviews/{interview_id}/

Success is 204.

## Notes

Note JSON:

| Field | Rules |
| --- | --- |
| id | Integer |
| text | String |
| created_at | ISO 8601, set on insert, never changed |
| updated_at | ISO 8601, set on insert and when `text` changes |

### GET /api/applications/{id}/notes/

Returns that application's notes as a JSON list, newest `created_at` first.

### POST /api/applications/{id}/notes/

Body: `text`, required. Success is 201 and the note object.

### PATCH /api/applications/{id}/notes/{note_id}/

Body: `text`. Success is 200 and the note object. `created_at` stays the same. `updated_at` changes.

### DELETE /api/applications/{id}/notes/{note_id}/

Success is 204.

## Health

### GET /api/health/live/

Public. No token. The load balancer's target health check calls it.

Returns 200 and `{"status": "ok"}` while the process can serve HTTP. It does not query the database. `architecture.md` explains why.

### GET /api/health/

Public. No token. CloudWatch monitoring calls it.

200 when a database query succeeds:

```json
{"status": "ok"}
```

503 when the database cannot be reached:

```json
{"status": "error"}
```
