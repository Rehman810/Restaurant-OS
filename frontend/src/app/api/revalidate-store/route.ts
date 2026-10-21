import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/** Called after admin saves storefront-related settings (ISR ~30s on /settings/public). */
export async function POST() {
  revalidatePath("/");
  revalidatePath("/menu");
  return NextResponse.json({ ok: true, revalidatedSeconds: 30 });
}
