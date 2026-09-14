import { LearningApp } from "@/components/LearningApp";
import { getTableData } from "@/lib/data";
import { getStandaloneVocabularyData } from "@/lib/vocab-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [initialKanjiData, initialVocabularyData] = await Promise.all([
    getTableData(),
    getStandaloneVocabularyData(),
  ]);

  return (
    <LearningApp
      initialKanjiData={initialKanjiData}
      initialVocabularyData={initialVocabularyData}
    />
  );
}
