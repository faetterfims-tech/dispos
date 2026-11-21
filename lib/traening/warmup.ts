/**
 * Trin til opvarmnings-timeren: hvert hold, hvert sideskift og hver pause
 * som ét trin med en nedtælling.
 */

export type StepKind = "hold" | "skift" | "klar";

export interface TimerStep {
  /** Hvilken opvarmningsøvelse (indeks i RYG_OPVARMNING). */
  item: number;
  kind: StepKind;
  /** Stor tekst: hvad man gør nu. */
  title: string;
  /** Lille tekst under, fx "Hold 3 af 12". */
  sub: string;
  seconds: number;
}

export interface WarmupPlan {
  name: string;
  /** Antal hold i alt (pr. side tæller hver for sig). */
  holds: number;
  holdSec: number;
  /** Skiftes der mellem to positioner? Så veksles der for hvert hold. */
  sides?: [string, string];
  /** Tekst for hold, når der ikke er sider. */
  holdLabel?: string;
  /** Pause/skift mellem hold. */
  betweenSec: number;
  /** Ekstra besked midtvejs (fx "Skift ben"). */
  halfway?: string;
}

export const WARMUP_PLANS: WarmupPlan[] = [
  {
    name: "Firfod-stræk",
    holds: 12,
    holdSec: 10,
    sides: ["Højre arm + venstre ben ud", "Venstre arm + højre ben ud"],
    betweenSec: 3,
  },
  {
    name: "Planke på siden",
    holds: 6,
    holdSec: 15,
    sides: ["Højre side: løft hoften", "Venstre side: løft hoften"],
    betweenSec: 8,
  },
  {
    name: "Lille mavebøjning",
    holds: 6,
    holdSec: 10,
    holdLabel: "Løft hoved og skuldre lidt",
    betweenSec: 5,
    halfway: "Skift ben: bøj det andet knæ",
  },
];

/** Tid i sekunder, man har til at komme på plads før en ny øvelse. */
export const GET_READY_SEC = 10;

/** Alle trin, eller kun én øvelses trin (`only` = indeks). */
export function buildSteps(plans: WarmupPlan[] = WARMUP_PLANS, only?: number): TimerStep[] {
  const steps: TimerStep[] = [];
  plans.forEach((p, item) => {
    if (only !== undefined && item !== only) return;
    const sub = only === undefined ? `Øvelse ${item + 1} af ${plans.length}` : p.name;
    steps.push({ item, kind: "klar", title: `Gør klar: ${p.name}`, sub, seconds: GET_READY_SEC });
    for (let h = 0; h < p.holds; h++) {
      const title = p.sides ? p.sides[h % 2] : (p.holdLabel ?? "Hold");
      steps.push({ item, kind: "hold", title, sub: `${p.name} · hold ${h + 1} af ${p.holds}`, seconds: p.holdSec });
      const last = h === p.holds - 1;
      if (last) continue;
      const isHalf = p.halfway && h + 1 === Math.floor(p.holds / 2);
      const nextTitle = p.sides ? p.sides[(h + 1) % 2] : (p.holdLabel ?? "Hold");
      steps.push({
        item,
        kind: "skift",
        title: isHalf ? p.halfway! : p.sides ? "Skift side" : "Slap af",
        sub: `Næste: ${nextTitle}`,
        seconds: isHalf ? Math.max(p.betweenSec, 8) : p.betweenSec,
      });
    }
  });
  return steps;
}

export const totalSeconds = (steps: TimerStep[]) => steps.reduce((s, x) => s + x.seconds, 0);
