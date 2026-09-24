/**
 * Garde-fous déterministes, exécutés AVANT l'appel au LLM.
 * Si un signal d'alerte est détecté, la réponse commence obligatoirement
 * par l'orientation médicale, quel que soit le reste de la conversation.
 * (Filet de sécurité, pas un outil de triage médical.)
 */
export type SafetyLevel = "emergency" | "medical" | "caution" | "none";

interface Rule {
  level: SafetyLevel;
  pattern: RegExp;
  reason: string;
}

const RULES: Rule[] = [
  { level: "emergency", pattern: /douleur (dans la |à la |a la )?poitrine|douleur thoracique|oppression thoracique|serrement (dans la|à la) poitrine/i, reason: "douleur thoracique" },
  { level: "emergency", pattern: /(perte de connaissance|évanoui|evanoui|syncope|je suis tomb[ée] dans les pommes)/i, reason: "perte de connaissance" },
  { level: "emergency", pattern: /(palpitations?|cœur qui s'emballe|coeur qui s'emballe|rythme cardiaque irrégulier|arythmie)/i, reason: "symptôme cardiaque" },
  { level: "emergency", pattern: /(essoufflement (anormal|au repos)|du mal à respirer|difficult[ée]s? à respirer)/i, reason: "difficulté respiratoire" },
  { level: "emergency", pattern: /(urine (très )?(foncée|marron|couleur coca))|rhabdo/i, reason: "urines foncées après effort (possible rhabdomyolyse)" },
  { level: "medical", pattern: /(malaise|vertiges?|confusion|vision (floue|trouble))/i, reason: "malaise / symptôme neurologique" },
  { level: "medical", pattern: /(craquement|claquement|entorse|gonfl[ée]|hématome|ne peux (plus )?(poser|marcher)|je boite|boiterie)/i, reason: "suspicion de lésion" },
  { level: "medical", pattern: /(douleur (osseuse|sur l'os|précise sur l'os)|fracture de fatigue|périoste)/i, reason: "douleur osseuse localisée" },
  { level: "caution", pattern: /\b(mal aux?|mal au|douleurs?|douloureux|douloureuse)\b/i, reason: "douleur signalée" },
];

export interface SafetyCheck {
  level: SafetyLevel;
  reasons: string[];
  /** Préambule imposé à la réponse du coach. */
  preamble?: string;
}

export function checkSafety(message: string, painScore?: number): SafetyCheck {
  const hits = RULES.filter((r) => r.pattern.test(message));
  const order: SafetyLevel[] = ["emergency", "medical", "caution", "none"];
  let level: SafetyLevel = hits.length ? hits.map((h) => h.level).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]! : "none";
  if (painScore !== undefined && painScore >= 7 && order.indexOf(level) > order.indexOf("medical")) level = "medical";
  const reasons = [...new Set(hits.map((h) => h.reason))];

  let preamble: string | undefined;
  if (level === "emergency") {
    preamble =
      "⚠️ Ce que tu décris peut être sérieux. Arrête tout effort et appelle le 15 (SAMU) ou le 112 si c'est en cours ou si ça revient. Je ne suis pas médecin et je ne peux pas évaluer ça.";
  } else if (level === "medical") {
    preamble =
      "Je ne peux pas poser de diagnostic. Avec ces symptômes, pas d'entraînement intense : fais-toi examiner par un médecin, un kiné ou le staff médical du club.";
  }
  return { level, reasons, preamble };
}
