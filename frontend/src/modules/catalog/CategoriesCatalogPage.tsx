"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { FolderTree } from "lucide-react";
import { api, apiUpload, ApiError } from "@/lib/api";
import { enrichCategories } from "@/lib/category-meta";
import { Category } from "@/lib/types";
import type { AdminCategoryRow } from "@/lib/admin-menu/types";
import { useAuth } from "@/lib/auth";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { CategoryFormSheet, CategoryFormData } from "@/components/admin/CategoryFormSheet";
import { CategoriesTab } from "@/components/admin/menu/CategoriesTab";
import { emptyCategory, minutesToTimeLabel } from "./catalog-constants";
import { useCatalogLoader } from "./use-catalog-loader";

export function CategoriesCatalogPage() {
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";

  const { loadError, load } = useCatalogLoader();

  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(emptyCategory);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function closeCategoryForm() {
    setCategoryFormOpen(false);
    setCategoryForm(emptyCategory);
    setEditingCategory(null);
    setCategoryError("");
  }

  function openAddCategory() {
    setCategoryForm(emptyCategory);
    setEditingCategory(null);
    setCategoryError("");
    setCategoryFormOpen(true);
  }

  function startEditCategory(cat: Category | AdminCategoryRow) {
    const enriched = enrichCategories([
      {
        id: cat.id,
        name: cat.name,
        tagline: cat.tagline || "",
        imageUrl: cat.imageUrl || "",
        sortOrder: cat.sortOrder,
        createdAt: "createdAt" in cat ? cat.createdAt : "",
      },
    ])[0];
    setEditingCategory(cat.id);
    setCategoryForm({
      name: enriched.name,
      tagline: enriched.tagline || "",
      imageUrl: enriched.imageUrl || "",
      isVisible: "isVisible" in cat ? cat.isVisible : true,
      scheduleDays: "scheduleDays" in cat ? cat.scheduleDays : [],
      scheduleStartTime: minutesToTimeLabel("scheduleStartMinutes" in cat ? cat.scheduleStartMinutes : null),
      scheduleEndTime: minutesToTimeLabel("scheduleEndMinutes" in cat ? cat.scheduleEndMinutes : null),
    });
    setCategoryError("");
    setCategoryFormOpen(true);
  }

  async function onCategorySubmit(e: FormEvent) {
    e.preventDefault();
    setCategoryError("");
    setSaving(true);
    try {
      const body = {
        name: categoryForm.name,
        tagline: categoryForm.tagline,
        imageUrl: categoryForm.imageUrl,
        isVisible: categoryForm.isVisible,
        scheduleDays: categoryForm.scheduleDays,
        scheduleStartTime: categoryForm.scheduleStartTime || null,
        scheduleEndTime: categoryForm.scheduleEndTime || null,
      };
      if (editingCategory) {
        await api(`/categories/${editingCategory}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/categories", { method: "POST", body: JSON.stringify(body) });
      }
      closeCategoryForm();
      await load(true);
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : "Could not save category");
    } finally {
      setSaving(false);
    }
  }

  async function onCategoryImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCategoryError("");
    setUploading(true);
    try {
      const { url } = await apiUpload("/upload/image", file);
      setCategoryForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AdminPage fill>
      <CategoriesTab
        header={
          <>
            <AdminPageHeader
              title="Categories"
              description="Banners and weekly hours"
              icon={FolderTree}
            />
            {loadError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
            ) : null}
          </>
        }
        canManage={canManage}
        onAddCategory={openAddCategory}
        onEditCategory={startEditCategory}
        onCategoriesChanged={() => void load(true)}
      />
      {categoryFormOpen && (
        <CategoryFormSheet
          open={categoryFormOpen}
          editingId={editingCategory}
          form={categoryForm}
          setForm={setCategoryForm}
          saving={saving}
          uploading={uploading}
          uploadError={categoryError}
          onClose={closeCategoryForm}
          onSubmit={onCategorySubmit}
          onImagePick={onCategoryImagePick}
        />
      )}
    </AdminPage>
  );
}
