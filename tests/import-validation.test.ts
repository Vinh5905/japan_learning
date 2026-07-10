import { describe, expect, it } from "vitest";
import { parseImportJson } from "@/lib/import-validation";

describe("parseImportJson", () => {
  it("rejects invalid JSON", () => {
    const result = parseImportJson("{");

    expect(result.ok).toBe(false);
    expect(result.errors[0].path).toBe("$");
    expect(result.errors[0].message).toContain("Invalid JSON");
  });

  it("rejects a non-array top-level value", () => {
    const result = parseImportJson('{"kanji":"井"}');

    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toContain("array");
  });

  it("reports indexed schema errors", () => {
    const result = parseImportJson(
      JSON.stringify([
        {
          kanji: "",
          han_viet: "",
          meaning: "",
          kun: "い",
          on: [],
          vocabulary: [
            {
              word: "",
              han_viet: "",
              type: "danh từ",
              reading: "",
              meaning: "",
              example: {
                japanese: [{ reading: "い" }],
                vietnamese: "",
              },
            },
          ],
        },
      ]),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "$[0].kanji",
        "$[0].kun",
        "$[0].vocabulary[0].word",
        "$[0].vocabulary[0].reading",
        "$[0].vocabulary[0].example.japanese[0].text",
      ]),
    );
  });

  it("accepts a valid kanji import payload", () => {
    const result = parseImportJson(
      JSON.stringify([
        {
          kanji: "井",
          han_viet: "TỈNH",
          meaning: "cái giếng",
          kun: ["い"],
          on: ["ショウ"],
          vocabulary: [
            {
              word: "井戸",
              han_viet: "TỈNH HỘ",
              type: "danh từ",
              reading: "いど",
              meaning: "giếng nước",
              example: {
                japanese: [{ text: "井戸", reading: "いど", is_target: true }],
                vietnamese: "giếng nước",
              },
            },
          ],
        },
      ]),
    );

    expect(result.ok).toBe(true);
    expect(result.items[0].kanji).toBe("井");
    expect(result.items[0].vocabulary[0].type).toBe("danh từ");
  });

  it("rejects vocabulary types outside the five allowed values", () => {
    const result = parseImportJson(
      JSON.stringify([
        {
          kanji: "冷",
          han_viet: "LÃNH",
          meaning: "lạnh",
          kun: ["つめたい"],
          on: ["レイ"],
          vocabulary: [
            {
              word: "冷える",
              han_viet: "LÃNH",
              type: "động từ",
              reading: "ひえる",
              meaning: "trở nên lạnh",
              example: {
                japanese: [{ text: "冷える", reading: "ひえる", is_target: true }],
                vietnamese: "Trời trở lạnh.",
              },
            },
          ],
        },
      ]),
    );

    expect(result.ok).toBe(false);
    expect(result.errors[0].path).toBe("$[0].vocabulary[0].type");
    expect(result.errors[0].message).toContain("type must be one of");
  });
});
