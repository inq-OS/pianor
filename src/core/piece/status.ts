export type PieceStatus = 'draft' | 'approved';

export type StatusEdit = { ok: true; text: string; unchanged?: true } | { ok: false; message: string };

/** The status written in a `piece.meta.json`, or null when the text is not a meta file with a valid status. */
export function readStatus(metaText: string): PieceStatus | null {
  try {
    const status = (JSON.parse(metaText) as { status?: unknown } | null)?.status;
    return status === 'draft' || status === 'approved' ? status : null;
  } catch {
    return null;
  }
}

/** Where the value of the top-level "status" key sits in the text (start and end of the quoted string). */
function statusValueRange(text: string): { start: number; end: number } | null {
  let depth = 0;
  let i = 0;
  const readString = (): { value: string; end: number } => {
    let value = '';
    let j = i + 1;
    while (j < text.length && text[j] !== '"') {
      if (text[j] === '\\') {
        value += text[j + 1] ?? '';
        j += 2;
      } else {
        value += text[j];
        j++;
      }
    }
    return { value, end: j + 1 };
  };
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    else if (ch === '"') {
      const key = readString();
      let j = key.end;
      while (/\s/.test(text[j] ?? '')) j++;
      if (depth === 1 && key.value === 'status' && text[j] === ':') {
        j++;
        while (/\s/.test(text[j] ?? '')) j++;
        if (text[j] !== '"') return null;
        i = j;
        return { start: j, end: readString().end };
      }
      i = key.end;
      continue;
    }
    i++;
  }
  return null;
}

/**
 * The meta text with its status changed. Only the value is replaced, so every other character stays as the author
 * wrote it and a review sees a one-line change. Refuses text it cannot read instead of guessing.
 */
export function withStatus(metaText: string, status: PieceStatus): StatusEdit {
  const current = readStatus(metaText);
  if (current === null) {
    return { ok: false, message: 'the meta file has no valid "status" ("draft" or "approved"), so it cannot be changed' };
  }
  if (current === status) return { ok: true, text: metaText, unchanged: true };
  const range = statusValueRange(metaText);
  if (!range) return { ok: false, message: 'could not find the "status" value in the meta file' };
  const text = `${metaText.slice(0, range.start)}"${status}"${metaText.slice(range.end)}`;
  return readStatus(text) === status ? { ok: true, text } : { ok: false, message: 'the edit did not give a valid meta file, nothing was changed' };
}
