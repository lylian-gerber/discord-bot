import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { appUrl, authorizeUrl, stravaConfigured } from "@/server/strava/client";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login`);
  if (!stravaConfigured()) return NextResponse.redirect(`${appUrl()}/settings?strava=not_configured`);
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("uc_strava_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return NextResponse.redirect(authorizeUrl(state));
}
