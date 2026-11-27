import Phaser from 'phaser';
import { blit, createBitmap, recolor, toRgba, type Bitmap } from './bitmap';
import { barBitmap, focusRingBitmap, inkBarBitmap, inkStar, labelOverflow, panelBitmap, tinted, trayBitmap, type BarColors, type PanelKind, type TrayKind } from './frames';
import { BUBBLE_ALPHA, choicePatch, closePlate, goldChip, OPTION_PLATE, OPTION_SIZE, optionFocus, optionPlate, stripCell, type PlateLook } from './bubbleArt';
import { C } from './palette';
import { drawnText, letterBoxOf, LINE_GAP, LINE_HEIGHT, renderText, type TextOptions } from './font';
import { MASCOT, STAR_EMPTY, STAR_FULL, type MascotFrame } from './sprites';
import { ART_DETAIL } from '../../../core/layout/frame';
import { TOOLTIP_DELAY_MS, tooltipBox } from '../../../core/layout/tooltip';
import { GRADE_STARS } from '../../../core/scoring/stars';

/** A second click this soon after its screen opened belongs to the double click that opened it. */
const DOUBLE_CLICK_MS = 600;

/**
 * Phaser objects made from `Bitmap`s. A bitmap becomes a small canvas texture owned by the object, so its memory goes
 * with it. Everything is drawn at one art pixel per pixel and zoomed by whole numbers by the scene's root container
 * (`PixelScene`), which keeps the pixels square and crisp at any screen size.
 */

let nextTexture = 0;

/** Art already in colour, RGBA per pixel (the template character's frames, d142), where a `Bitmap` holds palette indexes. */
export interface RgbaArt {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array | Uint8ClampedArray;
}

function makeTexture(scene: Phaser.Scene, bitmap: Bitmap | RgbaArt, palette?: readonly number[]): string {
  const key = `pixel-art-${nextTexture++}`;
  // Raw RGBA straight into a texture: a canvas texture would read its pixels back from the GPU every time one is made.
  const rgba = 'rgba' in bitmap ? bitmap.rgba : toRgba(bitmap, palette);
  const texture = scene.textures.addUint8Array(key, new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), bitmap.width, bitmap.height);
  if (!texture) throw new Error('could not create a texture');
  return key;
}

/** An image drawn from a bitmap. Its top-left corner is at (x, y) in art pixels. */
export class PixelImage extends Phaser.GameObjects.Image {
  private textureKey: string;

  /**
   * `palette` colours the bitmap's indexes (the sky's phase palette, ft_1_14); the base palette when not given.
   * Art already in colour (`RgbaArt`) is shown as it is.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, bitmap: Bitmap | RgbaArt, palette?: readonly number[]) {
    const key = makeTexture(scene, bitmap, palette);
    super(scene, x, y, key);
    this.textureKey = key;
    this.setOrigin(0, 0);
    scene.add.existing(this);
  }

  /** Show another bitmap (of any size) in place of this one, coloured by `palette` (the base palette when not given). */
  setBitmap(bitmap: Bitmap, palette?: readonly number[]): this {
    const old = this.textureKey;
    const key = makeTexture(this.scene, bitmap, palette);
    this.setTexture(key);
    this.textureKey = key;
    this.scene.textures.remove(old);
    return this;
  }

  override destroy(fromScene?: boolean): void {
    const textures = this.scene?.textures;
    const key = this.textureKey;
    super.destroy(fromScene);
    textures?.remove(key);
  }
}

/**
 * An image whose pixels the game paints as it runs (live water, `liveWater.ts`): `show` lays new palette places into
 * its texture in place, with no new texture each time. Index 0 is clear.
 */
export class LiveImage extends Phaser.GameObjects.Image {
  private readonly rgba: Uint8Array;
  private readonly textureKey: string;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, private readonly palette: readonly number[]) {
    const key = `pixel-live-${nextTexture++}`;
    const rgba = new Uint8Array(width * height * 4);
    if (!scene.textures.addUint8Array(key, rgba, width, height)) throw new Error('could not create a texture');
    super(scene, x, y, key);
    this.rgba = rgba;
    this.textureKey = key;
    this.setOrigin(0, 0);
    scene.add.existing(this);
  }

  /** Shows `pixels` (palette places, the image's size). */
  show(pixels: Uint8Array): this {
    const { rgba, palette } = this;
    for (let i = 0; i < pixels.length; i++) {
      const index = pixels[i]!, o = i * 4;
      if (index === 0) { rgba[o + 3] = 0; continue; }
      const rgb = palette[index] ?? 0xff00ff;
      rgba[o] = (rgb >> 16) & 0xff;
      rgba[o + 1] = (rgb >> 8) & 0xff;
      rgba[o + 2] = rgb & 0xff;
      rgba[o + 3] = 255;
    }
    this.texture.source[0]?.update();
    return this;
  }

  override destroy(fromScene?: boolean): void {
    const textures = this.scene?.textures;
    const key = this.textureKey;
    super.destroy(fromScene);
    textures?.remove(key);
  }
}

