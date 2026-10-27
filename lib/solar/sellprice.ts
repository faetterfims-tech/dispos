import type { HourData } from "./types";

/**
 * Min Strøm giver kun en salgspris i de timer, hvor der faktisk er solgt.
 * Scenariet "uden batteri" sælger i andre timer (typisk midt på dagen), så
 * salgsprisen skal estimeres for dem.
 *
 * Metode: købsprisen er (spot + variable afgifter/tariffer) inkl. moms.
 *   spot ekskl. moms ≈ (købspris − variable afgifter) / 1,25
 *   salgspris        ≈ spot ekskl. moms − gebyr
 * Gebyret kalibreres som medianen af forskellen i de timer, hvor både
 * købs- og salgspris er kendt. Uden kendte variable afgifter bruges i stedet
 * median(købspris − salgspris) som fast fradrag.
 */
export interface SellPriceInput extends HourData {
  /** Variable afgifter/tariffer pr. kWh fra Min Strøm (kan være null). */
  variableCharges?: number | null;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const VAT = 1.25;

export function fillSellPrices(hours: SellPriceInput[]): {
  hours: HourData[];
  method: "spot" | "offset" | "none";
  fee: number | null;
} {
  const spotDiffs: number[] = [];
  const offsetDiffs: number[] = [];
  for (const h of hours) {
    if (h.sellPrice == null || h.buyPrice == null) continue;
    offsetDiffs.push(h.buyPrice - h.sellPrice);
    if (h.variableCharges != null) {
      spotDiffs.push((h.buyPrice - h.variableCharges) / VAT - h.sellPrice);
    }
  }

  const spotFee = spotDiffs.length >= 24 ? median(spotDiffs) : null;
  const offset = median(offsetDiffs);
  const method = spotFee != null ? "spot" : offset != null ? "offset" : "none";

  const out: HourData[] = hours.map(({ variableCharges, ...h }) => {
    if (h.sellPrice != null || h.buyPrice == null) return h;
    let est: number | null = null;
    if (spotFee != null && variableCharges != null) {
      est = (h.buyPrice - variableCharges) / VAT - spotFee;
    } else if (offset != null) {
      est = h.buyPrice - offset;
    }
    return est == null ? h : { ...h, sellPrice: est, sellPriceEstimated: true };
  });

  return { hours: out, method, fee: method === "spot" ? spotFee : offset };
}
