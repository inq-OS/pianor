// Covers ft_1_39.AC1, ft_1_39.AC6.
import { describe, expect, it } from 'vitest';
import catalogJson from '../../../content/lessons/catalog.json';
import { strings } from '../text/strings.ts';
import { areaNameKey, catalogTopicIds, loadCatalog, topicNameKey } from './catalog.ts';

describe('the learning catalog as data (ft_1_39.AC1)', () => {
  const catalog = loadCatalog(catalogJson);

  it('ft_1_39.AC1 holds every topic in eighteen areas, A to R, each id under its own area letter', () => {
    expect(catalog.areas.map((a) => a.id).join('')).toBe('ABCDEFGHIJKLMNOPQR');
    const ids = catalogTopicIds(catalog);
    expect(ids.length).toBe(173);
    for (const area of catalog.areas) for (const topic of area.topics) expect(topic.id.startsWith(area.id)).toBe(true);
  });

  it('ft_1_39.AC1 gives every area and every topic a name under a string key', () => {
    for (const area of catalog.areas) {
      expect(areaNameKey(area.id) in strings).toBe(true);
      for (const topic of area.topics) expect(topicNameKey(topic.id) in strings, topic.id).toBe(true);
    }
  });

  it('refuses a repeated id, an id outside its area, an unknown status and another version', () => {
    const area = (id: string, topics: { id: string; status: string }[]) => ({ id, topics });
    expect(() => loadCatalog({ schemaVersion: 1, areas: [area('A', [{ id: 'A1', status: 'drawn' }, { id: 'A1', status: 'idea' }])] })).toThrow(/A1/);
    expect(() => loadCatalog({ schemaVersion: 1, areas: [area('A', [{ id: 'B1', status: 'drawn' }])] })).toThrow(/B1/);
    expect(() => loadCatalog({ schemaVersion: 1, areas: [area('A', [{ id: 'A1', status: 'soon' }])] })).toThrow();
    expect(() => loadCatalog({ ...catalogJson, schemaVersion: 2 })).toThrow();
  });
});
