# Phase 6 info

Phase 6 added a GitHub Actions workflow that runs on every pull request. It installs dependencies, starts PostgreSQL, runs migrations, runs the tests, runs lint and formatting checks, builds the API image, and builds the frontend. A failed step fails the pull request. This is the Phase 6 requirement in `PROJECTSPEC.md`. This file records what was built on 2026-10-16, how to run the same checks locally, how the workflow works, and what to know before Phase 7.

`P6DOCSCHANGES.md` in this folder lists each change to the other docs and why. `architecture.md` is still the design source of truth.

## What runs

```text
pull request opened or updated, or push to main
  -> .github/workflows/ci.yml, three jobs in parallel
       Backend tests and lint
         postgres:17 service container
         pip install -r requirements-dev.txt
         python manage.py migrate --noinput
         pytest
         ruff check .
         ruff format --check .
       Frontend lint and build
         npm ci
         npm run lint
         npm run format:check
         npm run build
       API image build
         docker build backend
```

Each job runs on its own fresh `ubuntu-latest` machine. The jobs share no files and do not wait for each other. Inside a job, the steps run in order and the job stops at the first failed step. GitHub marks the pull request's CI check as failed when any job fails.

| Job | Spec steps it covers | Runtime |
| --- | --- | --- |
| Backend tests and lint | Install dependencies, start PostgreSQL, run migrations, run tests, run lint and formatting checks | Python 3.12, PostgreSQL 17 |
| Frontend lint and build | Install dependencies, run lint and formatting checks, build the frontend | Node 22 |
| API image build | Build the Docker image | Docker on the runner |

The job names are the names GitHub shows on the pull request, and the names a branch rule would require.

## What changed

### New files

| File | What it does |
| --- | --- |
| `.github/workflows/ci.yml` | The workflow. Three jobs, triggered by every pull request and every push to `main`. |
| `backend/requirements-dev.txt` | `-r requirements.txt` plus `ruff==0.17.1`. CI and developers install this. The API image does not. |
| `backend/ruff.toml` | Ruff settings: 120-character lines, Python 3.12, the `E4`, `E7`, `E9`, and `F` rules, and `migrations/` excluded. |
| `frontend/eslint.config.js` | ESLint flat config: the recommended JavaScript, TypeScript, and React hooks rules, then `eslint-config-prettier`. |
| `frontend/.prettierrc.json` | Prettier settings: single quotes, no semicolons, 120-character lines. |
| `frontend/.prettierignore` | Keeps Prettier off `package-lock.json` and Markdown files. |
| `docs/Phase6-Docs/P6DOCSCHANGES.md` | The docs changelog for this phase. |
| `docs/Phase6-Docs/P6-INFO.md` | This file. |

### Changed files

| File | Change |
| --- | --- |
| `frontend/package.json`, `frontend/package-lock.json` | Adds `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-config-prettier`, and `prettier` as devDependencies. Adds the `lint`, `format`, and `format:check` scripts. |
| `backend/tracker/views.py`, `backend/tracker/tests/test_applications.py`, `test_ownership.py`, `test_schema.py` | `ruff format` rewrapped five statements. No logic changed. |
| `frontend/src/types.ts`, `index.css`, `components/ApplicationForm.tsx`, `pages/ApplicationDetail.tsx`, `pages/ApplicationList.tsx` | Prettier rewrapped lines and split the one-line CSS rules. No logic or style values changed. |
| `frontend/src/pages/ApplicationList.tsx` | Also adds an `eslint-disable-next-line` for one `exhaustive-deps` warning, with the reason. See "The one lint exception" below. |
| `docs/architecture.md` | Repository layout, a new "Development tools" section, and the three CI jobs. |
| `README.md` | Phase 6 is marked done. New "Continuous integration" section. |
| `backend/README.md`, `frontend/README.md` | How to install and run the lint and format tools. |

Nothing in the API's behavior, the React screens, the schema, or the API contract changed. `backend/Dockerfile`, `frontend/Dockerfile`, and `compose.yaml` are unchanged.

## How to run the checks locally

CI runs the same commands as the steps below. Run them before you push, and a passing local run means CI should pass too.

### Backend

From `backend/`, with the virtualenv active:

