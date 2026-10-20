"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { api, apiUpload, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { MenuFormSheet, MenuFormData } from "@/components/admin/MenuFormSheet";
import { DishesTab } from "@/components/admin/menu/DishesTab";
import { emptyDish } from "./catalog-constants";
import { useCatalogLoader } from "./use-catalog-loader";

export function DishesCatalogPage() {
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canToggleAvailability = canManage || user?.role === "CASHIER" || user?.role === "CHEF";
  const canSeeMargin = canManage;

  const { categories, categoryNames, printStations, loadError, load } = useCatalogLoader();

  const [dishFormOpen, setDishFormOpen] = useState(false);
  const [dishForm, setDishForm] = useState<MenuFormData>(emptyDish);
  const [editingDish, setEditingDish] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  function closeDishForm() {
    setDishFormOpen(false);
    setDishForm(emptyDish);
    setEditingDish(null);
    setUploadError("");
  }

  function openAddDish() {
    setDishForm({ ...emptyDish, category: categoryNames[0] || "Main Course" });
    setEditingDish(null);
    setUploadError("");
    setDishFormOpen(true);
  }

  async function openEditDishById(id: string) {
    try {
      const item = await api<import("@/lib/types").MenuItem>(`/menu/${id}`);
      setEditingDish(item.id);
      setDishForm({
        name: item.name,
        description: item.description,
        price: String(item.price),
        discountPrice: item.discountPrice != null ? String(item.discountPrice) : "",
        category: item.category,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
        optionGroups: (item.optionGroups ?? []).map((g) => ({
          name: g.name,
          required: g.required,
          options: g.options.map((o) => ({
            name: o.name,
            price: String(o.price),
            discountPrice: o.discountPrice != null ? String(o.discountPrice) : "",
          })),
        })),
        addons: (item.addons ?? []).map((a) => ({ name: a.name, price: String(a.price) })),
        printStationId: item.printStationId || item.printStation?.id || "",
      });
      setDishFormOpen(true);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Could not load dish.");
    }
  }

  async function onDishSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...dishForm,
        price: Number(dishForm.price),
        discountPrice: dishForm.discountPrice ? Number(dishForm.discountPrice) : null,
        optionGroups: dishForm.optionGroups
          .filter((g) => g.name.trim())
          .map((g) => ({
            name: g.name.trim(),
            required: g.required,
            options: g.options
              .filter((o) => o.name.trim())
              .map((o) => ({
                name: o.name.trim(),
                price: Number(o.price) || 0,
                discountPrice: o.discountPrice ? Number(o.discountPrice) : null,
              })),
          })),
        printStationId: dishForm.printStationId || null,
        addons: dishForm.addons
          .filter((a) => a.name.trim())
          .map((a) => ({ name: a.name.trim(), price: Number(a.price) || 0 })),
      };
      if (editingDish) await api(`/menu/${editingDish}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/menu", { method: "POST", body: JSON.stringify(body) });
      closeDishForm();
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
      setDishForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AdminPage fill>
      <DishesTab
        header={
          <>
            <AdminPageHeader
              title="Dishes"
              description="Sold-out is per branch"
              icon={UtensilsCrossed}
            />
            {loadError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
            ) : null}
          </>
        }
        categories={categories}
        canManage={canManage}
        canToggleAvailability={canToggleAvailability}
        canSeeMargin={canSeeMargin}
        onAddDish={openAddDish}
        onEditDish={(id) => void openEditDishById(id)}
      />
      {dishFormOpen && (
        <MenuFormSheet
          open={dishFormOpen}
          editingId={editingDish}
          form={dishForm}
          setForm={setDishForm}
          categories={categoryNames}
          printStations={printStations.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
          saving={saving}
          uploading={uploading}
          uploadError={uploadError}
          onClose={closeDishForm}
          onSubmit={onDishSubmit}
          onImagePick={onImagePick}
        />
      )}
    </AdminPage>
  );
}
