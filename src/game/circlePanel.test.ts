import { afterEach, describe, expect, it } from 'vitest';
import { circlePanelLayout, spellingsOf, stepOfFifths } from '../core/layout/circleOfFifths';
import { FRAME_ROWS, frameView } from '../core/layout/frame';
import type { Rect } from '../core/layout/rect';
import { keyName, type KeyMode } from '../core/editor/key';
import { setLanguage, type Language } from '../core/text/language';
import type { NoteNaming } from '../core/text/noteName';
import { WHEEL_MARGIN } from './ui/pixel/circleArt';
import { drawnText, renderText } from './ui/pixel/font';
import { signatureIcon } from './ui/pixel/lengthArt';
import { BAR_BUTTON_HEIGHT } from './ui/pixel/playBars';

afterEach(() => setLanguage('en'));

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

/** The circle's panel as the overlay lays it out on a screen, with its name and ticks measured as the scene draws them. */
function panelFor(screen: { width: number; height: number }, fifths: number, mode: KeyMode, naming: NoteNaming, choosing: boolean) {
  const view = frameView(screen.width, screen.height);
  const name = (f: number) => keyName(f, mode, naming);
  const heading = renderText(drawnText(name(fifths), true), { color: 0 });
  const ticks = choosing ? spellingsOf(stepOfFifths(fifths)).map((f) => Math.max(22, (f === 0 ? 14 : signatureIcon(f).width) + 8)) : [];
  return circlePanelLayout({ width: view.width, rows: Math.floor(screen.height / view.scale) - FRAME_ROWS }, {
    heading: { w: heading.width, h: heading.height }, ticks, choosing, wheelMargin: WHEEL_MARGIN, button: { w: 22, h: BAR_BUTTON_HEIGHT },
  });
}

const SCREENS = [{ width: 1920, height: 1080 }, { width: 1536, height: 864 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }];
const CASES = (['en', 'et'] as Language[]).flatMap((lang) => (['B', 'H'] as NoteNaming[]).map((naming) => ({ lang, naming })));

describe('circlePanelLayout (ft_1_28.AC6, ft_1_28.AC7)', () => {
  it('ft_1_28.AC7 no button covers the key\'s name, for every key in both languages, the piece maker\'s two ticks included', () => {
    for (const { lang, naming } of CASES) {
      setLanguage(lang);
      for (const screen of SCREENS) {
        for (const choosing of [false, true]) {
          for (const mode of ['major', 'minor'] as KeyMode[]) {
            for (let fifths = -7; fifths <= 7; fifths++) {
              const layout = panelFor(screen, fifths, mode, naming, choosing);
              const buttons = [layout.listen, layout.close, ...layout.ticks];
              const at = `${lang} ${naming} ${screen.width}x${screen.height} ${fifths} ${mode} ${choosing ? 'choosing' : 'showing'}`;
              for (const button of buttons) {
                expect(overlaps(button, layout.heading), at).toBe(false);
                expect(inside(button, layout.panel), at).toBe(true);
                expect(button.y + button.h, at).toBeLessThanOrEqual(layout.staff.y);
              }
              buttons.forEach((a, i) => buttons.slice(i + 1).forEach((b) => expect(overlaps(a, b), at).toBe(false)));
              expect(layout.heading.y + layout.heading.h, at).toBeLessThanOrEqual(layout.staff.y);
            }
          }
        }
      }
    }
  });

  it('ft_1_28.AC6 the staff stands at one place for every key', () => {
    for (const choosing of [false, true]) {
      const rooms = new Set<string>();
      for (let fifths = -7; fifths <= 7; fifths++) {
        for (const mode of ['major', 'minor'] as KeyMode[]) rooms.add(JSON.stringify(panelFor(SCREENS[0]!, fifths, mode, 'B', choosing).staff));
      }
      expect(rooms.size).toBe(1);
    }
  });

  it('keeps the shown circle\'s staff where it was; the ticks\' row moves it down only when choosing', () => {
    const shown = panelFor(SCREENS[0]!, 0, 'major', 'B', false);
    expect(shown.staff.y).toBe(shown.panel.y + 30);
    expect(panelFor(SCREENS[0]!, 0, 'major', 'B', true).staff.y).toBeGreaterThan(shown.staff.y);
  });
});
