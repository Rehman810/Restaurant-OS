import { Prisma } from "@prisma/client";
import { getRestaurantId, isTenantBypass, TenantContextError } from "./restaurant-context";
import { basePrisma } from "./prisma-base";

export { basePrisma };

const LIST_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

const tenantModels = new Set(
  Prisma.dmmf.datamodel.models.filter((model) => model.fields.some((field) => field.name === "restaurantId")).map((model) => model.name)
);

const modelsByName = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));

export function isTenantModel(model?: string) {
  return !!model && tenantModels.has(model);
}

function delegate(model: string) {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  return (basePrisma as unknown as Record<string, { findFirst: (args: object) => Promise<{ id?: string } | null> }>)[key];
}

function stampTenantPayload(model: string, data: unknown, restaurantId: string): unknown {
  if (Array.isArray(data)) return data.map((row) => stampTenantPayload(model, row, restaurantId));
  if (!data || typeof data !== "object") return data;
  const meta = modelsByName.get(model);
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  if (meta?.fields.some((field) => field.name === "restaurantId")) {
    out.restaurantId = restaurantId;
  }
  if (!meta) return out;
  for (const field of meta.fields) {
    if (field.kind !== "object") continue;
    const value = out[field.name];
    if (!value || typeof value !== "object") continue;
    const nested = value as Record<string, unknown>;
    if (nested.create !== undefined) nested.create = stampTenantPayload(field.type, nested.create, restaurantId);
    if (nested.createMany && typeof nested.createMany === "object") {
      const many = nested.createMany as { data?: unknown };
      if (many.data !== undefined) many.data = stampTenantPayload(field.type, many.data, restaurantId);
    }
    const stampWrapped = (key: "connectOrCreate" | "upsert") => {
      const wrapped = nested[key];
      if (!wrapped) return;
      const rows = Array.isArray(wrapped) ? wrapped : [wrapped];
      for (const row of rows) {
        if (row && typeof row === "object" && "create" in row) {
          (row as { create: unknown }).create = stampTenantPayload(field.type, (row as { create: unknown }).create, restaurantId);
        }
      }
    };
    stampWrapped("connectOrCreate");
    stampWrapped("upsert");
  }
  return out;
}

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (isTenantBypass()) return query(args);
        if (model === "Restaurant") return scopeRestaurant(operation, args, query);
        if (!isTenantModel(model)) return query(args);
        let restaurantId: string;
        try {
          restaurantId = getRestaurantId();
        } catch (err) {
          if (err instanceof TenantContextError) throw err;
          throw err;
        }
        const next = args as {
          where?: object;
          data?: unknown;
          create?: unknown;
          select?: Record<string, unknown>;
        };

        if ((operation === "create" || operation === "createMany") && next.data) {
          next.data = stampTenantPayload(model, next.data, restaurantId);
        } else if (operation === "upsert" && next.create) {
          next.create = stampTenantPayload(model, next.create, restaurantId);
          if (next.data) next.data = stampTenantPayload(model, next.data, restaurantId);
        } else if (LIST_OPS.has(operation)) {
          next.where = { AND: [next.where || {}, { restaurantId }] };
        }

        let stripRestaurantId = false;
        if (
          (operation === "findUnique" || operation === "findUniqueOrThrow") &&
          next.select &&
          !next.select.restaurantId
        ) {
          next.select = { ...next.select, restaurantId: true };
          stripRestaurantId = true;
        }

        if (operation === "update" || operation === "delete") {
          const existing = await delegate(model).findFirst({
            where: { AND: [filterWhere((args as { where?: object }).where), { restaurantId }] },
            select: { id: true },
          });
          if (!existing) {
            const err = new Error("Record not found") as Error & { code?: string };
            err.code = "P2025";
            throw err;
          }
        }

        const row = await query(args);
        if (
          (operation === "findUnique" || operation === "findUniqueOrThrow") &&
          row &&
          typeof row === "object" &&
          "restaurantId" in row &&
          (row as { restaurantId?: string }).restaurantId !== restaurantId
        ) {
          if (operation === "findUniqueOrThrow") {
            const err = new Error("Record not found") as Error & { code?: string };
            err.code = "P2025";
            throw err;
          }
          return null;
        }
        if (stripRestaurantId && row && typeof row === "object") {
          delete (row as { restaurantId?: string }).restaurantId;
        }
        return row;
      },
    },
  },
});

/** findUnique accepts compound keys like branchId_itemId. findFirst needs the fields. */
function filterWhere(where: object | undefined): object {
  if (!where) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
    if (
      key.includes("_") &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.values(value as Record<string, unknown>).every((item) => item == null || typeof item !== "object")
    ) {
      Object.assign(out, value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function notFound() {
  const err = new Error("Record not found") as Error & { code?: string };
  err.code = "P2025";
  return err;
}

async function scopeRestaurant(
  operation: string,
  args: unknown,
  query: (args: unknown) => Promise<unknown>
) {
  const restaurantId = getRestaurantId();
  const next = args as { where?: { id?: string } & object; select?: Record<string, unknown> };
  if (operation === "create" || operation === "createMany") {
    throw new TenantContextError("Restaurants are created from the platform.");
  }
  if (LIST_OPS.has(operation)) {
    next.where = { AND: [next.where || {}, { id: restaurantId }] } as { id?: string };
  }
  if (operation === "update" || operation === "delete" || operation === "upsert") {
    if (next.where?.id && next.where.id !== restaurantId) throw notFound();
    if (!next.where?.id) {
      const existing = await basePrisma.restaurant.findFirst({
        where: { AND: [next.where || {}, { id: restaurantId }] },
        select: { id: true },
      });
      if (!existing) throw notFound();
    }
  }
  const row = await query(args);
  if (
    (operation === "findUnique" || operation === "findUniqueOrThrow") &&
    row &&
    typeof row === "object" &&
    "id" in row &&
    (row as { id?: string }).id !== restaurantId
  ) {
    if (operation === "findUniqueOrThrow") throw notFound();
    return null;
  }
  return row;
}

export { runWithRestaurant } from "./restaurant-context";
export {
  resolveRestaurantIdForHost as resolveRestaurantId,
  resolveRestaurantIdFromRequest,
  resolveRequestHost,
  invalidateTenantHostCache,
} from "./tenant-resolve";
