import "server-only";
import type { Integration } from "@prisma/client";
import { decrypt, encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

const API = () => process.env.STRAVA_API_BASE ?? "https://www.strava.com/api/v3";
const OAUTH = () => process.env.STRAVA_OAUTH_BASE ?? "https://www.strava.com";

export function stravaConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET && process.env.TOKEN_ENC_KEY);
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function authorizeUrl(state: string): string {
  const u = new URL(`${OAUTH()}/oauth/authorize`);
  u.searchParams.set("client_id", process.env.STRAVA_CLIENT_ID ?? "");
  u.searchParams.set("redirect_uri", `${appUrl()}/api/strava/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("approval_prompt", "auto");
  u.searchParams.set("scope", "read,activity:read_all,profile:read_all");
  u.searchParams.set("state", state);
  return u.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
  scope?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH()}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.STRAVA_CLIENT_ID ?? "", client_secret: process.env.STRAVA_CLIENT_SECRET ?? "", ...params }),
  });
  if (!res.ok) throw new Error(`Strava token ${res.status}: ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}

export class StravaAlreadyLinkedError extends Error {}

export async function exchangeCode(userId: string, code: string, scope: string | null) {
  const t = await tokenRequest({ code, grant_type: "authorization_code" });
  if (t.athlete) {
    const other = await db.integration.findUnique({ where: { provider_externalUserId: { provider: "strava", externalUserId: String(t.athlete.id) } } });
    if (other && other.userId !== userId) throw new StravaAlreadyLinkedError("Ce compte Strava est déjà lié à un autre compte.");
  }
  const data = {
    externalUserId: t.athlete ? String(t.athlete.id) : null,
    accessTokenEnc: encrypt(t.access_token),
    refreshTokenEnc: encrypt(t.refresh_token),
    expiresAt: new Date(t.expires_at * 1000),
    scopes: (scope ?? t.scope ?? "").split(",").filter(Boolean),
    status: "active",
  };
  return db.integration.upsert({
    where: { userId_provider: { userId, provider: "strava" } },
    create: { userId, provider: "strava", ...data },
    update: data,
  });
}

/** Token d'accès valide (rafraîchi s'il expire dans moins de 5 min). */
export async function accessToken(integration: Integration): Promise<string> {
  if (integration.expiresAt && integration.expiresAt.getTime() - Date.now() > 5 * 60_000) return decrypt(integration.accessTokenEnc);
  if (!integration.refreshTokenEnc) throw new Error("Pas de refresh token Strava");
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(integration.refreshTokenEnc) });
  await db.integration.update({
    where: { id: integration.id },
    data: { accessTokenEnc: encrypt(t.access_token), refreshTokenEnc: encrypt(t.refresh_token), expiresAt: new Date(t.expires_at * 1000) },
  });
  return t.access_token;
}

export class StravaRateLimitError extends Error {}

export async function stravaGet<T>(integration: Integration, path: string): Promise<T> {
  const res = await fetch(`${API()}${path}`, { headers: { authorization: `Bearer ${await accessToken(integration)}` }, cache: "no-store" });
  if (res.status === 429) throw new StravaRateLimitError("Limite de requêtes Strava atteinte, réessaie dans 15 minutes.");
  if (res.status === 401) {
    await db.integration.update({ where: { id: integration.id }, data: { status: "revoked" } });
    throw new Error("Accès Strava révoqué : reconnecte ton compte.");
  }
  if (!res.ok) throw new Error(`Strava ${res.status} sur ${path}`);
  return res.json() as Promise<T>;
}

export async function deauthorize(integration: Integration) {
  await fetch(`${OAUTH()}/oauth/deauthorize`, {
    method: "POST",
    headers: { authorization: `Bearer ${await accessToken(integration).catch(() => "")}` },
  }).catch(() => undefined);
  await db.integration.delete({ where: { id: integration.id } });
}
