import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface RevenueChartProps {
  data: Array<{ date: string; count: number }>;
}

export default function RevenueChart({ data }: RevenueChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#b3cde0] bg-[#f8fbff] p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
        No registration trend data yet.
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    label: new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  }));

  return (
    <div className="h-72 w-full rounded-xl border border-[#b3cde0]/60 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe8f3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#7a8797" />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#7a8797" />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#0f2573" strokeWidth={2.5} dot={{ r: 3 }} name="Registrations" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
