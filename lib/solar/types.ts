/**
 * Én time med data. Alle energital er kWh for timen, alle priser er DKK/kWh.
 * `null` betyder "ukendt" — aldrig nul. Manglende data må ikke behandles som 0.
 */
export interface HourData {
  /** Timens start som ISO-tid i UTC, fx "2026-06-01T10:00:00.000Z". Bruges som nøgle. */
  start: string;

  // --- Fra Min Strøm (måleren) ---
  /** Købt fra nettet. */
  importKWh: number | null;
  /** Solgt til nettet. */
  exportKWh: number | null;
  /** Købspris inkl. moms, afgifter og tariffer (variabel del, uden faste gebyrer). */
  buyPrice: number | null;
  /** Salgspris ekskl. moms. */
  sellPrice: number | null;
  /** true hvis salgsprisen er estimeret (der blev ikke solgt i timen). */
  sellPriceEstimated?: boolean;

  // --- Fra SunMate (anlægget) ---
  /** Solproduktion. */
  pvKWh?: number | null;
  /** Opladet på batteriet (fra sol og/eller net). */
  chargeKWh?: number | null;
  /** Afladet fra batteriet. */
  dischargeKWh?: number | null;
}

/** Resultat af beregningen for en periode (dag, måned eller hele perioden). */
export interface PeriodResult {
  /** Dag ("2026-06-01"), måned ("2026-06") eller "total". */
  key: string;
  /** Antal timer med komplet data, som scenarierne er regnet på. */
  hours: number;

  /** Husets faktiske forbrug (beregnet fra måler + anlæg). */
  loadKWh: number;
  pvKWh: number;
  importKWh: number;
  exportKWh: number;
  chargeKWh: number;
  dischargeKWh: number;

  /** Det I faktisk har betalt for strøm minus salg (variable priser). */
  actualCost: number;
  /** Uden anlæg: hele forbruget købt time for time. */
  noSystemCost: number;
  /** Kun solceller, intet batteri: underskud købt, overskud solgt samme time. */
  solarOnlyCost: number;

  /** noSystemCost − actualCost */
  totalSaving: number;
  /** noSystemCost − solarOnlyCost */
  solarSaving: number;
  /** solarOnlyCost − actualCost */
  batterySaving: number;

  /** Solstrøm brugt i huset uden batteri (time for time). */
  directSolarKWh: number;
  /** Timer hvor salgsprisen var estimeret. */
  estimatedSellHours: number;
}

/** Nøgletal der kun kræver Min Strøm-data. */
export interface MeterOnlyResult {
  hours: number;
  importKWh: number;
  exportKWh: number;
  importCost: number;
  exportRevenue: number;
  netCost: number;
  /** Gennemsnitlig købspris I har betalt (vægtet efter forbrug). */
  avgPaidBuyPrice: number | null;
  /** Gennemsnitlig købspris over alle timer (uvægtet) — "markedsgennemsnittet". */
  avgMarketBuyPrice: number | null;
  /** Gennemsnitlig salgspris I har fået (vægtet efter eksport). */
  avgPaidSellPrice: number | null;
  /** Gennemsnitlig salgspris over alle timer (uvægtet). */
  avgMarketSellPrice: number | null;
}

export interface CalculationResult {
  /** Scenarierne kræver SunMate-data. Er false, hvis der ikke er nogen. */
  hasSystemData: boolean;
  total: PeriodResult;
  months: PeriodResult[];
  days: PeriodResult[];
  meterOnly: MeterOnlyResult;
  /** Timer hvor tallene ikke hænger sammen (negativt husforbrug). */
  inconsistentHours: string[];
  /** Timer med måledata men uden komplet anlægsdata. */
  missingSystemHours: number;
}
