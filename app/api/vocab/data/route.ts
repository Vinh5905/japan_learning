import { NextResponse } from "next/server";
import { getStandaloneVocabularyData } from "@/lib/vocab-data";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getStandaloneVocabularyData());
}
