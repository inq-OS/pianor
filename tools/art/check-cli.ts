import { mkdirSync, writeFileSync } from 'node:fs';
import { SKY_PHASES, type SkyPhase } from '../../src/core/sky/skyPhase.ts';
import { lchOf } from '../../src/game/ui/pixel/paint/lab.ts';
import { runStats } from './colourRuns.ts';
import { runUse, withGuides } from './guides.ts';
import { pngBytes } from './png.ts';
import { PICTURES } from './pictures.ts';
import { bandedFindings, cloudFindings, cloudShape, limitsFor, runFindings } from './sceneChecks.ts';

/**
 * `npm run art:check -- <picture> [hour]`: measures one of Keri's pictures against the rules that can be measured
 * (docs/art-direction.md; the `paint-a-scene` skill): its colour runs (steps in lightness, how the hue turns), which
 * of their colours the picture uses, its clouds, and a copy of it with the composition's
 * guides laid over, written to `test-logs/art/<picture>-<hour>-guides.png`. Findings are warnings for the painter; the
 * eye and the maintainer decide.
 */

const [name = '', hour = 'day'] = process.argv.slice(2);
const paint = PICTURES[name];
if (!paint || !SKY_PHASES.includes(hour as SkyPhase)) {
  console.error(`usage: npm run art:check -- <${Object.keys(PICTURES).join('|')}> [${SKY_PHASES.join('|')}]`);
  process.exit(2);
}
const picture = paint(hour as SkyPhase);
const { bitmap, palette } = picture;
const findings: string[] = [];

console.log(`${name} at ${hour}: ${bitmap.width} x ${bitmap.height} fine pixels, ${palette.length} colours in its palette, ${new Set(bitmap.pixels).size} used`);
if (picture.horizon !== undefined) console.log(`horizon at ${(picture.horizon / bitmap.height).toFixed(2)} of the height (never 0.50; where the viewer's eye is)`);

{
  // the whole runs, in-betweens included; judged in the day's colours, which an hour only lights
  const { day } = picture;
  const use = new Map(runUse(bitmap, picture.runs).map((u) => [u.name, u]));
  console.log('\nrun          colours  used  L* dark..light  largest step  hue turn /10 L*');
  for (const [run, places] of Object.entries(picture.runs)) {
    // some runs are kept light to dark (a cloud's lit top first): measure them dark to light
    const hexes = places.map((p) => day[p]!).sort((a, b) => lchOf(a).l - lchOf(b).l);
    const s = runStats(hexes);
    const turn = s.hueTurnPer10L === null ? 'grey' : s.hueTurnPer10L.toFixed(1);
    const u = use.get(run)!;
    console.log(`${run.padEnd(12)} ${String(places.length).padStart(7)}  ${String(u.used).padStart(4)}  ${s.lightness[0]!.toFixed(0).padStart(5)}..${s.lightness[s.lightness.length - 1]!.toFixed(0).padEnd(8)}${s.maxStep.toFixed(1).padStart(12)}  ${turn.padStart(15)}`);
    if (!picture.apart?.has(run)) findings.push(...runFindings(run, hexes, picture.kinds?.[run] ?? 'material', limitsFor(picture.banded).step));
  }
  if (picture.banded) {
    console.log(`(a banded picture: a lit set keeps short runs, steps up to ${limitsFor(true).step} L*, so its light lands in flat tones)`);
    findings.push(...bandedFindings(Object.values(picture.runs).map((places) => places.map((p) => day[p]!).sort((a, b) => lchOf(a).l - lchOf(b).l))));
  }
  if (hour !== 'day') console.log('(the runs are judged in the day\'s colours; an hour only lights them)');
}

if (picture.clouds?.length) {
  const shapes = picture.clouds.map(cloudShape);
  console.log('\ncloud  size      length:height  head/tail  head at');
  shapes.forEach((c, i) => console.log(`${String(i + 1).padStart(5)}  ${`${c.width} x ${c.height}`.padEnd(9)} ${c.aspect.toFixed(1).padStart(13)}  ${c.headOverTail.toFixed(1).padStart(9)}  ${c.headAt.toFixed(2).padStart(7)}`));
  findings.push(...cloudFindings(shapes));
}

const out = `test-logs/art/${name}-${hour}-guides.png`;
mkdirSync('test-logs/art', { recursive: true });
writeFileSync(out, pngBytes(withGuides({ width: bitmap.width, height: bitmap.height, pixels: bitmap.pixels, palette }, picture.horizon), 2));
console.log(`\n${out}: the subject band (0.4 to 0.6 of the width) and the middle row dotted, the horizon solid`);
console.log(findings.length ? `\n${findings.length} findings:\n${findings.map((f) => `- ${f}`).join('\n')}` : '\nno findings');
