# Kanji Spreadsheet

Excel-like web app for Vietnamese learners studying Japanese kanji and vocabulary.

The app uses English UI labels and supports Vietnamese learning content. Data is persisted in PostgreSQL through Docker.

## Stack

- Next.js App Router
- TypeScript
- Prisma 7
- PostgreSQL via Docker Compose
- Zod validation
- `@dnd-kit` drag/drop
- shadcn/ui components
- Vitest and Playwright

## Current UI Flow

- Use `Add` to open the JSON import modal.
- Paste real JSON into the modal. The app no longer pre-fills demo JSON.
- Click `Review` to validate and see a spreadsheet-style preview.
- Resolve duplicate kanji/vocabulary decisions if shown.
- After review, use the centered bottom `Import` button to persist data to PostgreSQL.
- Kanji level 1 details are shown in one merged-looking `Kanji Details` cell.
- The leftmost collapse column is narrow, the group column shows only a number, and reveal is an eye-only column.
- Groups are collapsed by default when the app first loads so the user can open only the group they want to study.
- Use `Collapse All` and `Expand All` to close or open every group in the current table.
- Vocabulary rows include a separate `Han Viet` column for the Sino-Vietnamese reading of each full word, for example `領土` -> `LĨNH THỔ`.
- Vocabulary rows can be dragged from the row area; there is no separate Actions column or drag-dot button.
- Group, kanji detail, and vocabulary cells include small up/down buttons for faster movement.
- Moving a kanji down past the final group creates a new group automatically; empty groups are deleted automatically.
- Kanji Details and Word cells include edit/delete buttons.
- Edit changes are saved only after `Save`; cancel keeps the old data.
- Vocabulary rows include a `Type` column. Valid types are `danh từ`, `tính từ i`, `tính từ na`, `tha động từ`, and `tự động từ`.
- Type pills are color-coded: nouns blue, adjectives yellow with light/dark variants, and verbs red with light/dark variants.
- Word edit covers word, type, reading, and meaning. Example text is not edited because it depends on furigana token data.
- Delete is available only for kanji or word and always shows a confirmation dialog with the level and item.
- The `Copy AI Prompt` text explicitly tells the AI to read PDFs/files carefully, keep kun readings in hiragana and on readings in katakana, reuse source examples when available, create N3-N2 examples when missing, and web-check meanings/readings/type with reliable Japanese dictionary sources before outputting JSON.
- The prompt also requires every example token containing kanji to include a hiragana `reading`, including non-target words.
- Reading Test and Writing Test keep separate saved answer states in the browser.
- Correct/wrong answers remain after reload, and the current mode has `Reset Wrong`, `Reset Correct`, and `Reset All`.
- Answer status uses background plus icons only: wrong answers show `X`, correct answers show a check, and the table border stays unchanged.
- Pressing Enter inside the answer input does not trigger row dragging, so wrong answers do not flash a drag outline or dim the kanji details cell.
- Demo seeding and test resets are disabled by default so the real local database is not deleted accidentally.

## Commands

The recommended entry point is:

```bash
make help
```

Help: show all available project commands and what each one does.

```bash
make setup
```

Help: install dependencies, start PostgreSQL, and apply Prisma migration.

```bash
make dev
```

Help: start the local development server at `http://127.0.0.1:3000`.

The raw commands are also listed below for clarity.

```bash
docker compose up -d postgres
```

Help: start the PostgreSQL database container.

```bash
npm install
```

Help: install dependencies and generate the Prisma client through `postinstall`.

```bash
npm run db:migrate -- --name init
```

Help: apply Prisma migrations to the local PostgreSQL database. Use a new name for future migrations, for example `npm run db:migrate -- --name add_vocabulary_type`.

```bash
make clear-data
```

Help: intentionally clear current database data when starting over. This deletes groups, kanji, vocabulary, attempts, and column settings.

```bash
make backfill-vocab-han-viet
```

Help: fill empty vocabulary `Han Viet` values from existing kanji `Han Viet` data. This is non-destructive and does not clear user data.

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Help: start the local development server at `http://127.0.0.1:3000`.

```bash
npm run lint
```

Help: run ESLint.

```bash
npm run test
```

Help: run Vitest unit/component tests. Database-reset integration tests are skipped unless `ALLOW_DATABASE_RESET=true` is set.

```bash
npx playwright install chromium
```

Help: download Chromium for Playwright if it has not been installed on the machine.

```bash
npm run test:e2e
```

Help: run Playwright end-to-end tests. These tests reset database data and are skipped unless `ALLOW_DATABASE_RESET=true` is set for disposable data.

```bash
npm run build
```

Help: run a production build and TypeScript checks.

## Notes For Future Agents

- Read `AGENTS_PLAN.md` and `kanji-excel-web-spec.md` before changing behavior.
- The database URL is configured in `.env` and mirrored in `.env.example`.
- `app/api/test/reset` is blocked by default and requires `ALLOW_DATABASE_RESET=true` plus the `x-kanji-reset-confirm: true` header.
- Prisma generated client output is `lib/generated/prisma` and is ignored; run `npm run prisma:generate` if it is missing.
