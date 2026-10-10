# Phase 1 docs changes

This file lists the changes to the Phase 1 planning docs that came out of the design review on 2026-10-09. Each entry says what changed and why. No backend code exists yet, so nothing else had to change.

## Spec decisions changed

Two choices in PROJECTSPEC.md were reversed. Each change touches several files.

### Interview outcome can be updated

**Before:** An interview could not be updated. The only way to change one was to delete it and add another.

**After:** `PATCH /api/applications/{id}/interviews/{interview_id}/` changes `outcome` only. Any other field in the body is a 400. `PUT` is still 405. Changing the date, type, round, or interviewer still means delete and add.

**Why:** The most common thing a user does with an interview is record how it went. Under the old rule, that meant delete and re-add. Interviews that were never re-added stayed `SCHEDULED` forever after their date passed. Allowing only `outcome` keeps most of the original simplicity and supports that action.

**Files:** PROJECTSPEC.md (data model, endpoint list, frontend detail section, testing list), PROJECTDESCRIPTION.md (application detail), api.md (errors, new PATCH section), database.md (interview section).

### The server finds or creates the company

**Before:** The client called `POST /api/companies/` for a new name, then sent `company_id` with the application. That was two requests with no transaction between them.

**After:** Application writes send `company_name`. The server trims it, matches it against the user's companies ignoring case, and creates the company if there is no match. All of this happens in one `transaction.atomic()` with the application save. `POST /api/companies/` still exists, but the form no longer calls it.

**Why:** In the old flow, if the second request failed, the new company stayed behind. There is no company delete endpoint, so a typo stayed in the user's company list for good. One transaction removes that failure mode. It also moves a business rule from the browser to the backend, which is where this project is meant to show its work.

**Files:** PROJECTSPEC.md (core API, create and edit section), PROJECTDESCRIPTION.md (application fields), api.md (application write rules, POST and PATCH, companies), database.md (company section).

**Frontend follow-up:** The mock frontend does not reflect either change yet. `ApplicationDetail.tsx` has no outcome control, and the RECAP's next-steps list still describes the two-request company flow. Update both when the API client replaces `mockData.ts`.

## architecture.md

| Change | Why |
| --- | --- |
| Local `/api` proxy is the Vite dev server's `server.proxy` | The doc said the frontend proxies `/api` but did not say how. |
| New section: frontend routes on CloudFront, using a CloudFront Function on the S3 behavior | The common setup, custom error responses that map 404 to `index.html`, applies to every behavior. An API 404 would then come back as HTML with status 200. |
| New section: networking (VPC, subnets, security groups, NAT gateway) | It was unspecified. RDS and ECS belong in private subnets. The load balancer should accept only CloudFront traffic, or anyone could call it directly. Fargate in private subnets needs a route out to pull images from ECR. |
| `gunicorn` added under libraries beyond the spec | Production Django needs a WSGI server. The spec says to record every added technology. |
| Authentication: `CommonPasswordValidator` and `ScopedRateThrottle` on login and register | Both are built into Django and DRF, so no new library. They slow password guessing and checking which emails have accounts. |
| Authentication: new known tradeoffs list | Records the costs of the spec's choices: a 24-hour token in `localStorage`, no revocation on logout, and register revealing which emails have accounts. These are likely interview questions. |
| Configuration: secrets come from SSM Parameter Store through the task definition's `secrets` field | "Environment variables" did not say where the values come from in ECS. Parameter Store's standard tier has no extra cost. |
| Configuration: task IP added to `ALLOWED_HOSTS` from the ECS metadata endpoint | Load balancer health checks send the task IP as the `Host` header. Django rejects unknown hosts with 400, so every task would be marked unhealthy. |
| CD: numbered steps, with migrations as a one-off ECS task before the service update | Migrations had no place in the deploy. Running them first, and stopping the deploy if they fail, keeps the old version serving. Migrations must work with the code that is still running. |
| CD: cache headers for hashed assets, `no-cache` on `index.html`, and an invalidation of `/index.html` | Without this, CloudFront can keep serving the old `index.html`, which points to the old assets. |
| New section: health checks, split into `/api/health/live/` for the load balancer and `/api/health/` for monitoring | If the load balancer used the database check, a short RDS outage would make ECS restart every task at once and turn a database problem into a full outage. |
| Monitoring: Route 53 health check that calls `/api/health/` | The spec requires health results in CloudWatch, but nothing was calling the endpoint. Route 53 is the smallest service that does it. Its addition is recorded in the doc, as the spec requires. |
| Monitoring: two alarms (target 5xx and health status) to SNS email | Logs and metrics with no alarm do not alert anyone. |

## api.md

