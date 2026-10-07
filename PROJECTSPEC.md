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

A company name is unique for one user. Two users may each have a company with the same name. Deleting an application does not delete its company.

User fields:

- Email, required and unique
- Password, required, at least 8 characters, stored hashed

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

An interview cannot be updated. To change one, the user deletes it and adds another. An interview has no note field of its own.

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
POST   /api/companies/

Interviews
GET    /api/applications/{id}/interviews/
POST   /api/applications/{id}/interviews/
DELETE /api/applications/{id}/interviews/{interview_id}/

Notes
GET    /api/applications/{id}/notes/
POST   /api/applications/{id}/notes/
PATCH  /api/applications/{id}/notes/{note_id}/
DELETE /api/applications/{id}/notes/{note_id}/

Health
GET    /api/health/
```

`GET /api/applications/` searches job title and company name, filters by an applied-date range, and returns one page at a time.

`GET /api/dashboard/` returns the signed-in user's count for each status, including zero, and that user's upcoming interviews. An interview is upcoming when its date and time are in the future and its outcome is `SCHEDULED`. Each item includes the job title, company name, date and time, type, and application id.

`DELETE /api/applications/{id}/` also deletes that application's interviews and notes.

Register accepts email and password. Login accepts email and password. A duplicate email and a password shorter than 8 characters are validation errors.

Permissions tie each record to the user who owns it. One user cannot read or change another user's records. Dashboard counts and upcoming interviews follow the same rule.

## Frontend

Build these screens in React and TypeScript:

- Login
- Register
- Dashboard
- Application list
- Create an application
- Edit an application
- Application detail

Interviews and notes are sections on the application detail screen. Companies are chosen or created on the application form. Account actions are register, login, and log out.

There is no sidebar and no top bar that stays on screen. The dashboard links to the application list, the create screen, and log out. Every other signed-in screen links back to the dashboard. The application list also links to the create screen.

A signed-out visitor to any screen other than login and register is sent to login. A signed-in visitor to login or register is sent to the dashboard. Login and registration both land on the dashboard. The session survives a refresh until the token expires or the user logs out. Log out clears the session and opens login.

Each screen calls the API and shows the result. Stop frontend work once those screens work.

### Login and register

Register collects email and password and shows a field error when the email is already registered or the password is shorter than 8 characters.

Login collects email and password. When they do not match an account, the screen shows one error and does not say whether the email exists.

### Dashboard

The dashboard shows a count for each status, a list of upcoming interviews, a link to the application list, a link to create an application, and log out.

Each upcoming interview shows the job title, company, date and time, and type, and links to that application. The counts and the interview list come from `GET /api/dashboard/`.

### Application list

The list is a table. Columns are job title, company, status, date applied, and next interview. Next interview is the soonest upcoming interview for that application. The cell is empty when there is none. A row opens the detail screen.

The user can search by job title and company name and can filter by an applied-date range. Applications with no applied date are shown when the range is empty, and hidden when a range is set.

The table requests one page at a time and shows next and previous when another page exists.

### Create and edit

Create is `/applications/new`. Edit is `/applications/{id}/edit`. Both forms use the same fields.

Required fields are job title, company, location, and status. Optional fields are salary, job posting URL, date applied, and description. The create form starts with status `SAVED`.

The company control lists that user's companies and accepts a new name. Submitting a new name creates the company, then creates or updates the application. If the name already belongs to that user, the form uses the existing company.

A successful create opens the new detail screen. A successful edit returns to the detail screen.

### Application detail

The detail route is `/applications/{id}`. The page shows the application fields, then interviews, then notes.

The application section links to edit. Delete asks for confirmation, then removes the application and opens the list.

The interviews section lists interviews and can add or delete one. It cannot edit one. Required fields are date and time, type, and outcome. Optional fields are round name and interviewer name. The add form starts with outcome `SCHEDULED`.

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

- Authentication, including a short password, a duplicate email, and a login that does not match
- Authorization
- Create, read, update, and delete for applications
- Add and delete for interviews, with no update path
- Create, update, and delete for notes
- Search by job title and company name
- Filter by applied date
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

A failed test or check fails the pull request.

### AWS and CD

Deployment runs in this order:

1. Push to GitHub.
2. GitHub Actions starts.
3. Tests pass.
4. The workflow builds a Docker image.
5. The workflow pushes the image to Amazon ECR.
6. ECS on Fargate runs the image.
7. The backend uses RDS PostgreSQL.

A push to the release branch deploys the backend after CI passes. Name that branch in `/docs/architecture.md`.

### Monitoring

Send these to CloudWatch:

- Application logs
- ECS logs
- HTTP errors
- ECS CPU and memory
- Results from `GET /api/health/`

`GET /api/health/` returns success when the backend can reach PostgreSQL. It returns an error when it cannot.

## Development phases

Finish each phase before starting the next.

### Phase 1. Planning

Write these files before you write implementation code:

```text
/docs/architecture.md
/docs/database.md
/docs/api.md
```

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

Deploy the backend image to ECS on Fargate, PostgreSQL to RDS, and images to ECR.

### Phase 8. CD

Connect GitHub Actions to AWS. A passing build on the release branch deploys the backend.

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

- `architecture.md`, `database.md`, and `api.md`
- The Django REST API and PostgreSQL schema from this file
- The React screens from the Frontend section
- A pytest suite that covers the Testing section
- Docker Compose for the frontend, backend, and PostgreSQL
- GitHub Actions that fail a pull request when tests, lint, or the image build fail
- A running deployment on ECS, RDS, and ECR
- A GitHub Actions deploy from the release branch
- CloudWatch logs and a health check that depends on PostgreSQL
- A README that explains how to run the project locally and how deployment works
