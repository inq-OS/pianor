// Covers ft_Y_04.AC1.
import { describe, expect, it } from 'vitest';
import { child, childAt, childrenOf, decodeEntities, descendants, parseXml, textOf, XmlError } from './xml';

describe('the XML reader (ft_Y_04.AC1)', () => {
  it('ft_Y_04.AC1 reads elements, attributes in either quote, text, CDATA and entities, skipping the prolog and comments', () => {
    const root = parseXml(`<?xml version="1.0"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "x.dtd" [ <!ENTITY e "x"> ]>
<!-- a comment with <tags> -->
<a x="1" y='two &amp; three' z="a>b">
  <b>hello &lt;world&gt; &#65;&#x42; &quot;&apos; &unknown;</b>
  <c/>
  <c k = "v" />
  <?pi inside?>
  <d><![CDATA[<raw & text>]]></d>
</a>`);
    expect(root.name).toBe('a');
    expect(root.attrs).toEqual({ x: '1', y: 'two & three', z: 'a>b' });
    expect(textOf(child(root, 'b'))).toBe('hello <world> AB "\' &unknown;');
    expect(childrenOf(root, 'c').map((c) => c.attrs)).toEqual([{}, { k: 'v' }]);
    expect(textOf(child(root, 'd'))).toBe('<raw & text>');
    expect(childrenOf(root)).toHaveLength(4);
  });

  it('a value ending in a slash does not close its tag', () => {
    const root = parseXml('<a><link href="x/">text</link></a>');
    expect(child(root, 'link')?.attrs.href).toBe('x/');
    expect(textOf(child(root, 'link'))).toBe('text');
  });

  it('finds by path and at any depth', () => {
    const root = parseXml('<r><n><p><s>C</s></p></n><n><p><s>D</s></p></n></r>');
    expect(textOf(childAt(root, 'n', 'p', 's'))).toBe('C');
    expect(childAt(root, 'n', 'x', 's')).toBeUndefined();
    expect(descendants(root, 's').map((s) => textOf(s))).toEqual(['C', 'D']);
    expect(textOf(undefined)).toBe('');
    expect(child(undefined, 'x')).toBeUndefined();
  });

  it('leaves text without entities alone and keeps a code point out of range as written', () => {
    expect(decodeEntities('plain')).toBe('plain');
    expect(decodeEntities('&#x110000;')).toBe('&#x110000;');
  });

  it.each([
    ['<a><b></a>', '</a> closes <b>'],
    ['<a>', '<a> is never closed'],
    ['</a>', 'closes nothing'],
    ['', 'no root element'],
    ['<a/><b/>', 'a second root element'],
    ['<a><!-- never closed', 'no closing -->'],
    ['<a><![CDATA[ x', 'no closing ]]>'],
    ['<a x="1', 'no closing >'],
    ['<a></a', 'no closing >'],
    ['<!DOCTYPE a [', 'no closing > for <!'],
    ['<a>< /a>', 'a tag with no name'],
  ])('says where %j breaks', (text, message) => {
    expect(() => parseXml(text)).toThrow(XmlError);
    expect(() => parseXml(text)).toThrow(message);
  });

  it('gives the line of the break', () => {
    expect(() => parseXml('<a>\n<b>\n</c></a>')).toThrow('(line 3)');
  });
});
