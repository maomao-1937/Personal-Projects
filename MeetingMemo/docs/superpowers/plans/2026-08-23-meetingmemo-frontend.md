# MeetingMemo Frontend Implementation Plan

> Execute with strict red-green-refactor cycles. The existing FastAPI service is the contract and source of truth.

**Goal:** Build the closed-beta MeetingMemo product UI through invite access, transcript import, AI job monitoring, structured summary review/edit/approval, and export.

**Architecture:** A Next.js App Router client shell talks to FastAPI only through a typed centralized API module. The page owns remote loading state; domain helpers remain pure and tested. Desktop renders a three-pane notebook, while tablet/mobile collapse secondary panes into accessible drawers and tabs.

**Tech Stack:** Next.js, React, TypeScript strict, Tailwind CSS v4, Lucide React, Vitest, React Testing Library, Playwright.

---

## Task 1: Scaffold and smoke contract

**Files:** `frontend/package.json`, `frontend/app/*`, `frontend/vitest.config.ts`, `frontend/tests/smoke.test.tsx`

1. Scaffold the App Router project and testing dependencies.
2. Write a smoke test expecting the MeetingMemo product name and access boundary.
3. Run it and verify failure because the product shell does not exist.
4. Add the minimum root layout/page and make the test pass.
5. Run lint, typecheck, and test.

## Task 2: Typed API and access gate

**Files:** `frontend/lib/types/api.ts`, `frontend/lib/api/client.ts`, `frontend/components/access-gate.tsx`, related tests

1. Test normalized backend error handling, session detection, and invite submission.
2. Verify each test fails for the missing behavior.
3. Implement the typed fetch layer and access gate.
4. Cover invalid/expired/exhausted invite errors and pending button state.
5. Verify focused and full tests.

## Task 3: Meetings and transcript import

**Files:** `frontend/components/meeting-sidebar.tsx`, `frontend/components/new-meeting-panel.tsx`, domain helpers and tests

1. Test empty state, meeting selection, create payload, pasted transcript, supported file labels, and disabled audio/video state.
2. Verify expected failures.
3. Implement the sidebar and creation panel with the real create/transcript endpoints.
4. Ensure error recovery keeps user-entered transcript.
5. Verify focused and full tests.

## Task 4: Processing lifecycle

**Files:** `frontend/hooks/use-processing-job.ts`, status component and tests

1. Test queued/processing/complete/failed states and terminal polling stop.
2. Verify failure.
3. Implement polling with visibility handling and retry.
4. Refresh meeting and summaries when complete.
5. Verify tests with fake timers and real domain behavior.

## Task 5: Three-pane summary workspace

**Files:** workspace, transcript, summary and insight components plus tests

1. Test rendering topics, decisions, actions, owners, due dates, quality flags, and empty sections.
2. Test source marker activation and transcript focus.
3. Verify failures.
4. Implement the semantic three-pane workspace.
5. Add small AI/status badges and Granola-aligned tokens.
6. Verify tests.

## Task 6: Editing, versions, approval and export

**Files:** summary editor, toolbar, export helpers and tests

1. Test edit/cancel, payload preservation, add/remove items, version conflict, approval, and export links.
2. Verify failure.
3. Implement controlled structured editing and real API calls.
4. Preserve local edits on conflict and announce results accessibly.
5. Verify focused and full tests.

## Task 7: Responsive and accessible interaction

**Files:** shell styles, drawer/tab components and tests

1. Test accessible names, dialog semantics, Escape behavior, and mobile tabs.
2. Verify failures.
3. Implement desktop three-pane, tablet insight drawer, and mobile navigation/insight drawers.
4. Add focus visibility and reduced motion behavior.
5. Verify component tests.

## Task 8: Browser and release verification

**Files:** `frontend/e2e/meetingmemo.spec.ts`, config, stage verification notes

1. Add deterministic API route interception for browser UI states.
2. Verify invite → import → processing → review → edit/export at desktop and mobile widths.
3. Run test, lint, typecheck, production build, and Playwright.
4. Start frontend with the actual backend and verify session/upload/error paths where local configuration permits.
5. Record commands and any external gates in the stage document.

