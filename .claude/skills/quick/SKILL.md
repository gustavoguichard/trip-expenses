---
name: quick
description: Run a small fix or polish to an existing surface under a reduced quick-iteration Definition of Done — no subagents, no mobile pass, no self-improvement pass. Use when the user invokes /quick, or select it yourself whenever the task is a small fix or polish to an existing surface — a copy tweak, a styling adjustment, a one-file bug fix — and none of the qualification criteria in the skill disqualify it.
---

# Quick

A small fix should cost minutes, not half an hour. This mode trades the full Definition of Done for a reduced one that still protects correctness: the gates that catch real breakage stay, the rituals that only pay off on large or risky changes go.

## Selecting this mode

This mode applies when the user invokes `/quick`, or when you classify the task as qualifying under the criteria below. When you self-select it, say so in one line before starting — the user should always know which Definition of Done is in effect. When in doubt about qualification, run under the full Definition of Done.

If the work outgrows the qualification criteria mid-task, stop, tell the user what it grew into, and continue under the full Definition of Done in `CLAUDE.md`. Discovering that a "small fix" needs a document-schema change is not a reason to press on quietly.

## Qualification criteria

Qualifies: a small fix or polish to an existing surface.

Any one of these disqualifies:

- a new route
- a change to the stored document schema (`documentSchema` in `app/business/store.common.ts`)
- a change to the sync protocol or merge semantics
- a new product surface
- an architecturally material change

A disqualified task runs under the full Definition of Done, even when the user invoked `/quick`. Say so before starting.

## Workflow

- Work inline: no subagents, no charters, no ledger. You are the one reading, building, and testing.
- Load only the skills the change itself needs — `design-system` for UI work, `local-data` for document or mutation work, and nothing else on spec.
- Work directly in the checkout. When a dev server is needed for verification, start it on a non-default port (`PORT=<n> pnpm --filter @trip-expenses/web run dev`) — port 3000 belongs to the human.

## Quick Definition of Done

When quick mode applies and the task qualifies, this list replaces the one in `CLAUDE.md`.

1. `pnpm run lint` and `pnpm run tsc` are green. Run only the unit test files the change affects — the pre-push hook and CI run the full suites.
2. Bug fixes still follow red/green: a failing test first, then the minimal fix. No mutation proof, and no double `test:unit` reconciliation run.
3. Verify the changed flow end to end with `agent-browser` and take a screenshot.
4. One code-review pass over the committed diff, with the fixes applied. A single pass, not a loop.
5. Commit on `main` in small increments. The pre-push hook stays the acceptance gate — fix any red before pushing.
6. Skipped entirely: the self-improvement pass and the `architecture.md` criterion. The qualification criteria guarantee neither can apply.
