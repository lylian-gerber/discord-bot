import { describe, expect, it } from "vitest";
import {
  addDays,
  adaptSession,
  bedtime,
  buildMacrocycle,
  checkSafety,
  computeDurability,
  computeReadiness,
  currentWeek,
  dailyTargets,
  distributeMeals,
  drinkPlan,
  gearChecklist,
  gradeFactor,
  macroWarnings,
  nextGutTarget,
  phaseLabel,
  planWeek,
  sessionLoad,
  shoeStatus,
  sleepSummary,
  summarizeLoad,
  sweatRate,
  type LoadSession,
  type StreamPoint,
  type WeekDayPlan,
} from "../index";

const TODAY = "2026-09-24";

describe("load", () => {
  it("sRPE = durée × RPE", () => {
    expect(sessionLoad({ durationMin: 90, rpe: 7 })).toBe(630);
    expect(() => sessionLoad({ durationMin: 60, rpe: 11 })).toThrow();
  });

  it("détecte un pic de charge", () => {
    const sessions: LoadSession[] = [];
    // 4 semaines stables à ~2000 UA/sem puis semaine à ~3000
    for (let d = 35; d >= 7; d--) sessions.push({ date: addDays(TODAY, -d), category: "football", durationMin: 60, rpe: 5 });
    for (let d = 6; d >= 0; d--) sessions.push({ date: addDays(TODAY, -d), category: "trail", durationMin: 90, rpe: 5 });
    const s = summarizeLoad(sessions, TODAY);
    expect(s.acute7).toBe(3150);
    expect(s.weeklyChangePct).toBeGreaterThan(20);
    expect(s.alerts.some((a) => a.startsWith("Charge +"))).toBe(true);
    expect(s.byCategory7.trail).toBe(3150);
    expect(["caution", "danger"]).toContain(s.status);
  });

  it("pas d'ACWR sans historique suffisant", () => {
    const s = summarizeLoad([{ date: TODAY, category: "running", durationMin: 30, rpe: 4 }], TODAY);
    expect(s.acwrRolling).toBeNull();
    expect(s.status).toBe("optimal");
  });
});

describe("readiness", () => {
  const good = { sleepQuality: 8, sleepHours: 8, fatigue: 2, legs: 8, pain: 0, motivation: 8, stress: 2, energy: 8, soreness: 2 };
  const base = { sleepNeedHours: 8, restingHrMean: 50, restingHrSd: 2, lnRmssdMean: Math.log(80), lnRmssdSd: 0.1 };

  it("bonne forme → feu vert", () => {
    const r = computeReadiness({ ...good, restingHr: 49, hrvRmssd: 82 }, base);
    expect(r.total).toBeGreaterThanOrEqual(75);
    expect(r.blockRunning).toBe(false);
  });

  it("FC repos élevée et HRV basse → cardio dégradé + flags", () => {
    const r = computeReadiness({ ...good, restingHr: 56, hrvRmssd: 55 }, base);
    expect(r.cardio).toBeLessThan(40);
    expect(r.flags.join()).toMatch(/FC repos/);
  });

  it("douleur ≥ 7 bloque la course", () => {
    const r = computeReadiness({ ...good, pain: 8 }, base);
    expect(r.blockRunning).toBe(true);
    expect(r.tier).toBe("rest");
    expect(r.total).toBeLessThanOrEqual(30);
  });

  it("lendemain de match 90 min → jambes pénalisées", () => {
    const fresh = computeReadiness(good, base);
    const post = computeReadiness(good, base, { hoursSinceMatch: 16, minutesPlayedLastMatch: 90 });
    expect(post.legs).toBeLessThan(fresh.legs - 15);
  });
});

describe("durability", () => {
  it("Minetti : montée plus coûteuse, légère descente moins coûteuse", () => {
    expect(gradeFactor(0)).toBeCloseTo(1, 5);
    expect(gradeFactor(0.1)).toBeGreaterThan(1.4);
    expect(gradeFactor(-0.1)).toBeLessThan(1);
  });

  function stream(hours: number, speedAt: (tS: number) => number, hrAt: (tS: number) => number): StreamPoint[] {
    const pts: StreamPoint[] = [];
    let d = 0;
    for (let t = 0; t <= hours * 3600; t += 10) {
      pts.push({ t, d, alt: 100, hr: hrAt(t) });
      d += speedAt(t) * 10;
    }
    return pts;
  }

  it("aucune dégradation → score élevé", () => {
    const r = computeDurability(stream(3.2, () => 3, () => 140))!;
    expect(r.basis).toBe("efficiency");
    expect(r.score).toBeGreaterThanOrEqual(95);
    expect(Math.abs(r.decouplingPct!)).toBeLessThan(1);
  });

  it("allure qui chute à FC constante → score bas", () => {
    const r = computeDurability(stream(3.2, (t) => (t < 3600 ? 3 : 3 - (t - 3600) / 7200 * 0.6), () => 145))!;
    expect(r.score).toBeLessThan(70);
    expect(r.retentionByHour[0]!.retentionPct).toBeLessThan(100);
  });

  it("séance trop courte → null", () => {
    expect(computeDurability(stream(0.5, () => 3, () => 140))).toBeNull();
  });
});

