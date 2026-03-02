export interface PrescriptionRow {
  substancia: string;
  dose: string;
  via: string;
  frequencia: string;
  duracao: string;
  condicoes_ci?: string;
  monitorizacao?: string;
}

function escapeCsvField(value: string): string {
  if (!value) return "";
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportPrescriptionCSV(rows: PrescriptionRow[], patientName: string) {
  const headers = ["Substância", "Dose", "Via", "Frequência", "Duração", "Condições/CI", "Monitorização"];
  const csvLines = [
    headers.join(";"),
    ...rows.map((r) =>
      [
        escapeCsvField(r.substancia ?? ""),
        escapeCsvField(r.dose ?? ""),
        escapeCsvField(r.via ?? ""),
        escapeCsvField(r.frequencia ?? ""),
        escapeCsvField(r.duracao ?? ""),
        escapeCsvField(r.condicoes_ci ?? ""),
        escapeCsvField(r.monitorizacao ?? ""),
      ].join(";")
    ),
  ];

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const safeName = patientName.replace(/[^a-zA-Z0-9À-ÿ]/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Prescricao_${safeName}_${date}.csv`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
