import { NextResponse } from "next/server";
import { saveColumnSettings } from "@/lib/data";
import type { ColumnKey } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    settings?: Partial<Record<ColumnKey, boolean>>;
  };

  if (!body.settings) {
    return NextResponse.json(
      { ok: false, message: "settings is required" },
      { status: 400 },
    );
  }

  await saveColumnSettings(body.settings as Record<ColumnKey, boolean>);
  return NextResponse.json({ ok: true });
}
