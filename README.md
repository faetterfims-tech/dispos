# dispos

Daniels personlige app-portal. Next.js (App Router) på Vercel.

Hvert værktøj ligger i sin egen mappe under `app/` og registreres i `lib/tools.ts`.

## Værktøjer

### Solceller (`/solceller`)

Regner time for time ud, hvad solceller og batteri faktisk sparer, ved at sammenligne tre scenarier:

| Scenarie | Sådan |
|---|---|
| **Faktisk** | Købt og solgt ifølge Min Strøm |
| **Kun sol** | Underskud købes, overskud sælges samme time |
| **Uden anlæg** | Hele husforbruget købes til timens pris |

Husforbrug pr. time = købt + sol + afladet − solgt − opladet.

- **Min Strøm** (måler + priser) hentes på serveren: `lib/minstrom.ts`, `app/api/solceller/route.ts`.
- **SunMate** (produktion, op/afladning): API'et har kun dagens tidslinje, så den samles løbende. GitHub Actions kalder `/api/sunmate/collect` hvert 20. minut (`.github/workflows/sunmate.yml`), som regner watt om til kWh pr. time og gemmer i Upstash Redis. Historik før indsamlingen kan indlæses som CSV med timetal.
- Beregningen er ren TypeScript uden afhængigheder: `lib/solar/engine.ts` med tests i `engine.test.ts`.

### Træning (`/traening`)

Træningslog til hjemmeprogrammet (4 styrkepas + 2 intervalpas om ugen).

- **Træn**: ugens dage øverst, dagens pas med farve og fremskridt. Rygopvarmning før styrkepas med en guidet timer (fuld skærm, nedtælling, bip ved skift, holder skærmen tændt). Hver øvelse har et almindeligt dansk navn, en kort forklaring og et link til en video. Tallene er udfyldt ud fra sidste gang, og man trykker ✓ ved hvert sæt, man har lavet. Kun sæt med ✓ bliver gemt.
- **Ur**: "Start dagens træning" låser op og starter uret. ▶ starter et sæt, ✓ afslutter det. Tiden deles i aktiv (sæt og opvarmningstimer), pause (op til 2 min efter hver aktiv periode) og spildtid, og gemmes med passet (`lib/traening/timing.ts`).
- **Fremgang**: træninger pr. uge, vægt og mål om maven siden start, og styrke pr. øvelse over tid.
- **Vægt**: vægt og mål om maven med grafer.
- **Tidligere**: alle træninger med mulighed for at slette.

**Sættimer:** ▶ ved et sæt åbner en timer i fuld skærm med 5 sekunders nedtælling (tid til at stille sig klar, tæller ikke som aktiv tid) og derefter rytme pr. øvelse (fx 2 sek ned/1 sek op, 1 sek op/2 sek ned for curl og roning, op/hold 2 sek/ned for hoftehævning og armløft) med en løbebar i høj opløsning for hver fase, bip ved hvert skift og tælling af gentagelser, indtil man trykker Færdig. Bagefter bekræftes antal og kg, og en pausenedtælling starter (2 min for ben, 1½ min for øvrige styrkeøvelser, 1 min for mave/core) med bip de sidste 3 sek og visning af næste sæt. Lyd kan slås fra.

**Vægtforslag:** første gang en vægtøvelse laves, er sæt 1 et testsæt med et forsigtigt startgæt ud fra kropsvægt, erfaring og evt. køn ("Om dig" under Vægt). Ud fra antallet i testsættet beregnes vægten til resten (Epley). Derefter foreslås mere vægt, når alle sæt når toppen af intervallet (større spring, hvis man er langt over), og mindre, når man er langt under. Logikken ligger i `lib/traening/loads.ts` og `suggest()` i `logic.ts`.

**Kalorier:** et skøn som interval ud fra MET-værdier i 2024 Adult Compendium of Physical Activities (kcal ≈ MET × kg × timer, brutto). I sættene: vægte 5,0–6,0 MET, kropsvægt 3,8–6,5, planke/mave 2,8–3,8, intervaller og bjergbestiger 7,5–8,8; pauser 1,5–2,0; opvarmning 2,8–3,5. Sættid fra uret, ellers antal × rytme. Kun aktiv træning tæller (sæt, pauser op til den foreskrevne og opvarmning), ikke spildtid. Vises i en opgørelse efter gemt træning, ved hver træning under Tidligere og som graf pr. uge under Fremgang (`lib/traening/calories.ts`).