```sh
uv pip install -r requirements-dev.txt   # once, to get Ruff
ruff check .
ruff format --check .
```

To fix formatting, run `ruff format .`. To apply the lint fixes Ruff knows are safe, run `ruff check --fix .`.

The tests run on the host against Postgres.app, as `backend/README.md` describes:

```sh
pg_isready -h localhost
set -a; source .env; set +a
pytest
```

### Frontend

From `frontend/`:

```sh
npm install
npm run lint
npm run format:check
npm run build
```

To fix formatting, run `npm run format`.

### API image

From the repository root, with Docker Desktop running:

```sh
docker build backend
```

`docker compose up --build` also builds it.

## Configuration

The backend job sets every variable `config/settings.py` reads, so the job needs no secrets from the repository.

| Variable | Value in CI | Why |
| --- | --- | --- |
| `SECRET_KEY` | `ci-only-secret-key-not-used-anywhere-else-0123456789` | Settings stop at startup without it. It signs test tokens only. It is longer than 32 characters, so PyJWT does not warn. |
| `DEBUG` | `false` | The same default production uses. pytest-django forces `DEBUG` off during tests anyway. |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Matches the local value in `backend/README.md`. Django's test setup adds the test client's `testserver` host. |
| `POSTGRES_DB` | `applications_tracker` | The same name Compose uses. pytest-django creates `test_applications_tracker` next to it. |
| `POSTGRES_USER` | `postgres` | The `postgres:17` image's superuser, so pytest-django can create the test database. |
| `POSTGRES_PASSWORD` | `ci-only-password` | Set on the service container and on the job, so both agree. |
| `POSTGRES_HOST` | `localhost` | The service container publishes 5432 on the runner. |
| `POSTGRES_PORT` | `5432` | |
| `NUM_PROXIES` | `0` | No proxy sits in front of Django in CI. |

### Why these values are in the workflow

`SECRET_KEY` and the database password are written in plain text in `ci.yml`. The database only exists inside the job's runner, it holds only test rows, and GitHub deletes it when the job ends. The key signs tokens for that database only. Neither value is used anywhere else, and neither protects anything.

Writing them in the file also lets the workflow run on a pull request from a fork. GitHub does not pass repository secrets to those runs, so a workflow that read them from secrets would fail for every outside contributor.

The real `SECRET_KEY` and `POSTGRES_PASSWORD` stay in SSM Parameter Store, as `architecture.md` describes. Phase 8 will add the AWS credentials CD needs, and those will be GitHub secrets.

## Why it is built this way

### One workflow file, three jobs

The spec lists seven CI steps. They fall into three groups that need different machines: Python and PostgreSQL, Node, and Docker. Each group is one job.

The jobs run in parallel, so the whole check takes as long as the slowest job instead of the sum of all three. A failure in one job also does not hide the others. A pull request with a failing test and a frontend lint error shows both.

One file is enough. Phase 8 will add deploy jobs to the same file and use `needs:` so they run only after these three pass.

### Pull requests and pushes to main

The spec asks for CI on each pull request. The workflow also runs on every push to `main`. That run checks the code exactly as it was merged, and it is where Phase 8's deploy jobs will start.

A new push to a pull request cancels that pull request's older run, because only the newest commit matters. Runs on `main` are never cancelled, so a deploy job added in Phase 8 cannot be stopped halfway by the next merge.

### Least privilege

`permissions: contents: read` gives the workflow's token read access to the code and nothing else. CI does not need to write to the repository, comment on pull requests, or push packages.

### PostgreSQL 17 as a service container

The tests must run on PostgreSQL, as `PROJECTSPEC.md` and `P3IMPLEMENTATIONMANUAL.md` require. A GitHub Actions service container starts PostgreSQL next to the job, and its health check holds the job until `pg_isready` passes. The image is `postgres:17`, the same major version `compose.yaml` runs, so the tests use the same engine as the local stack.

### Migrate before pytest

pytest-django builds its own test database from the migrations, so the tests would pass without a separate `migrate` step. The spec lists "run migrations" as its own step, and it checks something the tests do not. `migrate --noinput` runs against an empty `applications_tracker` database the same way the first production deploy will run against an empty RDS database.

### Ruff for Python

