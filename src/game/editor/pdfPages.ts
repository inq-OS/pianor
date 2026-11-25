/**
 * The pages of a PDF in the browser (ft_Y_04 slice 6), through pdf.js (Apache-2.0), loaded only when a PDF is chosen: small
 * pictures to choose the pages by, and each chosen page drawn large, as the picture the computer cuts each part's strip
 * from. The PDF itself is read by Audiveris on the computer.
 */

/** A PDF opened in the browser. */
export interface PdfPages {
  readonly count: number;
  /** Page `n` (from 1) drawn `width` pixels wide on white. */
  render(n: number, width: number): Promise<HTMLCanvasElement>;
  close(): void;
}

/** The width a page is drawn for the computer: about 300 dots an inch on an A4 page, where staff lines stay apart. */
export const PAGE_WIDTH = 2480;

/** Opens a PDF; throws when it is not one or cannot be read. */
export async function openPdf(bytes: Uint8Array): Promise<PdfPages> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  // pdf.js takes the bytes over to its worker: a copy keeps the caller's
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  return {
    count: doc.numPages,
    async render(n, width) {
      const page = await doc.getPage(n);
      const unit = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / unit.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const g = canvas.getContext('2d');
      if (!g) throw new Error('no canvas');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: g, viewport }).promise;
      page.cleanup();
      return canvas;
    },
    close: () => void task.destroy(),
  };
}

/** A canvas as JPEG bytes. */
export function jpegOf(canvas: HTMLCanvasElement, quality = 0.9): Promise<Uint8Array | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => void (blob ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b))) : resolve(null)), 'image/jpeg', quality));
}
