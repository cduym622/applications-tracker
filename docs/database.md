# Database

PostgreSQL stores every record. Django models in `backend` match this schema, and migrations create it.

`User` is a custom user model with email as the login. That matches the spec's account, which is email and password only.

Every column with a fixed set of values has a `CheckConstraint` that lists those values. Django's `choices` only validate in Python, so without the constraint, a bulk update, a raw query, or a bug that skips the serializer could store any string.

## User

| Column | Type | Rules |
| --- | --- | --- |
| id | bigint | Primary key |
| email | varchar | Required, unique |
| password | varchar | Required, stored hashed |

The API rejects a password shorter than 8 characters or a common password. The database stores the hash. The API enforces both rules.

Deleting a user deletes that user's companies, applications, interviews, and notes.

## Company

| Column | Type | Rules |
| --- | --- | --- |
| id | bigint | Primary key |
| user_id | bigint | Required, foreign key to User, delete cascades |
| name | varchar | Required, stored trimmed |
| created_at | timestamptz | Set on insert, never changed |

A unique constraint on `user_id` and `lower(name)` stops two companies for one user from sharing a name, even when only the case differs, such as Stripe and stripe. Two users may each have a company with the same name. In Django this is `UniqueConstraint(Lower('name'), 'user', name='unique_company_name_per_user')`.

The API has no company delete endpoint. Deleting an application leaves its company in place.

There is no endpoint that creates a company on its own. The API creates a company only in the same transaction as the application that uses it, so a failed save leaves no unused company. A company can still become unused when its last application is deleted or moved to another company.

## Job application

| Column | Type | Rules |
| --- | --- | --- |
| id | bigint | Primary key |
| user_id | bigint | Required, foreign key to User, delete cascades |
| company_id | bigint | Required, foreign key to Company, delete is protected |
| job_title | varchar | Required |
| location | varchar | Required. A city, Remote, or Hybrid, stored as text |
| status | varchar | Required. One of the values below |
| salary | varchar | Optional |
| job_posting_url | varchar(2000) | Optional. When present, a valid URL |
| date_applied | date | Optional |
| description | text | Optional |
| created_at | timestamptz | Set on insert, never changed |
| updated_at | timestamptz | Set on insert and on every change |

`job_posting_url` allows 2000 characters. Django's `URLField` defaults to 200, and job board links with tracking parameters often run longer.

`company_id` uses `PROTECT`. The database refuses to delete a company that still has applications.

`user_id` is stored on the application so the status index can filter by user without joining through company. The API sets it from the signed-in user, and it only ever finds or creates companies for that same user.

The database does not check that `application.user_id` equals the company's `user_id`. A composite foreign key on `(company_id, user_id)` would check it, but Django does not support composite foreign keys. The API enforces it, and a test with two users covers it.

Status values:

```text
SAVED
APPLIED
SCREENING
INTERVIEW
OFFER
REJECTED
WITHDRAWN
```

`status` has a check constraint on the values above.

Index: `user_id, status`. The dashboard counts and the status filter use it.

Index: `user_id, date_applied DESC NULLS LAST, id DESC`. The default list order and the applied-date filter use it.

## Interview

| Column | Type | Rules |
| --- | --- | --- |
| id | bigint | Primary key |
| application_id | bigint | Required, foreign key to Job application, delete cascades |
| scheduled_at | timestamptz | Required |
| type | varchar | Required. One of the values below |
| outcome | varchar | Required. One of the values below |
| round_name | varchar | Optional |
| interviewer_name | varchar | Optional |

Only `outcome` can be updated. To change any other field, the user deletes the interview and adds another. Interviews have no updated-at column.

`type` and `outcome` each have a check constraint on the values below.

Types:

```text
PHONE
VIDEO
ONSITE
```

Outcomes:

```text
SCHEDULED
COMPLETED
PASSED
FAILED
CANCELLED
```

Index: `application_id, scheduled_at`. The next-interview column and the upcoming list use it.

An interview is upcoming when `scheduled_at` is in the future and `outcome` is `SCHEDULED`.

Deleting an application deletes its interviews.

## Note

| Column | Type | Rules |
| --- | --- | --- |
| id | bigint | Primary key |
| application_id | bigint | Required, foreign key to Job application, delete cascades |
| text | text | Required |
| created_at | timestamptz | Set on insert, never changed |
| updated_at | timestamptz | Set on insert, and again when `text` changes |

Deleting an application deletes its notes.

## Relationships

- A user has many companies.
- A user has many job applications.
- A company has many job applications.
- A job application has many interviews.
- A job application has many notes.

Foreign keys get PostgreSQL's usual indexes.
