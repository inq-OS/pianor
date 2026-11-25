import { describe, expect, it } from 'vitest';
import { addNode, freeNodeId, moveNode, newSong, removeNode, renameNode } from './edit.ts';
import { songSchema, walkSong, type Song, type SongNode } from './schema.ts';

const blank = (id: string, name = id): SongNode => ({ kind: 'blank', id, name, bars: 8 });
const ids = (song: Song) => walkSong(song.nodes).map(({ node, groupDepth }) => `${'.'.repeat(groupDepth)}${node.id}`);

/** A song of: a, a group g holding b and c, then d. */
function sample(): Song {
  const song = newSong('own-song', 'My song', 'a');
  return {
    ...song,
    nodes: [blank('a'), { kind: 'group', id: 'g', name: 'G', nodes: [blank('b'), blank('c')] }, blank('d')],
  };
}

describe('making and editing a song (ft_1_36 rule 12)', () => {
  it('ft_1_36.AC14 a new song takes its title, the defaults and one blank, and passes the song schema', () => {
    const song = newSong('own-song', 'My song', 'Part');
    expect(song.title).toBe('My song');
    expect({ bpm: song.bpm, key: song.key, meter: song.meter }).toEqual({ bpm: 80, key: { fifths: 0, mode: 'major' }, meter: { num: 4, den: 4 } });
    expect(song.nodes).toHaveLength(1);
    expect(song.nodes[0]).toMatchObject({ kind: 'blank', name: 'Part' });
    expect(song.license).toBe('NaN');
    expect(songSchema.safeParse(song).success).toBe(true);
  });

  it('ft_1_36.AC14 a row is added after a row, inside a group or at the end, with an id the song does not have yet', () => {
    const song = sample();
    expect(freeNodeId(song, 'b')).toBe('b-2');
    expect(freeNodeId(song, 'chorus')).toBe('chorus');
    expect(ids(addNode(song, { after: 'b' }, blank('x')))).toEqual(['a', 'g', '.b', '.x', '.c', 'd']);
    expect(ids(addNode(song, { inside: 'g' }, blank('x')))).toEqual(['a', 'g', '.b', '.c', '.x', 'd']);
    expect(ids(addNode(song, 'end', blank('x')))).toEqual(['a', 'g', '.b', '.c', 'd', 'x']);
    // the song given is left as it was
    expect(ids(song)).toEqual(['a', 'g', '.b', '.c', 'd']);
  });

  it('ft_1_36.AC14 a row moves up, down, into the group above and out of its group; a move that cannot be made gives null', () => {
    const song = sample();
    expect(ids(moveNode(song, 'c', 'up')!)).toEqual(['a', 'g', '.c', '.b', 'd']);
    expect(ids(moveNode(song, 'a', 'down')!)).toEqual(['g', '.b', '.c', 'a', 'd']);
    expect(ids(moveNode(song, 'd', 'into')!)).toEqual(['a', 'g', '.b', '.c', '.d']);
    expect(ids(moveNode(song, 'b', 'out')!)).toEqual(['a', 'g', '.c', 'b', 'd']);
    expect(moveNode(song, 'a', 'up')).toBeNull();
    expect(moveNode(song, 'd', 'down')).toBeNull();
    expect(moveNode(song, 'a', 'into')).toBeNull();
    expect(moveNode(song, 'a', 'out')).toBeNull();
  });

  it('ft_1_36.AC14 a move that would put a link before its piece is refused', () => {
    const song: Song = { ...sample(), nodes: [{ kind: 'piece', id: 'p', piece: 'own-x' }, { kind: 'link', id: 'l', to: 'p' }] };
    expect(moveNode(song, 'l', 'up')).toBeNull();
    expect(moveNode(song, 'p', 'down')).toBeNull();
  });

  it('ft_1_36.AC14 a row is renamed; removed, it takes its links with it; the last row is never removed', () => {
    const song = sample();
    expect(walkSong(renameNode(song, 'g', 'Chorus').nodes).find((n) => n.node.id === 'g')!.node).toMatchObject({ name: 'Chorus' });
    expect(ids(removeNode(song, 'g')!)).toEqual(['a', 'd']);
    const linked: Song = { ...song, nodes: [{ kind: 'piece', id: 'p', piece: 'own-x' }, blank('a'), { kind: 'link', id: 'l', to: 'p' }] };
    expect(ids(removeNode(linked, 'p')!)).toEqual(['a']);
    expect(removeNode({ ...song, nodes: [blank('a')] }, 'a')).toBeNull();
  });
});
