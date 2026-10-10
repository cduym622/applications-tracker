# Architecture

This file names the services, how they connect, and the repository layout. The schema is in `database.md`. The API contract is in `api.md`.

## Services

Locally, three containers run the product:

- The React frontend
- The Django and Django REST Framework API
- PostgreSQL

`docker compose up` starts all three. The frontend container proxies `/api` to Django with the Vite dev server's `server.proxy` setting, so the browser uses one origin locally and in production.

In production the same product is a public site:

- Amazon S3 stores the Vite build.
- ECS on Fargate runs the API container.
- Amazon RDS runs PostgreSQL.
- Amazon ECR stores the API image.
- An Application Load Balancer is the API's stable address. A Fargate task IP changes, and CloudFront needs an origin that stays put.
- Amazon CloudFront is the only public URL. Default requests serve the React app from S3. Requests under `/api` go to the load balancer.

```text
Browser
  -> CloudFront
       -> S3 for pages and assets
       -> Application Load Balancer -> ECS Fargate -> RDS PostgreSQL
          for /api
```

A push to `main` deploys the API and the frontend after CI passes. `main` is the release branch. One long-lived branch is enough.

## Why S3 and CloudFront

PROJECTSPEC.md requires ECS, RDS, and ECR for the API. This project also deploys the screens, because the deployed site has to be the full application.

The Vite build is static files. A running container is a poor place for them. S3 stores the files. CloudFront serves them and forwards `/api` to the load balancer. One hostname means the browser calls `/api` on the same origin. Production uses that single origin, with no second domain and no CORS.

## Frontend routes on CloudFront

A refresh of `/applications/1` must load `index.html`, and React Router then handles the route.

The `/api/*` behavior uses the managed `CachingDisabled` cache policy and the `AllViewerExceptHostHeader` origin request policy. Every API request reaches Django, and the viewer's headers, including `Authorization`, are forwarded. Without this, CloudFront could cache API responses, because Django sends no `Cache-Control` header. The health check, which goes through CloudFront, could then report a cached success while the database is down.

A CloudFront Function on the default (S3) behavior rewrites any path without a file extension to `/index.html`. The `/api/*` behavior has no function, so API responses pass through unchanged.

CloudFront custom error responses (404 to `/index.html` with 200) are not used. They apply to every behavior in the distribution, so an API 404 such as `{"detail": "Not found."}` would come back as HTML with status 200.

## Networking

- One VPC with public and private subnets in two availability zones.
- The load balancer is in the public subnets. Its security group accepts HTTP only from the CloudFront managed prefix list, so the load balancer cannot be called directly from the internet.
- ECS tasks are in the private subnets. Their security group accepts traffic only from the load balancer's security group.
- RDS is in the private subnets with no public access. Its security group accepts PostgreSQL traffic only from the ECS tasks' security group.
- ECS tasks in private subnets need a route out to pull from ECR, read secrets, and send logs. A single NAT gateway provides it. It is required because the spec puts the API on ECS and the database on RDS, and keeping both off the public internet means private subnets. VPC endpoints for ECR, CloudWatch Logs, and SSM would also work, but they cost more for a single small service.

## Repository layout

```text
backend/                 Django project config and one app, tracker
frontend/                React and TypeScript screens
docs/                    PROJECTSPEC.md, PROJECTDESCRIPTION.md, architecture.md,
                         database.md, api.md, PHASE1DOCSCHANGES.md
.github/workflows/       CI, then CD
```

`tracker` holds models, serializers, views, permissions, and filters. The spec asks for those modules inside one Django project.

## Libraries beyond the spec

These are required, and Django or Django REST Framework does not provide them:

- `djangorestframework-simplejwt` issues the JWT. The spec requires JWT authentication.
- `drf-spectacular` emits the OpenAPI schema and Swagger UI. The spec requires both.
- `psycopg` is the PostgreSQL driver Django uses to talk to the database.
- `gunicorn` serves the API in the container. Django's `runserver` is for development only, and the spec requires a deployed backend.

## Authentication

Register and login return an access token. The frontend stores it in `localStorage` and sends `Authorization: Bearer` on later requests. Logout deletes the token in the browser. The spec asks for that access token only, so there is no refresh token and no server-side blacklist. The access token lasts 24 hours, so a refresh during a normal session still works.

Passwords are hashed with Django's default hasher, PBKDF2. The API rejects a password shorter than 8 characters, and Django's `CommonPasswordValidator` rejects common passwords.

Login and register use Django REST Framework's built-in `ScopedRateThrottle`. The limit is 10 requests per minute per client IP for each endpoint. This slows password guessing without adding a library.

