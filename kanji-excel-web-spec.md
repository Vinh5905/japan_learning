# Kanji Excel-Like Web App Specification

## 1. Project Goal

Build a basic web app for studying kanji and vocabulary in an Excel-like table.

The app should feel like a clean black-and-white spreadsheet: clear grid lines, merged-looking cells, compact rows, and only minimal color for status such as correct answers, wrong answers, disabled/hidden content, or warnings.

The app is for Vietnamese learners of Japanese. However, all UI labels, table headers, buttons, and column names must be in English.

The main user workflow:

1. User pastes a JSON array into a textarea.
2. The app validates and imports the kanji/vocabulary data.
3. Each new kanji initially becomes its own group.
4. User can manually organize similar-looking kanji into groups via drag and drop.
5. User can study from the table.
6. User can enter test modes to hide columns and answer directly in the table.

## 2. Core Concepts

The table has three logical levels.

### Level 0: Group

A group is a numeric container for visually similar kanji.

Example:

```text
Group 1: 井, 升, 丼
Group 2: 日, 目, 田
```

Rules:

- A group can contain many kanji.
- A newly imported kanji should create a new group by default.
- Groups are numbered in display order.
- Users can drag a kanji block from one group into another group.
- Users can reorder groups.
- Groups can be collapsed.
- When collapsed, a group should only show its group number and the kanji inside that group.

Collapsed example:

```text
Group 1 | 井, 升, 丼
```

### Level 1: Kanji Block

A kanji block represents one main kanji.

It should visually behave like a merged Excel cell spanning all vocabulary rows inside it.

It contains:

- Kanji
- Han Viet
- Kanji meaning
- Kun readings
- On readings

Example:

```text
Kanji: 井
Han Viet: TINH
Meaning: cai gieng
Kun: い
On: ショウ
```

The display may use Vietnamese diacritics in content, for example `TỈNH` and `cái giếng`, but UI labels must remain English.

### Level 2: Vocabulary Row

Each vocabulary row belongs to exactly one kanji block.

It contains:

- Word
- Reading
- Meaning
- Example
- Answer cell used in test modes
- Row actions

Example:

```text
Word: 井戸
Reading: いど
Meaning: giếng nước
Example:
  井戸水を飲んだ
  井戸水[いどみず]を飲[の]んだ
  Tôi đã uống nước giếng
```

If a kanji has no vocabulary yet, the table should still show one empty vocabulary row so the kanji block remains visible and can be edited later.

## 3. Table Columns

All column headers must be English.

Recommended columns:

```text
Group
Kanji
Han Viet
Kanji Meaning
Kun
On
Word
Reading
Meaning
Example
Answer
Actions
```

Notes:

- `Group`, `Kanji`, `Han Viet`, `Kanji Meaning`, `Kun`, and `On` should visually appear merged across the vocabulary rows belonging to the same kanji/group.
- `Word`, `Reading`, `Meaning`, `Example`, `Answer`, and `Actions` are per vocabulary row.
- Each column should have a hide/show control.
- Hidden columns should be reversible.
- In test mode, hidden content should look temporarily disabled/blank rather than permanently removed.

## 4. Visual Style

The app should look like a polished Excel-style table.

Style requirements:

- Mostly black and white.
- Clear borders around cells.
- Compact table layout.
- Use subtle gray backgrounds for headers, collapsed rows, disabled/hidden cells, and hover states.
- Use green only for correct answers.
- Use red only for wrong answers or validation errors.
- Avoid colorful decorative UI.
- Avoid card-heavy marketing layout.
- The first screen should be the actual usable table/import interface, not a landing page.

Recommended interaction details:

- Wrong answer: red border or light red background, optionally a short shake animation.
- Correct answer: green tick icon and reveal the row content.
- Hidden test content: gray disabled-looking cell with no answer visible.
- Collapsed group: single row with group number and kanji list.
- Drag handles should be visible but minimal.

## 5. Import JSON Flow

Do not require importing a file.

The app should provide a textarea where the user can paste JSON directly.

Recommended UI:

```text
[Paste JSON here...]

[Validate JSON] [Import] [Copy AI Prompt]
```

Flow:

