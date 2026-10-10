# Backend engineering portfolio project

## Objective

Build one full-stack project that covers design, implementation, tests, containers, deployment, and monitoring of a backend application.

Write this for people hiring entry-level and new-grad backend engineers. Link the repo from a resume, and be ready to walk through it in an interview.

## Project

Authenticated users track job applications, companies, interviews, notes, statuses, and important dates.

Build only the screens in the Frontend section. Use the rest of the time on the backend, tests, containers, deployment, and monitoring.

## Technology stack

- Python, Django, and Django REST Framework for the backend
- React and TypeScript for the frontend
- PostgreSQL for the database
- JWT for authentication
- pytest and pytest-django for tests
- Docker and Docker Compose for local containers
- GitHub Actions for CI and CD
- AWS for hosting
- Amazon ECR for the container registry
- ECS on Fargate to run the backend
- RDS for PostgreSQL
- Amazon S3 for the frontend build
- Amazon CloudFront as the public site
- CloudWatch for logs and metrics
- OpenAPI and Swagger UI for API documentation
- Git and GitHub for version control

Add a technology only when a requirement in this file cannot be met without it. Record the reason in `/docs` first.

## Core data model

Entities:

- User
- Company
- JobApplication
- Interview
- Note

Relationships:

- A user has many companies.
- A user has many job applications.
- A company has many job applications.
- A job application has many interviews.
- A job application has many notes.

A company name is unique for one user, ignoring case. Two users may each have a company with the same name. Deleting an application does not delete its company.

User fields:

- Email, required and unique
- Password, required, at least 8 characters, not a common password, stored hashed

Company fields:

- Name, required

Job application fields:

- Job title, required
- Company, required
- Location, required. The value is a city, Remote, or Hybrid.
- Status, required
- Salary, optional text for an amount or a range
- Job posting URL, optional. When present, it must be a valid URL.
- Date applied, optional
- Description, optional text written by the user

Application statuses:

```text
SAVED
APPLIED
SCREENING
INTERVIEW
OFFER
REJECTED
WITHDRAWN
```

Interview fields:

- Date and time, required
- Type, required
- Outcome, required
- Round name, optional
- Interviewer name, optional

Interview types:

```text
PHONE
VIDEO
ONSITE
```

Interview outcomes:

```text
SCHEDULED
COMPLETED
PASSED
FAILED
CANCELLED
```

Only an interview's outcome can be updated. To change any other field, the user deletes the interview and adds another. An interview has no note field of its own.

Note fields:

- Text, required
- Created time, set when the note is added
- Updated time, set when the note text changes

## Core API

REST endpoints:

```text
Authentication
POST   /api/auth/register/
POST   /api/auth/login/

Dashboard
GET    /api/dashboard/

Applications
GET    /api/applications/
POST   /api/applications/
GET    /api/applications/{id}/
PATCH  /api/applications/{id}/
DELETE /api/applications/{id}/

Companies
GET    /api/companies/

Interviews
GET    /api/applications/{id}/interviews/
POST   /api/applications/{id}/interviews/
PATCH  /api/applications/{id}/interviews/{interview_id}/
DELETE /api/applications/{id}/interviews/{interview_id}/

Notes
GET    /api/applications/{id}/notes/
POST   /api/applications/{id}/notes/
PATCH  /api/applications/{id}/notes/{note_id}/
DELETE /api/applications/{id}/notes/{note_id}/

Health
GET    /api/health/
GET    /api/health/live/
```

`GET /api/applications/` searches job title and company name, filters by an applied-date range and by one status, and returns one page at a time.

`GET /api/dashboard/` returns the signed-in user's count for each status, including zero, and that user's soonest 10 upcoming interviews. An interview is upcoming when its date and time are in the future and its outcome is `SCHEDULED`. Each item includes the job title, company name, date and time, type, and application id.

`DELETE /api/applications/{id}/` also deletes that application's interviews and notes.

`POST /api/applications/` and `PATCH /api/applications/{id}/` take a company name. The server uses the user's company with that name, or creates one, in the same transaction as the application. There is no endpoint that creates a company on its own.

`status` and `outcome` are required on the stored record. The API fills `SAVED` and `SCHEDULED` when a create omits them.

`PATCH` on an interview changes its outcome and nothing else.

Register accepts email and password. Login accepts email and password. A duplicate email, a password shorter than 8 characters, and a common password are validation errors.

Permissions tie each record to the user who owns it. One user cannot read or change another user's records. Dashboard counts and upcoming interviews follow the same rule.

## Frontend

Build these screens in React and TypeScript:

