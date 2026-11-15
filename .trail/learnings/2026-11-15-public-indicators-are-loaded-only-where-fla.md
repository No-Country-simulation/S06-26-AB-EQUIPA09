---
title: "Public indicators are loaded only where IBGE or DATASUS really publish them, at municipal level, and never invented"
author: Flávio
date: 2026-11-15
branch: feat/security-agent-public-data-tests
cost: { minutes: 13, tokens: 156904 }
id: l-a47cea6a
scope: repo
status: active
src: agent
touches:
  - README.md
  - README_BAC.md
  - README_FRONT.md
  - backend/README.md
  - docs/API_CONTRACT.md
  - docs/ARQUITECTURE.md
  - web/.gitignore
  - web/e2e/staff-login.spec.ts
  - web/e2e/user-flow.spec.ts
  - web/package-lock.json
---

## Decided
Only two indicators are loaded from public sources: formal employment (IBGE company registry salaried workers divided by Census 2022 population) and mental health coverage (CAPS units per 100k people from DATASUS, scored against the Ministry of Health target of 0.70). Municipal values are copied to every region of that municipality and the note on each row says so. Training, social initiatives and mentoring stay empty and the dashboard shows a dash instead of 0, because a zero reads as terrible when it means no source. The 12 CAPS become programs, each linked to the nearest region by the coordinates DATASUS gives.

## Tried and ruled out
Filling the three missing indicators with plausible numbers: no public source exists, so it would be invented data in a government decision tool. Counting CAPS weighted by type: the API only gives a free text name, so units are counted equally.

## Watch out
Every municipality meets the 0.70 target, so the mental health index is 100 everywhere and does not separate regions. Employment counts jobs where they are located, so it overstates job hubs. Region names in the database have no accents while municipality labels do; matching uses the unaccented name.
A git add that includes a path matching the ignore rules (the coverage module folder) fails halfway and still stages the other paths, which silently mixes files into the next commit. Use git add -u for tracked files there.
Installing a newer Playwright browser prunes older cached browsers.

In the code:
- backend/scripts/load-public-data.ts: bun run data:load-public, with --offline (snapshot) and --dry-run
- backend/src/modules/ingestion/application/services/public-data.ts: pure calculations
- backend/data/public-sources/snapshot.json: raw API responses used for offline runs
- web/src/lib/indicadores.ts: temDadosIndicador drives the dash on the dashboard
