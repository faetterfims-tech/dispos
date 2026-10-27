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
- **SunMate** (produktion, op/afladning): API endnu ikke koblet på. Indtil da indlæses en CSV i browseren (`lib/solar/sunmate.ts`).
- Beregningen er ren TypeScript uden afhængigheder: `lib/solar/engine.ts` med tests i `engine.test.ts`.

## Miljøvariabler (Vercel → Settings → Environment Variables)

| Navn | |
|---|---|
| `DISPOS_PASSWORD` | Påkrævet. Adgangskode til hele siden. |
| `MINSTROEM_API_KEY` | Nøgle fra Min Strøm-appen (kræver Min Strøm Plus). |
| `MINSTROEM_ADDRESS_ID` | Valgfri, hvis kontoen har flere adresser. |

## Udvikling

```bash
npm install
npm run dev
npm test
```