1. User pastes a JSON array into the textarea.
2. User clicks `Validate JSON`.
3. App parses JSON and validates the schema.
4. App shows an import preview:
   - New kanji
   - Duplicate kanji
   - New vocabulary
   - Duplicate vocabulary requiring comparison
   - Validation errors
5. User resolves duplicates if needed.
6. User clicks `Import`.
7. Data is added to the table/database.

## 6. JSON Schema

The imported JSON must be an array of kanji objects.

Recommended schema:

```json
[
  {
    "kanji": "井",
    "han_viet": "TỈNH",
    "meaning": "cái giếng",
    "kun": ["い"],
    "on": ["ショウ"],
    "vocabulary": [
      {
        "word": "井戸",
        "han_viet": "TỈNH HỘ",
        "type": "danh từ",
        "reading": "いど",
        "meaning": "giếng nước",
        "example": {
          "japanese": [
            { "text": "井戸", "reading": "いど", "is_target": true },
            { "text": "水", "reading": "みず" },
            { "text": "を" },
            { "text": "飲", "reading": "の" },
            { "text": "んだ" }
          ],
          "vietnamese": "Tôi đã uống nước giếng"
        }
      }
    ]
  }
]
```

Field meanings:

- `kanji`: main kanji for the level 1 block.
- `han_viet`: Vietnamese Sino-Vietnamese reading.
- `meaning`: Vietnamese meaning of the kanji.
- `kun`: array of kun readings.
- `on`: array of on readings.
- Kun readings should be written in hiragana; on readings should be written in katakana.
- `vocabulary`: array of vocabulary rows using this kanji.
- `word`: vocabulary word written in Japanese.
- `han_viet`: Sino-Vietnamese reading of the full vocabulary word, uppercase and space-separated by kanji, for example `領土` -> `LĨNH THỔ`.
- `type`: vocabulary type. Must be one of `danh từ`, `tính từ i`, `tính từ na`, `tha động từ`, or `tự động từ`.
- `reading`: reading/furigana answer for the vocabulary word.
- `meaning`: Vietnamese meaning of the vocabulary word.
- `example.japanese`: tokenized Japanese example sentence.
- `example.japanese[].text`: visible Japanese text.
- `example.japanese[].reading`: optional furigana reading for this token.
- Every token containing kanji should include a hiragana `reading`, including non-target words.
- `example.japanese[].is_target`: marks the vocabulary word inside the example.
- `example.vietnamese`: Vietnamese translation of the example.

Validation rules:

- The top-level value must be an array.
- Each kanji item must have `kanji`.
- `han_viet`, `meaning`, `kun`, `on`, and `vocabulary` may be empty but should exist.
- `kun` and `on` must be arrays.
- `kun` readings should use hiragana, and `on` readings should use katakana.
- `vocabulary` must be an array.
- Each vocabulary item should have `word`, `han_viet`, `type`, `reading`, `meaning`, and `example`.
- `example.japanese` should be an array of token objects.
- Every `example.japanese` token containing kanji should include a hiragana `reading`, including non-target kanji words.
- At least one token in `example.japanese` should have `is_target: true` when possible.
- The app should show clear validation errors with item indexes.

## 7. Furigana Rendering

Furigana should render as small text above the kanji using HTML ruby.

Data:

```json
[
  { "text": "井戸水", "reading": "いどみず", "is_target": true },
  { "text": "を" },
  { "text": "飲", "reading": "の" },
  { "text": "んだ" }
]
```

Rendered HTML concept:

```html
<ruby class="target-word">井戸水<rt>いどみず</rt></ruby>を<ruby>飲<rt>の</rt></ruby>んだ
```

The example cell should show three lines:

1. Full kanji sentence.
2. Furigana-rendered sentence.
3. Vietnamese translation.

Target vocabulary highlight:

- In the full kanji sentence, the target word must be bold, italic, and underlined.
- In the furigana sentence, the same target token should also be visually highlighted.

Example visual intent:

```text
<bold><italic><underline>井戸水</underline></italic></bold>を飲んだ
井戸水(with furigana) を 飲(with furigana) んだ
Tôi đã uống nước giếng
```

## 8. Duplicate Handling During Import

Duplicate handling is important and should not be skipped.

### New Kanji

If imported `kanji` does not already exist:

- Create a new group.
- Add the kanji block into that group.
- Add all vocabulary rows.

