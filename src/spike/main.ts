/**
 * The hardware spike page (`spike.html`, `npm run spike`): a standalone check of the EZ-220 over Web MIDI, with no game
 * code. It lists the MIDI ports and follows plugging in and out, logs every raw message with its timestamp, sends notes to
 * test key lighting and Local Control, runs a tap test against clicks to measure how late key presses arrive, exports
 * the log (with a replay draft) and writes a summary for `docs/hardware-notes.md`. `?device=virtual` runs it against the
 * simulated EZ-220, which proves the page works and nothing about the real keyboard. Steps: `docs/hardware-test-checklist.md`.
 */
import { VirtualEz220 } from '../io/mock/VirtualEz220';
import { buildExport, describeMidi, noteName, summarize, type LogEntry, type PortInfo } from './midiLog';
import { hardwareReport, type ReportInput } from './report';
import { analyseTaps, type TapAnalysis } from './tapTest';

const params = new URLSearchParams(location.search);
const virtual = params.get('device') === 'virtual';
const device = virtual ? new VirtualEz220() : null;
const TAP_CLICKS = Math.max(4, Math.min(64, Number(params.get('clicks') ?? 16) || 16));
const TAP_BPM = 100;
const SHOWN_ROWS = 300;
const KEPT_ENTRIES = 50_000;
const T0 = performance.now();

interface PortEvent { t: number; name: string; type: string; state: string }

const state = {
  access: null as MIDIAccess | null,
  midiStatus: 'asking the browser ...',
  entries: [] as LogEntry[],
  portEvents: [] as PortEvent[],
  tapRuns: [] as TapAnalysis[],
  tap: { running: false, clicks: [] as number[], taps: [] as number[], mapping: '' },
  audio: null as AudioContext | null,
  /** Notes the page switched on and has not switched off, as "channel:note". */
  held: new Set<string>(),
};

// ---------------------------------------------------------------------------------------------------------------- DOM

type Child = Node | string;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}
const button = (label: string, onClick: () => void, quiet = false) => el('button', { type: 'button', className: quiet ? 'quiet' : '', onclick: onClick }, label);
const numberInput = (value: number, min: number, max: number) => el('input', { type: 'number', value: String(value), min: String(min), max: String(max) });
const field = (label: string, input: HTMLElement) => el('label', {}, `${label} `, input);
const hex = (bytes: number[]) => bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const seconds = (t: number) => ((t - T0) / 1000).toFixed(3);

const root = document.getElementById('spike')!;
const badge = el('span', { className: virtual ? 'badge virtual' : 'badge' }, virtual ? 'Simulated keyboard' : 'Real Web MIDI');
root.append(
  el('h1', {}, 'Pianor hardware check ', badge),
  el('p', { className: 'hint' }, virtual
    ? 'This run uses the simulated EZ-220: it shows the page works, never how the real keyboard behaves.'
    : 'Connect the EZ-220 over USB and allow MIDI when the browser asks. Follow docs/hardware-test-checklist.md, then copy the summary at the bottom into docs/hardware-notes.md.'),
);

// ---- environment
const envList = el('ul');
root.append(el('section', {}, el('h2', {}, 'This computer'), envList));
function renderEnvironment(): void {
  const audio = state.audio;
  envList.replaceChildren(
    el('li', {}, `Browser: ${navigator.userAgent}`),
    el('li', {}, `Secure context (needed for Web MIDI): ${window.isSecureContext ? 'yes' : 'no'}`),
    el('li', {}, `Web MIDI in this browser: ${virtual || 'requestMIDIAccess' in navigator ? 'yes' : 'no (use Chrome or Edge)'}`),
    el('li', { id: 'midi-status' }, `MIDI access: ${state.midiStatus}`),
    el('li', {}, audio
      ? `Audio: ${audio.sampleRate} Hz, base latency ${(audio.baseLatency * 1000).toFixed(1)} ms, output latency ${audio.outputLatency ? `${(audio.outputLatency * 1000).toFixed(1)} ms` : 'not reported'} (as the browser reports them)`
      : 'Audio: starts with the tap test'),
  );
}

