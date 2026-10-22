"use client";

import { PLAN_MODULES, PLAN_MODULE_IDS, type PlanModuleId } from "@/lib/plan-modules";
import {
  MODULE_ACCESS_LEVELS,
  compactModuleAccessForApi,
  defaultOnForModule,
  fullModuleAccess,
  isFullModuleAccess,
  noModuleAccess,
  parseModuleAccess,
  type ModuleAccess,
  type ModuleAccessLevel,
} from "@/lib/module-access";

export type EntitlementsForm = {
  maxBranches: string;
  maxStaff: string;
  modules: Record<PlanModuleId, ModuleAccess>;
  unlimitedBranches: boolean;
  unlimitedStaff: boolean;
};

function defaultModulesRecord(): Record<PlanModuleId, ModuleAccess> {
  return Object.fromEntries(
    PLAN_MODULE_IDS.map((id) => [id, parseModuleAccess(undefined, defaultOnForModule(id))])
  ) as Record<PlanModuleId, ModuleAccess>;
}

export const DEFAULT_ENTITLEMENTS_FORM: EntitlementsForm = {
  maxBranches: "1",
  maxStaff: "10",
  modules: defaultModulesRecord(),
  unlimitedBranches: false,
  unlimitedStaff: false,
};

export function entitlementsFromApi(raw: unknown): EntitlementsForm {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const modules = defaultModulesRecord();
  for (const id of PLAN_MODULE_IDS) {
    modules[id] = parseModuleAccess(o[id], defaultOnForModule(id));
  }
  return {
    maxBranches: o.maxBranches != null ? String(o.maxBranches) : "1",
    maxStaff: o.maxStaff != null ? String(o.maxStaff) : "10",
    modules,
    unlimitedBranches: o.maxBranches === null,
    unlimitedStaff: o.maxStaff === null,
  };
}

export function entitlementsToApi(form: EntitlementsForm) {
  const payload: Record<string, unknown> = {
    maxBranches: form.unlimitedBranches ? null : Math.max(0, Math.round(Number(form.maxBranches) || 0)),
    maxStaff: form.unlimitedStaff ? null : Math.max(0, Math.round(Number(form.maxStaff) || 0)),
  };
  for (const id of PLAN_MODULE_IDS) {
    payload[id] = compactModuleAccessForApi(form.modules[id]);
  }
  return payload;
}

function patchModuleAccess(
  prev: ModuleAccess,
  change: { all?: boolean; level?: ModuleAccessLevel; on?: boolean }
): ModuleAccess {
  if (change.all === true) return fullModuleAccess();
  if (change.all === false) return noModuleAccess();
  if (change.level && change.on !== undefined) {
    const next = { ...prev, [change.level]: change.on };
    if (!change.on && change.level === "read") return noModuleAccess();
    if (change.on && (change.level === "edit" || change.level === "delete")) next.read = true;
    return next;
  }
  return prev;
}

function AccessToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center justify-center gap-1.5">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500 disabled:opacity-40"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
    </label>
  );
}

export function PlanEntitlementsFields({
  value,
  onChange,
}: {
  value: EntitlementsForm;
  onChange: (next: EntitlementsForm) => void;
}) {
  function setModuleAccess(id: PlanModuleId, next: ModuleAccess) {
    onChange({ ...value, modules: { ...value.modules, [id]: next } });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Module access</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Read = sidebar + view API · Edit = create/update · Delete = remove records. Legacy plans with a single checkbox
          still map to full access.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/[0.03]">
              <th className="px-3 py-2.5 font-medium min-w-[200px]">Module</th>
              <th className="px-2 py-2.5 font-medium text-center w-14">All</th>
              <th className="px-2 py-2.5 font-medium text-center w-14">Read</th>
              <th className="px-2 py-2.5 font-medium text-center w-14">Edit</th>
              <th className="px-2 py-2.5 font-medium text-center w-14">Delete</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_MODULES.map((mod) => {
              const access = value.modules[mod.id];
              const allOn = isFullModuleAccess(access);
              const off = !access.read && !access.edit && !access.delete;
              return (
                <tr
                  key={mod.id}
                  className="border-b border-slate-100 dark:border-slate-800/80 align-top last:border-0"
                >
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{mod.label}</div>
                    <code className="text-[11px] text-accent-600 dark:text-accent-400">{mod.id}</code>
                    <p className="mt-1 text-xs text-slate-500 leading-snug">
                      {mod.menus.map((m) => m.label).join(" · ")}
                    </p>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <AccessToggle
                      label={`${mod.label} all`}
                      checked={allOn}
                      onChange={(on) => setModuleAccess(mod.id, patchModuleAccess(access, { all: on }))}
                    />
                  </td>
                  {MODULE_ACCESS_LEVELS.map((level) => (
                    <td key={level} className="px-2 py-3 text-center">
                      <AccessToggle
                        label={`${mod.label} ${level}`}
                        checked={access[level]}
                        disabled={off && level !== "read"}
                        onChange={(on) =>
                          setModuleAccess(mod.id, patchModuleAccess(access, { level, on }))
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={value.unlimitedBranches}
              onChange={(e) => onChange({ ...value, unlimitedBranches: e.target.checked })}
            />
            Unlimited branches <code className="text-[10px]">maxBranches</code>
          </label>
          {!value.unlimitedBranches ? (
            <input
              className="input mt-1"
              type="number"
              min={0}
              value={value.maxBranches}
              onChange={(e) => onChange({ ...value, maxBranches: e.target.value })}
            />
          ) : null}
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={value.unlimitedStaff}
              onChange={(e) => onChange({ ...value, unlimitedStaff: e.target.checked })}
            />
            Unlimited staff <code className="text-[10px]">maxStaff</code>
          </label>
          {!value.unlimitedStaff ? (
            <input
              className="input mt-1"
              type="number"
              min={0}
              value={value.maxStaff}
              onChange={(e) => onChange({ ...value, maxStaff: e.target.value })}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
