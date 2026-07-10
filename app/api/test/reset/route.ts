import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (
    process.env.ALLOW_DATABASE_RESET !== "true" ||
    request.headers.get("x-kanji-reset-confirm") !== "true"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Database reset is disabled. Set ALLOW_DATABASE_RESET=true and send x-kanji-reset-confirm: true only for disposable test data.",
      },
      { status: 403 },
    );
  }

  await prisma.reviewAttempt.deleteMany();
  await prisma.vocabularyItem.deleteMany();
  await prisma.kanjiItem.deleteMany();
  await prisma.group.deleteMany();
  await prisma.userColumnSetting.deleteMany();

  return NextResponse.json({ ok: true });
}
