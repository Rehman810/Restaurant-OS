"use client";

import Image from "next/image";
import { ArrowUpToLine, ImageIcon, Plus, Trash2 } from "lucide-react";
import { SettingsField, SettingsSection } from "@/components/admin/SettingsSection";
import { resolveMediaUrl } from "@/lib/media-url";
import type { PromoBanner } from "@/lib/types";

export type BannerFormState = { title: string; imageUrl: string; linkUrl: string };

type Props = {
  banners: PromoBanner[];
  form: BannerFormState;
  onFormChange: (patch: Partial<BannerFormState>) => void;
  uploading: boolean;
  error: string;
  onUpload: (file: File) => void;
  onAdd: () => void;
  onToggle: (banner: PromoBanner) => void;
  onPinFirst: (banner: PromoBanner) => void;
  onRequestDelete: (id: string) => void;
};

export function BannersSettings({
  banners,
  form,
  onFormChange,
  uploading,
  error,
  onUpload,
  onAdd,
  onToggle,
  onPinFirst,
  onRequestDelete,
}: Props) {
  const liveCount = banners.filter((b) => b.isActive).length;

  return (
    <SettingsSection
      icon={ImageIcon}
      title="Promo banners"
      description="Homepage carousel images. Changes apply immediately — no Save bar needed."
    >
      <p className="text-xs text-stone-600">
        {liveCount} of {banners.length} banner{banners.length === 1 ? "" : "s"} live on the storefront. Use{" "}
        <strong>Show first</strong> to bump one to the front of the rotation.
      </p>

      {banners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center">
          <ImageIcon size={28} className="mx-auto text-stone-300" />
          <p className="mt-2 text-sm font-medium text-stone-600">No banners yet</p>
          <p className="text-xs text-stone-400">Add your first promo image below</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {banners.map((b) => (
            <li
              key={b.id}
              className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-brand-200 hover:shadow-sm"
            >
              <div className="relative aspect-[16/7] bg-stone-100">
                {b.imageUrl ? (
                  <Image
                    src={resolveMediaUrl(b.imageUrl)}
                    alt={b.title || "Banner"}
                    fill
                    className="object-cover"
                    sizes="400px"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-stone-300">
                    <ImageIcon size={24} />
                  </div>
                )}
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    b.isActive ? "bg-emerald-500 text-white" : "bg-stone-800/70 text-white"
                  }`}
                >
                  {b.isActive ? "Live" : "Hidden"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">{b.title || "Untitled banner"}</p>
                  <p className="truncate text-xs text-stone-500">{b.linkUrl || "No link"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onPinFirst(b)}
                  className="grid h-8 w-8 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                  aria-label="Show this banner first"
                  title="Show first"
                >
                  <ArrowUpToLine size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(b)}
                  className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
                >
                  {b.isActive ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  onClick={() => onRequestDelete(b.id)}
                  className="grid h-8 w-8 place-items-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete banner"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-dashed border-brand-200 bg-[#fffaf5] p-4 sm:p-5">
        <p className="mb-3 text-sm font-semibold text-stone-800">Add new banner</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsField label="Title (optional)">
            <input
              className="input"
              placeholder="e.g. Biryani night"
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
            />
          </SettingsField>
          <SettingsField label="Link URL (optional)" hint="Relative (/menu) or full https URL.">
            <input
              className="input"
              placeholder="/menu or https://..."
              value={form.linkUrl}
              onChange={(e) => onFormChange({ linkUrl: e.target.value })}
            />
          </SettingsField>
        </div>
        <SettingsField label="Banner image" className="mt-3" hint="Wide images (~16:7) work best in the carousel.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="input flex-1"
              placeholder="Paste image URL or upload"
              value={form.imageUrl}
              onChange={(e) => onFormChange({ imageUrl: e.target.value })}
            />
            <label className="btn-ghost shrink-0 cursor-pointer justify-center">
              {uploading ? "Uploading…" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
            </label>
          </div>
        </SettingsField>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {form.imageUrl && (
          <div className="relative mt-3 aspect-[16/7] max-h-40 overflow-hidden rounded-xl border border-stone-200">
            <Image src={resolveMediaUrl(form.imageUrl)} alt="Preview" fill className="object-cover" sizes="600px" />
          </div>
        )}
        <button
          type="button"
          className="btn-primary mt-4 w-full sm:w-auto"
          onClick={onAdd}
          disabled={!form.imageUrl}
        >
          <Plus size={16} /> Add banner
        </button>
      </div>
    </SettingsSection>
  );
}
