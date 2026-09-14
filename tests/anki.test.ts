import { describe, expect, it } from "vitest";
import {
  ANKI_FIELDS,
  VOCABULARY_ANKI_FIELDS,
  buildAnkiFields,
  buildStandaloneVocabularyAnkiFields,
} from "@/lib/anki";

describe("buildAnkiFields", () => {
  it("stores the vocabulary word as the main Anki prompt", () => {
    const fields = buildAnkiFields({
      kanji: "領",
      word: "領土",
      hanViet: "LĨNH THỔ",
      type: "danh từ",
      reading: "りょうど",
      meaning: "lãnh thổ",
      exampleJapanese: [
        { text: "国", reading: "くに" },
        { text: "の" },
        { text: "領土", reading: "りょうど", is_target: true },
        { text: "を" },
        { text: "守", reading: "まも" },
        { text: "る" },
      ],
      exampleVietnamese: "Bảo vệ lãnh thổ của đất nước.",
    });

    expect(fields[ANKI_FIELDS.Kanji]).toBe("領土");
    expect(fields[ANKI_FIELDS.Hiragana]).toBe("りょうど");
    expect(fields[ANKI_FIELDS["Chinese character"]]).toBe("LĨNH THỔ");
    expect(fields[ANKI_FIELDS.Meaning]).toBe("lãnh thổ");
  });
});

describe("buildStandaloneVocabularyAnkiFields", () => {
  it("stores word and hiragana on the standalone vocabulary front fields", () => {
    const fields = buildStandaloneVocabularyAnkiFields({
      word: "領土",
      hanViet: "LĨNH THỔ",
      type: "danh từ",
      reading: "りょうど",
      meaning: "lãnh thổ",
      examples: [
        {
          japanese: [
            { text: "国", reading: "くに" },
            { text: "の" },
            { text: "領土", reading: "りょうど", is_target: true },
            { text: "を" },
            { text: "守", reading: "まも" },
            { text: "る" },
          ],
          vietnamese: "Bảo vệ lãnh thổ của đất nước.",
        },
        {
          japanese: [{ text: "領土", reading: "りょうど", is_target: true }],
          vietnamese: "Lãnh thổ.",
        },
      ],
    });

    expect(fields[VOCABULARY_ANKI_FIELDS.Word]).toBe("領土");
    expect(fields[VOCABULARY_ANKI_FIELDS.Hiragana]).toBe("りょうど");
    expect(fields[VOCABULARY_ANKI_FIELDS["Chinese character"]]).toBe("LĨNH THỔ");
    expect(fields[VOCABULARY_ANKI_FIELDS["Example 1"]]).toContain("領土");
    expect(fields[VOCABULARY_ANKI_FIELDS["Meaning 2"]]).toBe("Lãnh thổ.");
    expect(fields[VOCABULARY_ANKI_FIELDS["Example 3"]]).toBe("");
  });
});
