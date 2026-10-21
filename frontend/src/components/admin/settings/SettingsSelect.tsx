"use client";

import { AdminSelect, type AdminSelectOption } from "@/components/admin/AdminSelect";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  "aria-label"?: string;
};

/** Same dropdown UI as inventory, orders, and other admin modules. */
export function SettingsSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  "aria-label": ariaLabel,
}: Props) {
  return (
    <AdminSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="w-full min-w-0"
      minWidth="min-w-0"
    />
  );
}
