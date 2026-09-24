import { AlertTriangle, ChevronRight, Droplets, Moon, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { Bar, CardLink, fmtHours, Ring, Stat, tierColor } from "@/components/ui";
import { RpePrompt } from "@/components/RpePrompt";
import { WorkoutRow } from "@/components/WorkoutRow";
import { addDays } from "@/engine";
import { db } from "@/lib/db";
import { requireAthlete } from "@/lib/auth";
import { dbDate, formatDayFr, localToday } from "@/lib/day";
import { todayData } from "@/server/today";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { user, profile } = await requireAthlete();
  const day = localToday(user.timezone);
  const [t, toConfirm] = await Promise.all([
    todayData(user.id, profile, day),
    db.activity.findMany({ where: { userId: user.id, rpeEstimated: true, day: { gte: dbDate(addDays(day, -3)) } }, orderBy: { startAt: "desc" }, take: 3 }),
  ]);
  const r = t.readiness;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: user.timezone }).format(new Date()));
  const hello = hour < 18 ? "Bonjour" : "Bonsoir";
  const alerts = [...t.load.alerts, ...(r?.flags ?? [])].slice(0, 3);
  const trainingToday = t.workoutsToday.filter((w) => w.sport !== "football");
  const footballToday = t.workoutsToday.filter((w) => w.sport === "football");

  return (
    <div className="space-y-3">
      <header className="flex items-end justify-between pt-6">
        <div>
          <p className="text-sm capitalize text-muted">{formatDayFr(day)}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {hello} {user.name}
          </h1>
        </div>
        <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-sm font-semibold">
          {(user.name ?? "?").slice(0, 1).toUpperCase()}
        </Link>
      </header>

      {/* Forme */}
      {r ? (
        <CardLink href="/checkin" className="flex items-center gap-4">
          <Ring value={r.total} color={tierColor(r.tier)}>
            <span className="num text-3xl font-bold">{r.total}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted">Forme</span>
          </Ring>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="num grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <span className="text-muted">Récup <b className="text-fg">{r.recovery}</b></span>
              <span className="text-muted">Jambes <b className="text-fg">{r.legs}</b></span>
              <span className="text-muted">Cardio <b className="text-fg">{r.cardio}</b></span>
              <span className="text-muted">Sommeil <b className="text-fg">{r.sleep}</b></span>
            </div>
            <p className="text-sm leading-snug">{r.recommendation}</p>
          </div>
        </CardLink>
      ) : (
        <Link href="/checkin" className="card flex items-center gap-4 border-accent/40">
          <Ring value={0} color="var(--color-line)">
            <span className="text-2xl font-bold text-faint">?</span>
          </Ring>
          <div className="flex-1">
            <p className="font-semibold">Check-in du matin</p>
            <p className="mt-1 text-sm text-muted">60 secondes pour calculer ta forme et adapter ta séance.</p>
            <span className="btn-primary mt-3 h-10 text-sm">Faire mon check-in</span>
          </div>
        </Link>
      )}

      {/* Aujourd'hui */}
      <section className="card">
        <p className="label">Aujourd&apos;hui</p>
        {t.workoutsToday.length === 0 && <p className="mt-2 text-muted">Repos. Profite-en pour bien manger et dormir.</p>}
        <div className="mt-1 divide-y divide-line">
          {trainingToday.map((w) => (
            <WorkoutRow key={w.id} w={w} big />
          ))}
          {footballToday.map((w) => (
            <WorkoutRow key={w.id} w={w} />
          ))}
        </div>
        {trainingToday.some((w) => w.adaptedReason) && (
          <p className="mt-2 rounded-lg bg-warn/10 p-2 text-xs text-warn">Séance adaptée à ta forme du jour.</p>
        )}
      </section>

      <RpePrompt activities={toConfirm} />

      {/* Demain / match */}
      <section className="card grid grid-cols-2 gap-4">
        <div>
          <p className="label">Demain</p>
          <p className="mt-1 font-semibold leading-snug">
            {t.workoutsTomorrow.length ? t.workoutsTomorrow.map((w) => w.title).join(" + ") : "Repos"}
          </p>
        </div>
        <div>
          <p className="label">Match</p>
          <p className="mt-1 font-semibold capitalize">
            {t.match ? (t.match.inDays === 0 ? "Aujourd'hui" : formatDayFr(t.match.day, { weekday: "long" })) : "—"}
          </p>
          {t.match && t.match.inDays > 0 && <p className="text-xs text-faint">J-{t.match.inDays}</p>}
        </div>
      </section>

      {/* Sommeil / eau / nutrition */}
      <section className="grid grid-cols-3 gap-3">
        <Link href="/checkin" className="card p-3">
          <Moon size={16} className="text-muted" />
          <p className="num mt-2 text-lg font-semibold">{t.sleep.lastNight !== undefined ? fmtHours(t.sleep.lastNight) : "—"}</p>
          <p className="text-[11px] text-faint">Coucher {t.bedtime}</p>
        </Link>
        <Link href="/nutrition" className="card p-3">
          <Droplets size={16} className="text-muted" />
          <p className="num mt-2 text-lg font-semibold">
            {(t.hydrationMl / 1000).toFixed(1)}
            <span className="text-xs font-normal text-muted"> / {(t.nutrition.targets.waterMl / 1000).toFixed(1)} L</span>
          </p>
          <Bar value={t.hydrationMl} max={t.nutrition.targets.waterMl} className="mt-1.5" />
        </Link>
        <Link href="/nutrition" className="card p-3">
          <UtensilsCrossed size={16} className="text-muted" />
          <p className="num mt-2 text-lg font-semibold">{t.nutrition.targets.carbsG} g</p>
          <p className="text-[11px] leading-tight text-faint">glucides · {t.nutrition.label}</p>
        </Link>
      </section>

      {/* Alertes */}
      {alerts.length > 0 && (
        <section className="card space-y-2 border-warn/30">
          {alerts.map((a) => (
            <p key={a} className="flex items-start gap-2 text-sm">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
              {a}
            </p>
          ))}
        </section>
      )}

      {/* Progression vers l'objectif */}
      {t.week && t.plan && (
        <CardLink href="/plan/timeline">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">{t.plan.goal.race?.name ?? "Objectif"}</p>
              <p className="mt-1 font-semibold">
                {t.phaseName} · semaine {t.week.phaseWeek}/{t.week.phaseWeeks}
              </p>
            </div>
            <div className="text-right">
              <p className="num text-2xl font-bold">J-{t.daysToRace}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Charge 7j" value={t.load.acute7} />
            <Stat label="Moy. 4 sem" value={t.load.chronic28WeeklyAvg} />
            <Stat label="Course/sem" value={fmtHours(t.week.runHours)} />
          </div>
        </CardLink>
      )}

      <Link href="/coach" className="card flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink">💬</span>
        <span className="flex-1 text-muted">Demande à ton coach IA…</span>
        <ChevronRight size={18} className="text-faint" />
      </Link>
    </div>
  );
}
