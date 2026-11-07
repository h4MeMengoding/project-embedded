import { describe, it, expect } from 'vitest';
import { assertDevEnvironment } from '../src/guard';

const fakeDb = (rows: { value: string }[]) =>
  ({ select: () => ({ from: () => ({ where: async () => rows }) }) }) as never;

describe('assertDevEnvironment', () => {
  it('throws on prod', async () => {
    await expect(assertDevEnvironment(fakeDb([{ value: 'prod' }]))).rejects.toThrow(/dev/);
  });
  it('passes on dev', async () => {
    await expect(assertDevEnvironment(fakeDb([{ value: 'dev' }]))).resolves.toBeUndefined();
  });
  it('throws when row missing', async () => {
    await expect(assertDevEnvironment(fakeDb([]))).rejects.toThrow();
  });
});