- Landing
- Login
- Register
- Dashboard
- Application list
- Create an application
- Edit an application
- Application detail

Interviews and notes are sections on the application detail screen. Companies are chosen or created on the application form. Account actions are register, login, and log out.

There is no sidebar, and no bar that stays on every signed-in screen. The landing page is the only screen with a top bar. The dashboard links to the application list, the create screen, and log out. The application list links to the create screen. Create and edit link back to the dashboard.

A signed-out visitor to any screen other than the landing page, login, and register is sent to login. A signed-in visitor to the landing page, login, or register is sent to the dashboard. Login and registration both land on the dashboard. The session survives a refresh until the token expires or the user logs out. Log out clears the session and opens the landing page.

Each screen calls the API and shows the result. Stop frontend work once those screens work.

### Landing

The landing page is `/`. It is the first screen for a signed-out visitor, including after log out.

The top bar shows Applications Tracker on the left and Login and Register on the right. The page uses the same type and colors as the other screens. It has a short headline and one sentence about tracking applications.

### Login and register

Register collects email and password and shows a field error when the email is already registered, the password is shorter than 8 characters, or the password is a common one.

Login collects email and password. When they do not match an account, the screen shows one error and does not say whether the email exists.

### Dashboard

The dashboard shows a count for each status, a list of the soonest 10 upcoming interviews, a link to the application list, a link to create an application, and log out.

Each status count is a card. The card opens `/applications` limited to that status, including a card whose count is zero. All applications opens `/applications` with no status limit.

Each upcoming interview shows the job title, company, date and time, and type, and links to that application. The counts and the interview list come from `GET /api/dashboard/`.

### Application list

The list is a table. Columns are job title, company, status, date applied, and next interview. Next interview is the soonest upcoming interview for that application. The cell is empty when there is none. The rest of a row opens the detail screen.

The status badge opens a menu of the seven statuses. Choosing one updates that application immediately through `PATCH /api/applications/{id}/`. If the open list is limited to one status and the new status does not match, the row leaves the list.

The user can search by job title and company name, filter by an applied-date range, and filter by one status. Applications with no applied date are shown when the range is empty, and hidden when a range is set.

The table requests one page at a time and shows next and previous when another page exists. Search, the applied-date range, the status, and the page stay in the list address. Opening a detail screen and coming back shows that same list.

### Create and edit

Create is `/applications/new`. Edit is `/applications/{id}/edit`. Both forms use the same fields.

Required fields are job title, company, location, and status. Optional fields are salary, job posting URL, date applied, and description. The create form starts with status `SAVED`.

The company control lists that user's companies and accepts a new name. The form sends the name with the application. The server uses the existing company when the name matches one of the user's companies, ignoring case, and creates the company otherwise.

A successful create opens the new detail screen. A successful edit returns to the detail screen. Both screens link back to the dashboard.

### Application detail

The detail route is `/applications/{id}`. The page shows the application fields, then interviews, then notes. Status on this screen is a label.

The page keeps the address it was opened from, and Back uses that address. The back label names that previous screen.

- From All applications, Back returns to that list with the same search, dates, and page. The label is All applications.
- From a status card, Back returns to that filtered list with the same search, dates, and page. The label is the status name.
- From an upcoming interview on the dashboard, Back returns to the dashboard. The label is Dashboard.
- A detail address opened on its own goes back to `/applications` with no filters. The label is All applications.

The application section links to edit. Delete asks for confirmation, then removes the application and opens that same previous list. A detail address opened on its own opens `/applications` after delete.

The interviews section lists interviews and can add or delete one. Each interview's outcome can be changed in place. No other interview field can be edited. Required fields are date and time, type, and outcome. Optional fields are round name and interviewer name. The add form starts with outcome `SCHEDULED`.

The notes section lists notes and can add, edit, or delete one. Each note shows its text, the time it was created, and the time it was last changed after an edit.

## Engineering requirements

### Backend

- Split the Django project into models, serializers, views, and permissions
- REST API as listed above
- JWT authentication
- Permissions that check ownership on each record
- PostgreSQL
- Database constraints and indexes
- Pagination and filtering
- Configuration from environment variables
- HTTP error responses for invalid input, missing records, and permission failures
- OpenAPI documentation

### Testing

Use pytest and pytest-django.

Cover at least these cases:

- Authentication, including a short password, a common password, a duplicate email, and a login that does not match
- Authorization
- Create, read, update, and delete for applications
- Add and delete for interviews, an outcome update, and a rejected update to any other field
- Create, update, and delete for notes
- Search by job title and company name
- Filter by applied date
- Filter by one status
- Pagination
- Dashboard counts and upcoming interviews
- Invalid input
- Two users with separate data, including companies that share a name
- The relationships in the data model