### Existing Kanji

If imported `kanji` already exists:

- Do not automatically overwrite.
- Show a comparison for level 1 fields:
  - Han Viet
  - Kanji meaning
  - Kun
  - On
- Let the user choose:
  - `Keep Old`
  - `Use New`
  - `Merge`

Suggested merge behavior:

- For `han_viet` and `meaning`, prefer explicit user choice if old and new differ.
- For `kun` and `on`, merge arrays and remove exact duplicates.

### New Vocabulary

Within an existing kanji block:

- If imported vocabulary `word` does not exist yet, add it directly.

### Duplicate Vocabulary

If imported vocabulary has the same `word` as an existing row under the same kanji block:

- Treat it as a duplicate requiring diff, even if the reading is different.
- Show an old-vs-new comparison similar to GitHub diff.
- Compare:
  - Word
  - Reading
  - Meaning
  - Example Japanese tokens
  - Example Vietnamese translation
- Let the user choose:
  - `Keep Old`
  - `Use New`
  - `Keep Both`

Important:

- Same `word` but different `reading` is still a duplicate requiring comparison.
- `Keep Both` must be allowed because the same written word may have different readings, meanings, examples, or usage contexts.

## 9. Drag And Drop Rules

Required drag/drop:

1. Reorder groups.
2. Move a kanji block from one group to another.
3. Reorder vocabulary rows inside the same kanji block.

Restrictions:

- Vocabulary rows must not be dragged from one kanji block to another.
- A vocabulary row can only move within its own level 1 kanji block.

Recommended behavior:

- Show a drag handle for groups.
- Show a drag handle for kanji blocks.
- Show a drag handle for vocabulary rows.
- When dragging a kanji block over another group, highlight the target group.
- After dropping, update group order and kanji order.
- Group numbers should be recalculated or displayed based on current group order.

## 10. Group Collapse Behavior

Each group should have a collapse/expand control.
On initial page load, all groups should be collapsed by default.
The table should include controls to collapse all groups and expand all groups.

Expanded group:

```text
Group 1
  Kanji 井
    井戸
    天井
  Kanji 丼
    牛丼
```

Collapsed group:

```text
Group 1 | 井, 丼
```

When collapsed:

- Hide all vocabulary rows.
- Hide detailed kanji information.
- Show only group number and all kanji inside the group.
- Drag/drop of the whole group should still be possible.

## 11. Column Visibility

Every column should have a hide/show toggle.

Possible UI:

```text
Columns: [Group] [Kanji] [Han Viet] [Kanji Meaning] [Kun] [On] [Word] [Reading] [Meaning] [Example] [Answer] [Actions]
```

Rules:

- User can hide or show each column.
- Column visibility should persist if storage is available.
- Test modes may temporarily override visibility.
- After leaving test mode, restore the user's original column visibility settings.

## 12. Study/Test Modes

The app should have normal mode plus two test modes.

Suggested mode selector:

```text
Mode: [Study] [Reading Test] [Writing Test]
```

### Study Mode

Default mode.

Shows all visible columns according to user column settings.

No answer checking required.

### Reading Test

Purpose:

The user sees the vocabulary word and must type the reading/furigana for that word.

Example:

```text
Word: 井戸
Answer expected: いど
```

Reading Test visibility:

- Show `Word`.
- Hide or disable `Reading`.
- Hide or disable `Meaning`.
- Hide or disable `Example`.
- Show `Answer`.
- Keep enough group/kanji context visible to make the table understandable.

Answer checking:

- Compare user input against the vocabulary row's `reading`.
- Trim surrounding whitespace.
- Exact match is acceptable for MVP.
- If correct:
  - Show green tick.
  - Reveal the full row content.
- If wrong:
  - Mark answer cell red.
  - Optionally shake the cell briefly.
- If user edits or clears the answer after a wrong answer:
  - Reset the row to neutral state.
- Provide a row action button:
  - `Reveal Row`
  - Reveals full row content even if user does not know the answer.

### Writing Test

Purpose:

The user sees only the vocabulary meaning and must type the full Japanese word.

Example:

```text
Meaning: giếng nước
Answer expected: 井戸
```

Writing Test visibility:

