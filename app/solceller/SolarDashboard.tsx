"use client";

import { useEffect, useMemo, useState } from "react";
import { calculate, paybackYears } from "@/lib/solar/engine";
import { mergeHours, unpackHours, type MeterHour, type PackedHour } from "@/lib/solar/merge";
import { parseSystemCsv, type CsvParseResult, type SystemHour } from "@/lib/solar/sunmate";
import { copenhagenToUtc, localDay } from "@/lib/solar/time";
import SavingsChart from "./SavingsChart";
import { fmtKr, fmtKWh, fmtMonth, fmtPct, fmtPrice, fmtYears } from "./format";

interface MeterResponse {
  address: { id: string; label: string | null };
  hours: MeterHour[];
  /** Som på regningen/Min Strøm-appen: inkl. faste gebyrer. */
  billed?: { importCost: number; importFixedFees: number; exportRevenue: number; exportFixedFees: number };
  sellPriceMethod: "spot" | "offset" | "none";
  sellPriceFee: number | null;
}

interface Settings {
  from: string;
  to: string;
  solarInvestment: string;
  batteryInvestment: string;
}

const STORAGE = {
  settings: "dispos.solceller.settings",
  system: "dispos.solceller.system",
};

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* fuld eller blokeret — data lever så kun i denne session */
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/** Anlæggets pris fra SunMate-portalen (Mine Invertere). Kan overskrives på siden. */
const DEFAULT_SOLAR_INVESTMENT = "69997";
const DEFAULT_BATTERY_INVESTMENT = "60001";

