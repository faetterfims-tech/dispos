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
}

export interface Day {
  id: string;
  name: string;
  /** Kort navn til ugeoversigten. */
  short: string;
  /** Bruges ikke længere — passene tages i rækkefølge. */
  weekday: number;
  color: string;
  minutes: string;
  /** Rygopvarmning før passet. */
  warmup: boolean;
  exercises: Exercise[];
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
    dose: "3 × 10–20 sek pr. side",
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
    how: "Lig på albuerne og tæerne med kroppen helt lige fra hoved til hæl. Hold.",
    aka: "plank",
    unit: "sek",
    sets: 3,
    target: [30, 60],
  }),
  knaeloeft: ex({
    id: "knaeloeft",
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
};

export const DAYS: Day[] = [
  { id: "overkrop-a", name: "Overkrop A", short: "Over A", weekday: 1, color: "#2a6fd6", minutes: "45–55 min", warmup: true, exercises: [E.armstraek, E.roning, E.skulderpres, E.pullups, E.curl] },
  { id: "underkrop", name: "Ben, mave og ryg", short: "Ben", weekday: 2, color: "#1f8a5b", minutes: "45–55 min", warmup: true, exercises: [E.goblet, E.rdl, E.hoftehaev, E.bulgarsk, E.planke, E.knaeloeft] },
  { id: "interval", name: "Kondition", short: "Kondi", weekday: 3, color: "#e2662b", minutes: "20 min", warmup: false, exercises: [E.intervaller] },
  { id: "overkrop-b", name: "Overkrop B", short: "Over B", weekday: 4, color: "#6a4bc9", minutes: "45–55 min", warmup: true, exercises: [E.skraapres, E.chinups, E.sideloeft, E.dips, E.triceps] },
  { id: "fuldkrop", name: "Hele kroppen", short: "Hele", weekday: 5, color: "#c43d6b", minutes: "45–55 min", warmup: true, exercises: [E.goblet, E.roning, E.skulderpres, E.rdl, E.deadbug] },
  { id: "interval-2", name: "Kondition eller gåtur", short: "Kondi", weekday: 6, color: "#e2662b", minutes: "20–60 min", warmup: false, exercises: [E.intervaller] },
];

/** Alle øvelser, uden dubletter (samme øvelse kan stå på flere dage). */
export const EXERCISES: Exercise[] = Object.values(E);

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id);
export const dayById = (id: string) => DAYS.find((d) => d.id === id);

/** Søg efter en video af øvelsen. */
export const videoUrl = (aka: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${aka} how to`)}`;
