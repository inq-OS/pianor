import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';

/**
 * Command-line arguments of `piece:lint` and `piece:build`. Node's own `parseArgs` in strict mode, so a misspelt option
 * (`--stict`) or a stray folder is an error with the usage, not silently ignored, and `--help` never lints or builds.
 */
export type CliArgs<T> = { kind: 'ok' } & T | { kind: 'help' } | { kind: 'error'; message: string };

export const LINT_USAGE = 'usage: npm run piece:lint [-- [piecesDir] [--levels=path] [--strict]]  (defaults: content/pieces, content/curriculum/levels.json)';
export const BUILD_USAGE = 'usage: npm run piece:build [-- [piecesDir] [outDir]]  (defaults: content/pieces, build/charts)';

type Values = Record<string, string | boolean | (string | boolean)[] | undefined>;

function parse(args: string[], options: ParseArgsOptionsConfig, maxPositionals: number) {
  try {
    const parsed = parseArgs({ args, options: { ...options, help: { type: 'boolean', short: 'h' } }, allowPositionals: true, strict: true });
    const values: Values = parsed.values;
    if (values['help'] === true) return { kind: 'help' as const };
    if (parsed.positionals.length > maxPositionals) {
      return { kind: 'error' as const, message: `too many folders: ${parsed.positionals.join(' ')}` };
    }
    return { kind: 'parsed' as const, values, positionals: parsed.positionals };
  } catch (e) {
    return { kind: 'error' as const, message: e instanceof Error ? e.message : String(e) };
  }
}

export function parseLintArgs(args: string[]): CliArgs<{ piecesDir: string; levelsPath: string; strict: boolean }> {
  const r = parse(args, { strict: { type: 'boolean' }, levels: { type: 'string' } }, 1);
  if (r.kind !== 'parsed') return r;
  const levels = r.values['levels'];
  return {
    kind: 'ok',
    piecesDir: r.positionals[0] ?? 'content/pieces',
    levelsPath: typeof levels === 'string' ? levels : 'content/curriculum/levels.json',
    strict: r.values['strict'] === true,
  };
}

export function parseBuildArgs(args: string[]): CliArgs<{ piecesDir: string; outDir: string }> {
  const r = parse(args, {}, 2);
  if (r.kind !== 'parsed') return r;
  return { kind: 'ok', piecesDir: r.positionals[0] ?? 'content/pieces', outDir: r.positionals[1] ?? 'build/charts' };
}