Requests pass through CloudFront and the load balancer, so `REMOTE_ADDR` is the load balancer's address. DRF's `NUM_PROXIES` is set to 2, so the throttle reads the client IP from `X-Forwarded-For`, two hops from the right. If it were unset, DRF would key on the whole header, and a client could change the header on each request to get a fresh limit. Locally there is no proxy, and `NUM_PROXIES` is 0.

### Known tradeoffs

- A token in `localStorage` can be read by any script on the page. A cross-site scripting bug would let an attacker use the token until it expires, for up to 24 hours. React escapes rendered text by default, and the app renders no user HTML.
- Logout does not revoke the token. A copied token keeps working until it expires. Rotating `SECRET_KEY` revokes every token at once.
- Register returns a field error when an email is already taken, as the spec requires. That tells a caller which emails have accounts, even though login does not. The rate limit on register reduces how fast someone can check emails.

## Configuration

The process reads configuration from environment variables. Secrets stay out of Git.

- `SECRET_KEY` signs sessions and JWTs.
- `DEBUG`
- `ALLOWED_HOSTS`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`

Locally, Docker Compose reads them from a `.env` file that Git ignores.

In ECS, `SECRET_KEY` and `POSTGRES_PASSWORD` are SSM Parameter Store `SecureString` parameters. The task definition's `secrets` field references them, and ECS injects them as environment variables when the task starts. The other values are plain `environment` entries in the task definition. Parameter Store is required because the spec keeps secrets out of Git, and a plain task definition value would put them in the ECS console and API in clear text. It was chosen over Secrets Manager because the standard tier has no extra cost and the app does not need automatic rotation.

### ALLOWED_HOSTS behind the load balancer

CloudFront does not forward the viewer's `Host` header to the load balancer (see the origin request policy above). Django sees the load balancer's DNS name instead, so `ALLOWED_HOSTS` holds that name. The load balancer's health checks send the task's private IP as the `Host` header, and Django would answer those with 400, so every task would be marked unhealthy. At startup, settings read the task's private IP from the ECS task metadata endpoint (`ECS_CONTAINER_METADATA_URI_V4`) and add it to `ALLOWED_HOSTS`. Outside ECS that variable is unset, and nothing is added.

## CI and CD

On each pull request, GitHub Actions installs dependencies, starts PostgreSQL, runs migrations, runs tests, runs lint and formatting checks, and builds the API image and the frontend. A failed test or check fails the pull request.

On a push to `main`, after those checks pass, the workflow does these steps in order:

1. Build the API image and push it to ECR.
2. Register a new task definition revision with that image.
3. Run `python manage.py migrate` as a one-off ECS task with the new revision, and wait for it to exit. A non-zero exit stops the deploy, and the running service stays on the old image.
4. Update the ECS service to the new revision. ECS replaces tasks with a rolling deploy.
5. Build the frontend and upload it to S3.
6. Invalidate `/index.html` in CloudFront.

Migrations run before the new code. Each migration must therefore work with the code that is still running, so a column is added before code uses it and removed only after code stops using it.

Vite gives built assets content-hashed names, so they are uploaded with a long `Cache-Control` max age and never need invalidation. `index.html` is uploaded with `Cache-Control: no-cache` and is also invalidated, so browsers get the new asset names right after a deploy.

## Health checks

There are two checks, and they answer different questions.

- **Load balancer target health check: is this process serving HTTP?** It calls `GET /api/health/live/`, which returns 200 without touching the database. ECS replaces a task only when the process itself is broken.
- **Monitoring check: can the API reach PostgreSQL?** `GET /api/health/` runs a database query. It returns 200 when the query succeeds and 503 when it fails. CloudWatch records this result, as the spec requires.

If the load balancer used the database check, a short RDS outage would mark every task unhealthy. ECS would then stop and restart all of them at once, which turns a database problem into a full outage and slows recovery. With the split, a database outage shows up as 503s and an alarm while the tasks keep running, and they recover on their own when RDS returns.

## Monitoring

The API sends application logs, ECS logs, HTTP errors, ECS CPU and memory, and the result of `GET /api/health/` to CloudWatch.

`GET /api/health/` returns success when the API can query PostgreSQL. It returns an error when it cannot.

Something has to call `GET /api/health/` for its result to reach CloudWatch. A Route 53 health check calls it through the CloudFront URL every 30 seconds and publishes `HealthCheckStatus` as a CloudWatch metric. Route 53 is not in the spec's stack. It is added because the spec requires health results in CloudWatch, and it is the smallest AWS service that does that without running code of our own.

Two CloudWatch alarms notify an SNS topic with an email subscription. SNS is required because a CloudWatch alarm can only notify a person through it. The alarms are:

- Load balancer `HTTPCode_Target_5XX_Count` above 5 in 5 minutes.
- Route 53 `HealthCheckStatus` below 1 for 2 consecutive minutes.
