# Kanji Excel-Like Web App Implementation Plan

## Current Context

- Repository currently starts from `kanji-excel-web-spec.md`.
- The app must be implemented as a full MVP, not a partial foundation.
- Use PostgreSQL through Docker Compose for persistence.
- Treat the local PostgreSQL database as real user storage. Do not seed demos, call reset routes, or run destructive DB tests unless the user explicitly asks and the command has an explicit confirmation flag/env.
- UI labels, table headers, buttons, and column names must be English.
- Kanji/vocabulary content may contain Vietnamese text and diacritics.

## Chosen Stack

- Next.js with App Router
- TypeScript
- Prisma ORM
- PostgreSQL via Docker Compose
- Zod for JSON/schema validation
- `@dnd-kit` for drag/drop
- Lucide React for simple UI icons
- Vitest + Testing Library for unit/component tests
- Playwright for end-to-end browser tests

## Required MVP Scope

Implement all items below before considering the MVP complete:

- Excel-like black-and-white table with compact rows and clear grid borders.
- JSON textarea import flow in the Add modal with `Review`, `Copy AI Prompt`, and a bottom `Import` action after review.
- Strict validation of imported JSON with clear index-based errors.
- Import preview that separates new kanji, duplicate kanji, new vocabulary, and duplicate vocabulary.
- Duplicate kanji decisions: `Keep Old`, `Use New`, `Merge`.
- Duplicate vocabulary decisions: `Keep Old`, `Use New`, `Keep Both`.
- No silent overwrites for duplicate kanji or duplicate vocabulary.
- Each new imported kanji creates a separate group by default.
- Group collapse/expand.
- On initial page load, display all groups collapsed by default.
- Provide `Collapse All` and `Expand All` controls for all groups.
- Drag/drop support:
  - reorder groups
  - move kanji blocks between groups
  - reorder vocabulary rows only inside the same kanji block
- Prevent dragging vocabulary rows into a different kanji block.
- Column visibility toggles for every table column.
- Vocabulary rows include a `Type` column after `Word`.
- Vocabulary rows include a `Han Viet` column for the full word, e.g. `領土` -> `LĨNH THỔ`.
- Valid vocabulary type values are exactly `danh từ`, `tính từ i`, `tính từ na`, `tha động từ`, and `tự động từ`.
- Type pills should be visually color-coded: `danh từ` blue, `tính từ i` light yellow, `tính từ na` darker yellow, `tha động từ` light red, and `tự động từ` darker red.
- Study mode.
- Reading Test mode.
- Writing Test mode.
- Answer checking with green correct state, red wrong state, reset on edit, and row reveal.
- Reading and Writing answer states must be separated and persisted in browser storage.
- Test modes need reset controls for wrong answers, correct answers, and all answers in the active mode.
- Wrong and correct answer states should not change the row/cell border; keep the default grid border and communicate status with background plus icon.
- Wrong answers show an `X` icon and correct answers show a check icon.
- Answer inputs must stop pointer/key events from bubbling into row drag/drop listeners, otherwise pressing Enter can briefly trigger the dragging outline/opacity state.
- HTML ruby furigana rendering.
- Target vocabulary highlighted as bold, italic, and underlined in the full kanji sentence.

## Active UI Revision Notes

The user requested a more polished spreadsheet design after the first MVP:

- Move JSON import out of the always-visible page area.
- The top `Kanji Spreadsheet` area should have an `Add` button.
- Clicking `Add` opens a modal with a dark transparent overlay.
- The modal contains the JSON textarea and actions.
- Add a `Review` action in the modal.
- `Review` validates the pasted JSON and shows a spreadsheet-like preview for the new JSON before import.
- Level 1 kanji data must be in one merged-looking cell, not split across separate columns.
- The Level 1 cell order must be:
  - Han Viet
  - Kanji
  - Kanji Meaning
  - Kun
  - On
- Remove the separate `Actions` column.
- Drag affordance should come from hovering the movable area, not a visually separate action column.
- Hovering a Level 1 kanji area should subtly tint the kanji block and its vocabulary rows so the user understands what will move.
- Hovering a vocabulary row should subtly tint that row across all row cells so the user understands what will move.
- `Reveal Row` should be an eye icon only.
- Answer cells should not include an explicit check/tick button; pressing Enter checks the answer.
- Text should be clearly centered/aligned.
- Horizontal overflow is acceptable for long tables.
- The Example column should omit the plain sentence line and show only:
  - furigana-rendered Japanese
  - Vietnamese translation
