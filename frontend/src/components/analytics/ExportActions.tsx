'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { ui } from './theme';

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
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val).replace(/,/g, ';');
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
      type="button"
      onClick={handleExportCSV}
      disabled={!data.length}
      title={data.length ? `Download ${data.length.toLocaleString('en-IN')} rows as CSV` : 'Nothing to export'}
      className={`${ui.btnSecondary} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <Download className="h-4 w-4" />
      Export CSV
    </button>
  );
}
