import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    kanjiId?: unknown;
    toGroupId?: unknown;
    sourceKanjiIds?: unknown;
    targetKanjiIds?: unknown;
  };

  if (typeof body.kanjiId !== "string" || typeof body.toGroupId !== "string") {
    return NextResponse.json(
      { ok: false, message: "kanjiId and toGroupId are required" },
      { status: 400 },
    );
  }

  const sourceKanjiIds = Array.isArray(body.sourceKanjiIds)
    ? body.sourceKanjiIds.map(String)
    : [];
  const targetKanjiIds = Array.isArray(body.targetKanjiIds)
    ? body.targetKanjiIds.map(String)
    : [body.kanjiId];

  await prisma.$transaction([
    ...sourceKanjiIds.map((id, index) =>
      prisma.kanjiItem.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
    ...targetKanjiIds.map((id, index) =>
      prisma.kanjiItem.update({
        where: { id },
        data: { groupId: body.toGroupId as string, sortOrder: index },
      }),
    ),
  ]);

  return NextResponse.json({ ok: true });
}