- Target underline must sit lower and not be too tight to the kanji glyph.
- Prefer shadcn/ui components for modal, buttons, textarea, select, badge, and similar controls.

Latest requested revisions:

- Remove demo-prefilled import data. The Add JSON textarea should start empty.
- Clear the existing database once so the user can start adding real data again.
- After that, do not delete user data automatically. Demo seeding and test reset paths must be opt-in only.
- `app/api/test/reset` must stay blocked by default and require `ALLOW_DATABASE_RESET=true` plus `x-kanji-reset-confirm: true`.
- DB integration/E2E tests that reset data must be skipped unless `ALLOW_DATABASE_RESET=true` is set for disposable data.
- Add a narrow leftmost collapse column for the collapse/expand button.
- Default first-load group state should be collapsed for all groups; the user opens only the group they want to study.
- Bulk group controls should include `Collapse All` and `Expand All`.
- The group column should be narrow and show only the group number, not the word `Group`.
- Remove the six-dot drag button from the group cell.
- Collapsed rows should have a clearly different background color.
- `Kanji Details` should emphasize Han Viet: larger, bold, and first in the cell.
- Do not clamp `Kanji Details`, `Word`, or vocabulary row heights with hard limits; let them expand with content.
- `Example` should be about twice as wide as normal content columns.
- Vocabulary content columns should align left where helpful.
- Reveal should be its own narrow column with an eye icon.
- The eye icon should toggle reveal on/off for the row.
- The Reveal table header should be blank.
- Group, Kanji Details, and vocabulary row cells should include compact up/down buttons.
- Up/down buttons should move at the correct level:
  - group buttons reorder groups
  - kanji buttons move/reorder kanji blocks across groups
  - vocabulary buttons reorder vocabulary only inside the same kanji block
- Moving a kanji down past the final group creates a new group automatically.
- Empty groups should be deleted automatically after kanji moves.
- Add edit/delete buttons only for Kanji Details and Word levels; do not add group deletion.
- Editing must require pressing `Save`; closing/canceling keeps old data.
- Kanji edit fields: kanji, Han Viet, meaning, Kun, On.
- Word edit fields: word, type, reading, meaning only. Do not edit example/furigana data in this flow.
- Delete must show an explicit confirmation dialog with:
  - level (`Kanji Details` or `Word`)
  - item text (`井`, `井戸`, etc.)
  - for kanji, a warning that all words inside it will be deleted
- In the Add JSON modal:
  - make the title larger and bold
  - remove the top `Import` action
  - before review, show only `Review` and `Copy AI Prompt`
  - after review, show a centered bottom `Import` button
- Duplicate sections should have visually distinct outer and inner containers.
- Duplicate decisions should visually communicate kept/discarded columns:
  - `Keep Old`: old column green, new column red
  - `Use New`: old column red, new column green
  - `Keep Both`: both columns green
  - `Merge`: non-conflicting/merged outcome should avoid looking destructive
- `Copy AI Prompt` must tell the AI to:
  - read PDFs/files/text sources carefully
  - extract kanji and vocabulary from the supplied source
  - require kun readings to be written in hiragana and on readings to be written in katakana
  - require every example token containing kanji to include a hiragana `reading`, not only the target vocabulary
  - reuse source examples when available and natural
  - create N3-N2 Japanese examples when examples are missing
  - search the web in parallel to verify readings, meanings, close-synonym nuance, and the vocabulary type
  - return only JSON matching the import schema

## Data Model

Use Prisma models equivalent to these conceptual tables:

- `groups`
  - `id`
  - `order`
  - `isCollapsed`
  - `createdAt`
  - `updatedAt`
- `kanji_items`
  - `id`
  - `groupId`
  - `order`
  - `kanji`
  - `hanViet`
  - `meaning`
  - `kun`
  - `on`
  - `createdAt`
  - `updatedAt`
- `vocabulary_items`
  - `id`
  - `kanjiItemId`
  - `order`
  - `word`
  - `hanViet`
  - `type`
  - `reading`
  - `meaning`
  - `exampleJapanese`
  - `exampleVietnamese`
  - `createdAt`
  - `updatedAt`

Current vocabulary Han Viet behavior:

