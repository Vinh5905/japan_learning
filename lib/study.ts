import type { ExampleToken } from "@/lib/types";

export function checkAnswer(input: string, expected: string) {
  return input.trim() === expected;
}

export function getPlainJapanese(tokens: ExampleToken[]) {
  return tokens.map((token) => token.text).join("");
}

export function hasTargetToken(tokens: ExampleToken[]) {
  return tokens.some((token) => token.is_target);
}

export function mergeUniqueStrings(oldValues: string[], newValues: string[]) {
  return Array.from(new Set([...oldValues, ...newValues].filter(Boolean)));
}