// ---- simulated keyboard
const litLine = el('p', { id: 'virtual-lit' });
if (device) {
  const play = (notes: number[]) => notes.forEach((midi, i) => {
    setTimeout(() => device.isConnected && device.press(midi, 70 + i * 5), i * 300);
    setTimeout(() => device.isConnected && device.release(midi), i * 300 + 200);
  });
  root.append(el('section', {}, el('h2', {}, 'Simulated keyboard'),
    el('div', { className: 'row' },
      button('Play C D E F G', () => play([60, 62, 64, 65, 67])),
      button('Hold C4', () => device.press(60)), button('Release C4', () => device.release(60)),
      button('Active sensing', () => device.activeSensing()),
      button('Unplug', () => device.disconnect(), true), button('Plug in', () => device.connect(), true)),
    litLine));
}
function renderVirtualLit(): void {
  if (!device) return;
  const lit = new Set<number>();
  for (const { data } of device.output.sent) {
    const d = describeMidi(data);
    if (d.kind === 'note-on') lit.add(d.note!);
    if (d.kind === 'note-off') lit.delete(d.note!);
    if (d.kind === 'control' && d.controller === 123) lit.clear();
  }
  litLine.textContent = `Notes the computer holds on this keyboard (the real one might light these): ${lit.size ? [...lit].sort((a, b) => a - b).map(noteName).join(' ') : 'none'}`;
}

// ---- ports
const portRows = el('tbody');
const outputSelect = el('select', { id: 'output' });
const plugList = el('ul', { id: 'plug-events' });
root.append(el('section', {}, el('h2', {}, 'MIDI ports'),
  el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Type'), el('th', {}, 'Name'), el('th', {}, 'Maker'), el('th', {}, 'State'), el('th', {}, 'Connection'))), portRows),
  el('p', { className: 'hint' }, 'Unplug the keyboard and plug it back in: the list and the log below must follow without reloading the page.'),
  plugList));

function ports(): PortInfo[] {
  const access = state.access;
  if (!access) return [];
  const list: PortInfo[] = [];
  access.inputs.forEach((p) => list.push({ type: 'input', name: p.name ?? '?', manufacturer: p.manufacturer ?? '', state: p.state, id: p.id, version: p.version ?? '' }));
  access.outputs.forEach((p) => list.push({ type: 'output', name: p.name ?? '?', manufacturer: p.manufacturer ?? '', state: p.state, id: p.id, version: p.version ?? '' }));
  return list;
}

function refreshPorts(): void {
  const access = state.access;
  if (!access) return;
  access.inputs.forEach((input) => {
    if (input.state === 'connected') input.onmidimessage = (event) => onMessage(input.name ?? '?', event);
  });
  portRows.replaceChildren(...ports().map((p) => el('tr', {}, el('td', {}, p.type), el('td', {}, p.name), el('td', {}, p.manufacturer), el('td', {}, p.state),
    el('td', {}, String((p.type === 'input' ? access.inputs.get(p.id!) : access.outputs.get(p.id!))?.connection ?? '')))));
  const chosen = outputSelect.value;
  const outputs: MIDIOutput[] = [];
  access.outputs.forEach((o) => outputs.push(o));
  outputSelect.replaceChildren(...outputs.map((o) => el('option', { value: o.id }, `${o.name ?? '?'}${o.state === 'connected' ? '' : ' (disconnected)'}`)));
  if (outputs.some((o) => o.id === chosen)) outputSelect.value = chosen;
  renderEnvironment();
}

async function openMidi(): Promise<void> {
  try {
    if (!device && !('requestMIDIAccess' in navigator)) throw new Error('this browser has no Web MIDI (use Chrome or Edge)');
    const access = device ? device.access : await navigator.requestMIDIAccess({ sysex: false });
    state.access = access;
    state.midiStatus = 'allowed';
    access.onstatechange = (event) => {
      const port = event.port;
      if (port) {
        state.portEvents.push({ t: performance.now(), name: port.name ?? '?', type: port.type, state: port.state });
        plugList.prepend(el('li', {}, `${seconds(performance.now())} s: ${port.type} "${port.name ?? '?'}" is now ${port.state}`));
      }
      refreshPorts();
    };
    refreshPorts();
  } catch (e) {
    state.midiStatus = `refused or not available: ${e instanceof Error ? e.message : String(e)}`;
    renderEnvironment();
  }
}

// ---- sending: key lights, Local Control, echo
const channelInput = numberInput(1, 1, 16);
const noteInput = numberInput(60, 0, 127);
const velocityInput = numberInput(64, 1, 127);
const lengthInput = numberInput(1000, 50, 10000);
const echoBox = el('input', { type: 'checkbox', id: 'echo' });
const sendStatus = el('p', { className: 'hint', id: 'send-status' });
const noteLabel = el('span', { className: 'hint' });
const updateNoteLabel = () => (noteLabel.textContent = noteName(clampInt(noteInput, 0, 127)));
noteInput.addEventListener('input', updateNoteLabel);
updateNoteLabel();

function clampInt(input: HTMLInputElement, min: number, max: number): number {
  const value = Math.round(Number(input.value));
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}
const channel = () => clampInt(channelInput, 1, 16) - 1;

