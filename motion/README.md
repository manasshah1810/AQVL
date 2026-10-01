# AQVL launch film

Self-contained Remotion project (not part of the pnpm workspace). Output: `out/aqvl-launch-film.mp4`.

```bash
npm install
npm run brand      # regenerate logo SVGs in public/brand from scripts/brand.mjs
npm run textures   # regenerate grain/paper/board textures + the frozen wall frame
npm run draft      # 960x540 preview
npm run master && npm run final   # 1920x1080 deliverable
```

Rendering uses the preinstalled headless Chromium configured in `remotion.config.ts`.
Every frame is a pure function of the frame number (seeded randomness only).

**Identity:** a ring, broken at 4:30, closed by a single point. It is the dot of a
question mark, resolved, and it is also the Q of AQVL. One stroke weight drives
the whole system (`scripts/brand.mjs`).
