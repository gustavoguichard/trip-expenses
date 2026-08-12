---
name: architecture-md
description: Keep the root architecture.md in sync with the product as it evolves. Use when finishing a feature or PR, when adding or changing a product surface, an end-to-end flow, the stored document schema, the sync protocol, a business-layer capability, or a cross-cutting pattern, or when the user mentions architecture.md, the architecture doc, or keeping docs up to date.
---

# Maintaining architecture.md

`architecture.md` (at the repository root) is the single high-level description of what the product is and how it works end to end. It is a **business + technical** document written at an executive/product altitude: it reads as prose for a product-literate reader, but every claim is grounded in real module and function names. It is the map newcomers and stakeholders use to understand the whole system.

Keeping it accurate is part of the Definition of Done. A stale architecture doc is worse than none — it teaches the wrong model of the system.

## The document is the source of truth for its own voice and shape

**Before editing, read `architecture.md` in full.** Do not reconstruct its structure from memory or from this skill. The doc itself is the canonical example of the voice, altitude, and section conventions to match. This skill tells you *when* and *how* to change it; the doc shows you *what good looks like*.

Its current shape (subject to change — always confirm against the file):

- **Runtime shape** — the Remix 3 app, its entries, middleware, and the route/controller/screen structure.
- **Data** — the localStorage document, its schema sketch, the business modules that own it.
- **Client layer** — the store glue (`bindDocument`/`mutateDocument`) and the screen inventory.
- **Sync over QR** — the codec, the invite payload, the merge, the invite/join screens.
- **Styling** — the Tailwind v4 setup and token system.
- **Tests & gates** — the Vitest suite and the lint/tsc/test gates.
- **Deployment** — the Vercel adapter and the plain-Node path.

## When a change needs a doc update (materiality)

Update `architecture.md` when a change is **architecturally material** — it changes the mental model of the system, not just its internals. Material changes include:

- Adding, removing, or renaming a **product surface** or route (a new screen under `apps/web/app/assets/`, a new entry in `app/routes.ts`).
- Adding a new **end-to-end flow**, or meaningfully changing an existing one (a new user journey).
- Changing the **stored document schema** — a new entity, a new field with behavioral weight, a version bump.
- Changing the **sync protocol** — the payload shape, the chunk codec, the merge semantics, the claim rules.
- Adding a new **business-layer capability** (a new `.common.ts` domain module, a new derived-data family).
- Changing the **styling system's structure** (new token families, a new utility layer — not individual token tweaks).
- Establishing a new **cross-cutting pattern** (a new use of tombstoning, a new document-context convention, a new gate).

Do **not** touch the doc for: bug fixes, copy/UI tweaks, refactors with no behavioral change, a single new optional field with no new behavior, test-only changes, or anything a stakeholder reading the doc would never notice. When unsure, ask: *would this change how a newcomer draws the system on a whiteboard?* If no, skip it.

## How to update it

1. **Read the whole doc first**, then locate the minimal set of sections the change touches.
2. **Prefer editing an existing section** over adding a new top-level one. Only add a new section when the change genuinely is a new flow or surface.
3. **Ground every claim in the real code.** Never guess a module name, function name, or behavior. Verify against the sources below.
4. **Match the voice and altitude.** Keep the dense, module-name-grounded prose the surrounding sections use.
5. **Propagate to the through-lines.** If the change affects the document schema sketch, the route inventory, or a pattern stated in another section, update those too — don't leave one section describing an older system than another.
6. **Re-read the changed sections** and check for now-stale references (a removed screen, a renamed function, a superseded pattern) elsewhere in the doc.

### Sources of truth to verify against

- `apps/web/app/routes.ts` — the product surfaces and their routes.
- `apps/web/app/actions/` — the controllers and which screen each route renders.
- `apps/web/app/business/*.common.ts` — the domain logic and behavior; `store.common.ts` for the document schema.
- `apps/web/app/assets/` — the client screens and the store glue (`store.ts`).
- `apps/web/app/framework/` — the local-store and sync-codec primitives.
- `apps/web/app/ui/styles.css` — the styling tokens and utilities.

## Style and altitude rules

- **Write in English prose.** The doc's audience is anyone technical or product-literate.
- **Business terms in narrative, concrete names in the details.** Describe *what and why* in domain language; ground it in the backing module and function names.
- **State architectural intent.** The doc's spine is its patterns — one versioned document per device, immutable mutations returning the next document, tombstones + `updatedAt` as the merge substrate, framework/business separation, server-renders-shells/client-owns-data. Frame new capabilities in terms of these when they apply.
- **Describe the system as-built, not its history.** No changelogs, no "previously…", no backwards-compatibility notes. Someone reading it should see today's system.
- **Stay lean and durable.** Name representative modules, not every one. Avoid volatile specifics that rot fast — exact test counts, line counts, or pixel values. Favor claims that stay true as the code grows.
- **Keep any ASCII sketches aligned.** If you edit the document-schema sketch, ensure it renders cleanly in monospace.

## Large or multi-domain updates

When many areas changed at once (e.g. after a big merge or a long gap), rebuild understanding before writing: fan out one exploration agent per domain to produce a grounded brief (business purpose, workflows, key modules, technical notes), then synthesize the doc from the briefs. This is how the doc is kept honest across large deltas — breadth of accurate input first, prose second.

## Examples

- *Added a recurring-expenses capability with its own screen and document entities* → material. Extend the Data and Client layer sections, add the flow, update the schema sketch.
- *Added an optional `note` field to expenses rendered in the detail view* → not material. No doc change.
- *Changed the QR chunk size or the merge conflict rule* → material. Update the Sync over QR section.
- *Refactored a balance computation for clarity, same results* → not material.