- `VocabularyItem.hanViet` maps to database column `vocabulary_items.han_viet`.
- Migration `20260710000100_add_vocabulary_han_viet` adds this column with a non-null empty-string default.
- `scripts/backfill-vocabulary-han-viet.mjs` fills empty vocabulary `han_viet` values from existing kanji Hán Việt readings plus a fallback map for kanji that appear only inside vocabulary words.
- Use `npm run db:backfill-vocab-han-viet -- --dry-run` before writing, then `npm run db:backfill-vocab-han-viet` to fill empty values. This script does not clear or delete user data.
- `user_column_settings`
  - `id`
  - `columnKey`
  - `isVisible`
  - `updatedAt`
- `review_attempts`
  - `id`
  - `vocabularyItemId`
  - `mode`
  - `answer`
  - `isCorrect`
  - `createdAt`

For MVP without user accounts, column settings may be global.

## Implementation Order

1. Scaffold Next.js app in the repository root.
2. Install dependencies.
3. Add Docker Compose for PostgreSQL.
4. Add Prisma schema and environment examples.
5. Create initial migration.
6. Implement data access helpers and API routes.
7. Implement JSON validation and duplicate preview logic.
8. Implement import commit logic with duplicate decisions.
9. Build the spreadsheet UI and import panel.
10. Add group collapse/expand behavior.
11. Add drag/drop behavior with persisted ordering.
12. Add column visibility controls.
13. Add study, reading test, and writing test modes.
14. Add furigana rendering.
15. Add tests.
16. Run lint, unit tests, and E2E tests; fix failures.

## Commands And Help

```bash
npm create next-app@latest . -- --typescript --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

Help: scaffold a new Next.js TypeScript app in the current directory.

```bash
npm install @prisma/client prisma zod @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities lucide-react
```

Help: install runtime dependencies for database access, validation, drag/drop, and icons.

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom playwright
```

Help: install unit/component and browser E2E test tooling.

```bash
docker compose up -d postgres
```

Help: start the PostgreSQL container in the background.

```bash
npx prisma migrate dev --name init
```

Help: create and apply the initial database migration.

```bash
npm run dev
```

Help: start the local development server.

```bash
npm run lint
npm run test
npm run test:e2e
```

Help: run static checks and tests. DB-reset integration/E2E tests are skipped unless `ALLOW_DATABASE_RESET=true` is set for disposable data.

```bash
npm run db:clear -- --confirm-clear
```

Help: intentionally clear all app data from the configured PostgreSQL database when the user explicitly asks to start over.

## Test Plan

Unit tests:

- JSON validation rejects malformed top-level values and wrong field types.
- JSON validation rejects vocabulary `type` values outside the five allowed values.
- Validation reports item indexes for kanji and vocabulary errors.
- Duplicate detection identifies existing kanji.
- Duplicate vocabulary is detected by same `word` under the same kanji, even if `reading` differs.
- Kanji merge combines `kun` and `on` arrays without exact duplicates.
- Answer checking trims surrounding whitespace and uses exact matching.
- Furigana helpers render ruby tokens and target highlighting.

Integration tests:

- Importing new kanji creates one group per kanji.
- Importing duplicate kanji requires explicit decisions.
- Import commit applies `Keep Old`, `Use New`, `Merge`, and `Keep Both` correctly.
- Reordering groups persists after reload.
- Moving kanji between groups persists after reload.
- Vocabulary reorder is limited to the same kanji block.
- Column settings persist and test mode restores prior user visibility on exit.

E2E tests:

- Paste valid JSON, validate, import, and see rows in the table.
- Collapse and expand a group.
- Move a kanji block into another group.
- Reorder vocabulary rows within one kanji block.
- Confirm vocabulary cannot be moved into another kanji block.
- Reading Test correct/wrong/reveal row flows.
- Writing Test correct/wrong/reveal row flows.
- Ruby furigana and target word styling are visible.

## Important Constraints

- Do not use a landing page. The first screen must be the usable app.
- Avoid decorative colors and card-heavy layout.
- Use subtle gray, black, and white for the table UI.
- Use green only for correct answers.
- Use red only for wrong answers or validation errors.
- Wrong/correct answer cells should not change border thickness/color; use background and status icons only.
- Correct answers should show a tick icon; wrong answers should show an X icon.
- Use Docker/Postgres as the source of persistence.
- Do not skip duplicate handling.
- Do not silently overwrite duplicate data.
