import { NextResponse } from "next/server";
import { getTableData } from "@/lib/data";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getTableData());
}