**Rolig opstart:** færre sæt de første uger ud fra erfaring (`lib/traening/ramp.ts`). Ny: 3 uger (2 · 2 · alle minus 1 sæt; 6/8/10 intervalrunder; stop med 3–4 → 2–3 gentagelser i reserve). Lidt erfaren: 2 uger. Øvet: ingen. Regnes fra første gemte træning. Kan slås til/fra under Vægt → Om dig og fra 🌱-mærket på passet. Grundlag: ACSM (1 sæt virker for begyndere de første måneder) og "repeated bout effect" (et første pas med få sæt beskytter næsten lige så godt mod ømhed; Nosaka m.fl. 2001, Howatson m.fl. 2007).

**Gåtur og løbetur:** konditionspas kan tages som intervaller, gåtur eller løbetur (sidste valg huskes). Turen måles med telefonens GPS (filtrerer unøjagtige punkter, stilstand og urealistiske spring; pause trækkes fra), eller distance og tid skrives selv. Forbrænding ud fra gennemsnitsfarten med MET fra 2024 Compendium (gang 2,3–8,5 MET ved 2,4–8,5 km/t, løb 6,0–19,0 ved 6,4–19,3 km/t), ±10 % (`lib/traening/cardio.ts`, `app/traening/Cardio.tsx`). Appen skal være åben under turen; huller bliver til lige linjer.

**Fremgangsbilleder:** under Fremgang kan man tage billeder (Før/Undervejs/Efter, forfra/fra siden). De skaleres ned i browseren (ca. 1280 px + lille 320 px-udgave) og gemmes privat pr. person i Redis (`<præfiks>photos`, `photo:<id>`, `thumb:<id>`) via `app/api/traening/fotos`. Første og nyeste billede vises side om side med vægtændring, og sammenligningen dukker op som pop-up højst hver 14. dag. Efter en gemt træning minder appen om vægt/mål (hver 7. dag) og billede (hver 14. dag), når det er tid.

**Mit udstyr:** øverst under "Træn" sætter man hak ved det udstyr, man har (håndvægte, pull-up-stang, bænk, elastikbånd, stol). Hver plads i et pas har alternativer i prioriteret rækkefølge (`slots` i `program.ts`), og `resolveDay()` vælger det første, man kan lave. Med håndvægte bruges programmet med 6 pas, uden håndvægte kropsvægt-programmet. Valget gemmes pr. person (`meta.equipment`). En test gennemgår alle 32 kombinationer af udstyr.

**Deling med venner og familie:** under fanen "Inviter" (kun for ejeren) laves personlige links (`/t/<token>`). Linket sætter en cookie (`dispos_traening`), som giver adgang til `/traening` og `/api/traening` og intet andet. Resten af dispos kræver stadig `DISPOS_PASSWORD` (se `middleware.ts`). Hver inviteret har sine egne data under `traening:u:<id>:*`, mens ejerens data ligger under de oprindelige `traening:*`-nøgler. Kun en sha256-hash af tokenet gemmes (`traening:tokens`, `traening:users`). Logikken ligger i `lib/traening-users.ts` og `lib/traening/invite-core.ts`.

Programmet ligger i `lib/traening/program.ts`, logikken i `lib/traening/logic.ts` (tests i `logic.test.ts`). Data gemmes i Upstash Redis (`traening:sessions`, `traening:body`) via `app/api/traening/route.ts`.

## Login og app

- **Login:** browsere logger ind på `/login` og huskes i 400 dage med en cookie (`dispos_auth`, en HMAC af `DISPOS_PASSWORD`). Skiftes koden, bliver alle logget ud. Scripts (Home Assistant, curl) kan stadig sende koden som Basic Auth. Logikken ligger i `lib/auth.ts` og `middleware.ts`.
- **Som app (PWA):** `app/manifest.ts`, ikoner i `public/icons/` og `public/apple-touch-icon.png`, service worker i `public/sw.js` (gemmer kun Next.js' statiske filer, aldrig data; viser `public/offline.html` uden net). Disse filer kan hentes uden login.
- Installér: iPhone → Safari → Del → *Føj til hjemmeskærm*. Android → Chrome → ⋮ → *Installer app*.

## Miljøvariabler (Vercel → Settings → Environment Variables)

| Navn | |
|---|---|
| `DISPOS_PASSWORD` | Påkrævet. Adgangskode til hele siden. |
| `MINSTROEM_API_KEY` | Nøgle fra Min Strøm-appen (kræver Min Strøm Plus). |
| `MINSTROEM_ADDRESS_ID` | Valgfri, hvis kontoen har flere adresser. |
| `SUNMATE_API_TOKEN` | SunMate → Integrations → Manage API Tokens (rettigheder: `assets:read`, `live_dashboard:read`). |
| `SUNMATE_ASSET_ID` | Valgfri. Ellers bruges den første inverter. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Sættes automatisk, når Upstash for Redis forbindes under Vercel → Storage. |

GitHub-secret (Settings → Secrets and variables → Actions): `DISPOS_PASSWORD`, så indsamlingen kan logge ind.

## Udvikling

```bash
npm install
npm run dev
npm test
```
