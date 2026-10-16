# Phase 6 docs changes

This file lists changes to the docs made while adding the GitHub Actions CI workflow on 2026-10-16. Each entry says what changed and why. The code already matches every entry. `api.md`, `database.md`, and the schema are unchanged.

Phase 6 added `.github/workflows/ci.yml`, `backend/requirements-dev.txt`, `backend/ruff.toml`, `frontend/eslint.config.js`, `frontend/.prettierrc.json`, and `frontend/.prettierignore`. It added ESLint, Prettier, and their plugins as frontend devDependencies, with `lint`, `format`, and `format:check` scripts. Ruff and Prettier reformatted a few backend and frontend files, with no change in behavior.

## architecture.md

| Change | Why |
| --- | --- |
| Repository layout lists `requirements-dev.txt`, `ruff.toml`, `eslint.config.js`, `.prettierrc.json`, `Phase6-Docs/`, and `ci.yml` | Phase 6 adds them. The layout listed `.github/workflows/` as "CI, then CD" with no file. |
| New "Development tools" section names Ruff, ESLint with its plugins, Prettier, and `eslint-config-prettier`, each with its reason | The spec says to record a reason in `/docs` before adding a technology. The CI section requires lint and formatting checks, and the repo had no tool for either. The section also says none of them reaches the API image or the frontend build. |
| CI and CD names the workflow file and describes its three jobs | The section said what CI does but not how. It now gives the runtime of each job, why the frontend image is not built, and why the CI database password and `SECRET_KEY` are not GitHub secrets. |
| CI and CD says a push to `main` runs the same jobs | The workflow runs on both triggers, and Phase 8's deploy steps will follow those jobs on `main`. |

## README.md

This file is outside `docs/`. It is listed here because it describes how to run the project.

| Change | Why |
| --- | --- |
| Phase 6 marked done | Phase 6 adds the CI workflow. |
| "Production design" says Phases 7 through 9 build it | It said Phases 5 through 9. Phases 5 and 6 are done and deploy nothing. |
| Repository section lists `.github/workflows/ci.yml`, `backend/ruff.toml`, and `Phase6-Docs/` | Phase 6 adds them. |
| New "Continuous integration" section with the three jobs and the commands to run the same checks locally | A reader of the README should know a pull request is checked and how to pass the check before pushing. |

## Phase6-Docs

| Change | Why |
| --- | --- |
| New `P6-INFO.md` | Records what Phase 6 built, how to run each check locally, the CI environment values and why they are not secrets, why each choice was made, the checks that ran, troubleshooting, and limits to know before Phase 7. It follows the layout of `P5-INFO.md`. |

## backend/README.md

| Change | Why |
| --- | --- |
| Step 2 says to install `requirements-dev.txt` for Ruff, and where a new check-only tool belongs | Ruff is not in `requirements.txt`, so the old install step does not provide it. Keeping check-only tools in the dev file keeps them out of the API image. |
| New step 7, "Lint and format", with the Ruff commands and settings | CI runs these checks. A developer needs the same commands to fix a failure. |
| Useful commands gains the Ruff check line | It is the one command that matches CI's backend lint steps. |
| Layout lists `requirements-dev.txt` and `ruff.toml` | Phase 6 adds them. |
| "Not in this phase" drops lint and CI, and adds the Phase 8 deploy | Phase 6 adds lint and CI. Deploy from GitHub Actions is still to come. |

## frontend/README.md

| Change | Why |
| --- | --- |
| Requirements say Node 20.19 or later, and that CI and Docker use Node 22 | ESLint 10 needs Node 20.19 or later. Node 20.0 through 20.18 can still run Vite but cannot run `npm run lint`. |
| New "Lint and format" section with the three scripts and the settings | CI runs these checks. The section says warnings fail the lint step, which ESLint does not do by default. |
