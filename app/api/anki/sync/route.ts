import { NextResponse } from "next/server";
import { AnkiConnectError, ankiSync } from "@/lib/anki";

export const runtime = "nodejs";

// Trigger an AnkiWeb sync so saved cards are pushed to the user's account.
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
