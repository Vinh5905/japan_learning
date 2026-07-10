import { NextResponse } from "next/server";
import { getTableData } from "@/lib/data";
import { buildImportPreview } from "@/lib/import-preview";
import { parseImportJson } from "@/lib/import-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { raw?: unknown };
  const raw = typeof body.raw === "string" ? body.raw : "";
  const parsed = parseImportJson(raw);

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  const data = await getTableData();
  return NextResponse.json({
    ok: true,
    preview: buildImportPreview(parsed.items, data),
  });
}