export default function SolarDashboard() {
  const [settings, setSettings] = useState<Settings>({
    from: "2025-08-01",
    to: today(),
    solarInvestment: DEFAULT_SOLAR_INVESTMENT,
    batteryInvestment: DEFAULT_BATTERY_INVESTMENT,
  });
  const [meter, setMeter] = useState<MeterResponse | null>(null);
  const [system, setSystem] = useState<(CsvParseResult & { fileName: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [view, setView] = useState<"months" | "days">("months");
  const [stored, setStored] = useState<{ configured: boolean; hours: SystemHour[] } | null>(null);

  useEffect(() => {
    const s = load<Settings>(STORAGE.settings);
    if (s)
      setSettings({
        ...s,
        to: today(),
        solarInvestment: s.solarInvestment || DEFAULT_SOLAR_INVESTMENT,
        batteryInvestment: s.batteryInvestment || DEFAULT_BATTERY_INVESTMENT,
      });
    const sys = load<CsvParseResult & { fileName: string }>(STORAGE.system);
    if (sys) setSystem(sys);
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    save(STORAGE.settings, next);
  };

  async function fetchMeter(range?: { from: string; to: string }) {
    const period = range ?? { from: settings.from, to: settings.to };
    if (range) update(range);
    setLoading(true);
    setError(null);
    try {
      // Datoerne er danske kalenderdage. "Til" er inklusiv i formularen; API'et bruger eksklusiv slut.
      const [fy, fm, fd] = period.from.split("-").map(Number);
      const [ty, tm, td] = period.to.split("-").map(Number);
      const from = new Date(copenhagenToUtc(fy, fm, fd)).toISOString();
      const to = new Date(copenhagenToUtc(ty, tm, td + 1)).toISOString();
      const range = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const [res, sysRes] = await Promise.all([fetch(`/api/solceller?${range}`), fetch(`/api/sunmate/hours?${range}`)]);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Fejl ${res.status}`);
      const { packed, ...rest } = body as Omit<MeterResponse, "hours"> & { packed: PackedHour[] };
      setMeter({ ...rest, hours: unpackHours(packed) });
      try {
        const sys = await sysRes.json();
        setStored(sysRes.ok ? { configured: Boolean(sys.configured), hours: sys.hours ?? [] } : null);
      } catch {
        setStored(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onCsv(file: File | undefined) {
    if (!file) return;
    setCsvError(null);
    try {
      const parsed = parseSystemCsv(await file.text());
      const withName = { ...parsed, fileName: file.name };
      setSystem(withName);
      save(STORAGE.system, withName);
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : String(e));
    }
  }

  function clearSystem() {
    setSystem(null);
    try {
      localStorage.removeItem(STORAGE.system);
    } catch {
      /* ignorer */
    }
  }

  // Anlægsdata: CSV (typisk historik) + automatisk indsamlede timer fra SunMate-API'et.
  // Overlapper de, vinder de indsamlede timer.
  const systemHours = useMemo(() => {
    const csv = system?.hours ?? [];
    const api = stored?.hours ?? [];
    if (csv.length === 0 && api.length === 0) return null;
    const map = new Map<string, SystemHour>();
    for (const h of csv) map.set(h.start, h);
    for (const h of api) map.set(h.start, h);
    return [...map.values()];
  }, [system, stored]);

  const result = useMemo(() => {
    if (!meter) return null;
    return calculate(mergeHours(meter.hours, systemHours));
  }, [meter, systemHours]);

  const coveredDays = result ? new Set(result.days.map((d) => d.key)).size : 0;
  const investment = (Number(settings.solarInvestment) || 0) + (Number(settings.batteryInvestment) || 0);
  const t = result?.total;

  return (
    <div className="stack">
      <section className="card stack">
        <div className="controls">
          <label className="field">
            Fra
            <input type="date" value={settings.from} onChange={(e) => update({ from: e.target.value })} />
          </label>
          <label className="field">
            Til
            <input type="date" value={settings.to} onChange={(e) => update({ to: e.target.value })} />
          </label>
          <button onClick={() => fetchMeter()} disabled={loading}>
            {loading ? "Henter…" : meter ? "Hent igen" : "Hent fra Min Strøm"}
          </button>
        </div>
        <div className="controls">
          {[
            { label: "Al historik", from: "2021-01-01" },
            { label: "Siden solceller", from: "2025-08-01" },
            { label: "I år", from: `${new Date().getFullYear()}-01-01` },
            { label: "Seneste 30 dage", from: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10) },
          ].map((p) => (
            <button
              key={p.label}
              className="secondary"
              disabled={loading}
              onClick={() => fetchMeter({ from: p.from, to: today() })}
            >
              {p.label}
            </button>
          ))}
        </div>
        {loading && <p className="small">Henter time for time fra Min Strøm. Flere års data kan tage op til et minut.</p>}
        {meter?.address.label && <p className="small">Adresse: {meter.address.label}</p>}
        {error && <p className="notice error">{error}</p>}
      </section>

      <section className="card stack">
        <h2>Anlægsdata (SunMate)</h2>
        {stored && (
          <p className="small">
            {stored.configured
              ? stored.hours.length > 0
                ? `Automatisk indsamlet: ${stored.hours.length.toLocaleString("da-DK")} timer (${localDay(stored.hours[0].start)} – ${localDay(stored.hours[stored.hours.length - 1].start)}).`
                : "Automatisk indsamling er sat op, men har ingen timer i perioden endnu."
              : "Automatisk indsamling fra SunMate er ikke sat op endnu."}
          </p>
        )}
        {system ? (
          <>
            <p className="muted">
              {system.fileName}: {system.hours.length.toLocaleString("da-DK")} timer
              {system.hours.length > 0 &&
                ` (${localDay(system.hours[0].start)} – ${localDay(system.hours[system.hours.length - 1].start)})`}
              {system.unitFactor !== 1 && " · omregnet fra Wh"}
              {system.skippedRows > 0 && ` · ${system.skippedRows} rækker sprunget over`}
            </p>
            {!system.hasBattery && (
              <p className="notice">
                Filen har ingen batterikolonner. Husforbruget kan ikke regnes rigtigt uden op- og afladning, så
                tallene nedenfor er forkerte, indtil batteridata er med.
              </p>
            )}
            <div className="controls">
              <label className="button" style={{ display: "inline-flex", alignItems: "center" }}>
                Skift fil
                <input type="file" accept=".csv,text/csv" hidden onChange={(e) => onCsv(e.target.files?.[0])} />
              </label>
              <button className="secondary" onClick={clearSystem}>
                Fjern
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Indtil SunMate-API&apos;et er koblet på, kan anlægsdata indlæses som CSV med kolonner for tid,
              produktion, opladning og afladning (kWh eller Wh pr. interval). Filen bliver i din browser.
            </p>
            <label className="button" style={{ display: "inline-flex", alignItems: "center", width: "fit-content" }}>
              Vælg CSV-fil
              <input type="file" accept=".csv,text/csv" hidden onChange={(e) => onCsv(e.target.files?.[0])} />
            </label>
          </>
        )}
        {csvError && <p className="notice error">{csvError}</p>}
      </section>

      {result && t && (
        <>
          {result.hasSystemData ? (
            <section className="card stack">
              <h2>Besparelse</h2>
              <div className="kpis">
                <Kpi label="Sparet i alt" value={fmtKr(t.totalSaving)} />
                <Kpi label="Heraf sol" value={fmtKr(t.solarSaving)} color="var(--series-1)" />
                <Kpi label="Heraf batteri" value={fmtKr(t.batterySaving)} color="var(--series-2)" />
                <Kpi label="Betalt (netto, ekskl. abonnementer)" value={fmtKr(t.actualCost)} />
                <Kpi label="Uden anlæg" value={fmtKr(t.noSystemCost)} />
                <Kpi label="Husforbrug" value={fmtKWh(t.loadKWh)} />
              </div>
              <p className="small">
                {t.hours.toLocaleString("da-DK")} timer over {coveredDays} dage. Solstrøm brugt direkte:{" "}
                {t.pvKWh > 0 ? fmtPct(t.directSolarKWh / t.pvKWh) : "–"} af produktionen.
              </p>
              <SavingsChart months={result.months} />
            </section>
          ) : (
            <section className="card stack">
              <h2>Fra måleren</h2>
              <div className="kpis">
                <Kpi label="Betalt for køb" value={fmtKr(meter!.billed?.importCost ?? result.meterOnly.importCost)} />
                <Kpi label="Fået for salg" value={fmtKr(meter!.billed?.exportRevenue ?? result.meterOnly.exportRevenue)} />
                <Kpi
                  label="Netto"
                  value={fmtKr(
                    (meter!.billed?.importCost ?? result.meterOnly.importCost) -
                      (meter!.billed?.exportRevenue ?? result.meterOnly.exportRevenue),
                  )}
                />
                <Kpi label="Din købspris" value={fmtPrice(result.meterOnly.avgPaidBuyPrice)} />
                <Kpi label="Gns. timepris" value={fmtPrice(result.meterOnly.avgMarketBuyPrice)} />
                <Kpi label="Din salgspris" value={fmtPrice(result.meterOnly.avgPaidSellPrice)} />
              </div>
              {meter?.billed && (
                <p className="small">
                  Som i Min Strøm-appen, inkl. faste abonnementer og gebyrer ({fmtKr(meter.billed.importFixedFees + meter.billed.exportFixedFees)}).
                  Købsprisen pr. kWh er uden dem.
                </p>
              )}
              <p className="notice">
                Besparelsen fra sol og batteri kræver anlægsdata. Indlæs en CSV fra SunMate ovenfor.
              </p>
            </section>
          )}

          {result.hasSystemData && (
            <section className="card stack">
              <h2>Tilbagebetaling</h2>
              <div className="controls">
                <label className="field">
                  Solceller (kr)
                  <input
                    type="number"
                    inputMode="numeric"
                    value={settings.solarInvestment}
                    onChange={(e) => update({ solarInvestment: e.target.value })}
                  />
                </label>
                <label className="field">
                  Batterier (kr)
                  <input
                    type="number"
                    inputMode="numeric"
                    value={settings.batteryInvestment}
                    onChange={(e) => update({ batteryInvestment: e.target.value })}
                  />
                </label>
              </div>
              {investment > 0 && (
                <div className="kpis">
                  <Kpi label="Hele anlægget" value={fmtYears(paybackYears(investment, t.totalSaving, coveredDays))} />
                  <Kpi
                    label="Solceller"
                    value={fmtYears(paybackYears(Number(settings.solarInvestment) || 0, t.solarSaving, coveredDays))}
                  />
                  <Kpi
                    label="Batterier"
                    value={fmtYears(
                      paybackYears(Number(settings.batteryInvestment) || 0, t.batterySaving, coveredDays),
                    )}
                  />
                  <Kpi label="Tilbagebetalt indtil nu" value={fmtPct(t.totalSaving / investment)} />
                </div>
              )}
              {coveredDays < 365 && (
                <p className="small">
                  Kun {coveredDays} dages data: årsbesparelsen er skaleret op og påvirkes meget af årstiden.
                </p>
              )}
            </section>
          )}

          {result.hasSystemData && (
            <section className="card stack">
              <div className="tabs" role="group" aria-label="Opdeling">
                <button aria-pressed={view === "months"} onClick={() => setView("months")}>
                  Måneder
                </button>
                <button aria-pressed={view === "days"} onClick={() => setView("days")}>
                  Dage
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{view === "months" ? "Måned" : "Dag"}</th>
                      <th>Hus kWh</th>
                      <th>Sol kWh</th>
                      <th>Betalt</th>
                      <th>Uden anlæg</th>
                      <th>Sol</th>
                      <th>Batteri</th>
                      <th>Sparet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(view === "months" ? result.months : [...result.days].reverse()).map((p) => (
                      <tr key={p.key}>
                        <td>{view === "months" ? fmtMonth(p.key) : p.key}</td>
                        <td>{Math.round(p.loadKWh).toLocaleString("da-DK")}</td>
                        <td>{Math.round(p.pvKWh).toLocaleString("da-DK")}</td>
                        <td>{fmtKr(p.actualCost)}</td>
                        <td>{fmtKr(p.noSystemCost)}</td>
                        <td>{fmtKr(p.solarSaving)}</td>
                        <td>{fmtKr(p.batterySaving)}</td>
                        <td>
                          <strong>{fmtKr(p.totalSaving)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <DataQuality
            meter={meter!}
            estimatedSellHours={t.estimatedSellHours}
            inconsistent={result.inconsistentHours.length}
            missingSystem={result.missingSystemHours}
            hasSystem={Boolean(systemHours)}
          />

          <details className="card">
            <summary>Sådan regnes det</summary>
            <div className="stack small" style={{ marginTop: "0.75rem" }}>
              <p>
                For hver time: husforbrug = købt + sol + afladet − solgt − opladet. Batteriets tab tæller derfor ikke
                som forbrug, men som en udgift ved batteriet.
              </p>
              <p>
                <strong>Uden anlæg</strong>: hele husforbruget købt til timens pris. <strong>Kun sol</strong>: det sol
                ikke dækker, købes; overskud sælges samme time. <strong>Faktisk</strong>: det I har købt og solgt
                ifølge Min Strøm.
              </p>
              <p>
                Sol-besparelse = uden anlæg − kun sol. Batteri-besparelse = kun sol − faktisk. Faste gebyrer og
                abonnementer er udeladt, da de er ens i alle scenarier.
              </p>
              <p>
                Købspriser er inkl. moms og afgifter. Salgspriser er ekskl. moms, som de afregnes. I timer uden salg
                er salgsprisen estimeret ud fra spotprisen.
              </p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="kpi">
      <div className="label">
        {color && (
          <i
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 2,
              background: color,
              marginRight: 6,
            }}
          />
        )}
        {label}
      </div>
      <div className="value">{value}</div>
    </div>
  );
}

function DataQuality(props: {
  meter: MeterResponse;
  estimatedSellHours: number;
  inconsistent: number;
  missingSystem: number;
  hasSystem: boolean;
}) {
  const notes: string[] = [];
  const meterHours = props.meter.hours.filter((h) => h.importKWh != null).length;
  if (meterHours < props.meter.hours.length) {
    notes.push(`${props.meter.hours.length - meterHours} timer mangler forbrugsdata fra Min Strøm og er sprunget over.`);
  }
  if (props.hasSystem && props.missingSystem > 0) {
    notes.push(`${props.missingSystem} timer har måledata, men ingen anlægsdata, og indgår ikke i besparelsen.`);
  }
  if (props.inconsistent > 0) {
    notes.push(
      `${props.inconsistent} timer giver negativt husforbrug (måler og anlæg passer ikke sammen) og er udeladt. Tjek om CSV-filens tider er i dansk tid.`,
    );
  }
  if (props.estimatedSellHours > 0) {
    const how =
      props.meter.sellPriceMethod === "spot"
        ? `spotpris minus et gebyr på ${props.meter.sellPriceFee?.toFixed(3).replace(".", ",")} kr/kWh, kalibreret på jeres faktiske salg`
        : "købsprisen minus den typiske forskel";
    notes.push(`Salgsprisen er estimeret i ${props.estimatedSellHours} timer (${how}).`);
  }
  if (notes.length === 0) return null;
  return (
    <section className="card">
      <h2>Datakvalitet</h2>
      <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem" }}>
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  );
}
