"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";
import { api, apiUpload, ApiError } from "@/lib/api";
import { Deal } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { DealFormSheet, DealFormData } from "@/components/admin/DealFormSheet";
import { DealsTab } from "@/components/admin/menu/DealsTab";
import { emptyDeal, minutesToTimeLabel, timeToMinutes } from "./catalog-constants";
import { useCatalogLoader } from "./use-catalog-loader";

export function DealsCatalogPage() {
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canToggleAvailability = canManage || user?.role === "CASHIER" || user?.role === "CHEF";

  const { items, dealCategoryOptions, loadError, load } = useCatalogLoader();

  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [dealSaveWarning, setDealSaveWarning] = useState("");
  const [dealForm, setDealForm] = useState<DealFormData>(emptyDeal);
  const [editingDeal, setEditingDeal] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  function closeDealForm() {
    setDealFormOpen(false);
    setDealForm(emptyDeal);
    setEditingDeal(null);
    setUploadError("");
  }

  function openAddDeal() {
    setDealForm({
      ...emptyDeal,
      items: [{ menuItemId: items[0]?.id || "", quantity: 1 }],
    });
    setEditingDeal(null);
    setDealFormOpen(true);
  }

  function startEditDeal(
    deal: Deal & {
      isVisible?: boolean;
      channelOnline?: boolean;
      channelPos?: boolean;
      channelDineIn?: boolean;
      perOrderLimit?: number | null;
      scheduleStartsAt?: string | null;
      scheduleEndsAt?: string | null;
      scheduleStartMinutes?: number | null;
      scheduleEndMinutes?: number | null;
      scheduleDays?: number[];
    }
  ) {
    setEditingDeal(deal.id);
    const sm = deal.scheduleStartMinutes;
    const em = deal.scheduleEndMinutes;
    setDealForm({
      title: deal.title,
      description: deal.description,
      category: deal.category || "",
      dealPrice: String(deal.dealPrice),
      imageUrl: deal.imageUrl,
      isVisible: deal.isVisible ?? deal.isActive,
      channelOnline: deal.channelOnline ?? true,
      channelPos: deal.channelPos ?? true,
      channelDineIn: deal.channelDineIn ?? true,
      perOrderLimit: deal.perOrderLimit != null ? String(deal.perOrderLimit) : "",
      scheduleStartsAt: deal.scheduleStartsAt ? String(deal.scheduleStartsAt).slice(0, 10) : "",
      scheduleEndsAt: deal.scheduleEndsAt ? String(deal.scheduleEndsAt).slice(0, 10) : "",
      scheduleStartTime: minutesToTimeLabel(sm),
      scheduleEndTime: minutesToTimeLabel(em),
      scheduleDays: deal.scheduleDays ?? [],
      items: deal.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    });
    setDealFormOpen(true);
  }

  async function openEditDealById(id: string) {
    try {
      const deal = await api<
        Deal & {
          isVisible?: boolean;
          channelOnline?: boolean;
          channelPos?: boolean;
          channelDineIn?: boolean;
          perOrderLimit?: number | null;
          scheduleStartsAt?: string | null;
          scheduleEndsAt?: string | null;
          scheduleStartMinutes?: number | null;
          scheduleEndMinutes?: number | null;
          scheduleDays?: number[];
        }
      >(`/deals/${id}`);
      startEditDeal(deal);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Could not load deal.");
    }
  }

  async function onDealSubmit(e: FormEvent) {
    e.preventDefault();
    const validItems = dealForm.items.filter((i) => i.menuItemId);
    if (validItems.length === 0) {
      setUploadError("Add at least one menu item to the deal.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: dealForm.title,
        description: dealForm.description,
        category: dealForm.category.trim(),
        dealPrice: Number(dealForm.dealPrice),
        imageUrl: dealForm.imageUrl,
        isVisible: dealForm.isVisible,
        channelOnline: dealForm.channelOnline,
        channelPos: dealForm.channelPos,
        channelDineIn: dealForm.channelDineIn,
        perOrderLimit: dealForm.perOrderLimit ? Number(dealForm.perOrderLimit) : null,
        scheduleStartsAt: dealForm.scheduleStartsAt || null,
        scheduleEndsAt: dealForm.scheduleEndsAt || null,
        scheduleStartMinutes: timeToMinutes(dealForm.scheduleStartTime),
        scheduleEndMinutes: timeToMinutes(dealForm.scheduleEndTime),
        scheduleDays: dealForm.scheduleDays,
        items: validItems,
      };
      const res = await api<{ deal: Deal; warnings?: string[] }>(
        editingDeal ? `/deals/${editingDeal}` : "/deals",
        { method: editingDeal ? "PUT" : "POST", body: JSON.stringify(body) }
      );
      setDealSaveWarning(res.warnings?.join(" ") ?? "");
      closeDealForm();
      await load(true);
    } finally {
      setSaving(false);
    }
  }

  async function onImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const { url } = await apiUpload("/upload/image", file);
      setDealForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api(`/deals/${deleteTarget.id}`, { method: "DELETE" });
      if (editingDeal === deleteTarget.id) closeDealForm();
      setDeleteTarget(null);
      await load(true);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminPage fill>
      <DealsTab
        header={
          <>
            <AdminPageHeader
              title="Deals"
              description="Bundle pricing"
              icon={Sparkles}
            />
            {loadError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
            ) : null}
            {dealSaveWarning ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{dealSaveWarning}</p>
            ) : null}
          </>
        }
        canManage={canManage}
        canToggleAvailability={canToggleAvailability}
        onAddDeal={openAddDeal}
        onEditDeal={(id) => void openEditDealById(id)}
        onDeleteDeal={(row) => {
          setDeleteError("");
          setDeleteTarget({ id: row.id, label: row.title });
        }}
      />
      {dealFormOpen && (
        <DealFormSheet
          open={dealFormOpen}
          editingId={editingDeal}
          form={dealForm}
          setForm={setDealForm}
          menuItems={items}
          saving={saving}
          uploading={uploading}
          uploadError={uploadError}
          categoryOptions={dealCategoryOptions}
          onClose={closeDealForm}
          onSubmit={onDealSubmit}
          onImagePick={onImagePick}
        />
      )}
      <ConfirmSheet
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.label ?? "deal"}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        saving={deleting}
        error={deleteError}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
