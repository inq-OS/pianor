import littleSteps from '../../content/dev/charts/little-steps.chart.json';
import { parseChart } from '../core/chart';
import { WaitMode, type JudgeEvent } from '../core/judge';
import { t } from '../core/text/strings';
import { createKeyboardInputs } from '../io/createInputs';
import { midiName } from '../io/mock/keyboardLayout';
import { composePerformance, playThroughDevice } from '../io/mock/performance';
import { realtimeScheduler } from '../io/mock/scheduler';

function describeEvent(e: JudgeEvent): string | null {
  switch (e.type) {
    case 'NoteJudged':
      return e.verdict === 'correct'
        ? `correct   ${midiName(e.midi)}${e.firstTry ? '' : '  (not first try)'}`
        : `wrong     ${midiName(e.midi)}  expected ${midiName(e.expectedMidi)}: ${e.reason}, ${e.direction}`;
    case 'NoteMissed':
      return `missed    ${midiName(e.midi)}`;
    case 'BarCompleted':
      return `bar ${e.result.bar + 1} done  accuracy ${Math.round(e.result.accuracy * 100)}%`;
    case 'PhraseCompleted':
      return `phrase "${e.result.name}" done`;
    case 'PieceCompleted':
      return `${t('demo.keys.done')}: accuracy ${Math.round(e.result.accuracy * 100)}%, mistakes ${e.result.mistakes}`;
  }
}

/** Dev-only page (`?demo=keys`): the whole input path in a browser, with the judge and key lights, and no EZ-220 needed. */
export async function startKeysDemo(): Promise<void> {
  const parsed = parseChart(littleSteps);
  if (!parsed.ok) throw new Error(parsed.errors.join('; '));
  const chart = parsed.chart;

  document.body.style.cssText = 'margin:0;background:#1b1b2f;color:#eee;font:14px monospace;display:flex;flex-direction:column;height:100vh';
  const page = document.createElement('div');
  page.style.cssText = 'flex:1;padding:16px;overflow:auto';
  const keyboardHost = document.createElement('div');
  keyboardHost.style.cssText = 'padding:0 16px 16px';
  document.body.replaceChildren(page, keyboardHost);

  const heading = Object.assign(document.createElement('h2'), { textContent: t('demo.keys.title') });
  const help = Object.assign(document.createElement('p'), { textContent: t('demo.keys.help') });
  const status = document.createElement('p');
  const progress = document.createElement('p');
  const log = document.createElement('pre');
  log.style.cssText = 'background:#11111f;padding:8px;min-height:200px';
  const button = Object.assign(document.createElement('button'), { textContent: t('demo.keys.play') });
  page.append(heading, help, status, button, progress, log);

  const virtual = new URLSearchParams(window.location.search).get('device') === 'virtual';
  const inputs = createKeyboardInputs({ virtual, parent: keyboardHost, keyTarget: window });
  await inputs.ready;
  const lines: string[] = [];
  let mode = new WaitMode(chart);

  const refresh = () => {
    const s = inputs.keyboard.getStatus();
    const midi = inputs.midiProblem ? ` | ${t('midi.noKeyboard')} (${inputs.midiProblem})` : '';
    status.textContent = `Keyboard: ${s.state}${s.name ? ` (${s.name})` : ''}${midi}`;
    const state = mode.getState();
    const awaiting = state.awaiting.map((i) => chart.notes[i]!.midi);
    progress.textContent = state.done ? t('demo.keys.done') : `Step ${state.stepIndex + 1}/${state.stepCount}, waiting for ${awaiting.map(midiName).join(' + ')}`;
    inputs.lights.setLitKeys(awaiting);
  };

  inputs.keyboard.onStatus(refresh);
  inputs.keyboard.onNote((note) => {
    for (const event of mode.handle(note)) {
      const text = describeEvent(event);
      if (text) lines.push(text);
    }
    log.textContent = lines.slice(-14).join('\n');
    refresh();
  });

  button.style.display = inputs.virtualDevice ? '' : 'none';
  button.addEventListener('click', () => {
    if (!inputs.virtualDevice) return;
    mode = new WaitMode(chart);
    lines.length = 0;
    log.textContent = '';
    playThroughDevice(
      inputs.virtualDevice,
      composePerformance(chart, {
        tempoScale: 3, jitterMs: 20, seed: 4,
        mistakes: [{ stepIndex: 2, kind: 'neighbour-key' }, { stepIndex: 6, kind: 'wrong-octave' }, { stepIndex: 8, kind: 'wrong-letter' }],
      }),
      realtimeScheduler,
    );
  });
  refresh();
}
