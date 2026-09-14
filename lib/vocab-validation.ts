import { z } from "zod";
import { exampleTokenSchema } from "@/lib/import-validation";
import { VOCABULARY_TYPES } from "@/lib/types";
import type {
  StandaloneVocabularyImportPayload,
  ValidationErrorItem,
} from "@/lib/types";

const vocabularyExampleSchema = z.object({
  japanese: z.array(exampleTokenSchema, {
    error: "examples[].japanese must be an array",
  }),
  vietnamese: z.string(),
});

export const standaloneVocabularyImportItemSchema = z.object({
  word: z.string().min(1, "Vocabulary word is required"),
  han_viet: z.string(),
  type: z.enum(VOCABULARY_TYPES, {
    error: "type must be one of: danh từ, tính từ i, tính từ na, tha động từ, tự động từ",
  }),
  reading: z.string().min(1, "Vocabulary reading is required"),
  meaning: z.string(),
  examples: z
    .array(vocabularyExampleSchema, {
      error: "examples must be an array",
    })
    .min(1, "At least one example is required")
    .max(3, "Use at most three examples"),
});

const standaloneVocabularyPayloadSchema = z.object({
  group_name: z.string().optional(),
  vocabulary: z
    .array(standaloneVocabularyImportItemSchema, {
      error: "vocabulary must be an array",
    })
    .min(1, "At least one vocabulary item is required"),
});

const standaloneVocabularyArraySchema = z
  .array(standaloneVocabularyImportItemSchema, {
    error: "Top-level JSON value must be an object with vocabulary[] or an array",
  })
  .min(1, "At least one vocabulary item is required");

export type ParseStandaloneVocabularyImportResult =
  | { ok: true; payload: StandaloneVocabularyImportPayload; errors: [] }
  | { ok: false; payload: null; errors: ValidationErrorItem[] };

export function parseStandaloneVocabularyImportJson(
  raw: string,
): ParseStandaloneVocabularyImportResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      payload: null,
      errors: [
        {
          path: "$",
          message:
            error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON",
        },
      ],
    };
  }

  const objectResult = standaloneVocabularyPayloadSchema.safeParse(parsed);

  if (objectResult.success) {
    return { ok: true, payload: objectResult.data, errors: [] };
  }

  const arrayResult = standaloneVocabularyArraySchema.safeParse(parsed);

  if (arrayResult.success) {
    return {
      ok: true,
      payload: { vocabulary: arrayResult.data },
      errors: [],
    };
  }

  const issues =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? objectResult.error.issues
      : arrayResult.error.issues;

  return {
    ok: false,
    payload: null,
    errors: issues.map((issue) => ({
      path: formatPath(issue.path),
      message: issue.message,
    })),
  };
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