The spec asks for lint and formatting checks, and the repo had neither. Ruff does both with one pinned package and one config file. The two older tools for the same job, flake8 for lint and black for formatting, would be two packages and two configs.

Ruff's settings follow the code that already existed:

- Lines may be up to 120 characters. All hand-written Python was already within 120, and 93 lines were over Ruff's default of 88. Formatting to 88 would have rewrapped most of the codebase.
- The lint rules are `E4`, `E7`, `E9`, and `F`: Pyflakes, plus the pycodestyle errors that do not overlap the formatter. They catch unused imports, undefined names, and syntax problems. The list is written out in `ruff.toml`. Ruff 0.17's own defaults also include `RUF012`, which flags every Django `Meta.fields` list and every DRF `permission_classes` as a mutable class attribute. Those are false positives for Django code, and listing the rules keeps a later Ruff upgrade from adding more.
- `migrations/` is excluded. Django generates those files, and `0001_initial.py` has a 260-character line.

### Ruff stays out of the API image

`backend/Dockerfile` installs `requirements.txt` only. Ruff is in `requirements-dev.txt`, which starts with `-r requirements.txt`. The image that ECS will run therefore has no tool it does not use.

### ESLint and Prettier for the frontend

`npm run build` already runs `tsc -b`, which catches type errors. ESLint catches what the compiler does not: unused variables, `let` that should be `const`, and broken rules of hooks. The config uses ESLint's and `typescript-eslint`'s recommended rules, and the React hooks plugin's recommended rules. It does not turn on the type-aware rules, which would run the TypeScript compiler a second time.

Prettier formats the code. Its settings match the code from Phase 4: single quotes, no semicolons, and trailing commas. The line width is 120, the same as Ruff. At that width Prettier rewrapped lines in four TypeScript files, a 51-line diff. At width 100 the TypeScript diff would have been 86 lines across six files. It also split the one-line rules in `index.css`.

`eslint-config-prettier` comes last in the ESLint config and turns off the formatting rules, so the two tools never disagree about the same line.

The lint script passes `--max-warnings 0`. ESLint exits 0 on warnings by default, and the hooks plugin reports a missing effect dependency as a warning. Without the flag, CI would pass with that warning showing.

The frontend uses ESLint 10, the current major release, and every plugin here supports it. ESLint 10 needs Node 20.19 or later, so `frontend/README.md` now says so.

### The one lint exception

The effect that loads the application list in `ApplicationList.tsx` lists `[key, reload]` as its dependencies. `key` is the whole query string, so it changes whenever any search, date, status, or page value changes. The hooks plugin asks for each of those values, plus the `update` function.

`update` is a new function on every render. Listing it would run the effect, and send a GET, after every render. Listing the separate values would not change when the effect runs, because `key` already covers them. The existing comment explained this, so the line now carries `eslint-disable-next-line react-hooks/exhaustive-deps` under that comment. No other finding was silenced.

### Node 22 in CI

`frontend/Dockerfile` uses `node:22-slim`. CI uses the same major version, so a lockfile or build problem shows up the same way in both.

### Build the API image, not the frontend image

`docker build backend` builds the image Compose runs today and ECS will run in Phase 7. It runs with no push, and Phase 8 will push the same image to ECR.

`frontend/Dockerfile` is the Vite dev server for local use. Production serves the output of `npm run build` from S3 and never runs that image, so the frontend job builds the files instead.

### Pinned versions

Ruff is pinned to an exact version in `requirements-dev.txt`, the same way the other Python packages are pinned. The frontend tools use `^` ranges in `package.json`, as the existing packages do, and `npm ci` installs the exact versions in `package-lock.json`. A new Ruff or ESLint release can add rules or change formatting, so a pin keeps CI from failing on a pull request that changed nothing.

The official actions use their major tags, `actions/checkout@v7`, `actions/setup-python@v7`, and `actions/setup-node@v7`. GitHub moves a major tag only for compatible releases.

### Caching

`actions/setup-python` caches pip's downloads, keyed on both requirements files. `actions/setup-node` caches npm's downloads, keyed on `package-lock.json`. A run with unchanged dependencies downloads nothing from PyPI or npm.

## Verification

Checks that ran on 2026-10-16:

