import { cookies } from "next/headers";
import { after, NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { appUrl, exchangeCode, StravaAlreadyLinkedError } from "@/server/strava/client";
import { backfillStrava } from "@/server/strava/import";

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login`);
  const jar = await cookies();
  const expected = jar.get("uc_strava_state")?.value;
  jar.delete("uc_strava_state");
  const p = req.nextUrl.searchParams;
  const code = p.get("code");
  if (p.get("error") || !code || !expected || p.get("state") !== expected) {
    return NextResponse.redirect(`${appUrl()}/settings?strava=denied`);
  }
  const scope = p.get("scope");
  if (!scope?.includes("activity:read")) return NextResponse.redirect(`${appUrl()}/settings?strava=missing_scope`);
  try {
    const integration = await exchangeCode(user.id, code, scope);
    // L'historique s'importe en arrière-plan : l'utilisateur n'attend pas.
    after(() => backfillStrava(integration).catch((e) => console.error("[strava backfill]", e)));
  } catch (e) {
    if (e instanceof StravaAlreadyLinkedError) return NextResponse.redirect(`${appUrl()}/settings?strava=already_linked`);
    console.error("[strava callback]", e);
    return NextResponse.redirect(`${appUrl()}/settings?strava=error`);
  }
  return NextResponse.redirect(`${appUrl()}/settings?strava=connected`);
}
