# Phase 4 docs changes

This file lists changes to the docs made while connecting the React screens to the API on 2026-10-12. Each entry says what changed and why. The code already matches every entry. The running API agreed with `api.md` for every screen, so `api.md` and the schema are unchanged.

## architecture.md

| Change | Why |
| --- | --- |
| Repository layout shows `Phase4-Docs/` with `P4IMPLEMENTATIONMANUAL.md` and `P4DOCSCHANGES.md`, after the `Phase3-Docs/` line | Phase 4 adds this folder. The layout listed every other phase folder but not this one. |
| Repository layout also lists `P4-CHANGES.md` under `Phase4-Docs/` | The owner asked for a summary of the Phase 4 changes, with test steps, in that folder. The layout should list every file in it. |

## Phase4-Docs

| Change | Why |
| --- | --- |
| New `P4-CHANGES.md` | Records what Phase 4 changed in the code, a click-through test list keyed to the Definition of done, and behavior and limits to know before Phase 5. The owner asked for it. |
| `P4-CHANGES.md` "How to test" steps 2 and 3 rewritten, plus a new "If startup fails" table | The owner reported that the startup steps did not work. In a fresh shell, the bare `pg_isready` failed with `command not found`, because the Postgres.app tools are not on `PATH` by default. `python` exists only inside the virtualenv. The new steps start each terminal with `cd backend` or `cd frontend` from the repository root, use the full `pg_isready` path, add health-check URLs to confirm each process, and list the failures a reader may hit. A smoke test on 2026-10-12 got 200 from `/api/health/live/`, 201 from register, and 200 from the dashboard and list, all through the Vite proxy, so the code needed no change. |