- [x] `actionlint` found no problems in `.github/workflows/ci.yml`.
- [x] `ruff check .` and `ruff format --check .` passed in `backend/`.
- [x] A temporary `postgres:17` container on host port 55432 used the workflow's database name, user, and password. With the workflow's environment, `python manage.py migrate --noinput` applied every migration to the empty database, and `pytest` passed all 71 tests. The container was then removed.
- [x] In a `node:22-slim` container, `npm ci`, `npm run lint`, `npm run format:check`, and `npm run build` all passed.
- [x] `docker build --tag applications-tracker-api:ci backend` built the API image.
- [x] Each check fails on bad input. An unused import made `ruff check` exit 1. Unformatted Python made `ruff format --check` exit 1. Double quotes and a semicolon made `prettier --check` exit 1. An unused `let` made ESLint exit 1.

Check after this branch is pushed:

- [ ] Open a pull request into `main`. The CI check appears with three jobs, and all three pass.
- [ ] Push a commit to that branch with a failing test or a lint error. The matching job fails and the pull request shows a failed check. Revert the commit and the check passes again.
- [ ] After merging, the push to `main` starts the same three jobs.

### Requiring the check before merge

The workflow fails the check. GitHub still allows a merge with a failed check until the repository requires it. To require it, open the repository's Settings, then Rules, then Rulesets, and add a branch ruleset for `main`. Turn on "Require status checks to pass" and add `Backend tests and lint`, `Frontend lint and build`, and `API image build`. GitHub lists those names only after the workflow has run once.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ruff format --check` fails with "Would reformat" | A Python file is not formatted. | Run `ruff format .` in `backend/` and commit the result. |
| `ruff check` fails | A lint finding, such as an unused import. | Fix the line. `ruff check --fix .` fixes the safe cases. |
| `prettier --check` lists files | A frontend file is not formatted. | Run `npm run format` in `frontend/` and commit the result. |
| ESLint fails on a warning | `--max-warnings 0` treats warnings as failures. | Fix the code. Disable a rule on one line only with a comment that gives the reason. |
| `npm ci` fails with "lock file is out of sync" | `package.json` changed without `package-lock.json`. | Run `npm install` in `frontend/` and commit both files. |
| `KeyError: 'SECRET_KEY'` in the backend job | The job's `env` block lost the variable. | Restore `SECRET_KEY` in `ci.yml`. |
| `connection refused` on port 5432 in the backend job | The service container is not healthy or the port mapping is wrong. | Check the "Initialize containers" step in the job log, and `ports: 5432:5432` in `ci.yml`. |
| `pytest` fails in CI and passes locally | The local run used Postgres.app with different data or settings. | Run the tests against a `postgres:17` container with the CI values, as in Verification. |
| The image job fails on `pip install` | A pin in `requirements.txt` does not exist or does not install on Linux. | Fix the pin. `docker build backend` reproduces it locally. |
| The workflow does not start | The file is not on the pull request's branch, or Actions is turned off. | Check that `.github/workflows/ci.yml` is in the branch, and check Settings, then Actions. |

## Things to know

### Behavior

- Every pull request runs all three jobs, including one that changes only docs. Path filters would skip jobs, but a required check that never runs blocks the merge, so every job runs every time.
- The tests still run on the host against Postgres.app locally. CI is the only place they run against a container.
- The workflow builds the API image and then discards it. Nothing is pushed and nothing deploys.

### Known limits

- The pull request is not blocked from merging until a ruleset requires the check. See "Requiring the check before merge".
- `postgres:17`, `ubuntu-latest`, and the action major tags can move to newer minor releases between runs. A failure that appears with no code change may come from one of them.
- The image job has no layer cache between runs, so it reinstalls the eight Python packages each time. A cache would need the Buildx and cache actions, which is more setup than eight packages are worth.
- The workflow does not check for a missing migration. `python manage.py makemigrations --check --dry-run`, listed in `backend/README.md`, does that by hand.

### Next phase

Phase 7 creates the AWS resources: ECR, ECS on Fargate, RDS, S3, and CloudFront. Phase 8 then adds deploy jobs to `ci.yml` that run on `main` after these three pass. They will push the image this workflow builds to ECR, run migrations as a one-off ECS task, update the service, upload `npm run build` to S3, and invalidate `/index.html`.