describe("nutrition & hydratation", () => {
  const athlete = { weightKg: 75, heightCm: 180, age: 22, sex: "male" as const, bodyFatPct: 11, weightGoalKgPerWeek: -0.3 };

  it("plus de glucides la veille de match qu'au repos", () => {
    const rest = dailyTargets(athlete, { dayType: "rest", exerciseKcal: 0, exerciseMin: 0 });
    const eve = dailyTargets(athlete, { dayType: "match_eve", exerciseKcal: 300, exerciseMin: 45 });
    expect(eve.carbsG).toBeGreaterThan(rest.carbsG * 1.5);
    expect(eve.warnings.join()).toMatch(/Pas de déficit/);
  });

  it("répartition des repas conserve les totaux", () => {
    const t = dailyTargets(athlete, { dayType: "long_run", exerciseKcal: 1500, exerciseMin: 180 });
    const meals = distributeMeals(t, ["breakfast", "lunch", "pre_workout", "during_workout", "post_workout", "dinner"], 150);
    const carbs = Object.values(meals).reduce((a, m) => a + m.carbsG, 0);
    expect(Math.abs(carbs - t.carbsG)).toBeLessThanOrEqual(3);
  });

  it("taux de sudation", () => {
    const r = sweatRate({ weightBeforeKg: 75, weightAfterKg: 74, fluidIntakeMl: 500, durationMin: 90 });
    expect(r.sweatRateLph).toBe(1);
    expect(r.bodyMassLossPct).toBeCloseTo(1.3, 1);
  });

  it("prise de poids pendant l'effort → alerte hyponatrémie", () => {
    const r = sweatRate({ weightBeforeKg: 75, weightAfterKg: 75.4, fluidIntakeMl: 2000, durationMin: 120 });
    expect(r.warnings.join()).toMatch(/hyponatrémie/);
  });

  it("le plan de boisson ne dépasse jamais le taux de sudation", () => {
    const p = drinkPlan({ sweatRateLph: 0.4, temperatureC: 12, durationMin: 240 });
    expect(p.mlPerHour).toBeLessThanOrEqual(400);
    const hot = drinkPlan({ sweatRateLph: 1, temperatureC: 30, durationMin: 240 });
    expect(hot.mlPerHour).toBeGreaterThan(p.mlPerHour);
    expect(hot.notes.join()).toMatch(/Chaleur/);
  });
});

describe("entraînement digestif", () => {
  it("monte après 2 sorties tolérées, redescend après symptômes", () => {
    const ok = (date: string, g: number) => ({ date, durationMin: 120, targetCarbsPerHour: g, actualCarbsPerHour: g, symptoms: {}, products: ["gel A"] });
    expect(nextGutTarget([ok("2026-10-01", 30), ok("2026-10-08", 30)]).nextTarget).toBe(40);
    const bad = { ...ok("2026-10-15", 40), symptoms: { nausea: 7 }, products: ["gel X"] };
    const s = nextGutTarget([ok("2026-10-01", 30), ok("2026-10-08", 30), bad, { ...bad, date: "2026-10-22", targetCarbsPerHour: 30, actualCarbsPerHour: 30 }]);
    expect(s.nextTarget).toBe(30);
    expect(s.productsToAvoid).toContain("gel X");
  });
});

describe("périodisation", () => {
  const plan = buildMacrocycle({
    start: TODAY,
    raceDate: "2027-06-26",
    raceDistanceKm: 100,
    raceDplusM: 4500,
    currentWeeklyRunHours: 1.5,
    currentLongestRunMin: 75,
    seasonEnd: "2027-05-22",
    breaks: [{ from: "2026-12-19", to: "2027-01-04" }],
  });

  it("couvre jusqu'à la course et finit par l'affûtage", () => {
    expect(plan.at(-1)!.phase).toBe("taper");
    expect(plan.filter((w) => w.phase === "taper")).toHaveLength(2);
    const maxLoaded = Math.max(...plan.filter((w) => w.phase !== "taper").map((w) => w.runHours));
    for (const w of plan.filter((w) => w.phase === "taper")) expect(w.runHours).toBeLessThan(maxLoaded);
    expect(plan[0]!.phase).toBe("base");
  });

  it("progression ≤ +10 % (+0,25 h) d'une semaine chargée à l'autre hors affûtage", () => {
    const loaded = plan.filter((w) => !w.isDeload && w.phase !== "taper");
    for (let i = 1; i < loaded.length; i++) {
      expect(loaded[i]!.runHours).toBeLessThanOrEqual(loaded[i - 1]!.runHours * 1.1 + 0.5);
    }
  });

  it("volume plafonné en saison, pic après la fin de saison", () => {
    for (const w of plan.filter((w) => w.context === "in_season")) {
      expect(w.runHours).toBeLessThanOrEqual(4.5);
      expect(w.longRunMin).toBeLessThanOrEqual(150);
    }
    const maxWeek = plan.reduce((a, w) => (w.runHours > a.runHours ? w : a));
    expect(maxWeek.context).toBe("off_season");
  });

  it("signale franchement la fenêtre hors saison trop courte", () => {
    const w = macroWarnings(plan, { start: TODAY, raceDate: "2027-06-26", raceDistanceKm: 100, raceDplusM: 4500, currentWeeklyRunHours: 1.5, currentLongestRunMin: 75, seasonEnd: "2027-05-22" });
    expect(w.join()).toMatch(/hors saison/);
  });

  it("libellé de phase", () => {
    expect(phaseLabel(currentWeek(plan, TODAY)!)).toMatch(/^Phase actuelle : Base aérobie \/ Semaine 1 sur \d+$/);
  });
});

