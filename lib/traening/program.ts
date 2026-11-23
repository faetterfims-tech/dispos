/**
 * Træningsprogrammet: 4 styrkepas + 2 intervalpas om ugen, hjemme med
 * håndvægte, pull-up-stang og en stol. Navne og forklaringer på almindeligt dansk.
 * OBS: id'erne må ikke ændres — de bruges i de gemte pas.
 */

/** kg = vægt × antal · reps = kropsvægt (evt. ekstra kg) · sek = holdetid · runder = intervaller */
export type Unit = "kg" | "reps" | "sek" | "runder";

export interface Exercise {
  id: string;
  /** Kort, letforståeligt navn. */
  name: string;
  /** Hvad det træner. */
  muscles: string;
  /** Sådan gør du — én eller to korte sætninger. */
  how: string;
  /** Det "officielle" navn, bruges til at finde en video. */
  aka?: string;
  unit: Unit;
  sets: number;
  /** Målområde, fx [8, 12] gange eller [30, 60] sekunder. */
  target: [number, number];
  /** Hvis det er for svært eller for let. */
  tip?: string;
  /** Udstyr, øvelsen kræver. Tom/mangler = kun kropsvægt. */
  needs?: Equip[];
}

/* ---------- Udstyr ---------- */

export type Equip = "haandvaegte" | "stang" | "baenk" | "baand" | "stol";

export const EQUIPMENT: { id: Equip; name: string; icon: string; hint: string }[] = [
  { id: "haandvaegte", name: "Håndvægte", icon: "🏋️", hint: "Justerbare eller et par faste" },
  { id: "stang", name: "Pull-up-stang", icon: "🚪", hint: "I dørkarmen" },
  { id: "baenk", name: "Træningsbænk", icon: "📐", hint: "Med justerbart ryglæn" },
  { id: "baand", name: "Elastikbånd", icon: "🎗️", hint: "Træningselastik med håndtag eller loop" },
  { id: "stol", name: "Stol eller sofa", icon: "🪑", hint: "Noget solidt at støtte på" },
];

export const isEquip = (v: unknown): v is Equip => EQUIPMENT.some((e) => e.id === v);

/** Det oprindelige program forudsætter håndvægte, stang og en stol. */
export const DEFAULT_EQUIPMENT: Equip[] = ["haandvaegte", "stang", "stol"];

export type ProgramId = "udstyr" | "kropsvaegt";

export interface Day {
  id: string;
  /** Hvilket program passet hører til. */
  program: ProgramId;
  name: string;
  /** Kort navn til ugeoversigten. */
  short: string;
  /** Bruges ikke længere — passene tages i rækkefølge. */
  weekday: number;
  color: string;
  minutes: string;
  /** Rygopvarmning før passet. */
  warmup: boolean;
  /** Øvelser for fuldt udstyr. Brug resolveDay() for at tilpasse til det, man har. */
  exercises: Exercise[];
  /** Pladser i passet. Hver plads er en liste af alternativer i prioriteret rækkefølge. */
  slots: Exercise[][];
}

export interface WarmupItem {
  name: string;
  dose: string;
  how: string;
  aka: string;
}

/** 10 minutter før hvert styrkepas — styrker lænden. */
export const RYG_OPVARMNING: WarmupItem[] = [
  {
    name: "Firfod-stræk",
    dose: "6 × 10 sek pr. side",
    how: "Stå på hænder og knæ. Stræk højre arm frem og venstre ben bagud, og hold. Ryggen skal være helt stille. Skift side.",
    aka: "bird dog",
  },
  {
    name: "Planke på siden",
    dose: "5 × 10 sek pr. side",
    how: "Lig på siden på albuen og knæene (senere fødderne), og løft hoften, så kroppen er lige.",
    aka: "side plank",
  },
  {
    name: "Lille mavebøjning",
    dose: "6 × 10 sek",
    how: "Lig på ryggen med det ene knæ bøjet og hænderne under lænden. Løft hoved og skuldre en lille smule, og hold.",
    aka: "mcgill curl up",
  },
];

