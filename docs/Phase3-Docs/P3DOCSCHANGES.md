# Phase 3 docs changes

This file lists changes to the docs made while building the Phase 3 test suite on 2026-10-11. Each entry says what changed and why. The code and tests already match every entry. No application code changed in Phase 3.

## api.md

| Change | Why |
| --- | --- |
| The expired-token example body has `message` set to `Token is expired`, not `Token is invalid or expired`. A new sentence says a malformed or badly signed token has the same body with `Token is invalid` | `test_auth.py` failed against the old example. djangorestframework-simplejwt 5.5.1, the pinned version, raises `Token is expired` for an expired token and `Token is invalid` for a bad one. The old text came from an older simplejwt release. The status, `detail`, and `code` were already correct. The client treats every 401 the same, so only the doc was wrong. |

## architecture.md

| Change | Why |
| --- | --- |
| Repository layout shows `Phase1-Docs/`, `Phase2-Docs/`, and `Phase3-Docs/` with their files | Commit 7653d47 moved the phase docs into per-phase folders. The layout still listed them at the top of `docs/`. |
| `tracker` description mentions the test suite in `tracker/tests/` | Phase 3 adds it. |

## PROJECTSPEC.md

| Change | Why |
| --- | --- |
| Phase 1 changelog path is `/docs/Phase1-Docs/P1DOCSCHANGES.md` | The same move. The old path pointed at a file that no longer exists. |

## backend/README.md

This file is outside `docs/`. It is listed here because P3IMPLEMENTATIONMANUAL.md asks for these edits.

| Change | Why |
| --- | --- |
| New "Run the tests" section, plus `pytest` in Useful commands | The manual's Definition of done asks for `pg_isready -h localhost`, loading `.env`, plain `pytest` from `backend/`, and a pointer to the manual. |
| The "no tests" sentence is removed from "Not in this phase" | Phase 3 adds the tests. |
| The P2 manual link is `../docs/Phase2-Docs/P2IMPLEMENTATIONMANUAL.md` | The same move. The old link was broken. |
| A fallback full path to `pg_isready` when the Postgres.app tools are not on `PATH` | Step 3 makes the `PATH` change optional, and without it the manual's first command is not found. |
