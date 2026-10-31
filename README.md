# Expo Quote Studio · Standskisse

Internal sales tool for expo stands: sketch the stand (walls, back rooms, floor, furniture, InFrame textile walls),
compare up to four variants and send an indicative quote. Web app, no server; state lives in `localStorage` and in
sketch files (JSON).

## Structure

```
src/
  domain/       pure types and functions: grid, walls, openings, floor, variants
  rules/        build rules as data (approved 30.10.2026). Change values here, never in calc
  catalog/      products, variants, prices (examples) and the art.nr the calc uses for system parts
  calc/         calc(variant, rules, catalog) → groups, lines, sums, key figures. InFrame production sizes
  foga/         Foga System engine: stand → Foga parts list (cut list + couplings). See docs/foga-system.md
  persistence/  sketch file format (versioned) and localStorage
```

The build system is Foga System; how it works and what is still open is in `docs/foga-system.md`.
Stand walls, inner walls and room walls (terms and what each may do) are locked in `docs/vegger.md`.

The stand model is the single source of truth. Plan, 3D, calc, quote and production are derived from it.
A room (bakrom, lager, møterom) is a `Room` with an orthogonal outline; its walls are derived and reuse stand walls.

## Develop

```
npm install
npm run dev      # app
npm test         # calc and file format tests
npm run build
```

## Deploy

`.github/workflows/deploy.yml` tests every pull request and deploys `main` to GitHub Pages.
Enable it once under Settings → Pages → Source: GitHub Actions.