const ex = (e: Exercise) => e;

const E = {
  armstraek: ex({
    id: "armstraek",
    name: "Armbøjninger",
    muscles: "Bryst, skuldre og arme",
    how: "Hænderne i gulvet, kroppen lige som en planke. Sænk brystet næsten ned, og pres dig op igen.",
    aka: "push up",
    unit: "reps",
    sets: 4,
    target: [8, 20],
    tip: "For svært: tag dem på knæene. For let: læg fødderne op på en stol.",
  }),
  roning: ex({
    id: "roning",
    needs: ["haandvaegte"],
    name: "Træk vægten op (én arm)",
    muscles: "Ryggen",
    how: "Støt knæ og hånd på en stol. Træk håndvægten op til hoften med albuen tæt på kroppen, og sænk den langsomt.",
    aka: "one arm dumbbell row",
    unit: "kg",
    sets: 4,
    target: [8, 12],
    tip: "Tal pr. arm. Tag samme antal med begge arme.",
  }),
  skulderpres: ex({
    id: "skulderpres",
    needs: ["haandvaegte"],
    name: "Pres vægtene over hovedet",
    muscles: "Skuldre og arme",
    how: "Sid på en stol eller stå. Start med vægtene ved skuldrene, og pres dem lige op. Spænd maven.",
    aka: "dumbbell shoulder press",
    unit: "kg",
    sets: 4,
    target: [8, 12],
  }),
  pullups: ex({
    id: "pullups",
    needs: ["stang"],
    name: "Træk dig op i stangen",
    muscles: "Ryg og arme",
    how: "Hæng i stangen med håndfladerne væk fra dig. Træk dig op, til hagen er over stangen.",
    aka: "pull up",
    unit: "reps",
    sets: 4,
    target: [3, 10],
    tip: "Kan du ikke endnu: stil dig på en stol, start oppe, og sænk dig så langsomt du kan (3–5 sek). Tæl dem.",
  }),
  curl: ex({
    id: "curl",
    needs: ["haandvaegte"],
    name: "Bøj armene med vægte",
    muscles: "Overarmen (forsiden)",
    how: "Stå med en vægt i hver hånd. Bøj armene, så vægtene kommer op mod skuldrene. Albuerne bliver ved siden.",
    aka: "dumbbell biceps curl",
    unit: "kg",
    sets: 3,
    target: [8, 12],
  }),
  goblet: ex({
    id: "goblet",
    needs: ["haandvaegte"],
    name: "Squat med vægt foran brystet",
    muscles: "Ben og baller",
    how: "Hold én håndvægt lodret ind mod brystet. Sæt dig ned, som på en lav stol, og rejs dig igen. Ret ryg.",
    aka: "goblet squat",
    unit: "kg",
    sets: 4,
    target: [8, 12],
  }),
  rdl: ex({
    id: "rdl",
    needs: ["haandvaegte"],
    name: "Bøj forover med ret ryg",
    muscles: "Baglår, baller og lænd",
    how: "Stå med vægtene foran lårene. Skub numsen bagud, og lad vægtene glide ned ad benene til midt på skinnebenet. Rejs dig igen. Ryggen skal være ret hele tiden.",
    aka: "dumbbell romanian deadlift",
    unit: "kg",
    sets: 4,
    target: [8, 12],
    tip: "Start let! Lær bevægelsen, før du går op i vægt. Den er rigtig god for ryggen, når den laves rigtigt.",
  }),
  hoftehaev: ex({
    id: "hoftehaev",
    name: "Løft hoften (liggende)",
    muscles: "Baller, aflaster lænden",
    how: "Lig på ryggen med bøjede knæ. Pres hoften op, til kroppen er lige fra knæ til skuldre, og klem ballerne sammen i toppen.",
    aka: "glute bridge",
    unit: "reps",
    sets: 3,
    target: [12, 15],
    tip: "For let: læg en håndvægt på hoften.",
  }),
  bulgarsk: ex({
    id: "bulgarsk",
    needs: ["haandvaegte"],
    name: "Udfald med bagerste fod på en stol",
    muscles: "Ben og baller",
    how: "Stå med ryggen til en stol, og læg den ene fod op på den. Bøj det forreste ben, til knæet bagved næsten rører gulvet.",
    aka: "bulgarian split squat",
    unit: "kg",
    sets: 3,
    target: [8, 12],
    tip: "Tal pr. ben. Start uden vægte.",
  }),
  planke: ex({
    id: "planke",
    name: "Planke",
    muscles: "Mave og ryg",
    how: "Lig på albuerne og tæerne med kroppen helt lige fra hoved til hæl. Spænd maven og ballerne, og hold.",
    aka: "plank",
    unit: "sek",
    sets: 3,
    target: [20, 45],
    tip: "Stop, når formen glipper (hoften synker eller ryggen svajer). Kan du holde 45 sek med god form, så gør den sværere, fx ved at løfte et ben, i stedet for at holde længere.",
  }),
  knaeloeft: ex({
    id: "knaeloeft",
    needs: ["stang"],
    name: "Hæng i stangen og løft knæene",
    muscles: "Maven",
    how: "Hæng i stangen, og løft knæene op mod brystet uden at svinge. Sænk langsomt.",
    aka: "hanging knee raise",
    unit: "reps",
    sets: 3,
    target: [8, 15],
    tip: "Gør det ondt i lænden, så lav “Arm-og-ben-stræk på ryggen” i stedet.",
  }),
  intervaller: ex({
    id: "intervaller",
    name: "Intervaller: 30 sek hårdt, 30 sek pause",
    muscles: "Kondition og fedtforbrænding",
    how: "5 min opvarmning. Så 30 sek så hårdt du kan (sprællemænd, burpees, sjippetov, cykel eller trappeløb) og 30 sek pause. Det er 1 runde.",
    aka: "hiit 30 30",
    unit: "runder",
    sets: 1,
    target: [10, 15],
    tip: "Lørdag kan du også bare gå en tur på 45–60 min.",
  }),
  skraapres: ex({
    id: "skraapres",
    needs: ["haandvaegte"],
    name: "Pres vægtene op liggende",
    muscles: "Bryst, skuldre og arme",
    how: "Lig på gulvet med bøjede knæ. Start med albuerne mod gulvet, og pres vægtene lige op over brystet.",
    aka: "dumbbell floor press",
    unit: "kg",
    sets: 4,
    target: [8, 12],
  }),
  chinups: ex({
    id: "chinups",
    needs: ["stang"],
    name: "Træk dig op, håndfladerne mod dig",
    muscles: "Ryg og overarme",
    how: "Som at trække sig op, men med håndfladerne vendt ind mod dig. Det er lidt lettere.",
    aka: "chin up",
    unit: "reps",
    sets: 4,
    target: [3, 10],
    tip: "Samme trick: start oppe, og sænk dig langsomt.",
  }),
  sideloeft: ex({
    id: "sideloeft",
    needs: ["haandvaegte"],
    name: "Løft armene ud til siden",
    muscles: "Skuldrene (bredere skuldre)",
    how: "Stå med lette vægte ned langs siden. Løft armene ud til siden til skulderhøjde, og sænk langsomt.",
    aka: "dumbbell lateral raise",
    unit: "kg",
    sets: 3,
    target: [10, 15],
  }),
  dips: ex({
    id: "dips",
    needs: ["stol"],
    name: "Sænk dig ned fra en stolekant",
    muscles: "Overarmen (bagsiden)",
    how: "Sid på kanten af en stol med hænderne ved siden af dig. Skub numsen frem, og sænk dig ned ved at bøje armene. Pres op igen.",
    aka: "chair dips",
    unit: "reps",
    sets: 3,
    target: [8, 15],
  }),
  triceps: ex({
    id: "triceps",
    needs: ["haandvaegte"],
    name: "Stræk armene med vægt bag hovedet",
    muscles: "Overarmen (bagsiden)",
    how: "Hold én håndvægt med begge hænder bag hovedet. Stræk armene, så vægten kommer op over hovedet.",
    aka: "overhead dumbbell triceps extension",
    unit: "kg",
    sets: 3,
    target: [10, 15],
  }),
  deadbug: ex({
    id: "deadbug",
    name: "Arm-og-ben-stræk på ryggen",
    muscles: "Maven, skånsom for ryggen",
    how: "Lig på ryggen med arme og bøjede ben i vejret. Stræk modsat arm og ben langsomt ud, mens lænden presses mod gulvet. Skift side.",
    aka: "dead bug exercise",
    unit: "reps",
    sets: 3,
    target: [8, 12],
    tip: "Tal pr. side.",
  }),

  baenkpres: ex({
    id: "baenkpres",
    needs: ["haandvaegte", "baenk"],
    name: "Pres vægtene op på skrå bænk",
    muscles: "Bryst, skuldre og arme",
    how: "Stil ryglænet på ca. 30°. Start med vægtene ved brystet, og pres dem lige op. Sænk langsomt.",
    aka: "incline dumbbell press",
    unit: "kg",
    sets: 4,
    target: [8, 12],
  }),
  baandroning: ex({
    id: "baandroning",
    needs: ["baand"],
    name: "Træk elastikken ind mod maven",
    muscles: "Ryggen",
    how: "Sæt elastikken fast i lav højde (fx om et bordben eller i døren). Træk håndtagene ind mod maven med albuerne tæt på kroppen, klem skulderbladene sammen, og slip langsomt.",
    aka: "resistance band row",
    unit: "reps",
    sets: 3,
    target: [10, 15],
    tip: "For let: gå et skridt længere væk eller brug en hårdere elastik.",
  }),
  baandtraek: ex({
    id: "baandtraek",
    needs: ["baand"],
    name: "Træk elastikken fra hinanden",
    muscles: "Øverste ryg og skuldre",
    how: "Hold elastikken foran brystet med strakte arme. Træk den fra hinanden ud til siderne, til den rører brystet, og slip langsomt.",
    aka: "band pull apart",
    unit: "reps",
    sets: 3,
    target: [12, 20],
  }),

  /* ---- Uden udstyr ---- */
  squat: ex({
    id: "squat",
    name: "Squat",
    muscles: "Ben og baller",
    how: "Stå med fødderne i skulderbredde. Sæt dig ned, som på en lav stol, med armene frem, og rejs dig igen. Ret ryg, hælene i gulvet.",
    aka: "bodyweight squat",
    unit: "reps",
    sets: 3,
    target: [12, 20],
    tip: "For let: hold 2 sek i bunden, eller gå langsomt ned (3 sek).",
  }),
  udfald: ex({
    id: "udfald",
    name: "Udfald bagud",
    muscles: "Ben og baller",
    how: "Tag et stort skridt bagud, og bøj begge knæ, til det bagerste næsten rører gulvet. Pres op med det forreste ben. Skift ben.",
    aka: "reverse lunge",
    unit: "reps",
    sets: 3,
    target: [8, 12],
    tip: "Tal pr. ben. Hold fast i en stol, hvis balancen driller.",
  }),
  splitstol: ex({
    id: "splitstol",
    needs: ["stol"],
    name: "Udfald med bagerste fod på en stol (uden vægt)",
    muscles: "Ben og baller",
    how: "Stå med ryggen til en stol, og læg den ene fod op på den. Bøj det forreste ben, til knæet bagved næsten rører gulvet.",
    aka: "bodyweight bulgarian split squat",
    unit: "reps",
    sets: 3,
    target: [8, 15],
    tip: "Tal pr. ben.",
  }),
  ytraek: ex({
    id: "ytraek",
    name: "Armløft på maven (Y)",
    muscles: "Øverste ryg og skuldre",
    how: "Lig på maven med armene skråt frem som et Y og tommelfingrene op. Løft armene fra gulvet ved at klemme skulderbladene sammen, hold 2 sek, og sænk.",
    aka: "prone y raise",
    unit: "reps",
    sets: 3,
    target: [10, 15],
    tip: "Hovedet bliver nede, og blikket mod gulvet. Det er armene og skulderbladene, der arbejder, ikke lænden.",
  }),
  ttraek: ex({
    id: "ttraek",
    name: "Armløft på maven (T)",
    muscles: "Øverste ryg og skuldre",
    how: "Lig på maven med armene lige ud til siden som et T. Løft armene ved at klemme skulderbladene sammen, hold 2 sek, og sænk.",
    aka: "prone t raise",
    unit: "reps",
    sets: 3,
    target: [10, 15],
  }),
  skulderarm: ex({
    id: "skulderarm",
    name: "Armbøjninger med numsen i vejret",
    muscles: "Skuldre og arme",
    how: "Stå i et omvendt V med hænder og fødder i gulvet og numsen højt. Bøj armene, så hovedet går ned mod gulvet foran hænderne, og pres op.",
    aka: "pike push up",
    unit: "reps",
    sets: 3,
    target: [6, 12],
    tip: "For svært: gør V'et mindre, med fødderne længere fra hænderne.",
  }),
  hoftebenet: ex({
    id: "hoftebenet",
    name: "Løft hoften på ét ben",
    muscles: "Baller og baglår, aflaster lænden",
    how: "Lig på ryggen med bøjede knæ, og stræk det ene ben. Pres hoften op med det andet ben, klem ballerne, og sænk langsomt.",
    aka: "single leg glute bridge",
    unit: "reps",
    sets: 3,
    target: [8, 15],
    tip: "Tal pr. ben. For svært: brug begge ben.",
  }),
  sideplanke: ex({
    id: "sideplanke",
    name: "Planke på siden",
    muscles: "Mave (siderne) og ryg",
    how: "Lig på siden på albuen med benene strakt. Løft hoften, så kroppen er lige, og hold. Skift side.",
    aka: "side plank",
    unit: "sek",
    sets: 3,
    target: [15, 30],
    tip: "Tal pr. side. For svært: tag den på knæene. Stop, når hoften begynder at synke.",
  }),
  bjergbestiger: ex({
    id: "bjergbestiger",
    name: "Bjergbestiger",
    muscles: "Mave, skuldre og kondition",
    how: "Stå i armbøjningsstilling. Træk skiftevis knæene op mod brystet i roligt tempo, med hoften nede og ryggen lige.",
    aka: "mountain climbers",
    unit: "sek",
    sets: 3,
    target: [20, 40],
  }),
};