/** Text in the pixel font. `text` holds the string, so tests and screen readers can read what is drawn. */
export class PixelText extends PixelImage {
  readonly pixelText = true;
  text: string;
  /**
   * The box the letters fill, in the text's own pixels (before any scale): from the top of the capitals to the bottom of
   * the last line, its tails included only when a letter on that line has one, so labels with and without tails share a baseline.
   */
  letterBox: { left: number; top: number; right: number; bottom: number };

  private options: TextOptions;
  /** The letters as drawn last, kept so `lineBoxes` can find each line's ink. */
  private drawn: Bitmap;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, options: TextOptions) {
    const { bitmap, letterBox } = PixelText.draw(text, options);
    super(scene, x, y, bitmap);
    this.options = options;
    this.text = text;
    this.letterBox = letterBox;
    this.drawn = bitmap;
  }

  /**
   * Each line of the text as drawn, from its first to its last inked column and over its line's rows, in the scene's art
   * pixels (scale and position applied); a line with no ink is left out. The menu strikes a title through by these (ft_1_02c.AC8).
   */
  lineBoxes(): { x: number; y: number; width: number; height: number }[] {
    const { width, height, pixels } = this.drawn;
    const scale = this.displayWidth / Math.max(1, width);
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (let top = 0; top < height; top += LINE_HEIGHT) {
      let left = width, right = -1;
      for (let y = top; y < Math.min(height, top + LINE_HEIGHT - LINE_GAP); y++) {
        for (let x = 0; x < width; x++) {
          if (pixels[y * width + x] === 0) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
      if (right >= left) boxes.push({ x: this.x + left * scale, y: this.y + top * scale, width: (right - left + 1) * scale, height: (LINE_HEIGHT - LINE_GAP) * scale });
    }
    return boxes;
  }

  setText(text: string): this {
    if (text === this.text) return this;
    this.text = text;
    return this.show(text, this.options);
  }

  /** Draw the same text again with other colours, wrapping or alignment. */
  setOptions(options: TextOptions): this {
    this.options = options;
    return this.show(this.text, options);
  }

  /**
   * The text as written is shown in small capitals in Estonian (ft_0_18, d086), by the active language's case; `keepCase`
   * draws it as written (only with a reason in the caller's code, e.g. a note name such as `Bb`).
   */
  private static draw(text: string, options: TextOptions): { bitmap: Bitmap; letterBox: PixelText['letterBox'] } {
    const bitmap = renderText(drawnText(text, options.keepCase), options);
    return { bitmap, letterBox: letterBoxOf(bitmap) };
  }

  private show(text: string, options: TextOptions): this {
    const { bitmap, letterBox } = PixelText.draw(text, options);
    this.letterBox = letterBox;
    this.drawn = bitmap;
    return this.setBitmap(bitmap);
  }

  /** Put the middle of the text at `cx` (whole art pixels, so letters keep their shape). */
  centerAt(cx: number): this {
    this.x = Math.floor(cx - this.width / 2);
    return this;
  }
}

export interface PixelButtonOptions {
  /** Centre of the button, in art pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  /** A smaller second line under the label. */
  sublabel?: string;
  /**
   * `button` is a blue key, `card` a dark card for a list of choices, `tab` one of a row of choices of which one is chosen
   * (`setActive`): the chosen tab is drawn flat and dark with gold letters, so it reads as "where you are", not as a key
   * that lit up to be pressed. `bandCell` and `bandSlot` are the band's trays (ft_1_20). `ink` is a line written on
   * parchment (the main menu, ft_1_07): no panel at all, letters in dark ink that turn red under the pointer, with a red
   * line drawn under them; its icon is drawn in the same ink.
   */
  look?: 'button' | 'card' | 'tab' | 'bandCell' | 'bandSlot' | 'ink' | 'bubble' | 'bubbleClose' | 'bubbleChoice';
  /** A cell of the strip that is the screen's main action (Play again, Done): a lighter wood with a honey edge (ft_1_20). */
  main?: boolean;
  /** A worn option that is on, beside More on the strip: a gold chip with its picture in dark ink (ft_1_20). */
  worn?: boolean;
  /** With the `ink` look: a box drawn round it by hand, so a small button written on paper reads as something to press (d130). */
  inkBox?: boolean;
  /** Letters twice as big, for headings. */
  big?: boolean;
  /** `left` puts the label at the left edge (cards), `right` at the right edge (a card on a book's left page); the default centres it. */
  align?: 'center' | 'left' | 'right';
  /** Width available to the label in art pixels; the panel width less a margin by default. */
  labelWidth?: number;
  /** A locked button looks dim and does nothing. */
  disabled?: boolean;
  /** A small picture at the left of the label (ft_1_08, `iconArt.ts`); with `iconOnly` the picture alone, centred, for a button too small for its text. */
  icon?: Bitmap;
  iconOnly?: boolean;
  /** The icon is drawn on the fine grid (d110), `ART_DETAIL` pixels to a cell: the piece maker's items in the band's slots (`itemArt.ts`). */
  fineIcon?: boolean;
  /** Draw the label as written, not in the language's capitals: a key name such as `Bbm`. */
  keepCase?: boolean;
  /**
   * Text shown in a bubble after the pointer rests on the button (`TOOLTIP_DELAY_MS`); an icon-only button shows its label.
   * Tablets have no hover, so a tooltip is a bonus, never the only way to know what a button does (ft_1_08.AC5).
   */
  tooltip?: string;
  /**
   * The button is this picture alone, centred in its box, with no panel and no label drawn (a room object, ft_1_08.AC7).
   * Its label shows in a bubble above it after the pointer rests on it, and at once while it has the keyboard focus.
   */
  picture?: Bitmap;
  /** Called when the pointer comes onto the button (true) and leaves it (false): the faded corner buttons light up (ft_1_20). */
  onHover?: (over: boolean) => void;
  onClick: () => void;
}

/** Space between a button's frame and its icon, and between the icon and the label, in art pixels. */
const ICON_PAD = 3;

/** A tappable panel with a label. Fires on release, so the tap that started a new scene cannot press a button there. */
export class PixelButton {
  readonly objects: Phaser.GameObjects.GameObject[];
  disabled: boolean;
  private readonly panel: PixelImage;
  private readonly label: PixelText;
  private readonly sublabel: PixelText | null;
  private readonly look: NonNullable<PixelButtonOptions['look']>;
  private active = false;
  private armed = false;
  private ring: PixelImage | null = null;
  private hover = false;
  private down = false;
  private readonly box: { x: number; y: number; width: number; height: number };
  private readonly maxLabelWidth: number;
  private readonly icon: PixelImage | null;
  /** The icon as it was given, before the band's tint. */
  private iconArt: Bitmap | null;
  private tip: PixelImage[] = [];
  private tipTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, private readonly options: PixelButtonOptions) {
    // a box from a scaled figure can be a fraction of a pixel wide: its face is drawn in whole pixels (a texture has no half one)
    const width = Math.max(1, Math.round(options.width));
    const height = Math.max(1, Math.round(options.height));
    this.disabled = options.disabled === true;
    this.look = options.look ?? 'button';
    const left = Math.floor(options.x - width / 2);
    const top = Math.floor(options.y - height / 2);
    this.box = { x: left, y: top, width, height };
    // a plate of the bubble is drawn larger than its box, centred on it, and see-through; a press counts in the box only
    const over = this.overhang();
    this.panel = new PixelImage(scene, left - over, top - over, this.face());
    if (this.isBubble()) this.panel.setAlpha(BUBBLE_ALPHA);
    const big = options.big === true;
    const iconScale = options.fineIcon ? 1 / ART_DETAIL : 1;
    const iconRoom = options.icon && !options.iconOnly ? options.icon.width * iconScale + ICON_PAD : 0;
    const maxWidth = Math.floor((options.labelWidth ?? width - 8 - iconRoom) / (big ? 2 : 1));
    this.maxLabelWidth = maxWidth;
    this.label = new PixelText(scene, 0, 0, options.label, this.labelStyle());
    if (big) this.label.setScale(2);
    // an icon-only or picture button keeps its label as text (tests and screen readers read it) but does not draw it
    if (options.iconOnly || options.picture) this.label.setVisible(false);
    this.iconArt = options.icon ?? null;
    this.icon = options.icon ? new PixelImage(scene, 0, 0, this.iconShown(options.icon)).setScale(iconScale) : null;
    this.sublabel = options.sublabel === undefined ? null : new PixelText(scene, 0, 0, options.sublabel, this.subStyle());
    const drawn = [this.panel, ...(this.icon ? [this.icon] : []), this.label, ...(this.sublabel ? [this.sublabel] : [])];
    parent.add(drawn);
    this.objects = drawn;
    this.layout();

    // A disabled button takes no press and no hover look; its tooltip still explains why it is off (when it has one).
    if (over > 0) this.panel.setInteractive({ hitArea: new Phaser.Geom.Rectangle(over, over, width, height), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: !this.disabled });
    else this.panel.setInteractive({ useHandCursor: !this.disabled });
    this.panel.on('pointerover', () => {
      if (!this.disabled) this.set({ hover: true });
      options.onHover?.(true);
      this.scheduleTooltip();
    });
    this.panel.on('pointerout', () => {
      options.onHover?.(false);
      this.hideTooltip();
      // a picture keeps its name up while it has the keyboard focus
      if (options.picture && this.focused) this.showTooltip();
      this.set({ hover: false, down: false });
    });
    // only the main button presses (a finger is one too): a right press opens the bubble, never the button under it (ft_1_20.AC19)
    this.panel.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      this.hideTooltip();
      if (!this.disabled) this.set({ down: true });
    });
    this.panel.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.set({ down: false });
      if (pointer.button !== 0 || this.disabled) return;
      // the second click of a double click whose first opened this screen (a place on the map, then the piano under the same spot in the room)
      const event = pointer.event as MouseEvent | undefined;
      const opened = (scene as { screenOpenedAt?: number }).screenOpenedAt;
      if (event && event.detail >= 2 && opened !== undefined && event.timeStamp - opened < DOUBLE_CLICK_MS) return;
      options.onClick();
    });
  }

  /** Extra pictures that belong to this button (stars, badges): they go away with it. */
  attach(...extra: Phaser.GameObjects.GameObject[]): void {
    this.objects.push(...extra);
  }

  /** The button's rectangle in art pixels, for placing things on it. */
  get rect(): { x: number; y: number; width: number; height: number } {
    return this.box;
  }

  /** Toggle the "switched on" look, for a hint that is on. */
  setActive(active: boolean): void {
    this.active = active;
    this.paint();
  }

  /** A band slot on a purple ground: the item a click on the staff writes with (the piece maker's notes or rests). */
  setArmed(armed: boolean): void {
    if (armed === this.armed) return;
    this.armed = armed;
    this.paint();
  }

  /** Draw (or remove) the ring that shows the button has the keyboard focus. */
  setFocused(focused: boolean): void {
    if (focused === (this.ring !== null)) return;
    if (!focused) {
      this.ring?.destroy();
      this.ring = null;
      if (this.options.picture) this.hideTooltip();
      return;
    }
    const { x, y, width, height } = this.box;
    const over = this.overhang();
    this.ring = this.isBubble() ? new PixelImage(this.panel.scene, x - over - 2, y - over - 2, optionFocus(width + 2 * over)) : new PixelImage(this.panel.scene, x - 2, y - 2, focusRingBitmap(width, height));
    this.panel.parentContainer?.add(this.ring);
    // a picture has no label on it: the keyboard shows its name at once
    if (this.options.picture) {
      this.hideTooltip();
      this.showTooltip();
    }
  }

  /** The pointer is gone, as when it leaves the canvas: what moving off the button does. */
  leave(): void {
    this.panel.emit('pointerout');
  }

  /** See-through by `alpha` (0 to 1), panel, picture and label together: the faded corner buttons over a picture (ft_1_20). */
  setAlpha(alpha: number): void {
    for (const o of this.objects) (o as unknown as { setAlpha(a: number): void }).setAlpha(alpha);
  }

  /** Press the button as a tap would (the keyboard's Enter); a locked button does nothing. */
  press(): void {
    if (!this.disabled) this.options.onClick();
  }

  /** Whether the focus ring is drawn. */
  get focused(): boolean {
    return this.ring !== null;
  }

  /** Lock or unlock the button (the keyboard switch with no piano to switch for). */
  setDisabled(disabled: boolean): void {
    if (this.disabled === disabled) return;
    this.disabled = disabled;
    this.paint();
  }

  /** Show another picture (a length button that shows rests once rests are written). */
  setIcon(icon: Bitmap): void {
    this.iconArt = icon;
    this.icon?.setBitmap(this.iconShown(icon));
    this.layout();
  }

  /** Say something else in the tooltip bubble (the piece maker's Save says which levels the piece fits, ft_1_20). */
  setTooltip(text: string): void {
    this.options.tooltip = text;
  }

  /** Show another label (a Listen button that turns into Stop). */
  setLabel(text: string): void {
    // an icon-only button shows its label as its tooltip: keep that up to date too
    this.options.label = text;
    this.label.setText(text);
    this.layout();
  }

  /** The middle of the button on the screen, in pixels (what a mouse click or a tap should hit). */
  screenCenter(): { x: number; y: number } {
    const m = this.panel.getWorldTransformMatrix();
    const width = this.box.width * Math.abs(m.scaleX);
    const height = this.box.height * Math.abs(m.scaleY);
    return { x: m.tx + width / 2, y: m.ty + height / 2 };
  }

  /** The button's rectangle on the screen, in pixels. */
  screenRect(): { left: number; top: number; right: number; bottom: number } {
    const m = this.panel.getWorldTransformMatrix();
    return { left: m.tx, top: m.ty, right: m.tx + this.box.width * Math.abs(m.scaleX), bottom: m.ty + this.box.height * Math.abs(m.scaleY) };
  }

  /** The tooltip's text while it is shown, else null. */
  get tooltipShown(): string | null {
    return this.tip.length > 0 ? this.tooltipText() : null;
  }

  destroy(): void {
    this.hideTooltip();
    this.ring?.destroy();
    this.ring = null;
    this.objects.forEach((o) => o.destroy());
  }

  /** Each line of the label as drawn, in art pixels (`PixelText.lineBoxes`); none for a button that draws no label. */
  textLines(): { x: number; y: number; width: number; height: number }[] {
    return this.options.iconOnly || this.options.picture ? [] : this.label.lineBoxes();
  }

  /** The label and sublabel as drawn, with how far their letters reach past the frame (`labelOverflow`); tests read it. */
  labelFit(): { label: string; overflow: number } {
    const reach = (text: PixelText, scale: number) => {
      const b = text.letterBox;
      return labelOverflow(this.box, { left: text.x + b.left * scale, top: text.y + b.top * scale, right: text.x + b.right * scale, bottom: text.y + b.bottom * scale });
    };
    // an icon-only button draws no label; beside an icon, the letters may not reach into the icon either
    const labelReach = this.options.iconOnly || this.options.picture ? -Infinity : reach(this.label, this.options.big === true ? 2 : 1);
    const iconReach = this.icon && !this.options.iconOnly ? this.icon.x + this.icon.displayWidth + 1 - (this.label.x + this.label.letterBox.left) : -Infinity;
    const overflow = Math.max(labelReach, iconReach, this.sublabel ? reach(this.sublabel, 1) : -Infinity);
    return { label: this.label.text, overflow };
  }

  /** Letters in white with a shadow; dark on the gold of a switched-on button; dim on a locked one. */
  private labelStyle(): TextOptions {
    const align = this.options.align ?? 'center';
    const base = { maxWidth: this.maxLabelWidth, align, ...(this.options.keepCase ? { keepCase: true } : {}) } as const;
    if (this.look === 'bandCell' || this.look === 'bandSlot' || this.isBubble()) return { color: this.disabled ? C.honeyDark : this.active ? C.goldLight : this.hover ? C.cream : C.honey, ...base };
    if (this.look === 'ink') return { color: this.inkColour(), ...base };
    if (this.disabled) return { color: C.dim, ...base };
    if (this.active && this.look === 'tab') return { color: C.gold, shadow: C.groove, ...base };
    if (this.active) return { color: C.ink, ...base };
    return { color: C.white, shadow: C.groove, ...base };
  }

  private subStyle(): TextOptions {
    const maxWidth = this.options.labelWidth ?? this.box.width - 8;
    const align = this.options.align ?? 'center';
    if (this.disabled) return { color: C.lock, maxWidth, align };
    if (this.active) return { color: C.ink, maxWidth, align };
    return { color: C.dim, maxWidth, align };
  }

  /** The ink of a line written on parchment: faded when locked, red under the pointer, black for the one switched on. */
  private inkColour(): number {
    if (this.disabled) return C.buffDeep;
    if (this.hover || this.down) return C.redDark;
    return this.active ? C.ink : C.featherStreak;
  }

  /** A written line has no panel: only, under the pointer, a line of red ink drawn under it by hand. */
  private inkFace(): Bitmap {
    const { width, height } = this.box;
    const face = createBitmap(width, height);
    if (this.options.inkBox) {
      // a box drawn by hand: corners left open, a side bowed out a pixel here and there
      const ink = this.inkColour();
      for (let x = 1; x < width - 1; x++) {
        face.pixels[x] = ink;
        face.pixels[(height - 1) * width + x] = ink;
      }
      for (let y = 1; y < height - 1; y++) {
        face.pixels[y * width] = ink;
        face.pixels[y * width + width - 1] = ink;
      }
      return face;
    }
    if (this.hover && !this.disabled) for (let x = 4; x < width - 4; x++) if (x % 9 !== 7) face.pixels[(height - 2 + (x % 23 > 15 ? 1 : 0)) * width + x] = C.redDark;
    return face;
  }

  /** What the panel shows: the frame of its kind, or the picture (sunk a pixel while pressed). */
  private face(): Bitmap {
    const { width, height } = this.box;
    const picture = this.options.picture;
    if (!picture && this.look === 'ink') return this.inkFace();
    const plate = width + 2 * this.overhang();
    if (!picture && this.look === 'bubble') return optionPlate(this.plateLook(), plate);
    if (!picture && this.look === 'bubbleClose') return closePlate(this.hover || this.down ? 'hover' : 'plain', plate, false);
    // a choice lies on the sausage the scene draws under the row: only a patch under the one in use or the pointer
    if (!picture && this.look === 'bubbleChoice') {
      const look = this.plateLook();
      return look === 'plain' || look === 'off' ? createBitmap(width, height) : choicePatch(look);
    }
    if (!picture && this.look === 'bandCell' && this.options.worn) return goldChip(width, height);
    if (!picture && this.look === 'bandCell') return stripCell(width, height, this.options.main && this.plateLook() === 'plain' ? 'main' : this.plateLook());
    if (!picture && this.look === 'bandSlot') return trayBitmap(width, height, this.trayKind());
    if (!picture) return panelBitmap(width, height, this.panelKind());
    const face = createBitmap(width, height);
    blit(face, picture, Math.floor((width - picture.width) / 2), Math.floor((height - picture.height) / 2) + (this.down ? 1 : 0));
    return face;
  }

  /** The icon as drawn: an action's picture in the band is in its letters' colour, pale honey, lighter under the pointer and gold when switched on (ft_1_20); any other as given. */
  private iconShown(icon: Bitmap): Bitmap {
    // a picture drawn with an outline keeps a pale fill inside its inked line; a line drawing (the tick, the delete key) is all ink
    // a drawing on its own slip of paper (the settings' pictures): the slip goes, the drawing is inked onto the page, its colours kept
    if (this.look === 'ink' && this.options.inkBox && icon.pixels.includes(C.cream)) return recolor(icon, { [C.cream]: 0, [C.ink]: this.inkColour() });
    if (this.look === 'ink') return icon.pixels.includes(C.ink) ? tinted(icon, C.buffLight, this.inkColour()) : tinted(icon, this.inkColour());
    if (this.options.worn) return tinted(icon, C.groove);
    return this.look === 'bandCell' || this.isBubble() ? tinted(icon, this.labelStyle().color ?? C.honey) : icon;
  }

  /** Whether this is a plate of the bubble (ft_1_20, d282): drawn by `bubbleArt.ts`, see-through. */
  private isBubble(): boolean {
    return this.look === 'bubble' || this.look === 'bubbleClose' || this.look === 'bubbleChoice';
  }

  /** How far a bubble's round plate reaches past its box on each side: 2 cells (24 over a 20-cell box); a choice none. */
  private overhang(): number {
    return this.look === 'bubble' || this.look === 'bubbleClose' ? (OPTION_PLATE - OPTION_SIZE) >> 1 : 0;
  }

  /** The look of a bubble's plate for the button's state. */
  private plateLook(): PlateLook {
    if (this.disabled) return 'off';
    if (this.armed) return this.isBubble() ? 'on' : 'armed';
    if (this.active) return 'on';
    if (this.down) return 'down';
    return this.hover ? 'hover' : 'plain';
  }

  /** The band's trays (ft_1_20): a cell or a slot, lit under the pointer, darker while pressed, marked when switched on. */
  private trayKind(): TrayKind {
    const slot = this.look === 'bandSlot';
    if (this.disabled) return slot ? 'slotEmpty' : 'cellOff';
    // the piece maker's writer (a slot, or a cell of the strip) is on purple while a click writes with it
    if (this.armed) return 'slotArmed';
    if (this.active) return slot ? 'slotOn' : 'cellOn';
    if (this.down) return 'cellDown';
    if (this.hover) return slot ? 'slotHover' : 'cellHover';
    return slot ? 'slot' : 'cell';
  }

  private panelKind(): PanelKind {
    if (this.disabled) return 'locked';
    if (this.active) return this.look === 'tab' ? 'tab' : 'active';
    if (this.look === 'card') return this.down ? 'buttonDown' : this.hover ? 'cardHover' : 'card';
    return this.down ? 'buttonDown' : this.hover ? 'buttonHover' : 'button';
  }

  private set(change: { hover?: boolean; down?: boolean }): void {
    if (change.hover !== undefined) this.hover = change.hover;
    if (change.down !== undefined) this.down = change.down;
    this.paint();
  }

  private paint(): void {
    this.panel.setBitmap(this.face());
    if (this.icon && this.iconArt && (this.look === 'bandCell' || this.isBubble() || this.look === 'ink')) this.icon.setBitmap(this.iconShown(this.iconArt));
    this.label.setOptions(this.labelStyle());
    this.sublabel?.setOptions(this.subStyle());
    this.layout();
  }

  private tooltipText(): string | null {
    return this.options.tooltip ?? (this.options.iconOnly || this.options.picture ? this.options.label : null);
  }

  private scheduleTooltip(): void {
    if (this.tooltipText() === null || this.tipTimer) return;
    this.tipTimer = this.panel.scene.time.delayedCall(TOOLTIP_DELAY_MS, () => {
      this.tipTimer = null;
      this.showTooltip();
    });
  }

  /** The bubble with the tooltip's text, under the button (above it at the bottom of the screen), on top of everything. */
  private showTooltip(): void {
    const text = this.tooltipText();
    const parent = this.panel.parentContainer;
    if (text === null || !parent) return;
    const scene = this.panel.scene;
    const letters = new PixelText(scene, 0, 0, text, { color: C.ink });
    const size = { w: letters.width + 8, h: letters.letterBox.bottom - letters.letterBox.top + 8 };
    const screen = { w: Math.ceil(scene.scale.width / parent.scaleX), h: Math.ceil(scene.scale.height / parent.scaleY) };
    const { x, y, width, height } = this.box;
    const at = tooltipBox({ x, y, w: width, h: height }, size, screen, this.options.picture ? 'above' : 'below');
    const bubble = new PixelImage(scene, at.x, at.y, panelBitmap(at.w, at.h, 'bubble'));
    letters.x = at.x + 4;
    letters.y = at.y + 4 - letters.letterBox.top;
    parent.add([bubble, letters]);
    this.tip = [bubble, letters];
  }

  private hideTooltip(): void {
    this.tipTimer?.remove(false);
    this.tipTimer = null;
    this.tip.forEach((o) => o.destroy());
    this.tip = [];
  }

  /**
   * Centre the letters (and the sublabel) in the panel; a pressed button sinks one pixel. The letter box is centred, not
   * the whole text picture, whose empty tail rows put a label without tails two pixels high.
   */
  private layout(): void {
    const { x, y, width, height } = this.box;
    const sink = this.down ? 1 : 0;
    const big = this.options.big === true ? 2 : 1;
    const letters = this.label.letterBox;
    const labelHeight = letters.bottom * big;
    const subHeight = this.sublabel ? this.sublabel.height + 2 : 0;
    const top = y + Math.floor((height - labelHeight - subHeight) / 2) + sink;
    const iconWidth = this.icon && !this.options.iconOnly ? this.icon.displayWidth + ICON_PAD : 0;
    if (this.icon) {
      // a fine icon is placed on the fine grid, half a cell at a time
      const step = this.options.fineIcon ? 1 / ART_DETAIL : 1;
      const snap = (v: number): number => Math.floor(v / step) * step;
      this.icon.x = this.options.iconOnly ? snap(x + (width - this.icon.displayWidth) / 2) : x + ICON_PAD;
      this.icon.y = y + snap((height - this.icon.displayHeight) / 2) + sink;
    }
    // with an icon the label is centred in the room right of it
    const cx = x + iconWidth + (width - iconWidth) / 2;
    const align = this.options.align ?? 'center';
    const placed = (w: number, inset: number): number => (align === 'left' ? x + 6 + inset : align === 'right' ? x + width - 6 - w : Math.floor(cx - w / 2));
    this.label.x = placed(this.label.width * big, iconWidth);
    this.label.y = top;
    if (this.sublabel) {
      this.sublabel.x = placed(this.sublabel.width, 0);
      this.sublabel.y = top + labelHeight + 2;
    }
  }
}

