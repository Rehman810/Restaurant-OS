"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminTheme } from "@/hooks/useAdminTheme";
import { compactAxisAmount, niceMoneyTicks, niceOrderTicks } from "@/lib/dashboard/helpers";
import { pkr } from "@/lib/format";

type DayRow = { date: string; label: string; orders: number; revenue: number | null };
type HourRow = { hour: number; orders: number; revenue: number | null };

function HourTooltip({
  active,
  payload,
  label,
  showMoney,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; payload: HourRow & { prevOrders?: number; prevRevenue?: number } }[];
  label?: string;
  showMoney: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-stone-600 dark:bg-stone-800">
      <p className="font-bold text-stone-900 dark:text-stone-100">{label}</p>
      {row && (
        <>
          <p className="text-brand-700 dark:text-brand-300">{row.orders} orders today</p>
          {showMoney && row.revenue != null && <p>{pkr(row.revenue)} revenue</p>}
          {row.prevOrders != null && (
            <p className="text-stone-500">Yesterday: {row.prevOrders} orders</p>
          )}
          {showMoney && row.prevRevenue != null && (
            <p className="text-stone-500">Yesterday: {pkr(row.prevRevenue)}</p>
          )}
        </>
      )}
    </div>
  );
}

export function Last7DaysChart({ data, showMoney }: { data: DayRow[]; showMoney: boolean }) {
  const { theme } = useAdminTheme();
  const grid = theme === "dark" ? "#44403c" : "#e7e5e4";
  const tick = theme === "dark" ? "#a8a29e" : "#57534e";
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);
  const maxRev = Math.max(...data.map((d) => d.revenue ?? 0), 1);
  const orderTicks = niceOrderTicks(maxOrders);
  const revTicks = niceMoneyTicks(maxRev);

  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-semibold ${view === "chart" ? "bg-brand-600 text-white" : "bg-stone-100 dark:bg-stone-800"}`}
          onClick={() => setView("chart")}
        >
          Chart
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-semibold ${view === "table" ? "bg-brand-600 text-white" : "bg-stone-100 dark:bg-stone-800"}`}
          onClick={() => setView("table")}
        >
          Table
        </button>
      </div>
      {view === "table" ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500">
              <th className="py-1">Day</th>
              <th>Orders</th>
              {showMoney && <th>Revenue</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-stone-100 dark:border-stone-800">
                <td className="py-2">{d.label}</td>
                <td>{d.orders}</td>
                {showMoney && <td>{d.revenue != null ? pkr(d.revenue) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="h-[220px] w-full max-w-full sm:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: tick }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="orders"
                ticks={orderTicks}
                allowDecimals={false}
                width={36}
                tick={{ fontSize: 11, fill: tick }}
                axisLine={false}
                tickLine={false}
              />
              {showMoney && (
                <YAxis
                  yAxisId="rev"
                  orientation="right"
                  ticks={revTicks}
                  width={40}
                  tickFormatter={(v) => compactAxisAmount(v)}
                  tick={{ fontSize: 11, fill: tick }}
                  axisLine={false}
                  tickLine={false}
                />
              )}
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "revenue" && showMoney ? pkr(value) : `${value} orders`
                }
              />
              <Bar yAxisId="orders" dataKey="orders" fill="var(--color-brand-600, #c2410c)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              {showMoney && (
                <Line
                  yAxisId="rev"
                  type="linear"
                  dataKey="revenue"
                  stroke="#fb923c"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function TodayHourlyChart({
  today,
  comparison,
  showMoney,
}: {
  today: HourRow[];
  comparison: HourRow[];
  showMoney: boolean;
}) {
  const { theme } = useAdminTheme();
  const grid = theme === "dark" ? "#44403c" : "#e7e5e4";
  const tick = theme === "dark" ? "#a8a29e" : "#57534e";

  const merged = useMemo(() => {
    return today.map((t, i) => ({
      ...t,
      label: `${t.hour}:00`,
      prevOrders: comparison[i]?.orders ?? 0,
      prevRevenue: comparison[i]?.revenue ?? 0,
    }));
  }, [today, comparison]);

  const maxOrders = Math.max(...merged.map((d) => Math.max(d.orders, d.prevOrders)), 1);
  const orderTicks = niceOrderTicks(maxOrders);

  return (
    <div className="h-[200px] w-full sm:h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={merged} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: tick }} interval={2} axisLine={false} tickLine={false} />
          <YAxis
            ticks={orderTicks}
            allowDecimals={false}
            width={32}
            tick={{ fontSize: 11, fill: tick }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<HourTooltip showMoney={showMoney} />} />
          <Bar dataKey="orders" fill="var(--color-brand-600, #c2410c)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line
            type="linear"
            dataKey="prevOrders"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
