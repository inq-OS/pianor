/** One problem found while reading a piece. Lines and columns are 1-based and point into the file named. */
export interface Diagnostic {
  severity: 'error' | 'warning';
  file: string;
  line?: number;
  column?: number;
  message: string;
  /** Which lint rule found it, e.g. "leap". Compiler diagnostics have none. */
  rule?: string;
  /** The bar it is in, counted from 1, when the lint rule points at a bar or a note (the message also starts with it). */
  bar?: number;
}

/** "piece.abc:12:5 error: message", the format editors can jump to. */
export function formatDiagnostic(d: Diagnostic): string {
  const where = d.line === undefined ? d.file : `${d.file}:${d.line}${d.column === undefined ? '' : `:${d.column}`}`;
  return `${where} ${d.severity}: ${d.message}${d.rule ? ` [${d.rule}]` : ''}`;
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}
