// Covers core_08.AC11.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLearnedModel } from '../../src/core/piece/learnedModel';

/** Learned models committed to content/: only ones fitted on a set a person marked publishable, never a private one. */
const dir = join(__dirname, '../../content/models');
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];

describe('committed learned models (core_08.AC11)', () => {
  it.each(files.length > 0 ? files : ['(none yet)'])('core_08.AC11 %s is a publishable model on today\'s features', (file) => {
    if (files.length === 0) return;
    const parsed = parseLearnedModel(JSON.parse(readFileSync(join(dir, file), 'utf-8')));
    if ('error' in parsed) throw new Error(`content/models/${file}: ${parsed.error}`);
    expect(parsed.model.source.publishable, `content/models/${file} comes from a set that may not be published: keep it in private/models/`).toBe(true);
  });
});
