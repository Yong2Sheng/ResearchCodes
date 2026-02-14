# ResearchCodes

ResearchCodes is a personal research code vault. Everything lives under `Projects/` as self contained project folders (example data, Python modules, notebooks, notes). The goal is to make it easy to clone anywhere, reproduce the environment, and reuse code later.

## Quick start

### 1) Clone

```bash
git clone git@github.com:Yong2Sheng/ResearchCodes.git
cd ResearchCodes
```

### 2) Create the conda environment from `environment.yml`

Create a fresh environment:

```bash
conda env create -f environment.yml
conda activate researchcodes
```
Notes:
- `environment.yml` is the source of truth for dependencies.
- If you add a new import in any project module, update `environment.yml` accordingly.
- Prefer keeping the environment reproducible on a clean machine, because CI will validate it.

During developing, you can update an existing environment to match `environment.yml` (and remove packages no longer listed):

```bash
conda env update -f environment.yml --prune
conda activate researchcode
```

### 3) Install pre-push checks (optional but recommended for pushing changes)

This repo is configured to run checks on `git push` (not on every commit).

```bash
pre-commit install -f
```

Manually run the same checks that would run on push:

```bash
pre-commit run --all-files --hook-stage pre-push
```

### 4) Run smoke tests locally

Smoke tests are intentionally lightweight. They mainly validate that key modules can be imported in the current environment.

```bash
pytest -q -m smoke -x -ra
```

To see what smoke tests would be collected:

```bash
pytest -m smoke --collect-only
```

## Repository layout

- `Projects/`
  - Each subfolder is an independent project workspace.
  - Typical contents: `*.py`, notebooks, configs, small example data.
- `tests/`
  - Smoke tests (import checks and minimal sanity checks).
- `environment.yml`
  - Conda environment specification (primary dependency source of truth).
- `pyproject.toml`
  - Pytest configuration (markers, test discovery).
- `.pre-commit-config.yaml`
  - Pre-push hooks (lint, hygiene checks, smoke test).
- `.github/workflows/ci.yml`
  - CI runs pre-commit (full repo) and smoke tests on a clean environment.

## CI on GitHub

GitHub Actions runs on push and pull requests:
- A `pre-commit` job that runs repository hooks against the full repository.
- A `smoke` job that builds the conda environment from `environment.yml` and runs `pytest -m smoke`.

CI is useful because it runs in a clean environment. If something imports locally only because your machine already had an extra dependency installed, CI will catch it.

## Important notes and conventions

### Auto-fix hooks are restricted

Some hooks can automatically edit files (for example trimming trailing whitespace). This repo restricts auto-fix hooks to code and configuration file extensions to prevent accidental edits to scientific data files.

### Large data

Avoid committing large raw datasets into git. Prefer small example inputs that are sufficient to reproduce a workflow, and store large data elsewhere.
