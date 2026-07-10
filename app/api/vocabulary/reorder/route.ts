import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    kanjiItemId?: unknown;
    vocabularyIds?: unknown;
  };

  if (typeof body.kanjiItemId !== "string" || !Array.isArray(body.vocabularyIds)) {
    return NextResponse.json(
      { ok: false, message: "kanjiItemId and vocabularyIds are required" },
      { status: 400 },
    );
  }

  const vocabularyIds = body.vocabularyIds.map(String);
  const ownedRows = await prisma.vocabularyItem.count({
    where: {
      id: { in: vocabularyIds },
      kanjiItemId: body.kanjiItemId,
    },
  });

  if (ownedRows !== vocabularyIds.length) {
    return NextResponse.json(
      {
        ok: false,
        message: "Vocabulary rows can only be reordered inside their own kanji block",
      },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    vocabularyIds.map((id, index) =>
      prisma.vocabularyItem.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
