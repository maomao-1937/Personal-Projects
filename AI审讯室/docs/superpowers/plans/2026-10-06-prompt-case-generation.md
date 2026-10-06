# Prompt Case Generation Implementation Plan

> Execute in this session with subagent-driven-development: frontend worker owns frontend files, primary agent owns backend and documentation. Review the final diff and validate integration before completion. This checkout has no Git metadata, so no branch or commit operation is applicable.

**Goal:** Player idea → validated case direction → playable case, under the fixed player/tools/play-session product constraints.

**Architecture:** Extend the OpenAI-compatible provider with a short JSON intent call. CaseGenerationService validates that result and passes it to the existing generator; the snapshot persists and publishes only the direction. The cinematic landing composer passes prompt through the existing launch hook and API. No new endpoint or database migration.

**Tech Stack:** FastAPI, Pydantic, httpx, SQLite, Next.js, React, existing GSAP animation, pytest and Vitest.

## 1. Backend contracts and generation

- [x] Write failing tests for prompt trimming/bounds, two-stage generation, invalid intent failure, persisted public intent and prompt-injection separation.
- [x] Add `CaseIntent` to `backend/app/domain/case_intent.py`: strict bounded fields `scene`, `incident`, `suspectRole`, `atmosphere`, `preferences`, `adaptationNote`.
- [x] Add product cards and intent messages in `backend/app/llm/prompts.py`. Extend provider protocol and implementation with `analyze_case_json`, bounded timeout and JSON mode.
- [x] Add optional prompt to request; pass through `backend/app/api/v1.py`. Analyze once in `backend/app/services/case_generation.py`, reject invalid/unsafe intent before generation and persist server-owned metadata on `CaseSnapshot`.
- [x] Run `pytest -q --ignore=tests/test_database_backup.py` with local auth and LLM disabled for tests. Existing Windows backup file-lock failures remain outside this feature.

## 2. Frontend composer and navigation

- [x] Write failing tests for empty input, trimmed prompt payload, example selection, duplicate submits, preserved input on error and retry, callback/navigation, next-case returning home.
- [x] Read frontend AGENTS and installed Next.js forms/client-component docs; preserve backdrop and cinematic lifecycle.
- [x] Add prompt input with accessible label, examples, count, busy lock, inline recovery. Extend launch hook input and API timeout to cover a short analysis call plus generation.
- [x] Show persisted direction and adjustment note in briefing; keep technical product constraints out of player copy.
- [x] Route StartCaseButton to `/` and keep replay of existing case unchanged.
- [x] Run Vitest, typecheck and lint. Set `NODE_OPTIONS=--no-experimental-webstorage` for Vitest on this Node version so jsdom owns localStorage.

## 3. Integration verification

- [x] Start/restart local backend and frontend using existing `.env`, preserving credentials without displaying them.
- [x] Generate two distinctly requested cases with DeepSeek; verify intent, persisted direction and usable session. Verify at least one turn.
- [x] Browser absence is classified from available skills; use regular Playwright for local desktop/narrow-screen inspection under frontend-testing-debugging. Save evidence outside repository.
- [x] Verify input → submit → loading → briefing and recoverable failure states. Keep input homepage available for the user.
- [x] Update README with new workflow and exact verification results; final response links running app and summarizes limits.

