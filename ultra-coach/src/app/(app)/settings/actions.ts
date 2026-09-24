"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { deauthorize } from "@/server/strava/client";
import { backfillStrava } from "@/server/strava/import";

export async function syncStrava() {
  const { user } = await requireAthlete();
  const integration = await db.integration.findUnique({ where: { userId_provider: { userId: user.id, provider: "strava" } } });
  if (!integration) redirect("/settings");
  let status = "synced";
  try {
    await backfillStrava(integration, 14);
  } catch (e) {
    console.error("[strava sync]", e);
    status = "sync_error";
  }
  revalidatePath("/");
  redirect(`/settings?strava=${status}`);
}

export async function disconnectStrava() {
  const { user } = await requireAthlete();
  const integration = await db.integration.findUnique({ where: { userId_provider: { userId: user.id, provider: "strava" } } });
  if (integration) await deauthorize(integration);
  revalidatePath("/settings");
  redirect("/settings?strava=disconnected");
}