function selectedOutput(): MIDIOutput | null {
  return state.access?.outputs.get(outputSelect.value) ?? null;
}

function send(bytes: number[]): boolean {
  const output = selectedOutput();
  if (!output) {
    sendStatus.textContent = 'No output port to send to.';
    return false;
  }
  try {
    output.send(bytes);
  } catch (e) {
    sendStatus.textContent = `Could not send: ${e instanceof Error ? e.message : String(e)}`;
    return false;
  }
  addEntry({ t: performance.now(), dir: 'out', port: output.name ?? '?', bytes });
  return true;
}

function noteOn(note: number, velocity: number, ch = channel()): void {
  if (send([0x90 | ch, note, velocity])) state.held.add(`${ch}:${note}`);
}
function noteOff(note: number, ch = channel()): void {
  send([0x80 | ch, note, 0]);
  state.held.delete(`${ch}:${note}`);
}

function sendNote(): void {
  const note = clampInt(noteInput, 0, 127);
  const ch = channel();
  noteOn(note, clampInt(velocityInput, 1, 127), ch);
  setTimeout(() => noteOff(note, ch), clampInt(lengthInput, 50, 10000));
  sendStatus.textContent = `Sent ${noteName(note)} on channel ${ch + 1}. Did its key light up? Did the keyboard sound it?`;
}

function sendScale(): void {
  const ch = channel();
  const velocity = clampInt(velocityInput, 1, 127);
  [60, 62, 64, 65, 67, 69, 71, 72].forEach((note, i) => {
    setTimeout(() => noteOn(note, velocity, ch), i * 450);
    setTimeout(() => noteOff(note, ch), i * 450 + 400);
  });
  sendStatus.textContent = `Sending C4 to C5 one by one on channel ${ch + 1}: watch the keys.`;
}

function allNotesOff(): void {
  for (const key of [...state.held]) {
    const [ch, note] = key.split(':').map(Number) as [number, number];
    noteOff(note, ch);
  }
  for (let ch = 0; ch < 16; ch++) send([0xb0 | ch, 123, 0]);
  sendStatus.textContent = 'Sent note-off for every held note and All Notes Off on all 16 channels.';
}

root.append(el('section', {}, el('h2', {}, 'Key lights and Local Control'),
  el('div', { className: 'row' }, field('Send to', outputSelect), field('Channel', channelInput), el('label', {}, 'Note ', noteInput, ' ', noteLabel), field('Velocity', velocityInput), field('Length (ms)', lengthInput)),
  el('div', { className: 'row' },
    button('Send note', sendNote), button('Light C4 to C5', sendScale),
    button('Hold note', () => noteOn(clampInt(noteInput, 0, 127), clampInt(velocityInput, 1, 127))), button('All notes off', allNotesOff, true)),
  el('div', { className: 'row' },
    button('Local Control off (CC 122)', () => send([0xb0 | channel(), 122, 0]), true), button('Local Control on', () => send([0xb0 | channel(), 122, 127]), true),
    // does a key still light when its channel is silent? If so, a key-light hint need not give the note away by ear
    button('Volume 0 (CC 7)', () => send([0xb0 | channel(), 7, 0]), true), button('Volume 100 (CC 7)', () => send([0xb0 | channel(), 7, 100]), true),
    el('label', {}, echoBox, ' Echo every key back to the keyboard on this channel')),
  el('p', { className: 'hint' }, 'The EZ-220 manual says notes on channel 1 light the keys. Try a few velocities, including 1. Local Control off should stop the keyboard sounding its own keys while it still sends them; check whether the keyboard accepts the message or needs its own menu. Volume 0 (CC 7) silences the chosen channel: send a note after it to see whether its key still lights without a sound, then set Volume 100 again.'),
  sendStatus));

// ---- tap test
const tapStatus = el('p', { id: 'tap-status' }, `${TAP_CLICKS} clicks at ${TAP_BPM} beats a minute. Press any key on the piano exactly with each click you hear. The first two clicks are for finding the beat.`);
const tapResults = el('ol', { id: 'tap-results' });
const tapButton = button('Start the tap test', () => void startTapTest());
root.append(el('section', {}, el('h2', {}, 'Tap test (how late do key presses arrive?)'), tapStatus, tapButton, tapResults,
  el('p', { className: 'hint' }, 'The result is how much later than the click you heard the computer gets your key: the MIDI delay, the part of the sound delay the browser does not report, and your own timing habit. Run it three times; results within about 10 ms of each other are steady. Use speakers or headphones on the computer, not the keyboard.')));

