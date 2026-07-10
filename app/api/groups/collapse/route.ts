import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    groupId?: unknown;
    isCollapsed?: unknown;
  };

  if (typeof body.groupId !== "string" || typeof body.isCollapsed !== "boolean") {
    return NextResponse.json(
      { ok: false, message: "groupId and isCollapsed are required" },
      { status: 400 },
    );
  }

  await prisma.group.update({
    where: { id: body.groupId },
    data: { isCollapsed: body.isCollapsed },
  });

  return NextResponse.json({ ok: true });
}
