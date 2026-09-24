// Crée (ou affiche) l'abonnement webhook Strava de l'application.
// Usage : node --env-file=.env scripts/strava-subscribe.mjs
// Prérequis : l'appli est en ligne sur APP_URL (Strava appelle /api/webhooks/strava pour valider).
const { STRAVA_CLIENT_ID: id, STRAVA_CLIENT_SECRET: secret, STRAVA_VERIFY_TOKEN: verify, APP_URL: app } = process.env;
if (!id || !secret || !verify || !app) {
  console.error("Il manque STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_VERIFY_TOKEN ou APP_URL.");
  process.exit(1);
}
const base = "https://www.strava.com/api/v3/push_subscriptions";
const existing = await (await fetch(`${base}?client_id=${id}&client_secret=${secret}`)).json();
if (Array.isArray(existing) && existing.length) {
  console.log("Abonnement déjà actif :", existing);
  process.exit(0);
}
const res = await fetch(base, {
  method: "POST",
  body: new URLSearchParams({ client_id: id, client_secret: secret, callback_url: `${app.replace(/\/$/, "")}/api/webhooks/strava`, verify_token: verify }),
});
console.log(res.status, await res.json());
