import { describe, expect, it } from "vitest";
import { checkAnswer, getPlainJapanese, hasTargetToken, mergeUniqueStrings } from "@/lib/study";

describe("study helpers", () => {
  it("checks exact answers after trimming surrounding whitespace", () => {
    expect(checkAnswer(" いど ", "いど")).toBe(true);
    expect(checkAnswer("イド", "いど")).toBe(false);
  });

  it("merges reading arrays without exact duplicates", () => {
    expect(mergeUniqueStrings(["い", "しょう"], ["い", "せい"])).toEqual([
      "い",
      "しょう",
      "せい",
    ]);
  });

  it("builds plain Japanese and detects target tokens", () => {
    const tokens = [
      { text: "井戸", reading: "いど", is_target: true },
      { text: "水", reading: "みず" },
      { text: "を" },
    ];

    expect(getPlainJapanese(tokens)).toBe("井戸水を");
    expect(hasTargetToken(tokens)).toBe(true);
  });
});
