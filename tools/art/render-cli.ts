import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SKY_PHASES, type SkyPhase } from '../../src/core/sky/skyPhase.ts';
import { pngBytes } from './png.ts';
import { KIT_FAMILIES, type KitFamily } from '../../src/game/ui/pixel/keri/kit/kit.ts';
import { kitSheet } from './kitSheet.ts';
import { figureSheet } from './figureSheet.ts';
import { PICTURES } from './pictures.ts';

/**
 * `npm run art:render -- <picture> [hour] [file] [zoom]`: paints one of Keri's pictures and writes it as a PNG, so it
 * can be looked at without starting the game (docs/art-direction.md, "Look at it"). A picture is `room`, `map` or
 * `knoll`; an hour is `day` (the default), `dawn`, `dusk` or `night`; the file defaults to `test-logs/art/<picture>-<hour>.png`
 * (a folder git ignores); the zoom defaults to 2. What moves in the game is shown in one of its looks.
 *
 * `npm run art:render -- kit [family] [hour] [file] [zoom]` paints the painter's kit instead: every type of every
 * family (or of one: `kit stones`) in every variant, to pick from (`kitSheet.ts`, d124); its zoom defaults to 3.
 *
 * `npm run art:render -- figures [hour] [file] [zoom]` paints the template character's sheet: the sample people in every
 * state and a row of generated islanders (`figureSheet.ts`, d144); its zoom defaults to 3.
 */

const args = process.argv.slice(2);
const name = args.shift() ?? '';
// the kit's sheet takes a family before the hour: `kit stones night`
const family = name === 'kit' && KIT_FAMILIES.includes(args[0] as KitFamily) ? args.shift() : undefined;
const [hour = 'day', file, zoom = name === 'kit' || name === 'figures' ? '3' : '2'] = args;
const paint = name === 'kit' ? (phase: SkyPhase) => kitSheet(phase, family) : PICTURES[name];
if (name === 'figures' && SKY_PHASES.includes(hour as SkyPhase)) {
  const sheet = figureSheet(hour as SkyPhase);
  const out = file ?? `test-logs/art/figures-${hour}.png`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, pngBytes(sheet, Number(zoom)));
  console.log(`${out}: ${sheet.width} x ${sheet.height} fine pixels at ${zoom}x, ${sheet.palette.length - 1} colours`);
  process.exit(0);
}
if (!paint || !SKY_PHASES.includes(hour as SkyPhase)) {
  console.error(`usage: npm run art:render -- <${Object.keys(PICTURES).join('|')}> [${SKY_PHASES.join('|')}] [file.png] [zoom]`);
  console.error(`       npm run art:render -- kit [${KIT_FAMILIES.join('|')}] [${SKY_PHASES.join('|')}] [file.png] [zoom]`);
  console.error(`       npm run art:render -- figures [${SKY_PHASES.join('|')}] [file.png] [zoom]`);
  process.exit(2);
}
const started = Date.now();
const { bitmap, palette } = paint(hour as SkyPhase);
const out = file ?? `test-logs/art/${[name, family, hour].filter(Boolean).join('-')}.png`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, pngBytes({ width: bitmap.width, height: bitmap.height, pixels: bitmap.pixels, palette }, Number(zoom)));
console.log(`${out}: ${bitmap.width} x ${bitmap.height} fine pixels at ${zoom}x, ${palette.length} colours, painted in ${Date.now() - started} ms`);
