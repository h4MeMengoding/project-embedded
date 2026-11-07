import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/lib/csv';

const one = (cell: string | number | boolean | Date | null) => toCsv(['h'], [[cell]]).split('\r\n')[1];

describe('toCsv', () => {
  it('uses CRLF and header', () => expect(toCsv(['a', 'b'], [[1, 2]])).toBe('a,b\r\n1,2\r\n'));
  it('quotes comma', () => expect(one('a,b')).toBe('"a,b"'));
  it('doubles quotes', () => expect(one('he said "hi"')).toBe('"he said ""hi"""'));
  it('neutralises formulas', () => {
    expect(one('=1+1')).toBe("'=1+1");
    expect(one('+1')).toBe("'+1");
    expect(one('@x')).toBe("'@x");
    expect(one('-5')).toBe("'-5");
  });
  it('keeps negative numbers', () => expect(one(-5)).toBe('-5'));
  it('quotes newline', () => expect(toCsv(['h'], [['a\nb']])).toBe('h\r\n"a\nb"\r\n'));
  it('null empty, Date ISO', () => {
    expect(one(null)).toBe('');
    expect(one(new Date('2026-11-07T00:00:00Z'))).toBe('2026-11-07T00:00:00.000Z');
  });
});