/** A bar (XP): a trough with a fill (gold unless `colors` say otherwise) of `fraction` of it. Call `set` when the fraction changes. */
export class PixelBar extends PixelImage {
  private shown: number;

  constructor(
    scene: Phaser.Scene, x: number, y: number, private readonly barWidth: number, private readonly barHeight: number, fraction: number,
    /** The fill's colours, or `ink` for a bar written on parchment (d130). */
    private readonly colors?: BarColors | 'ink',
  ) {
    super(scene, x, y, PixelBar.picture(barWidth, barHeight, fraction, colors));
    this.shown = fraction;
  }

  /** The fraction the bar shows now (0 to 1 as given; the picture clamps it). */
  get fraction(): number {
    return this.shown;
  }

  set(fraction: number): this {
    this.shown = fraction;
    return this.setBitmap(PixelBar.picture(this.barWidth, this.barHeight, fraction, this.colors));
  }

  private static picture(width: number, height: number, fraction: number, colors?: BarColors | 'ink'): Bitmap {
    return colors === 'ink' ? inkBarBitmap(width, height, fraction) : barBitmap(width, height, fraction, colors);
  }
}

/** A row of stars (five, the grade, or `total`), `earned` of them gold, a fraction of it filling the next one in part. Returns the objects so a scene can place or remove them. */
export function pixelStars(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, earned: number, options: { gap?: number; zoom?: number; total?: number; ink?: boolean } = {}): PixelImage[] {
  const { gap = 2, zoom = 1, total = GRADE_STARS, ink = false } = options;
  const picture = (full: boolean) => (ink ? inkStar(STAR_FULL, full) : full ? STAR_FULL : STAR_EMPTY);
  const at = (i: number) => x + i * (STAR_FULL.width + gap) * zoom;
  const stars = Array.from({ length: total }, (_, i) => i).map((i) => new PixelImage(scene, at(i), y, picture(i < Math.floor(earned))).setScale(zoom));
  // a star filled in part (a piece's difficulty, d157): the full star over the empty one, cut at whole art pixels from the left
  const part = earned - Math.floor(earned);
  if (part > 0 && Math.floor(earned) < total) {
    const cut = new PixelImage(scene, at(Math.floor(earned)), y, picture(true)).setScale(zoom);
    cut.setCrop(0, 0, Math.max(1, Math.round(part * STAR_FULL.width)), STAR_FULL.height);
    stars.push(cut);
  }
  parent.add(stars);
  return stars;
}

