# SunMate → dispos via Home Assistant

SunMates Cloudflare blokerer kald fra servere (Vercel, GitHub). Home Assistant
kører hjemme på en almindelig internetforbindelse, så den henter dagens
tidslinje fra SunMate og sender den videre til `https://dispos.dk/api/sunmate/ingest`.

## 1. `secrets.yaml`

Erstat `SUNMATE_TOKEN` og `DISPOS_PASSWORD` med de rigtige værdier.
Hele kommandoen ligger som én secret, så nøglerne aldrig står i `configuration.yaml`.

```yaml
sunmate_push: >-
  curl -sf --max-time 30
  -H "Authorization: Bearer SUNMATE_TOKEN"
  -H "Accept: application/json"
  "https://portal.sunmate.io/api/customer/v1/livedashboard?asset_id=2409044532"
  | curl -sf --max-time 30 -u "ha:DISPOS_PASSWORD"
  -H "Content-Type: application/json" --data-binary @-
  https://dispos.dk/api/sunmate/ingest
```

## 2. `configuration.yaml`

```yaml
shell_command:
  sunmate_push: !secret sunmate_push
```

## 3. Automatisering (hvert 10. minut)

```yaml
alias: SunMate til dispos
triggers:
  - trigger: time_pattern
    minutes: "/10"
actions:
  - action: shell_command.sunmate_push
mode: single
```

Genstart Home Assistant efter ændringen i `configuration.yaml`.
Test: Udviklerværktøjer → Handlinger → `shell_command.sunmate_push` → Udfør.
Efter et par kørsler viser Solceller-fanen "Automatisk indsamlet: … timer".
