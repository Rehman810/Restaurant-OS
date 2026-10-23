"use client";

import { useRef } from "react";
import Image from "next/image";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { resolveMediaUrl } from "@/lib/media-url";

type PreviewSize = "logo" | "favicon";

type Props = {
  value: string;
  onChange: (url: string) => void;
  uploading: boolean;
  uploadError?: string;
  onUpload: (file: File) => void;
  accept?: string;
  uploadLabel: string;
  replaceLabel?: string;
  previewSize: PreviewSize;
  emptyHint?: string;
};

export function SettingsMediaField({
  value,
  onChange,
  uploading,
  uploadError,
  onUpload,
  accept = "image/*",
  uploadLabel,
  replaceLabel = "Replace",
  previewSize,
  emptyHint = "JPG, PNG, or WebP",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hasValue = Boolean(value?.trim());
  const resolved = hasValue ? resolveMediaUrl(value) : "";

  const previewBox =
    previewSize === "logo"
      ? "relative h-14 w-40 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-600 dark:bg-stone-800/40"
      : "relative h-12 w-12 overflow-hidden rounded-lg border border-stone-200 bg-stone-50 dark:border-stone-600 dark:bg-stone-800/40";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className={previewBox}>
          {hasValue ? (
            previewSize === "logo" ? (
              <Image src={resolved} alt="" fill className="object-contain p-2" sizes="160px" />
            ) : (
              <img src={resolved} alt="" className="h-full w-full object-contain p-1" />
            )
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-stone-400">
              <ImageIcon size={previewSize === "logo" ? 22 : 18} className="opacity-50" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-sm dark:bg-stone-900/70">
              <Loader2 size={22} className="animate-spin text-brand-600" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
            >
              <Upload size={16} />
              {uploading ? "Uploading…" : hasValue ? replaceLabel : uploadLabel}
            </button>
            {hasValue && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => onChange("")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60 dark:border-stone-600 dark:text-stone-300 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <Trash2 size={16} />
                Remove
              </button>
            )}
          </div>
          <p className="text-[11px] text-stone-400">{emptyHint}</p>
          {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUpload(file);
        }}
      />

      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200">
          Or paste image URL
        </summary>
        <input
          className="input mt-2"
          placeholder="https://… or /uploads/…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </details>
    </div>
  );
}
