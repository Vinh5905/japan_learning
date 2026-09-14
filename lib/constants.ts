import type { ColumnKey } from "@/lib/types";

export const COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: "collapse", label: "Collapse" },
  { key: "group", label: "Group" },
  { key: "kanjiDetails", label: "Kanji Details" },
  { key: "word", label: "Word" },
  { key: "wordHanViet", label: "Han Viet" },
  { key: "type", label: "Type" },
  { key: "reading", label: "Reading" },
  { key: "meaning", label: "Meaning" },
  { key: "example", label: "Example" },
  { key: "answer", label: "Answer" },
  { key: "reveal", label: "Reveal" },
];

export const DEFAULT_COLUMN_SETTINGS = COLUMNS.reduce(
  (settings, column) => {
    settings[column.key] = true;
    return settings;
  },
  {} as Record<ColumnKey, boolean>,
);

export const AI_PROMPT = `Create a valid JSON array for the kanji/vocabulary list I provide.

Task:
- Read the user's source carefully. The source may be plain text, a copied list, a PDF, an image, a spreadsheet, or another file.
- Extract the kanji and all vocabulary that use each kanji.
- For kanji readings, write kun readings in hiragana and on readings in katakana.
- If the source already contains example sentences, use those examples when they are correct and natural.
- If the source does not contain examples, create natural Japanese example sentences yourself.
- Before finalizing meanings, readings, and vocabulary type, search the web in parallel and verify with reliable Japanese dictionary/learning sources.
- Use web checks to distinguish close synonyms and context-specific meanings. Do not guess.

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

Allowed vocabulary type values:
- "danh từ"
- "tính từ i"
- "tính từ na"
- "tha động từ"
- "tự động từ"

Rules:
- Return only valid JSON. No markdown, no explanation.
- Each kanji object must contain vocabulary using that kanji.
- In each kanji object, "kun" must contain hiragana readings only and "on" must contain katakana readings only.
- Every vocabulary item must contain "han_viet": the Sino-Vietnamese reading of the full vocabulary word, written in uppercase Vietnamese with spaces between kanji readings, e.g. "領土" -> "LĨNH THỔ".
- If the word contains kana mixed with kanji, write the Hán Việt only for the kanji portion in order.
- Every vocabulary item must contain exactly one "type" value from the allowed list.
- Use "danh từ" for nouns, including time words and place/entity names.
- Use "tính từ i" for i-adjectives ending in い when used as adjectives.
- Use "tính từ na" for na-adjectives and adjectival nouns.
- Use "tha động từ" for transitive verbs that take a direct object.
- Use "tự động từ" for intransitive verbs that describe the subject's own action/state.
- If a word can belong to more than one type, choose the type that matches the meaning/example you output and verify it with web sources.
- Readings must be kana only, not romaji.
- Vietnamese meanings should be natural, concise, and precise. If a word differs from a close synonym, include the distinguishing nuance in Vietnamese.
- Example sentences should be around JLPT N3-N2 difficulty: long enough to show real usage, but not overly complex.
- Example sentences must be natural Japanese and must match the selected meaning/type.
- In example.japanese, split the sentence into tokens.
- Every token in example.japanese that contains kanji must include a "reading" field in hiragana, even when it is not the target vocabulary.
- Do not omit furigana readings for non-target kanji words. Only pure kana, punctuation, and particles without kanji may omit "reading".
- The "reading" value must match the visible token text, including conjugated forms when the token text is conjugated.
- Mark the vocabulary word in the example with "is_target": true.
- Use the exact vocabulary word as the target token when possible.
- example.vietnamese must translate the full Japanese sentence naturally.
- UI labels are not needed in the JSON.

Few-shot example 1:
Input vocabulary: 井戸
Output item:
{
  "word": "井戸",
  "han_viet": "TỈNH HỘ",
  "type": "danh từ",
  "reading": "いど",
  "meaning": "giếng nước; nơi lấy nước ngầm bằng cách đào sâu xuống đất",
  "example": {
    "japanese": [
      { "text": "昔", "reading": "むかし" },
      { "text": "は" },
      { "text": "村", "reading": "むら" },
      { "text": "の" },
      { "text": "人", "reading": "ひと" },
      { "text": "たち" },
      { "text": "が" },
      { "text": "井戸", "reading": "いど", "is_target": true },
      { "text": "の" },
      { "text": "水", "reading": "みず" },
      { "text": "を" },
      { "text": "生活", "reading": "せいかつ" },
      { "text": "に" },
      { "text": "使", "reading": "つか" },
      { "text": "っていた" }
    ],
    "vietnamese": "Ngày xưa, người trong làng dùng nước giếng cho sinh hoạt."
  }
}

Few-shot example 2:
Input vocabulary: 冷える
Output item:
{
  "word": "冷える",
  "han_viet": "LÃNH",
  "type": "tự động từ",
  "reading": "ひえる",
  "meaning": "trở nên lạnh, nguội đi; tự chuyển sang trạng thái lạnh",
  "example": {
    "japanese": [
      { "text": "夜", "reading": "よる" },
      { "text": "になると" },
      { "text": "急", "reading": "きゅう" },
      { "text": "に" },
      { "text": "空気", "reading": "くうき" },
      { "text": "が" },
      { "text": "冷える", "reading": "ひえる", "is_target": true },
      { "text": "ので" },
      { "text": "上着", "reading": "うわぎ" },
      { "text": "を" },
      { "text": "持", "reading": "も" },
      { "text": "っていった" }
    ],
    "vietnamese": "Vì về đêm không khí trở lạnh nhanh, tôi đã mang theo áo khoác."
  }
}

Few-shot example 3:
Input vocabulary: 冷やす
Output item:
{
  "word": "冷やす",
  "han_viet": "LÃNH",
  "type": "tha động từ",
  "reading": "ひやす",
  "meaning": "làm lạnh, ướp lạnh; chủ thể tác động để vật gì đó lạnh đi",
  "example": {
    "japanese": [
      { "text": "運動", "reading": "うんどう" },
      { "text": "の" },
      { "text": "後", "reading": "あと" },
      { "text": "で" },
      { "text": "痛", "reading": "いた" },
      { "text": "めた" },
      { "text": "足", "reading": "あし" },
      { "text": "を" },
      { "text": "氷", "reading": "こおり" },
      { "text": "で" },
      { "text": "冷やす", "reading": "ひやす", "is_target": true },
      { "text": "ことにした" }
    ],
    "vietnamese": "Sau khi vận động, tôi quyết định chườm đá làm lạnh chân bị đau."
  }
}`;

