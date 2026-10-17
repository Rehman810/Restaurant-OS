"use client";

/** Tiny sparkline from hourly order counts (0–23). Hidden under 400px via parent. */
export function DashboardKpiSparkline({
  hours,
  className = "",
}: {
  hours: { hour: number; orders: number }[];
  className?: string;
}) {
  const points = hours.map((h) => h.orders);
  const max = Math.max(...points, 1);
  const w = 64;
  const h = 24;
  const coords = points
    .map((v, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * w;
      const y = h - (v / max) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`text-brand-600 dark:text-brand-400 ${className}`}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}
