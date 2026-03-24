interface StatusBreakdownItem {
  label: string;
  count: number;
  percent?: number;
  amount?: number;
}

interface StatusBreakdownListProps {
  items: StatusBreakdownItem[];
  emptyMessage?: string;
}

export default function StatusBreakdownList({
  items,
  emptyMessage = 'No data available.',
}: StatusBreakdownListProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#b3cde0] bg-[#f8fbff] p-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-[#b3cde0]/40 p-3 dark:border-gray-700">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium capitalize text-ev-900 dark:text-white">{item.label.replace(/_/g, ' ')}</span>
            <div className="text-right">
              <p className="font-semibold text-gray-800 dark:text-gray-100">{item.count}</p>
              {typeof item.amount === 'number' ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">₹{item.amount.toLocaleString('en-IN')}</p>
              ) : null}
            </div>
          </div>
          {typeof item.percent === 'number' ? (
            <div className="mt-2">
              <div className="h-2 rounded-full bg-[#e7f0f8] dark:bg-gray-700">
                <div
                  className="h-2 rounded-full bg-ev-700"
                  style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.percent}%</p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
