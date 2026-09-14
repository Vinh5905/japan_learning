import { NextResponse } from "next/server";
import { AnkiConnectError, ankiSync } from "@/lib/anki";

export const runtime = "nodejs";

export async function POST() {
  try {
    await ankiSync();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof AnkiConnectError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Anki sync failed.";

    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
