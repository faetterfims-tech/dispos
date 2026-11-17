/**
 * Træningsprogrammet: 4 styrkepas + 2 intervalpas om ugen, hjemme med
 * justerbare håndvægte, pull-up-stang og en stol (bænk er valgfri).
 */

/** kg = vægt × gentagelser · reps = kropsvægt (evt. ekstra kg) · sek = holdetid · runder = intervaller */
export type Unit = "kg" | "reps" | "sek" | "runder";

export interface Exercise {
  id: string;
  name: string;
  unit: Unit;
  sets: number;
  /** Målområde, fx [8, 12] gentagelser eller [30, 60] sekunder. */
  target: [number, number];
  tip?: string;
}

export interface Day {
  id: string;
  name: string;
  short: string;
  /** 1 = mandag … 7 = søndag. */
  weekday: number;
  exercises: Exercise[];
}

const ex = (e: Exercise) => e;

const E = {
  armstraek: ex({ id: "armstraek", name: "Armstrækninger", unit: "reps", sets: 4, target: [8, 20], tip: "For hårdt: på knæ eller mod bordkant. For let: fødderne op på en stol." }),
  roning: ex({ id: "roning", name: "Roning med håndvægt (pr. arm)", unit: "kg", sets: 4, target: [8, 12], tip: "Knæ og hånd på en stol eller bænk, træk albuen mod hoften." }),
  skulderpres: ex({ id: "skulderpres", name: "Skulderpres", unit: "kg", sets: 4, target: [8, 12], tip: "Siddende på en stol eller stående." }),
  pullups: ex({ id: "pullups", name: "Pull-ups", unit: "reps", sets: 4, target: [3, 10], tip: "Kan du ikke tage én endnu: hop op og sænk dig langsomt (3–5 sek)." }),
  curl: ex({ id: "curl", name: "Bicepscurl", unit: "kg", sets: 3, target: [8, 12] }),
  goblet: ex({ id: "goblet", name: "Goblet squat", unit: "kg", sets: 4, target: [8, 12], tip: "Én håndvægt lodret ind mod brystet." }),
  rdl: ex({ id: "rdl", name: "Rumænsk dødløft", unit: "kg", sets: 4, target: [8, 12], tip: "Ret ryg, skub hoften bagud, vægtene tæt på benene." }),
  bulgarsk: ex({ id: "bulgarsk", name: "Bulgarsk split squat (pr. ben)", unit: "kg", sets: 3, target: [8, 12], tip: "Bagerste fod op på en stol eller sofakant." }),
  planke: ex({ id: "planke", name: "Planke", unit: "sek", sets: 3, target: [30, 60] }),
  knaeloeft: ex({ id: "knaeloeft", name: "Hængende knæløft", unit: "reps", sets: 3, target: [8, 15], tip: "I pull-up-stangen. Undgå at svinge." }),
  intervaller: ex({ id: "intervaller", name: "Intervaller 30/30", unit: "runder", sets: 1, target: [10, 15], tip: "30 sek. fuld fart (burpees, cykel, sjippetov) + 30 sek. pause = 1 runde." }),
  skraapres: ex({ id: "skraapres", name: "Gulvpres / skråbænkspres", unit: "kg", sets: 4, target: [8, 12], tip: "Uden bænk: lig på gulvet med bøjede knæ og pres op. Med bænk: ryglænet på ca. 30°." }),
  chinups: ex({ id: "chinups", name: "Chin-ups (underhåndsgreb)", unit: "reps", sets: 4, target: [3, 10] }),
  sideloeft: ex({ id: "sideloeft", name: "Sideløft", unit: "kg", sets: 3, target: [10, 15], tip: "Lette vægte, løft til skulderhøjde." }),
  dips: ex({ id: "dips", name: "Dips (stol eller sofakant)", unit: "reps", sets: 3, target: [8, 15] }),
  triceps: ex({ id: "triceps", name: "Triceps extension over hovedet", unit: "kg", sets: 3, target: [10, 15] }),
  deadbug: ex({ id: "deadbug", name: "Dead bug (pr. side)", unit: "reps", sets: 3, target: [8, 12] }),
};

export const DAYS: Day[] = [
  { id: "overkrop-a", name: "Overkrop A", short: "Overkrop A", weekday: 1, exercises: [E.armstraek, E.roning, E.skulderpres, E.pullups, E.curl] },
  { id: "underkrop", name: "Underkrop + mave", short: "Underkrop", weekday: 2, exercises: [E.goblet, E.rdl, E.bulgarsk, E.planke, E.knaeloeft] },
  { id: "interval", name: "Intervaller", short: "Interval", weekday: 3, exercises: [E.intervaller] },
  { id: "overkrop-b", name: "Overkrop B", short: "Overkrop B", weekday: 4, exercises: [E.skraapres, E.chinups, E.sideloeft, E.dips, E.triceps] },
  { id: "fuldkrop", name: "Fuld krop", short: "Fuld krop", weekday: 5, exercises: [E.goblet, E.roning, E.skulderpres, E.rdl, E.deadbug] },
  { id: "interval-2", name: "Intervaller (eller lang gåtur)", short: "Interval 2", weekday: 6, exercises: [E.intervaller] },
];

/** Alle øvelser, uden dubletter (samme øvelse kan stå på flere dage). */
export const EXERCISES: Exercise[] = Object.values(E);

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id);
export const dayById = (id: string) => DAYS.find((d) => d.id === id);
