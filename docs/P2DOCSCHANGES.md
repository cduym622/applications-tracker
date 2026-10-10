# Phase 2 docs changes

This file lists changes to the docs made while building the Phase 2 API on 2026-10-10. Each entry says what changed and why. The code already matches every entry.

## api.md

| Change | Why |
| --- | --- |
| Note PATCH: `text` is required, and `updated_at` changes only when `text` differs from the stored text | api.md said `updated_at` always changes. P2IMPLEMENTATIONMANUAL.md and database.md say it changes when the text changes. A PATCH that sends the same text should not look like an edit. |
| Login: a missing field or a malformed email is a 400 field error | api.md covered only the 401 for a mismatch. A body that is not a valid login attempt is invalid input, the same as on every other endpoint. |
| Interview detail path: no `GET`. It returns 405 | The path listed only PATCH and DELETE but did not say what a `GET` does. The list already returns every interview. |
| Note detail path: no `GET` or `PUT`. Both return 405 | The same gap as interviews. The list returns every note, and PATCH is the only update. |

## database.md

| Change | Why |
| --- | --- |
| Relationships: Django carries out cascade and protect, and the PostgreSQL foreign keys have no `ON DELETE` action | The tables said "delete cascades", which reads as a database rule. Django 5.2 enforces `CASCADE` and `PROTECT` in the ORM. A raw SQL delete of a referenced row fails instead of cascading. The API behavior is unchanged. |

## architecture.md

| Change | Why |
| --- | --- |
| Repository layout names `P1DOCSCHANGES.md` and adds `P2DOCSCHANGES.md` | The Phase 1 changelog was renamed from `PHASE1DOCSCHANGES.md`, and this file is new. |

## PROJECTSPEC.md

| Change | Why |
| --- | --- |
| Phase 1 changelog path is `/docs/P1DOCSCHANGES.md` | The same rename. The old path pointed at a file that no longer exists. |

## Open question for a later phase

DRF throttles store their counts in Django's default cache, which lives in one process. Once production runs more than one ECS task, or more than one gunicorn worker, each process enforces its own 10 per minute limit. The real limit is then 10 times the number of processes. Phase 5 or 7 should either add a shared cache or record this in architecture.md's known tradeoffs. No doc was changed for this yet.
