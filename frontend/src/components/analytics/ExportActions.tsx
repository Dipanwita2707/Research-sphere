'use client';

import React from 'react';
import { Download } from 'lucide-react';

interface Props {
  data: any[];
  filename?: string;
  columns?: { key: string; label: string }[];
}

export default function ExportActions({ data, filename = 'analytics-export', columns }: Props) {
  const handleExportCSV = () => {
    if (!data.length) return;
    const cols = columns || Object.keys(data[0]).map((k) => ({ key: k, label: k }));
    const header = cols.map((c) => c.label).join(',');
    const rows = data.map((row) =>
      cols.map((c) => {
        const val = row[c.key];
        if (val ===
   null || val ===
   undefined) return '';
        if (typeof val ===
   'object') return JSON.stringify(val).replace(/,/g, ';');
        return String(val).replace(/,/g, ';');
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExportCSV}
      disabled={!data.length}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
      Export CSV
    </button>
  );
}
