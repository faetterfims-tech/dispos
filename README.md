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
- **Fremgang**: træninger pr. uge, vægt og mål om maven siden start, og styrke pr. øvelse over tid.
- **Vægt**: vægt og mål om maven med grafer.
- **Tidligere**: alle træninger med mulighed for at slette.

Programmet ligger i `lib/traening/program.ts`, logikken i `lib/traening/logic.ts` (tests i `logic.test.ts`). Data gemmes i Upstash Redis (`traening:sessions`, `traening:body`) via `app/api/traening/route.ts`.

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
