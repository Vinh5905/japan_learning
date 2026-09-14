import { describe, expect, it } from "vitest";
import { parseStandaloneVocabularyImportJson } from "@/lib/vocab-validation";

describe("parseStandaloneVocabularyImportJson", () => {
  it("rejects invalid JSON", () => {
    const result = parseStandaloneVocabularyImportJson("{");

    expect(result.ok).toBe(false);
    expect(result.errors[0].path).toBe("$");
    expect(result.errors[0].message).toContain("Invalid JSON");
  });

  it("accepts an object payload with one vocabulary group", () => {
    const result = parseStandaloneVocabularyImportJson(
      JSON.stringify({
        group_name: "Lesson 12",
        vocabulary: [
          {
            word: "領土",
            han_viet: "LĨNH THỔ",
            type: "danh từ",
            reading: "りょうど",
            meaning: "lãnh thổ",
            examples: [
              {
                japanese: [
                  { text: "領土", reading: "りょうど", is_target: true },
                ],
                vietnamese: "Lãnh thổ.",
              },
            ],
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.payload.group_name).toBe("Lesson 12");
    expect(result.payload.vocabulary[0].examples).toHaveLength(1);
  });

  it("accepts a top-level array and wraps it into one group", () => {
    const result = parseStandaloneVocabularyImportJson(
      JSON.stringify([
        {
          word: "冷やす",
          han_viet: "LÃNH",
          type: "tha động từ",
          reading: "ひやす",
          meaning: "làm lạnh",
          examples: [
            {
              japanese: [{ text: "冷やす", reading: "ひやす", is_target: true }],
              vietnamese: "Làm lạnh.",
            },
          ],
        },
      ]),
    );

    expect(result.ok).toBe(true);
    expect(result.payload.vocabulary[0].word).toBe("冷やす");
  });

  it("rejects more than three examples and invalid vocabulary type", () => {
    const result = parseStandaloneVocabularyImportJson(
      JSON.stringify({
        vocabulary: [
          {
            word: "冷える",
            han_viet: "LÃNH",
            type: "động từ",
            reading: "ひえる",
            meaning: "trở nên lạnh",
            examples: [
              { japanese: [{ text: "冷える" }], vietnamese: "1" },
              { japanese: [{ text: "冷える" }], vietnamese: "2" },
              { japanese: [{ text: "冷える" }], vietnamese: "3" },
              { japanese: [{ text: "冷える" }], vietnamese: "4" },
            ],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "$.vocabulary[0].type",
        "$.vocabulary[0].examples",
      ]),
    );
  });
});
