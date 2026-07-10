import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    vocabularyItemId?: unknown;
    mode?: unknown;
    answer?: unknown;
    isCorrect?: unknown;
  };

  if (
    typeof body.vocabularyItemId !== "string" ||
    (body.mode !== "reading" && body.mode !== "writing") ||
    typeof body.answer !== "string" ||
    typeof body.isCorrect !== "boolean"
  ) {
    return NextResponse.json(
      { ok: false, message: "Invalid review attempt payload" },
      { status: 400 },
    );
  }

  await prisma.reviewAttempt.create({
    data: {
      vocabularyItemId: body.vocabularyItemId,
      mode: body.mode,
      answer: body.answer,
      isCorrect: body.isCorrect,
    },
  });

  return NextResponse.json({ ok: true });
}