### Docker

This command starts the frontend, backend, and PostgreSQL locally, each in its own container:

```bash
docker compose up
```

### CI

On each pull request, GitHub Actions does the following:

1. Install dependencies.
2. Start PostgreSQL.
3. Run migrations.
4. Run tests.
5. Run lint and formatting checks.
6. Build the Docker image.
7. Build the frontend.

A failed test or check fails the pull request.

### AWS and CD

Deployment runs in this order:

1. Push to GitHub.
2. GitHub Actions starts.
3. Tests pass.
4. The workflow builds a Docker image.
5. The workflow pushes the image to Amazon ECR.
6. The workflow runs migrations against RDS PostgreSQL as a one-off ECS task with the new image. A failed migration stops the deploy.
7. ECS on Fargate runs the new image.
8. The workflow builds the frontend and uploads it to S3.
9. The workflow invalidates `/index.html` in CloudFront.
10. CloudFront serves that build, and forwards `/api` to the load balancer in front of ECS.

A push to `main` deploys the backend and the frontend after CI passes. `main` is the release branch. `/docs/architecture.md` records that choice and why S3 and CloudFront are required.

### Monitoring

Send these to CloudWatch:

- Application logs
- ECS logs
- HTTP errors
- ECS CPU and memory
- Results from `GET /api/health/`

`GET /api/health/` returns success when the backend can reach PostgreSQL. It returns an error when it cannot. The load balancer checks `GET /api/health/live/`, which does not query the database, so a database outage does not make ECS restart every task.

## Development phases

Finish each phase before starting the next.

### Phase 1. Planning

Write these files before you write implementation code:

```text
/docs/architecture.md
/docs/database.md
/docs/api.md
```

This file and PROJECTDESCRIPTION.md also live in `/docs`. Changes to the Phase 1 docs are logged in `/docs/PHASE1DOCSCHANGES.md`.

`architecture.md` names the services, how they connect, and the repository layout. `database.md` defines the schema. `api.md` defines the API contract.

### Phase 2. Backend

Build the Django and Django REST Framework backend against PostgreSQL.

Add models, migrations, serializers, views, authentication, permissions, filtering, pagination, and OpenAPI documentation.

### Phase 3. Testing

Add the tests listed in the Testing section before any deployment work.

### Phase 4. Frontend

Build the screens listed in the Frontend section.

### Phase 5. Docker

Put the frontend, backend, and database in containers. `docker compose up` starts all three, and a user can sign in and use the screens.

### Phase 6. CI

Add the GitHub Actions workflow from the CI section.

### Phase 7. AWS

Deploy the backend image to ECS on Fargate, PostgreSQL to RDS, images to ECR, and the frontend build to S3 behind CloudFront.

### Phase 8. CD

Connect GitHub Actions to AWS. A passing build on `main` deploys the backend and the frontend.

### Phase 9. Monitoring

Configure CloudWatch logs and metrics. Confirm `GET /api/health/` fails when PostgreSQL is unreachable and succeeds when it is reachable.

### Phase 10. Break and fix

Trigger failures on purpose, including a down database and a failed deploy. Fix error handling, security, `/docs`, and the deploy workflow from what you find.

## Development rules

1. Finish one phase before starting the next.
2. When you pick one design over another, say why.
3. Use the smallest design that meets this file.
4. Leave out microservices, Kubernetes, Kafka, Redis, Celery, and Terraform unless a requirement here cannot be met without one of them. Record the reason in `/docs` first.
5. Keep secrets out of Git.
6. Read configuration from environment variables.
7. Add tests in the same change as the behavior they cover.
8. Be ready to explain the schema, auth, tests, and deployment in an interview.
9. When a choice changes the schema, the API, or deployment, write it in `/docs`.
10. After the frontend screens work, spend implementation time on the backend, tests, and deployment.

## Final goal

The finished repo has:

- `/docs` with `architecture.md`, `database.md`, `api.md`, this spec, and PROJECTDESCRIPTION.md
- The Django REST API and PostgreSQL schema from this file
- The React screens from the Frontend section
- A pytest suite that covers the Testing section
- Docker Compose for the frontend, backend, and PostgreSQL
- GitHub Actions that fail a pull request when tests, lint, or the image build fail
- A running deployment on ECS, RDS, ECR, S3, and CloudFront, with CloudFront as the public site
- A GitHub Actions deploy of the backend and the frontend from `main`
- CloudWatch logs and a health check that depends on PostgreSQL
- A README that explains how to run the project locally and how deployment works