function scheduleClick(ctx: AudioContext, at: number, accent: boolean): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? 2000 : 1500;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.4, at + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.06);
}

/** Map audio-clock seconds to the `performance.now()` milliseconds when that sound comes out of the speakers. */
function heardAt(ctx: AudioContext): { at: (contextTime: number) => number; how: string } {
  const stamp = ctx.getOutputTimestamp?.();
  if (stamp && stamp.contextTime && stamp.performanceTime) {
    const { contextTime, performanceTime } = stamp;
    return { at: (t) => performanceTime + (t - contextTime) * 1000, how: 'the browser output timestamp' };
  }
  const now = performance.now();
  const current = ctx.currentTime;
  const latency = ctx.outputLatency || ctx.baseLatency || 0;
  return { at: (t) => now + (t - current + latency) * 1000, how: 'an estimate from the latency the browser reports' };
}

async function startTapTest(): Promise<void> {
  if (state.tap.running) return;
  const ctx = (state.audio ??= new AudioContext());
  await ctx.resume();
  await new Promise((r) => setTimeout(r, 250)); // let the output clock settle so its timestamp is meaningful
  renderEnvironment();
  const beat = 60 / TAP_BPM;
  const start = ctx.currentTime + 1;
  const times = Array.from({ length: TAP_CLICKS }, (_, i) => start + i * beat);
  times.forEach((t, i) => scheduleClick(ctx, t, i % 4 === 0));
  const map = heardAt(ctx);
  state.tap = { running: true, clicks: times.map(map.at), taps: [], mapping: map.how };
  tapButton.disabled = true;
  tapStatus.textContent = `Listen ... press a key with every click (${TAP_CLICKS} clicks).`;
  setTimeout(finishTapTest, (1 + TAP_CLICKS * beat + 0.8) * 1000);
}

function finishTapTest(): void {
  const result = analyseTaps(state.tap.clicks, state.tap.taps);
  state.tap.running = false;
  state.tapRuns.push(result);
  tapButton.disabled = false;
  tapStatus.textContent = 'Done. Run it again to see whether the result is steady.';
  tapResults.append(el('li', { className: 'result' }, result.medianMs === null
    ? `No key presses matched the clicks (${result.taps} presses).`
    : `${result.medianMs} ms after the click (spread ${result.spreadMs} ms; ${result.matched} clicks matched; from ${result.minMs} to ${result.maxMs} ms; clock: ${state.tap.mapping})`));
}

// ---- log
const showSystem = el('input', { type: 'checkbox', id: 'show-system' });
const summaryLine = el('p', { id: 'log-summary' });
const logRows = el('tbody', { id: 'log-rows' });
showSystem.addEventListener('change', () => scheduleRender());
root.append(el('section', {}, el('h2', {}, 'MIDI log'),
  el('div', { className: 'row' },
    el('label', {}, showSystem, ' Show active sensing and clock'),
    button('Download the log (JSON)', downloadLog), button('Clear', () => { state.entries = []; scheduleRender(); }, true)),
  summaryLine,
  el('div', { className: 'log' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Time (s)'), el('th', {}, 'Delay (ms)'), el('th', {}, 'Dir'), el('th', {}, 'Port'), el('th', {}, 'Bytes'), el('th', {}, 'Meaning'))), logRows)),
  el('p', { className: 'hint' }, 'Time is the MIDI timestamp; delay is how much later the page got the message. The download keeps every message and offers the key presses as a replay draft for the tests.')));

function addEntry(entry: LogEntry): void {
  state.entries.push(entry);
  if (state.entries.length > KEPT_ENTRIES) state.entries.splice(0, state.entries.length - KEPT_ENTRIES);
  scheduleRender();
}

function onMessage(port: string, event: MIDIMessageEvent): void {
  const bytes = Array.from(event.data ?? []);
  addEntry({ t: event.timeStamp, received: performance.now(), dir: 'in', port, bytes });
  const d = describeMidi(bytes);
  if (d.kind === 'note-on' && state.tap.running) state.tap.taps.push(event.timeStamp);
  if (echoBox.checked && (d.kind === 'note-on' || d.kind === 'note-off')) {
    if (d.kind === 'note-on') noteOn(d.note!, d.velocity!);
    else noteOff(d.note!);
  }
}

let renderQueued = false;
function scheduleRender(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderLog();
    renderVirtualLit();
  });
}

