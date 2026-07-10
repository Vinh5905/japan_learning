import { NextResponse } from "next/server";
import { setAllGroupsCollapsed } from "@/lib/data";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    isCollapsed?: unknown;
  };

  if (typeof body.isCollapsed !== "boolean") {
    return NextResponse.json(
      { ok: false, message: "isCollapsed is required" },
      { status: 400 },
    );
  }

  const data = await setAllGroupsCollapsed(body.isCollapsed);

  return NextResponse.json({ ok: true, data });
}