/**
 * Kiur, the character, with his top-left at (x, y) in art pixels; `zoom` 1 shows him at `MASCOT_SIZE`. His picture is on
 * the fine grid (d110), so it is drawn at half size per pixel. He bobs while idle; `setMood` changes his pose.
 */
export class Mascot {
  readonly image: PixelImage;
  private bob = 0;
  private readonly baseY: number;
  private readonly timer: Phaser.Time.TimerEvent;
  private moodTimer: Phaser.Time.TimerEvent | null = null;
  private frame: MascotFrame = 'idle';

  constructor(private readonly scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, zoom = 1) {
    this.image = new PixelImage(scene, x, y, MASCOT.idle);
    this.image.setScale(zoom / ART_DETAIL);
    this.baseY = y;
    parent.add(this.image);
    this.timer = scene.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.bob = this.bob === 0 ? 1 : 0;
        this.image.y = this.baseY + this.bob * Math.max(1, zoom);
      },
    });
  }

  get mood(): MascotFrame {
    return this.frame;
  }

  /** Show a face; `forMs` goes back to the idle face afterwards. */
  setMood(frame: MascotFrame, forMs = 0): void {
    this.moodTimer?.remove();
    this.moodTimer = null;
    this.frame = frame;
    this.image.setBitmap(MASCOT[frame]);
    if (forMs > 0 && frame !== 'idle') {
      this.moodTimer = this.scene.time.delayedCall(forMs, () => {
        this.frame = 'idle';
        this.image.setBitmap(MASCOT.idle);
      });
    }
  }

  destroy(): void {
    this.timer.remove();
    this.moodTimer?.remove();
    this.image.destroy();
  }
}