| Change | Why |
| --- | --- |
| Default list order: `date_applied` descending with nulls last, then `id` descending | Order was undefined. Paginating an unordered query gives unstable pages, and Django warns about it. |
| `status` on application create and `outcome` on interview create are now optional | Both were listed as required and also described as having a default. They are optional, with defaults `SAVED` and `SCHEDULED`. |
| `from` later than `to` is a 400 on `from` | The behavior was unspecified. |
| Client rule: a 404 for a page above 1 means request the page before it | A status change can remove the only row on the last page of a filtered list, and the refetch would then hit a 404. |
| Dashboard upcoming interviews capped at 10 | The list had no upper bound. |
| 429 response for throttled login and register; common passwords rejected | Matches the new authentication rules in architecture.md. |
| `job_posting_url` up to 2000 characters | Matches database.md. |
| Companies list ordered by name | Order was undefined. |
| New `GET /api/health/live/` | Matches the health check split in architecture.md. |

## database.md

| Change | Why |
| --- | --- |
| Check constraints on `status`, `type`, and `outcome` | Django `choices` validate only in Python. The spec asks for database constraints, and these are the natural ones. |
| Company uniqueness is on `user_id` and `lower(name)` | The form matched names ignoring case, but the database did not, so Stripe and stripe could both exist. |
| `created_at` on company; `created_at` and `updated_at` on job application | Standard audit columns. They support "important dates" from the spec's objective and help with debugging. |
| `job_posting_url` is `varchar(2000)` | Django's `URLField` defaults to 200 characters, and real job links with tracking parameters run longer. |
| Index on `user_id, date_applied DESC NULLS LAST, id DESC` | Supports the new default list order and the applied-date filter. |
| Note that the database does not check that the application owner matches the company owner | A composite foreign key would check it, but Django does not support one. The API and a two-user test cover it. Writing it down makes the gap a known decision. |

## PROJECTSPEC.md and PROJECTDESCRIPTION.md

These files changed only for the two spec decisions above, for case-insensitive company names, and for the second health endpoint. The testing list now covers the interview outcome update and the rejection of updates to other interview fields.

## Consistency pass

A second read of all the docs on 2026-10-09 found places where the first round of edits updated `api.md` and `architecture.md` but not the spec and description, plus a few gaps the new architecture created.

### Contradictions fixed

| Change | Files | Why |
| --- | --- | --- |
| Removed `POST /api/companies/`. `GET` stays. | PROJECTSPEC.md, api.md, database.md, frontend/RECAP.md | `database.md` said companies are created only together with an application, but the endpoint still created them on their own. Nothing called it after the `company_name` change. This replaces the earlier entry above that kept it. |
| Common passwords are rejected everywhere the password rule appears, and the auth test case covers them | PROJECTSPEC.md, PROJECTDESCRIPTION.md, database.md | Only `api.md` and `architecture.md` had the rule. |
| Fixed the path for PATCH: `/api/applications/{id}/` | PROJECTSPEC.md | It said PATCH was on the collection path. |
| The spec's CD list has the migration step and the `/index.html` invalidation | PROJECTSPEC.md | It did not match the deploy order in `architecture.md`. |
| Dashboard shows the soonest 10 upcoming interviews | PROJECTSPEC.md, PROJECTDESCRIPTION.md | Only `api.md` had the cap. |
| One line explaining that `status` and `outcome` are required on the record but defaulted by the API on create | PROJECTSPEC.md | The spec said "required" while `api.md` said "optional". Both are true at different layers, and now the spec says so. |

### Gaps filled

| Change | Files | Why |
| --- | --- | --- |
| The `/api/*` CloudFront behavior uses `CachingDisabled` and `AllViewerExceptHostHeader` | architecture.md | Django sends no `Cache-Control` header, so CloudFront could cache API responses. That includes the health check, which would then report success while the database is down. |
| `ALLOWED_HOSTS` holds the load balancer DNS name, not the CloudFront hostname | architecture.md | With that origin request policy, CloudFront does not forward the viewer's `Host`, so Django sees the load balancer's name. |
| DRF `NUM_PROXIES = 2` in production, 0 locally | architecture.md | Behind CloudFront and the load balancer, the throttle would otherwise key on the whole `X-Forwarded-For` header. A client could change that header to escape the rate limit. |
| Reasons recorded for NAT gateway, SSM Parameter Store, and SNS | architecture.md | The spec requires a reason for every added technology. Only Route 53 and gunicorn had one. |
| Separate 401 bodies for a missing token and an expired or invalid one | api.md | simplejwt returns a different body for an expired token than DRF does for a missing one. |
| `created_at` and `updated_at` added to the application JSON as read-only fields | api.md | `database.md` added the columns, but the API never returned them. |

### Paths and file lists

| Change | Files | Why |
| --- | --- | --- |
| References point to files inside `docs/` | PROJECTDESCRIPTION.md, frontend/RECAP.md | The spec and description moved into `docs/`. |
| The repository layout and the spec's Phase 1 and final goal lists name every file in `docs/` | architecture.md, PROJECTSPEC.md | They listed only the three original planning docs. |
| RECAP next steps 4 and 5 describe the `company_name` flow and the `types.ts` changes | frontend/RECAP.md | Step 4 described the removed two-request company flow, and step 5 said to keep `types.ts` unchanged. |
