"use client";

import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type ExportCsvRow = {
  studentName: string;
  email: string;
  /** Значения ячеек журнала по порядку колонок (проценты тестов и/или текстовые статусы заданий). */
  scores: Array<number | null | string>;
  averageScore: number | null;
};

type ExportCsvButtonProps = {
  cohortId: string;
  /** Заголовки всех колонок журнала (тесты и задания) слева направо. */
  columnTitles: string[];
  rows: ExportCsvRow[];
};

function escapeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

export function ExportCsvButton({
  cohortId,
  columnTitles,
  rows,
}: ExportCsvButtonProps) {
  function handleExport() {
    const header = [
      "Ученик",
      "Email",
      ...columnTitles,
      "Средний балл (%)",
    ];

    const body = rows.map((row) => [
      row.studentName,
      row.email,
      ...row.scores.map((score) =>
        score == null ? "-" : typeof score === "number" ? String(score) : score,
      ),
      row.averageScore == null ? "-" : String(row.averageScore),
    ]);

    const csvLines = [header, ...body].map((line) =>
      line.map((cell) => escapeCsvCell(cell)).join(";"),
    );

    const csv = `\uFEFF${csvLines.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `gradebook_cohort_${cohortId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport}>
      <DownloadIcon className="mr-2 size-4" aria-hidden />
      Экспорт CSV
    </Button>
  );
}
