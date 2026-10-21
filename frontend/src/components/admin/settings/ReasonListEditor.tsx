"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { SettingsField } from "@/components/admin/SettingsSection";

function parseLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

type Props = {
  label: string;
  hint?: string;
  value: string[];
  onChange: (reasons: string[]) => void;
};

export function ReasonListEditor({ label, hint, value, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  function addDraft() {
    const t = draft.trim();
    if (!t) return;
    if (value.some((r) => r.toLowerCase() === t.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function openBulk() {
    setBulkText(value.join("\n"));
    setBulkOpen(true);
  }

  function applyBulk() {
    onChange(parseLines(bulkText));
    setBulkOpen(false);
  }

  return (
    <SettingsField
      label={label}
      hint={hint ?? "Each entry becomes one option in the POS dropdown."}
    >
      {value.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {value.map((reason, index) => (
            <li
              key={`${reason}-${index}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-stone-200 bg-stone-50 py-1 pl-3 pr-1.5 text-sm text-stone-800 dark:border-stone-600 dark:bg-stone-800/60 dark:text-stone-100"
            >
              <span className="truncate">{reason}</span>
              <button
                type="button"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-700 dark:hover:bg-stone-700"
                aria-label={`Remove ${reason}`}
                onClick={() => removeAt(index)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-stone-500">No reasons yet — add at least one for the POS dropdown.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input min-w-0 flex-1"
          value={draft}
          placeholder="e.g. Wrong order"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
        />
        <button
          type="button"
          className="btn-ghost inline-flex shrink-0 items-center justify-center gap-1.5 sm:min-w-[5.5rem]"
          disabled={!draft.trim()}
          onClick={addDraft}
        >
          <Plus size={16} aria-hidden />
          Add
        </button>
      </div>

      {!bulkOpen ? (
        <button type="button" className="mt-2 text-xs font-semibold text-brand-700 hover:underline" onClick={openBulk}>
          Paste or edit multiple lines
        </button>
      ) : (
        <div className="mt-3 space-y-2 rounded-xl border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-600 dark:bg-stone-800/40">
          <p className="text-xs text-stone-600 dark:text-stone-400">One reason per line. Duplicates are removed on save.</p>
          <textarea
            className="input min-h-[5.5rem] w-full resize-y text-sm leading-relaxed"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={applyBulk}>
              Apply lines
            </button>
            <button type="button" className="btn-ghost text-sm" onClick={() => setBulkOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </SettingsField>
  );
}