export const VOCABULARY_AI_PROMPT = `Create valid JSON for a standalone Japanese vocabulary lesson group.

Task:
- Read the user's source carefully. The source may be plain text, a copied list, a PDF, an image, a spreadsheet, or another file.
- Extract every vocabulary word the user provided or every vocabulary item found in the source.
- Put all extracted words into one vocabulary group. Do not split them into multiple groups.
- If the source has a lesson/group name, use it as "group_name"; otherwise omit "group_name" and the app will create "New group", "New group 1", etc.
- Before finalizing readings, meanings, Hán Việt, examples, and type, search the web in parallel and verify with reliable Japanese dictionary/learning sources.
- Use web checks to distinguish close synonyms and context-specific meanings. Do not guess.

Use this exact schema:
{
  "group_name": "",
  "vocabulary": [
    {
      "word": "",
      "han_viet": "",
      "type": "danh từ",
      "reading": "",
      "meaning": "",
      "examples": [
        {
          "japanese": [
            { "text": "", "reading": "", "is_target": true }
          ],
          "vietnamese": ""
        }
      ]
    }
  ]
}

Allowed vocabulary type values:
- "danh từ"
- "tính từ i"
- "tính từ na"
- "tha động từ"
- "tự động từ"

Rules:
- Return only valid JSON. No markdown, no explanation.
- Output one object with one "vocabulary" array. Do not output multiple groups.
- Every vocabulary item must contain "han_viet": the Sino-Vietnamese reading of the full vocabulary word, written in uppercase Vietnamese with spaces between kanji readings, e.g. "領土" -> "LĨNH THỔ".
- If the word contains kana mixed with kanji, write the Hán Việt only for the kanji portion in order.
- Every vocabulary item must contain exactly one "type" value from the allowed list.
- Use "danh từ" for nouns, including time words and place/entity names.
- Use "tính từ i" for i-adjectives ending in い when used as adjectives.
- Use "tính từ na" for na-adjectives and adjectival nouns.
- Use "tha động từ" for transitive verbs that take a direct object.
- Use "tự động từ" for intransitive verbs that describe the subject's own action/state.
- If a word can belong to more than one type, choose the type that matches the meaning/examples you output and verify it with web sources.
- Readings must be kana only, not romaji.
- For standalone vocabulary cards, "reading" should be hiragana for the full word.
- Vietnamese meanings should be natural, concise, and precise. If a word differs from a close synonym, include the distinguishing nuance in Vietnamese.
- Each vocabulary item must have 2 or 3 examples when possible. Use 1 example only when the source is too limited.
- If the source already contains example sentences, use those examples when they are correct and natural.
- If the source does not contain examples, create natural Japanese example sentences yourself.
- Example sentences should be around JLPT N3-N2 difficulty: long enough to show real usage, but not overly complex.
- Example sentences must be natural Japanese and must match the selected meaning/type.
- In examples[].japanese, split the sentence into tokens.
- Every token in examples[].japanese that contains kanji must include a "reading" field in hiragana, even when it is not the target vocabulary.
- Do not omit furigana readings for non-target kanji words. Only pure kana, punctuation, and particles without kanji may omit "reading".
- The "reading" value must match the visible token text, including conjugated forms when the token text is conjugated.
- Mark the vocabulary word in each example with "is_target": true.
- Use the exact vocabulary word as the target token when possible.
- examples[].vietnamese must translate the full Japanese sentence naturally.
- UI labels are not needed in the JSON.

Few-shot example 1:
Input vocabulary: 領土
Output item:
{
  "word": "領土",
  "han_viet": "LĨNH THỔ",
  "type": "danh từ",
  "reading": "りょうど",
  "meaning": "lãnh thổ; vùng đất thuộc quyền kiểm soát của một quốc gia hoặc thế lực",
  "examples": [
    {
      "japanese": [
        { "text": "政府", "reading": "せいふ" },
        { "text": "は" },
        { "text": "国", "reading": "くに" },
        { "text": "の" },
        { "text": "領土", "reading": "りょうど", "is_target": true },
        { "text": "を" },
        { "text": "守", "reading": "まも" },
        { "text": "る" },
        { "text": "責任", "reading": "せきにん" },
        { "text": "がある" }
      ],
      "vietnamese": "Chính phủ có trách nhiệm bảo vệ lãnh thổ của đất nước."
    },
    {
      "japanese": [
        { "text": "その" },
        { "text": "島", "reading": "しま" },
        { "text": "は" },
        { "text": "昔", "reading": "むかし" },
        { "text": "から" },
        { "text": "重要", "reading": "じゅうよう" },
        { "text": "な" },
        { "text": "領土", "reading": "りょうど", "is_target": true },
        { "text": "とされてきた" }
      ],
      "vietnamese": "Hòn đảo đó từ xưa đã được xem là một lãnh thổ quan trọng."
    }
  ]
}

Few-shot example 2:
Input vocabulary: 冷やす
Output item:
{
  "word": "冷やす",
  "han_viet": "LÃNH",
  "type": "tha động từ",
  "reading": "ひやす",
  "meaning": "làm lạnh, ướp lạnh; chủ thể tác động để vật gì đó lạnh đi",
  "examples": [
    {
      "japanese": [
        { "text": "運動", "reading": "うんどう" },
        { "text": "の" },
        { "text": "後", "reading": "あと" },
        { "text": "で" },
        { "text": "痛", "reading": "いた" },
        { "text": "めた" },
        { "text": "足", "reading": "あし" },
        { "text": "を" },
        { "text": "氷", "reading": "こおり" },
        { "text": "で" },
        { "text": "冷やす", "reading": "ひやす", "is_target": true },
        { "text": "ことにした" }
      ],
      "vietnamese": "Sau khi vận động, tôi quyết định chườm đá làm lạnh chân bị đau."
    }
  ]
}`;
