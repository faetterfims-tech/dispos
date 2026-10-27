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
