import { msPerBeat } from '../core/chart';
import { t } from '../core/text/strings';
import { createAudio } from '../io/audio/createAudio';
import { monitorKeyboard } from '../io/audio/monitor';
import { createKeyboardInputs } from '../io/createInputs';

const C_MAJOR = [60, 62, 64, 65, 67, 69, 71, 72];

/** Dev-only page (`?demo=audio`): hear the piano, see the song clock and check the metronome and key latency. */
export async function startAudioDemo(): Promise<void> {
  document.body.style.cssText = 'margin:0;background:#1b1b2f;color:#eee;font:14px monospace;display:flex;flex-direction:column;height:100vh';
  const page = document.createElement('div');
  page.style.cssText = 'flex:1;padding:16px;overflow:auto';
  const keyboardHost = document.createElement('div');
  keyboardHost.style.cssText = 'padding:0 16px 16px';
  document.body.replaceChildren(page, keyboardHost);

  const audio = createAudio({ baseUrl: `${import.meta.env.BASE_URL}audio/salamander/` });
  audio.unlock(window);
  const { clock, piano, metronome } = audio;
  const virtual = new URLSearchParams(window.location.search).get('device') === 'virtual';
  const inputs = createKeyboardInputs({
    virtual, parent: keyboardHost, keyTarget: window,
    now: () => clock.fromDomTime(performance.now()), toSongTimeMs: (domMs) => clock.fromDomTime(domMs),
  });
  monitorKeyboard(inputs.keyboard, piano, { monitorMidi: true });

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = ''): HTMLElementTagNameMap[K] => Object.assign(document.createElement(tag), { textContent: text });
  const status = el('pre');
  const latency = el('pre');
  const beatBox = el('div', ' ');
  beatBox.style.cssText = 'width:120px;height:40px;background:#333;margin:8px 0;text-align:center;line-height:40px;font-size:20px';
  const beatInfo = el('pre');
  const bpm = Object.assign(el('input'), { type: 'number', value: '100', min: '30', max: '1000' });
  const perBar = Object.assign(el('input'), { type: 'number', value: '4', min: '1', max: '8' });
  const startButton = el('button', 'Start metronome');
  const stopButton = el('button', 'Stop');
  const scaleButton = el('button', 'Play C major scale');
  page.append(el('h2', t('demo.audio.title')), el('p', t('demo.audio.help')), status, scaleButton, el('p'), 'BPM ', bpm, ' beats/bar ', perBar, ' ', startButton, ' ', stopButton, beatBox, beatInfo, el('h3', 'Key to sound'), latency);

  // The sampler has no hardware latency measurement; this shows the software part: key event to noteOn call.
  const softwareMs: number[] = [];
  inputs.keyboard.onNote((event) => {
    if (event.kind !== 'on') return;
    softwareMs.push(clock.fromDomTime(performance.now()) - event.timeMs);
    if (softwareMs.length > 20) softwareMs.shift();
    const avg = softwareMs.reduce((a, b) => a + b, 0) / softwareMs.length;
    const info = audio.info();
    latency.textContent = [
      `last key to noteOn call: ${softwareMs.at(-1)!.toFixed(1)} ms   average of ${softwareMs.length}: ${avg.toFixed(1)} ms`,
      `browser audio latency: base ${info.baseLatencyMs} ms + output ${info.outputLatencyMs} ms`,
      `estimated key to sound: ${(avg + info.baseLatencyMs + info.outputLatencyMs).toFixed(1)} ms (real acoustic latency needs a mic or phone test)`,
    ].join('\n');
  });

  scaleButton.addEventListener('click', () => {
    const start = clock.nowMs() + 250;
    C_MAJOR.forEach((midi, i) => {
      piano.noteOn(midi, 85, start + i * 450);
      piano.noteOff(midi, start + i * 450 + 400);
    });
  });

  // Beat flash and sync readout. "Scheduled" is where the click sits on the audio clock (exact by construction);
  // "callback lateness" is how late the screen is told, which shows main-thread jitter, never audio drift.
  let first: number | null = null;
  const lateness: number[] = [];
  metronome.onBeat((beat) => {
    if (beat.index === 0) {
      first = beat.atMs;
      lateness.length = 0;
    }
    lateness.push(clock.nowMs() - beat.atMs);
    beatBox.style.background = beat.beatInBar === 0 ? '#2b6cff' : '#555';
    beatBox.textContent = `${beat.bar + 1}.${beat.beatInBar + 1}`;
    setTimeout(() => (beatBox.style.background = '#333'), 80);
    const grid = first === null ? 0 : beat.atMs - (first + beat.index * msPerBeat(Number(bpm.value)));
    beatInfo.textContent = [
      `beat ${beat.index}  scheduled at song time ${beat.atMs.toFixed(1)} ms  (grid error ${grid.toFixed(3)} ms at constant tempo)`,
      `screen callback lateness: min ${Math.min(...lateness).toFixed(1)}  max ${Math.max(...lateness).toFixed(1)} ms over ${lateness.length} beats`,
    ].join('\n');
  });
  startButton.addEventListener('click', () => metronome.start({ bpm: Number(bpm.value), beatsPerBar: Number(perBar.value) }));
  stopButton.addEventListener('click', () => metronome.stop());
  bpm.addEventListener('change', () => metronome.setBpm(Number(bpm.value)));

  const refresh = () => {
    const info = audio.info();
    status.textContent = [
      `audio: ${info.state}  sample rate ${info.sampleRate} Hz  song clock ${clock.nowMs().toFixed(0)} ms`,
      `piano samples: ${piano.loaded ? 'loaded' : 'loading...'}${piano.failed ? `  (${piano.failed} failed)` : ''}`,
      `keyboard: ${inputs.keyboard.getStatus().state}${inputs.midiProblem ? `  (real MIDI: ${inputs.midiProblem})` : ''}`,
    ].join('\n');
  };
  setInterval(refresh, 250);
  refresh();
}
