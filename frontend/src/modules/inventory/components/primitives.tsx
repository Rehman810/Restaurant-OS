"use client";

import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Info, Search } from "lucide-react";
import { AdminSelect } from "@/components/admin/AdminSelect";

const TOOLTIP_W = 288;
const TOOLTIP_GAP = 8;
const VIEWPORT_PAD = 12;

export function InfoTooltip({
  label,
  title,
  bullets,
  text,
  size = 15,
}: {
  /** Accessible name for the trigger */
  label: string;
  title?: string;
  bullets?: string[];
  text?: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(false);

  const body = bullets?.length ? (
    <ul className="list-disc space-y-1 pl-4 text-left text-xs leading-relaxed text-stone-600 dark:text-stone-300">
      {bullets.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  ) : text ? (
    <p className="text-left text-xs leading-relaxed text-stone-600 dark:text-stone-300">{text}</p>
  ) : null;

  const placePanel = useCallback(() => {
    const el = triggerRef.current;
    const panel = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelH = panel?.offsetHeight ?? 160;
    const panelW = Math.min(TOOLTIP_W, window.innerWidth - VIEWPORT_PAD * 2);

    let left = r.left + r.width / 2 - panelW / 2;
    left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - panelW - VIEWPORT_PAD));

    const belowTop = r.bottom + TOOLTIP_GAP;
    const aboveTop = r.top - panelH - TOOLTIP_GAP;
    const fitsBelow = belowTop + panelH <= window.innerHeight - VIEWPORT_PAD;
    const top = fitsBelow ? belowTop : Math.max(VIEWPORT_PAD, aboveTop);

    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    placePanel();
    const id = requestAnimationFrame(() => placePanel());
    return () => cancelAnimationFrame(id);
  }, [open, placePanel, title, bullets, text]);

  useEffect(() => {
    if (!open) return;
    function onScroll() {
      placePanel();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, placePanel]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const scheduleClose = () => {
    hoverRef.current = false;
    window.setTimeout(() => {
      if (!hoverRef.current) setOpen(false);
    }, 120);
  };

  if (!body) return null;

  const panel =
    open
      ? createPortal(
          <div
            ref={panelRef}
            role="tooltip"
            style={{
              top: coords?.top ?? -9999,
              left: coords?.left ?? VIEWPORT_PAD,
              width: TOOLTIP_W,
              maxWidth: `calc(100vw - ${VIEWPORT_PAD * 2}px)`,
              visibility: coords ? "visible" : "hidden",
            }}
            className="fixed z-[300] max-h-[min(14rem,40vh)] overflow-y-auto rounded-xl border border-stone-200 bg-white p-3 shadow-xl dark:border-stone-600 dark:bg-stone-900"
            onMouseEnter={() => {
              hoverRef.current = true;
            }}
            onMouseLeave={scheduleClose}
          >
            {title && <p className="mb-1.5 text-xs font-bold text-stone-900 dark:text-stone-100">{title}</p>}
            {body}
          </div>,
          document.body
        )
      : null;

  return (
    <span className="inline-flex align-middle">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        className="rounded-full p-0.5 text-stone-400 transition hover:bg-stone-100 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:bg-stone-800"
        onMouseEnter={() => {
          hoverRef.current = true;
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onClick={() => setOpen((v) => !v)}
      >
        <Info size={size} aria-hidden />
      </button>
      {panel}
    </span>
  );
}

export function InventoryPanel({
  title,
  description,
  children,
  className = "",
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
        <h2 className="flex items-center gap-1.5 font-display text-base font-bold text-stone-900 dark:text-stone-50">
          {title}
          {description && <InfoTooltip label={`About ${title}`} text={description} size={14} />}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Compact tab help — icon only, no full-width banner */
export function TabHelp({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <InfoTooltip label={`${title} — help`} title={title} bullets={bullets} size={16} />
  );
}

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
        {hint && <InfoTooltip label={hint} text={hint} size={13} />}
      </div>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`input admin-select w-full ${props.className ?? ""}`}
    />
  );
}

export function DateInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input admin-select w-full pl-9"
        />
      </div>
    </Field>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 w-full ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-stone-400"
        size={16}
        aria-hidden
      />
      <input
        aria-label={ariaLabel ?? placeholder}
        className="input w-full !py-2.5 !pl-10 !pr-4"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Segment<T extends string>({
  value,
  onChange,
  options,
  className = "",
  fullWidth = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  className?: string;
  /** Stack/wrap segment pills — use in narrow side panels */
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-stone-200 bg-stone-50 p-1 dark:border-stone-700 dark:bg-stone-800/50 ${
        fullWidth ? "flex w-full min-w-0 flex-wrap gap-1" : "inline-flex max-w-full flex-wrap gap-0.5"
      } ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:py-2 sm:text-sm ${
            fullWidth ? "min-w-0 flex-1 whitespace-nowrap sm:flex-none" : ""
          } ${
            value === o.id
              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-50"
              : "text-stone-500 hover:text-stone-800 dark:text-stone-400"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <AdminSelect
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? "Select…"}
        options={options.map((o) => ({ value: o.value, label: o.label }))}
        className="w-full min-w-0"
        minWidth="min-w-0"
      />
    </div>
  );
}

export function IngredientPicker({
  label,
  value,
  onChange,
  items,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  items: { id: string; name: string; unit?: string }[];
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.name.toLowerCase().includes(s));
  }, [items, q]);

  const options = useMemo(
    () =>
      filtered.map((i) => ({
        value: i.id,
        label: i.unit ? `${i.name} (${i.unit})` : i.name,
      })),
    [filtered]
  );

  return (
    <div className="space-y-1">
      <Field label={label}>
        <input
          className="input admin-select mb-1 w-full text-xs"
          placeholder="Type to filter…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={`Filter ${label}`}
        />
        <AdminSelect
          value={value}
          onChange={onChange}
          placeholder={placeholder ?? "Choose ingredient"}
          options={[{ value: "", label: "—" }, ...options]}
          className="w-full"
          minWidth="min-w-0"
        />
      </Field>
    </div>
  );
}

export function InventoryTable({
  columns,
  children,
  empty,
  loading,
  bodyMaxHeight,
}: {
  columns: string[];
  children: ReactNode;
  empty?: ReactNode;
  loading?: boolean;
  /** Fixed scroll area for tbody (header stays visible). */
  bodyMaxHeight?: string;
}) {
  const head = (
    <thead className={bodyMaxHeight ? "sticky top-0 z-10" : undefined}>
      <tr className="border-b border-stone-200 bg-stone-50/95 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500 backdrop-blur-sm dark:border-stone-700 dark:bg-stone-800/95">
        {columns.map((c) => (
          <th key={c} className="whitespace-nowrap px-4 py-3">{c}</th>
        ))}
      </tr>
    </thead>
  );

  const body = (
    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
      {loading ? (
        <tr>
          <td colSpan={columns.length} className="px-4 py-10 text-center text-stone-400">Loading…</td>
        </tr>
      ) : (
        children
      )}
    </tbody>
  );

  if (bodyMaxHeight) {
    return (
      <div className="overflow-hidden rounded-xl border border-stone-100 dark:border-stone-800">
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: bodyMaxHeight }}>
          <table className="w-full min-w-[640px] text-sm">
            {head}
            {body}
          </table>
        </div>
        {!loading && empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        {head}
        {body}
      </table>
      {!loading && empty}
    </div>
  );
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 25, 50],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3 text-xs dark:border-stone-800">
      <p className="text-stone-500">
        {total === 0 ? "No rows" : `Showing ${from}–${to} of ${total}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-stone-500">
            Per page
            <select
              className="input admin-select w-auto py-1.5 text-xs"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="btn-secondary px-2.5 py-1.5 text-xs"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Previous
        </button>
        <span className="min-w-[4.5rem] text-center font-medium text-stone-700 dark:text-stone-300">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="btn-secondary px-2.5 py-1.5 text-xs"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-stone-500">{children}</td>
    </tr>
  );
}

export function MetricCard({
  label,
  value,
  onClick,
  accent,
}: {
  label: string;
  value: ReactNode;
  onClick?: () => void;
  accent?: "amber" | "red";
}) {
  const border =
    accent === "amber"
      ? "border-amber-200 dark:border-amber-900/50"
      : accent === "red"
        ? "border-red-200 dark:border-red-900/50"
        : "border-stone-200 dark:border-stone-700";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border ${border} bg-white p-4 text-left transition hover:shadow-md disabled:cursor-default disabled:hover:shadow-none dark:bg-stone-900`}
    >
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-stone-900 dark:text-stone-50">{value}</p>
    </button>
  );
}

export function MovementTypePill({ type }: { type: string }) {
  const tone =
    type.includes("PURCHASE") || type.includes("TRANSFER_IN")
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
      : type.includes("SALE") || type.includes("WASTE") || type.includes("TRANSFER_OUT")
        ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
        : type.includes("COUNT")
          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200"
          : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
      {type.replace(/_/g, " ")}
    </span>
  );
}

export function PaymentPill({ status }: { status: string }) {
  const tone =
    status === "PAID"
      ? "bg-emerald-100 text-emerald-800"
      : status === "PARTIAL"
        ? "bg-amber-100 text-amber-900"
        : "bg-stone-100 text-stone-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{status}</span>;
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-900/50 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
          <h3 id="inv-modal-title" className="font-display text-lg font-bold">{title}</h3>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={onClose}>Close</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
