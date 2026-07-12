import { describe, expect, it } from "vitest";
import { ANKI_FIELDS, buildAnkiFields } from "@/lib/anki";

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
