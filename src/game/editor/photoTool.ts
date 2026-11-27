/**
 * The photo tool (ft_Y_04 slice 5, AC18): a plain page over the piece maker, a utility in the browser's own look, where the
 * person chooses a photo of a sheet, turns it upright, drags over the piece to read (a sheet from school often holds
 * examples and other pieces too), has it read on the computer, and checks what was read before it opens: the key signature and
 * each hand's clef, the two things a reading most often gets wrong, can be put right here, against the sheet.
 */
import { cropOf, fitIn, nextTurn, shownRect, turnTransform, turnedSize, wholeOf, type Rect, type Turn, type View } from '../../core/editor/photoCrop';
import { handRanges, reclef, rekey } from '../../core/editor/photoFix';
import { importPieceFile } from '../../core/editor/pieceFile';
import { keyLabel } from '../../core/editor/key';
import type { EditorHand, EditorPiece } from '../../core/editor/model';
import { noteLabel, type NoteNaming } from '../../core/text/noteName';
import { t } from '../../core/text/strings';
import { barsToFill, type PhotoReply } from './photoImport';

/** What the tool needs from the piece maker. */
export interface PhotoToolHost {
  /** Lets the person choose a file (called straight from a click). */
  pick(): Promise<{ name: string; bytes: Uint8Array } | null>;
  /** Sends the part to read to the PC. */
  send(name: string, bytes: Uint8Array, title: string): Promise<PhotoReply>;
  naming: NoteNaming;
  /** The cursor colour, for the part marked. */
  colour: number;
  /** The piece read and checked, to save and open; the tool has closed. */
  open(result: { piece: EditorPiece; author: string; reply: Extract<PhotoReply, { ok: true }> }): void;
  /** Closed without a piece. */
  closed(): void;
}

/** JPEG quality of the part sent: a sheet's lines stay sharp, and a phone photo stays a few megabytes. */
const QUALITY = 0.95;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<Omit<HTMLElementTagNameMap[K], 'style'>> & { style?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { style, ...rest } = props;
  Object.assign(node, rest);
  if (style) node.style.cssText = style;
  node.append(...children);
  return node;
}

const BUTTON = 'font:inherit;padding:6px 14px;margin:0 6px 0 0;cursor:pointer';

/** The photo's name without its extension, as the title to start from. */
export function titleOfName(name: string): string {
  return name.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || t('editor.photoTool.title');
}

export class PhotoTool {
  private readonly root: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly bar: HTMLDivElement;
  private readonly note: HTMLDivElement;
  private image: ImageBitmap | null = null;
  private turned: HTMLCanvasElement | null = null;
  private turn: Turn = 0;
  private crop: Rect | null = null;
  private view: View = { x: 0, y: 0, scale: 1 };
  private canvas: HTMLCanvasElement | null = null;
  private name = '';
  private title = '';
  private readonly resize = () => this.drawPhoto();
  private readonly escape = (e: KeyboardEvent) => {
    // the browser's own undo and redo would reach the piece maker's title field behind the tool: only the tool's fields take them
    if ((e.ctrlKey || e.metaKey) && ['KeyZ', 'KeyY'].includes(e.code) && !(e.target instanceof Node && this.root.contains(e.target))) e.preventDefault();
    if (e.key !== 'Escape') return;
    e.preventDefault();
    this.close();
  };
  private done = false;

  /** Opens the tool, with the photo already chosen when the piece maker's Import took one. */
  constructor(private readonly host: PhotoToolHost, first?: { name: string; bytes: Uint8Array }) {
    this.root = el('div', { id: 'photo-tool', style: 'position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;background:#f4f4f2;color:#111;font:15px system-ui,sans-serif' });
    this.note = el('div', { style: 'padding:8px 12px;min-height:1.4em' });
    this.stage = el('div', { style: 'flex:1;position:relative;overflow:auto;padding:0 12px' });
    this.bar = el('div', { style: 'padding:10px 12px;border-top:1px solid #ccc;display:flex;flex-wrap:wrap;align-items:center;gap:6px 0' });
    const close = el('button', { textContent: t('editor.photoTool.close'), id: 'photo-tool-close', style: `${BUTTON};margin-left:auto` });
    close.onclick = () => this.close();
    const head = el('div', { style: 'display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid #ccc' }, el('strong', {}, t('editor.photoTool.title')), close);
    this.root.append(head, this.note, this.stage, this.bar);
    // the piece maker's keys are the window's: typing a title here must not write notes behind the tool
    this.root.addEventListener('keydown', (e) => e.stopPropagation());
    this.root.addEventListener('keyup', (e) => e.stopPropagation());
    document.body.append(this.root);
    // Esc closes it wherever the focus is: the browser gives the focus back to the page late after a file was chosen, so a
    // listener on the tool alone missed an Esc pressed right away
    window.addEventListener('keydown', this.escape, true);
    window.addEventListener('resize', this.resize);
    this.showPick();
    if (first) void this.load(first);
  }

  private say(text: string): void {
    this.note.textContent = text;
  }