- Show `Meaning`.
- Hide or disable `Word`.
- Hide or disable `Reading`.
- Hide or disable `Example`.
- Show `Answer`.
- Do not show reading in this mode.

Answer checking:

- Compare user input against the vocabulary row's `word`.
- Trim surrounding whitespace.
- Exact match is acceptable for MVP.
- If correct:
  - Show green tick.
  - Reveal the full row content.
- If wrong:
  - Mark answer cell red.
  - Optionally shake the cell briefly.
- If user edits or clears the answer after a wrong answer:
  - Reset the row to neutral state.
- Provide `Reveal Row` for each row.

## 13. Data Persistence

The app should be designed so it can use a database.

For a quick MVP, localStorage or IndexedDB is acceptable if the app is frontend-only.

For a full app, use a real database.

Recommended conceptual tables:

```text
groups
kanji_items
vocabulary_items
user_column_settings
review_attempts
```

### groups

```text
id
order
created_at
updated_at
```

### kanji_items

```text
id
group_id
order
kanji
han_viet
meaning
kun_json
on_json
created_at
updated_at
```

### vocabulary_items

```text
id
kanji_item_id
order
word
han_viet
type
reading
meaning
example_japanese_json
example_vietnamese
created_at
updated_at
```

### user_column_settings

```text
id
column_key
is_visible
updated_at
```

### review_attempts

This can be added after MVP if needed.

```text
id
vocabulary_item_id
mode
answer
is_correct
created_at
```

## 14. AI Prompt Feature

The app should include a `Copy AI Prompt` button near the JSON textarea.

The prompt helps the user ask another AI tool to generate valid JSON.

Prompt text:

```text
Create a valid JSON array for the kanji/vocabulary list I provide.

Use this exact schema:
[
  {
    "kanji": "",
    "han_viet": "",
    "meaning": "",
    "kun": [],
    "on": [],
    "vocabulary": [
      {
        "word": "",
        "han_viet": "",
        "type": "danh từ",
        "reading": "",
        "meaning": "",
        "example": {
          "japanese": [
            { "text": "", "reading": "", "is_target": true }
          ],
          "vietnamese": ""
        }
      }
    ]
  }
]

Rules:
- Return only valid JSON. No markdown, no explanation.
- Each kanji object must contain vocabulary using that kanji.
- In example.japanese, split the sentence into tokens.
- Add "reading" only for tokens that need furigana.
- Mark the vocabulary word in the example with "is_target": true.
- Vietnamese meanings should be natural and concise.
- UI labels are not needed in the JSON.
```

## 15. Recommended MVP Scope

Implement first:

- Excel-like black-and-white table.
- English UI labels and column headers.
- JSON textarea import.
- JSON validation.
- Auto-create one group for each new kanji.
- Existing kanji duplicate handling.
- Duplicate vocabulary diff handling.
- Group collapse/expand.
- Drag/drop:
  - reorder groups
  - move kanji between groups
  - reorder vocabulary inside the same kanji
- Column hide/show controls.
- Study mode.
- Reading Test mode.
- Writing Test mode.
- Ruby furigana rendering.
- Bold/italic/underline target word in examples.
- Basic persistence with localStorage/IndexedDB or database.

Post-MVP:

- Spaced repetition.
- Review history.
- Search/filter.
- Tags.
- Bulk edit.
- Export JSON.
- More flexible answer matching.
- User accounts.
- Cloud sync.

## 16. Acceptance Criteria

The implementation is acceptable when:

- User can paste valid JSON into a textarea and import it.
- Imported kanji appear in an Excel-like table.
- Each new kanji creates a separate group by default.
- User can drag kanji into another group.
- User can collapse a group and see only the group number plus kanji list.
- User can reorder vocabulary rows only inside the same kanji block.
- User cannot drag vocabulary rows into another kanji block.
- User can hide/show columns.
- All UI labels and column names are English.
- Reading Test hides reading/meaning/example and checks the vocabulary reading.
- Writing Test shows only meaning and checks the full Japanese word.
- Correct answers show green success state and reveal the row.
- Wrong answers show red error state and reset when edited.
- `Reveal Row` works for each row in test modes.
- Furigana renders above kanji using ruby.
- Target vocabulary inside the full kanji example is bold, italic, and underlined.
- Duplicate kanji and duplicate vocabulary are not silently overwritten.
