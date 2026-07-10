import { KanjiApp } from "@/components/KanjiApp";
import { getTableData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialData = await getTableData();

  return <KanjiApp initialData={initialData} />;
}