  private buttons(...items: { label: string; id: string; act: () => void; disabled?: boolean }[]): HTMLButtonElement[] {
    return items.map((item) => {
      const b = el('button', { textContent: item.label, id: item.id, disabled: item.disabled ?? false, style: BUTTON });
      b.onclick = item.act;
      return b;
    });
  }

  /** Step 1: choose the photo. */
  private showPick(): void {
    this.say(t('editor.photoTool.pickHint'));
    this.stage.replaceChildren();
    this.bar.replaceChildren(...this.buttons({ label: t('editor.photoTool.choose'), id: 'photo-tool-choose', act: () => void this.choose() }));
  }

  private async choose(): Promise<void> {
    const file = await this.host.pick();
    if (file) await this.load(file);
  }

  private async load(file: { name: string; bytes: Uint8Array }): Promise<void> {
    if (this.done) return;
    let image: ImageBitmap;
    try {
      // the browser turns a phone photo by its EXIF orientation here, so what is shown is what is sent
      image = await createImageBitmap(new Blob([file.bytes as BlobPart]), { imageOrientation: 'from-image' });
    } catch {
      return this.say(t('editor.photoTool.cannotOpen'));
    }
    if (this.done) return image.close();
    this.image?.close();
    this.image = image;
    this.name = file.name;
    this.title = titleOfName(file.name);
    this.turn = 0;
    this.makeTurned();
    this.showMark();
  }

  /** The photo turned, at its own size: what is shown, and what the part is cut from. */
  private makeTurned(): void {
    if (!this.image) return;
    const photo = { width: this.image.width, height: this.image.height };
    const size = turnedSize(photo, this.turn);
    const canvas = el('canvas', { width: size.width, height: size.height });
    const g = canvas.getContext('2d');
    g?.setTransform(...turnTransform(photo, this.turn, wholeOf(size)));
    g?.drawImage(this.image, 0, 0);
    this.turned = canvas;
    this.crop = null;
  }

