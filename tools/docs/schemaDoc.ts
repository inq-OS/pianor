import { z } from 'zod';
import { chartSchema, pieceMetaSchema } from '../../src/core/chart/index.ts';

/** The shape of a JSON Schema as one compact line of type notation, the way the format docs write it by hand. */
type Json = { [key: string]: unknown };

function limits(s: Json, base: string): string {
  const min = s['minimum'];
  const exMin = s['exclusiveMinimum'];
  if (exMin === 0) return `${base}>0`;
  if (min === 0) return `${base}>=0`;
  if (typeof min === 'number') return `${base}>=${min}`;
  if (typeof exMin === 'number') return `${base}>${exMin}`;
  return base;
}

export function shape(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) return 'any';
  const s = raw as Json;
  if ('const' in s) return JSON.stringify(s['const']);
  if (Array.isArray(s['enum'])) return (s['enum'] as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
  for (const key of ['anyOf', 'oneOf']) {
    const options = s[key];
    if (Array.isArray(options)) return options.map(shape).join(' | ');
  }
  switch (s['type']) {
    case 'integer':
      return limits(s, 'int');
    case 'number':
      return limits(s, 'number');
    case 'string':
    case 'boolean':
      return s['type'];
    case 'null':
      return 'null';
    case 'array':
      return `[${shape(s['items'] ?? {})}]`;
    case 'object': {
      const props = (s['properties'] ?? {}) as Record<string, unknown>;
      const required = new Set((s['required'] ?? []) as string[]);
      const fields = Object.entries(props).map(([k, v]) => `${k}${required.has(k) ? '' : '?'}: ${shape(v)}`);
      if (fields.length === 0 && typeof s['additionalProperties'] === 'object') return `{ [key]: ${shape(s['additionalProperties'])} }`;
      return `{ ${fields.join(', ')} }`;
    }
    default:
      return 'any';
  }
}

/** One top-level field per line, so the block reads like the hand-written one it replaces. */
export function renderSchema(schema: z.ZodType): string {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Json;
  const props = (json['properties'] ?? {}) as Record<string, unknown>;
  const required = new Set((json['required'] ?? []) as string[]);
  const lines = Object.entries(props).map(([k, v]) => `  ${k}${required.has(k) ? '' : '?'}: ${shape(v)}`);
  return ['```text', '{', ...lines, '}', '```'].join('\n');
}

export const SCHEMAS: Record<string, z.ZodType> = { chart: chartSchema, meta: pieceMetaSchema };
