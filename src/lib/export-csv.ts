// src/lib/export-csv.ts — Browser CSV exporter for financial transactions

export interface ExportableTransaction {
  timestamp: number;
  type: string;
  amountEtb: number;
  feeEtb: number;
  netEtb: number;
  status: string;
  method: string;
  reference: string;
  description: string;
}

export function exportTransactionsToCsv(
  transactions: ExportableTransaction[],
  filename = `chessarena-transactions-${new Date().toISOString().slice(0, 10)}.csv`
) {
  if (!transactions || transactions.length === 0) {
    alert("No transactions available to export for this period.");
    return;
  }

  const headers = [
    "Date & Time",
    "Type",
    "Amount (ETB)",
    "Fee (ETB)",
    "Net Amount (ETB)",
    "Status",
    "Method",
    "Reference",
    "Description",
  ];

  const rows = transactions.map((t) => {
    const dateStr = new Date(t.timestamp).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return [
      `"${dateStr}"`,
      `"${t.type}"`,
      t.amountEtb.toFixed(2),
      t.feeEtb ? t.feeEtb.toFixed(2) : "0.00",
      t.netEtb.toFixed(2),
      `"${t.status}"`,
      `"${t.method}"`,
      `"${t.reference}"`,
      `"${(t.description || "").replace(/"/g, '""')}"`,
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