describe("planning hebdo autour du football", () => {
  const template: WeekDayPlan[] = [
    { weekday: 0, football: "light" },
    { weekday: 1, football: "moderate" },
    { weekday: 2, football: "light" },
    { weekday: 3, football: "none" },
    { weekday: 4, football: "light" },
    { weekday: 5, football: "match" },
    { weekday: 6, football: "none" },
  ];
  const plan = buildMacrocycle({
    start: TODAY, raceDate: "2027-06-26", raceDistanceKm: 100, raceDplusM: 4500,
    currentWeeklyRunHours: 3, currentLongestRunMin: 100, seasonEnd: "2027-05-22",
  });
  const week = plan.find((w) => w.phase === "endurance" && !w.isDeload)!;
  const days = planWeek(template, week);

  it("rien le jour de match, pas de course la veille", () => {
    expect(days[5]!.sessions).toHaveLength(0);
    expect(days[4]!.sessions.filter((s) => !s.type.startsWith("strength"))).toHaveLength(0);
  });

  it("jeudi (MD-2, sans foot) = séance qualité avec descente limitée", () => {
    const q = days[3]!.sessions[0]!;
    expect(["tempo", "progressive"]).toContain(q.type);
    expect(q.durationMin).toBeLessThanOrEqual(75);
    expect(q.maxDescentM).toBe(150);
  });

  it("dimanche MD+1 = récupération, sortie longue en début de semaine", () => {
    expect(days[6]!.sessions[0]!.type).toBe("recovery");
    const longDay = days.find((d) => d.sessions.some((s) => s.type === "long" || s.type === "hike_run"))!;
    expect(longDay.daysToMatch).toBeGreaterThanOrEqual(3);
  });

  it("pas de muscu lourde à moins de 4 jours du match", () => {
    for (const d of days) {
      if (d.sessions.some((s) => s.type === "strength_heavy")) expect(d.daysToMatch).toBeGreaterThanOrEqual(4);
    }
  });

  it("douleur → la séance devient récupération", () => {
    const s = adaptSession({ type: "tempo", durationMin: 60 }, {
      total: 25, recovery: 50, legs: 30, cardio: 70, sleep: 70, mind: 70, tier: "rest", flags: [], recommendation: "", blockRunning: true,
    });
    expect(s!.type).toBe("recovery");
  });
});

describe("sommeil, matériel, sécurité", () => {
  it("dette de sommeil et heure de coucher", () => {
    const s = sleepSummary([6, 6.5, 7, 6, 8, 7, 6.3].map((h, i) => ({ date: addDays(TODAY, i - 7), hours: h })));
    expect(s.debtHours).toBeGreaterThan(5);
    expect(bedtime("07:00", 8, 0, false)).toBe("22h45");
    expect(bedtime("07:00", 8, 5, true)).toBe("21h45");
  });

  it("usure chaussures", () => {
    expect(shoeStatus({ km: 483 }).level).toBe("ok");
    expect(shoeStatus({ km: 520 }).message).toBe("Commence à surveiller l'usure.");
    expect(shoeStatus({ km: 720 }).level).toBe("replace");
  });

  it("checklist : 5 h de nuit → frontale + batterie", () => {
    const ids = gearChecklist({ durationMin: 300, distanceKm: 40, night: true }).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["headlamp", "battery", "vest", "blanket"]));
    expect(gearChecklist({ durationMin: 50, distanceKm: 10, night: false }).map((i) => i.id)).not.toContain("vest");
  });

  it("sécurité : douleur thoracique = urgence, 'je dors mal' ≠ alerte médicale", () => {
    expect(checkSafety("J'ai eu une douleur dans la poitrine pendant la côte").level).toBe("emergency");
    expect(checkSafety("Je dors mal depuis 3 jours").level).toBe("none");
    expect(checkSafety("J'ai mal aux mollets").level).toBe("caution");
    expect(checkSafety("C'est normal d'avoir faim ?").level).toBe("none");
    expect(checkSafety("cheville gonflée après l'entorse").level).toBe("medical");
  });
});