  /** Step 2: turn the photo and mark the part to read. */
  private showMark(): void {
    this.say(t('editor.photoTool.markHint'));
    const canvas = el('canvas', { id: 'photo-tool-canvas', style: 'display:block;width:100%;height:100%;cursor:crosshair;touch-action:none' });
    this.canvas = canvas;
    this.stage.style.overflow = 'hidden';
    this.stage.replaceChildren(canvas);
    let from: { x: number; y: number } | null = null;
    let to: { x: number; y: number } | null = null;
    const at = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas.onpointerdown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      from = at(e);
      to = from;
    };
    canvas.onpointermove = (e) => {
      if (!from) return;
      to = at(e);
      this.drawPhoto(from, to);
    };
    canvas.onpointerup = (e) => {
      if (from && this.turned) {
        const crop = cropOf(from, at(e), this.view, { width: this.turned.width, height: this.turned.height });
        if (crop) this.crop = crop;
      }
      from = null;
      to = null;
      this.drawPhoto();
    };
    const title = el('input', { id: 'photo-tool-title', value: this.title, maxLength: 60, style: 'font:inherit;padding:5px;width:16em;margin-right:12px' });
    title.oninput = () => (this.title = title.value);
    this.bar.replaceChildren(
      ...this.buttons(
        { label: t('editor.photoTool.choose'), id: 'photo-tool-choose', act: () => void this.choose() },
        { label: t('editor.photoTool.turn'), id: 'photo-tool-turn', act: () => { this.turn = nextTurn(this.turn); this.makeTurned(); this.drawPhoto(); } },
        { label: t('editor.photoTool.whole'), id: 'photo-tool-whole', act: () => { this.crop = null; this.drawPhoto(); } },
      ),
      el('label', { style: 'margin:0 6px 0 12px' }, t('editor.photoTool.titleLabel')),
      title,
      ...this.buttons({ label: t('editor.photoTool.read'), id: 'photo-tool-read', act: () => void this.read() }),
    );
    requestAnimationFrame(() => this.drawPhoto());
  }

  /** The photo in the window, the part outside the marked one dimmed; while dragging, the part being marked. */
  private drawPhoto(from?: { x: number; y: number }, to?: { x: number; y: number }): void {
    const canvas = this.canvas;
    const turned = this.turned;
    if (!canvas || !turned || !canvas.isConnected) return;
    const ratio = window.devicePixelRatio || 1;
    const box = { width: canvas.clientWidth, height: canvas.clientHeight };
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    const g = canvas.getContext('2d');
    if (!g) return;
    this.view = fitIn({ width: turned.width, height: turned.height }, box);
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, box.width, box.height);
    const whole = shownRect(wholeOf(turned), this.view);
    g.drawImage(turned, whole.x, whole.y, whole.width, whole.height);
    const dragged = from && to ? cropOf(from, to, this.view, turned) : null;
    const part = dragged ?? this.crop;
    if (!part) return;
    const r = shownRect(part, this.view);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.rect(whole.x, whole.y, whole.width, whole.height);
    g.rect(r.x, r.y, r.width, r.height);
    g.fill('evenodd');
    g.strokeStyle = `#${this.host.colour.toString(16).padStart(6, '0')}`;
    g.lineWidth = 2;
    g.strokeRect(r.x, r.y, r.width, r.height);
  }

  /** The marked part (or the whole photo), turned, as a JPEG. */
  private partBytes(): Promise<Uint8Array | null> {
    const turned = this.turned;
    if (!turned) return Promise.resolve(null);
    const part = this.crop ?? wholeOf(turned);
    const out = el('canvas', { width: part.width, height: part.height });
    out.getContext('2d')?.drawImage(turned, part.x, part.y, part.width, part.height, 0, 0, part.width, part.height);
    return new Promise((resolve) => out.toBlob((blob) => void (blob ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b))) : resolve(null)), 'image/jpeg', QUALITY));
  }

  /** Step 3: read it on the PC; a failure goes back to the photo, to mark another part or try another photo. */
  private async read(): Promise<void> {
    const bytes = await this.partBytes();
    if (this.done) return;
    if (!bytes) return this.say(t('editor.photoTool.tooBig'));
    for (const b of this.bar.querySelectorAll('button, input')) (b as HTMLButtonElement).disabled = true;
    this.say(t('editor.photo.reading'));
    const title = this.title.trim() || titleOfName(this.name);
    const reply = await this.host.send(`${titleOfName(this.name)}.jpg`, bytes, title);
    if (this.done) return;
    if (!reply.ok) {
      this.showMark();
      return this.say(t('editor.photo.failed', { reason: reply.reason }));
    }
    const file = importPieceFile(reply.file);
    if (!file.ok) {
      this.showMark();
      return this.say(t('editor.photo.failed', { reason: file.message }));
    }
    this.showCheck(file.file.piece, file.file.author, reply);
  }

  /** Step 4: what was read, with the key signature and each hand's clef to put right against the sheet. */
  private showCheck(read: EditorPiece, author: string, reply: Extract<PhotoReply, { ok: true }>): void {
    let piece = read;
    this.canvas = null;
    this.stage.style.overflow = 'auto';
    const body = el('div', { id: 'photo-tool-check', style: 'max-width:44em;line-height:1.8' });
    this.stage.replaceChildren(body);
    const render = (message = '') => {
      const naming = this.host.naming;
      const key = el('select', { id: 'photo-tool-key', style: 'font:inherit;padding:3px' });
      for (let fifths = -7; fifths <= 7; fifths++) {
        const signs = fifths === 0 ? '' : ` (${Math.abs(fifths)}${fifths > 0 ? '♯' : '♭'})`;
        key.append(el('option', { value: String(fifths), textContent: `${keyLabel(fifths, piece.mode, naming)}${signs}`, selected: fifths === piece.fifths }));
      }
      key.onchange = () => {
        piece = rekey(piece, Number(key.value), piece.mode);
        render();
      };
      const pitch = (p: { step: EditorPiece['notes'][number]['step']; octave: number; alter: -1 | 0 | 1 }) => `${noteLabel(p, naming)}${p.octave}`;
      const hands = handRanges(piece).map((range) => {
        const move = (hand: EditorHand, direction: 1 | -1) => {
          const moved = reclef(piece, hand, direction);
          if (!moved) return render(t('editor.photoTool.offKeys'));
          piece = moved;
          render();
        };
        return el('div', { className: `photo-tool-hand-${range.hand}`, style: 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:4px 0' },
          `${t('editor.photoTool.hand', { hand: t(range.hand === 'RH' ? 'editor.photoTool.rh' : 'editor.photoTool.lh'), low: pitch(range.low), high: pitch(range.high) })} `,
          ...this.buttons(
            { label: t('editor.photoTool.up'), id: `photo-tool-up-${range.hand}`, act: () => move(range.hand, 1) },
            { label: t('editor.photoTool.down'), id: `photo-tool-down-${range.hand}`, act: () => move(range.hand, -1) },
          ));
      });
      const bars = barsToFill(reply.problems);
      body.replaceChildren(
        el('div', {}, t('editor.photoTool.summary', { title: piece.title, bars: piece.bars, beats: piece.beats })),
        el('div', {}, `${t('editor.photoTool.key')} `, key),
        ...hands,
        el('div', {}, bars.length === 0 ? t('editor.photoTool.noneToFill') : t('editor.photoTool.fill', { bars: bars.join(', ') })),
        ...(reply.stavesUneven ? [el('div', {}, t('editor.photo.uneven'))] : []),
        el('div', { style: 'color:#a33' }, message),
      );
    };
    render();
    this.say(t('editor.photoTool.checkHint'));
    this.bar.replaceChildren(...this.buttons(
      { label: t('editor.photoTool.back'), id: 'photo-tool-back', act: () => this.showMark() },
      { label: t('editor.photoTool.open'), id: 'photo-tool-open', act: () => { this.destroy(); this.host.open({ piece, author, reply }); } },
    ));
  }

  /** Closes without a piece. */
  close(): void {
    if (this.done) return;
    this.destroy();
    this.host.closed();
  }

  /** Takes the tool off the page. */
  destroy(): void {
    this.done = true;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.escape, true);
    this.image?.close();
    this.root.remove();
  }
}