type DayDef = Omit<Day, "exercises">;
const day = (d: DayDef): Day => ({ ...d, exercises: resolveSlots(d.slots, ["haandvaegte", "stang", "baenk", "baand", "stol"]) });

/** Første alternativ pr. plads, som kan laves med det udstyr, man har. Pladser uden muligheder udelades, og samme øvelse bruges kun én gang. */
export function resolveSlots(slots: Exercise[][], owned: Equip[]): Exercise[] {
  const out: Exercise[] = [];
  for (const alts of slots) {
    const pick = alts.find((e) => (e.needs ?? []).every((n) => owned.includes(n)) && !out.includes(e));
    if (pick) out.push(pick);
  }
  return out;
}

/** Et pas tilpasset det udstyr, man har. */
export const resolveDay = (d: Day, owned: Equip[]): Day => ({ ...d, exercises: resolveSlots(d.slots, owned) });

export const DAYS: Day[] = [
  // Med håndvægte: 4 styrkepas + 2 konditionspas. Mangler stang/bænk, byttes de øvelser ud.
  day({ id: "overkrop-a", program: "udstyr", name: "Overkrop A", short: "Over A", weekday: 1, color: "#2a6fd6", minutes: "45–55 min", warmup: true,
    slots: [[E.armstraek], [E.roning, E.baandroning, E.ytraek], [E.skulderpres, E.skulderarm], [E.pullups, E.baandtraek, E.ttraek], [E.curl]] }),
  day({ id: "underkrop", program: "udstyr", name: "Ben, mave og ryg", short: "Ben", weekday: 2, color: "#1f8a5b", minutes: "45–55 min", warmup: true,
    slots: [[E.goblet, E.squat], [E.rdl], [E.hoftehaev], [E.bulgarsk, E.splitstol, E.udfald], [E.planke], [E.knaeloeft, E.deadbug]] }),
  day({ id: "interval", program: "udstyr", name: "Kondition", short: "Kondi", weekday: 3, color: "#e2662b", minutes: "20 min", warmup: false, slots: [[E.intervaller]] }),
  day({ id: "overkrop-b", program: "udstyr", name: "Overkrop B", short: "Over B", weekday: 4, color: "#6a4bc9", minutes: "45–55 min", warmup: true,
    slots: [[E.baenkpres, E.skraapres], [E.chinups, E.baandroning, E.ytraek], [E.sideloeft], [E.dips, E.armstraek], [E.triceps]] }),
  day({ id: "fuldkrop", program: "udstyr", name: "Hele kroppen", short: "Hele", weekday: 5, color: "#c43d6b", minutes: "45–55 min", warmup: true,
    slots: [[E.goblet], [E.roning, E.baandroning], [E.skulderpres], [E.rdl], [E.deadbug]] }),
  day({ id: "interval-2", program: "udstyr", name: "Kondition eller gåtur", short: "Kondi", weekday: 6, color: "#e2662b", minutes: "20–60 min", warmup: false, slots: [[E.intervaller]] }),
  // Uden håndvægte: to helkropspas på skift med kondition. Stang og elastik bruges, hvis man har dem.
  day({ id: "krop-a", program: "kropsvaegt", name: "Hele kroppen A", short: "Krop A", weekday: 0, color: "#0f8b8d", minutes: "35–45 min", warmup: true,
    slots: [[E.squat], [E.armstraek], [E.pullups, E.baandroning, E.ytraek], [E.udfald], [E.hoftehaev], [E.planke]] }),
  day({ id: "krop-interval", program: "kropsvaegt", name: "Kondition", short: "Kondi", weekday: 0, color: "#e2662b", minutes: "20 min", warmup: false, slots: [[E.intervaller]] }),
  day({ id: "krop-b", program: "kropsvaegt", name: "Hele kroppen B", short: "Krop B", weekday: 0, color: "#7a5c2e", minutes: "35–45 min", warmup: true,
    slots: [[E.splitstol, E.udfald], [E.skulderarm], [E.chinups, E.baandtraek, E.ttraek], [E.dips, E.armstraek], [E.hoftebenet], [E.sideplanke], [E.knaeloeft, E.bjergbestiger]] }),
  day({ id: "krop-interval-2", program: "kropsvaegt", name: "Kondition eller gåtur", short: "Kondi", weekday: 0, color: "#e2662b", minutes: "20–60 min", warmup: false, slots: [[E.intervaller]] }),
];

/** Med håndvægte bruges programmet med udstyr, ellers kropsvægt-programmet. */
export const programFor = (owned: Equip[]): ProgramId => (owned.includes("haandvaegte") ? "udstyr" : "kropsvaegt");

export const PROGRAMS: { id: ProgramId; name: string; description: string }[] = [
  { id: "udstyr", name: "Med håndvægte", description: "4 styrkepas og 2 konditionspas." },
  { id: "kropsvaegt", name: "Uden håndvægte", description: "Hele kroppen hver gang, skiftevis med kondition." },
];

/** Passene i et program, i den rækkefølge de tages. */
export const orderFor = (program: ProgramId) => DAYS.filter((d) => d.program === program).map((d) => d.id);
export const isProgramId = (v: unknown): v is ProgramId => v === "udstyr" || v === "kropsvaegt";

/** Alle øvelser, uden dubletter (samme øvelse kan stå på flere dage). */
export const EXERCISES: Exercise[] = Object.values(E);

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id);
export const dayById = (id: string) => DAYS.find((d) => d.id === id);

/** Søg efter en video af øvelsen. */
export const videoUrl = (aka: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${aka} how to`)}`;
