import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json()) as { groupIds?: unknown };

  if (!Array.isArray(body.groupIds)) {
    return NextResponse.json(
      { ok: false, message: "groupIds must be an array" },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    body.groupIds.map((id, index) =>
      prisma.group.update({
        where: { id: String(id) },
        data: { sortOrder: index },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
