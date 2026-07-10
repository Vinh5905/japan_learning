import { z } from "zod";
import { VOCABULARY_TYPES } from "@/lib/types";
import type { KanjiImportItem, ValidationErrorItem } from "@/lib/types";

export const exampleTokenSchema = z.object({
  text: z.string().min(1, "Token text is required"),
  reading: z.string().optional(),
  is_target: z.boolean().optional(),
});

export const vocabularyImportSchema = z.object({
  word: z.string().min(1, "Vocabulary word is required"),
  han_viet: z.string(),
  type: z.enum(VOCABULARY_TYPES, {
    error: "type must be one of: danh từ, tính từ i, tính từ na, tha động từ, tự động từ",
  }),
  reading: z.string().min(1, "Vocabulary reading is required"),
  meaning: z.string(),
  example: z.object({
    japanese: z.array(exampleTokenSchema, {
      error: "example.japanese must be an array",
    }),
    vietnamese: z.string(),
  }),
});

export const kanjiImportSchema = z.object({
  kanji: z.string().min(1, "Kanji is required"),
  han_viet: z.string(),
  meaning: z.string(),
  kun: z.array(z.string(), { error: "kun must be an array" }),
  on: z.array(z.string(), { error: "on must be an array" }),
  vocabulary: z.array(vocabularyImportSchema, {
    error: "vocabulary must be an array",
  }),
});

export const importArraySchema = z.array(kanjiImportSchema, {
  error: "Top-level JSON value must be an array",
});

export type ParseImportResult =
  | { ok: true; items: KanjiImportItem[]; errors: [] }
  | { ok: false; items: []; errors: ValidationErrorItem[] };

export function parseImportJson(raw: string): ParseImportResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      items: [],
      errors: [
        {
          path: "$",
          message:
            error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON",
        },
      ],
    };
  }

  const result = importArraySchema.safeParse(parsed);

  if (!result.success) {
    return {
      ok: false,
      items: [],
      errors: result.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message,
      })),
    };
  }

  return { ok: true, items: result.data, errors: [] };
}

function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return "$";
  }

  return path.reduce<string>((result, part) => {
    if (typeof part === "number") {
      return `${result}[${part}]`;
    }

    return `${result}.${String(part)}`;
  }, "$");
}
