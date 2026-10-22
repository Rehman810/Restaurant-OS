import { Prisma } from "@prisma/client";
import { getRestaurantId, withoutTenant } from "./restaurant-context";
import { basePrisma } from "./prisma";

type SqlClient = {
  $executeRaw: Function;
  $queryRaw: Function;
};

/** Sets the transaction-local tenant id, then runs SQL. The statement must also filter on that id. */
export async function tenantExecuteRaw(tx: SqlClient, query: Prisma.Sql) {
  const restaurantId = getRestaurantId();
  await tx.$executeRaw(Prisma.sql`SELECT set_config('app.tenant_id', ${restaurantId}, true)`);
  return tx.$executeRaw(query);
}

export async function tenantQueryRaw<T>(tx: SqlClient, query: Prisma.Sql): Promise<T> {
  const restaurantId = getRestaurantId();
  await tx.$executeRaw(Prisma.sql`SELECT set_config('app.tenant_id', ${restaurantId}, true)`);
  return tx.$queryRaw(query) as Promise<T>;
}

/** Connectivity probe only. Does not read tenant rows. */
export function unscopedQueryRaw<T>(reason: string, query: Prisma.Sql): Promise<T> {
  return withoutTenant(reason, () => basePrisma.$queryRaw<T>(query));
}
