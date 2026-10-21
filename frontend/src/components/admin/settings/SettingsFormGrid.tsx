import { ReactNode } from "react";

/** Responsive field grid so wide settings pages do not leave empty gutters. */
export function SettingsFormGrid({
  children,
  columns = "auto",
  className = "",
}: {
  children: ReactNode;
  /** 2 = two columns from sm; 3 = three from lg; auto = 2 cols sm, 3 cols xl */
  columns?: 2 | 3 | "auto";
  className?: string;
}) {
  const cols =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2 xl:grid-cols-3";

  return <div className={`grid grid-cols-1 gap-4 ${cols} ${className}`}>{children}</div>;
}
