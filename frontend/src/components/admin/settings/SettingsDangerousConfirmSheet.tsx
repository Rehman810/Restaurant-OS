"use client";

import { ConfirmSheet } from "@/components/admin/ConfirmSheet";

export function SettingsDangerousConfirmSheet({
  open,
  impacts,
  saving,
  onConfirm,
  onClose,
}: {
  open: boolean;
  impacts: { key: string; text: string }[];
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmSheet
      open={open}
      title="Confirm this change"
      danger
      saving={saving}
      confirmLabel="Yes, save this change"
      cancelLabel="Go back"
      message={
        <div className="space-y-2 text-sm text-stone-600 dark:text-stone-300">
          <p>This update can affect customers or reporting. Please read before continuing.</p>
          <ul className="list-disc space-y-1 pl-5">
            {impacts.map((item) => (
              <li key={item.key}>{item.text}</li>
            ))}
          </ul>
        </div>
      }
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