function renderLog(): void {
  const s = summarize(state.entries);
  const releases = s.notesOff ? ` (as note-on velocity 0: ${s.releaseStyles.velocity0}, as note-off: ${s.releaseStyles.noteOff})` : '';
  summaryLine.textContent = `Key presses ${s.notesOn}, releases ${s.notesOff}${releases}; velocity ${s.velocity ? `${s.velocity.min} to ${s.velocity.max}` : '-'}; `
    + `active sensing ${s.activeSensing.count}${s.activeSensing.medianIntervalMs ? ` (every ${s.activeSensing.medianIntervalMs} ms)` : ''}; sent ${s.sent}; `
    + `delivery delay ${s.deliveryMs === null ? '-' : `${s.deliveryMs} ms`}.`;
  const visible = state.entries.filter((e) => {
    if (showSystem.checked) return true;
    const kind = describeMidi(e.bytes).kind;
    return kind !== 'active-sensing' && kind !== 'clock';
  });
  logRows.replaceChildren(...visible.slice(-SHOWN_ROWS).reverse().map((e) => el('tr', {},
    el('td', {}, seconds(e.t)), el('td', {}, e.received === undefined ? '' : (e.received - e.t).toFixed(1)), el('td', {}, e.dir), el('td', {}, e.port),
    el('td', {}, hex(e.bytes)), el('td', {}, describeMidi(e.bytes).text))));
}

// ---- results for docs/hardware-notes.md
function radios(name: string): HTMLElement {
  return el('span', { className: 'radios' }, ...['yes', 'no', 'partly', 'not checked'].map((value) =>
    el('label', {}, el('input', { type: 'radio', name, value, checked: value === 'not checked' }), ` ${value}`)));
}
const lightsHow = el('input', { type: 'text', id: 'lights-how', placeholder: 'which channel, velocity, any delay' });
const localText = el('input', { type: 'text', id: 'local-control', placeholder: 'what happened with Local Control on and off' });
const notesText = el('textarea', { id: 'notes', rows: 3, cols: 80, placeholder: 'anything else: driver, cable, browser, sleep and wake' });
const reportBox = el('textarea', { className: 'report', id: 'report', readOnly: true });
root.append(el('section', {}, el('h2', {}, 'Results for docs/hardware-notes.md'),
  el('p', { className: 'hint' }, 'The page can see MIDI, not lights or sound. Answer what you saw and heard, then make the summary and paste it into docs/hardware-notes.md.'),
  el('div', { className: 'row' }, 'Keys light up when the computer sends notes: ', radios('lights'), ' ', lightsHow),
  el('div', { className: 'row' }, 'The keyboard also sounds the notes the computer sends: ', radios('sounded')),
  el('div', { className: 'row' }, 'Local Control: ', localText),
  el('div', { className: 'row' }, 'Unplug and plug back in works without reloading: ', radios('hotplug')),
  el('div', { className: 'row' }, notesText),
  el('div', { className: 'row' }, button('Make the summary', makeReport), button('Copy', () => void copyReport(), true)),
  reportBox));

function chosen(name: string): 'yes' | 'no' | 'partly' | null {
  const value = root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
  return value === 'yes' || value === 'no' || value === 'partly' ? value : null;
}

function reportInput(): ReportInput {
  const audio = state.audio;
  return {
    date: new Date().toISOString().slice(0, 10),
    source: virtual ? 'virtual' : 'real',
    userAgent: navigator.userAgent,
    secureContext: window.isSecureContext,
    audio: audio ? { sampleRate: audio.sampleRate, baseLatencyMs: Math.round(audio.baseLatency * 10000) / 10, outputLatencyMs: audio.outputLatency ? Math.round(audio.outputLatency * 10000) / 10 : null } : null,
    ports: ports(),
    summary: summarize(state.entries),
    taps: state.tapRuns,
    answers: { lights: chosen('lights'), lightsHow: lightsHow.value, soundedWhenSent: chosen('sounded'), localControl: localText.value, hotplug: chosen('hotplug'), notes: notesText.value },
  };
}

function makeReport(): void {
  reportBox.value = hardwareReport(reportInput());
}

async function copyReport(): Promise<void> {
  if (!reportBox.value) makeReport();
  try {
    await navigator.clipboard.writeText(reportBox.value);
  } catch {
    reportBox.select();
  }
}

function downloadLog(): void {
  const input = reportInput();
  const data = buildExport(state.entries, {
    recordedAt: new Date().toISOString(), source: input.source, userAgent: input.userAgent, ports: input.ports,
    notes: { audio: input.audio, tapRuns: state.tapRuns, portEvents: state.portEvents, answers: input.answers },
  });
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(data, null, 1)}\n`], { type: 'application/json' }));
  const link = el('a', { href: url, download: `pianor-midi-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- start
renderEnvironment();
scheduleRender();
void openMidi();
if (import.meta.env.DEV || virtual) Object.assign(window, { __spike: { state, device, makeReport } });
