"use client";

import { useState } from "react";
import { BookOpen, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanjiApp } from "@/components/KanjiApp";
import { VocabularyApp } from "@/components/VocabularyApp";
import type { StandaloneVocabularyData, TableData } from "@/lib/types";

type Area = "kanji" | "vocabulary";

export function LearningApp({
  initialKanjiData,
  initialVocabularyData,
}: {
  initialKanjiData: TableData;
  initialVocabularyData: StandaloneVocabularyData;
}) {
  const [area, setArea] = useState<Area>("kanji");

  return (
    <main className="app-shell">
      <section className="area-switcher" aria-label="Learning area">
        <div>
          <h1>Japanese Learning Spreadsheet</h1>
          <p>Choose the kanji table or the standalone vocabulary lesson table.</p>
        </div>
        <div className="area-tabs">
          <Button
            type="button"
            variant={area === "kanji" ? "default" : "outline"}
            onClick={() => setArea("kanji")}
          >
            <BookOpen size={16} />
            Kanji
          </Button>
          <Button
            type="button"
            variant={area === "vocabulary" ? "default" : "outline"}
            onClick={() => setArea("vocabulary")}
          >
            <Languages size={16} />
            Vocabulary
          </Button>
        </div>
      </section>
      {area === "kanji" ? (
        <KanjiApp initialData={initialKanjiData} isEmbedded />
      ) : (
        <VocabularyApp initialData={initialVocabularyData} />
      )}
    </main>
  );
}
