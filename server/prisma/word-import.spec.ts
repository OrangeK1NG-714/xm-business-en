import { insertBatch, parseCsv, toWord } from './word-import';

async function* chunks(...parts: string[]) {
  for (const part of parts) yield part;
}

describe('ECDICT import', () => {
  it('parses quoted commas, escaped quotes, embedded newlines and chunk boundaries', async () => {
    const rows: string[][] = [];
    for await (const row of parseCsv(
      chunks(
        'word,translation,tag\r',
        '\napple,"line1, text\nline2 "',
        '"quote""",cet4\r\n',
      ),
    ))
      rows.push(row);
    expect(rows).toEqual([
      ['word', 'translation', 'tag'],
      ['apple', 'line1, text\nline2 "quote"', 'cet4'],
    ]);
  });

  it('rejects incomplete quoted records', async () => {
    await expect(
      (async () => {
        for await (const row of parseCsv(chunks('apple,"unfinished'))) void row;
      })(),
    ).rejects.toThrow('unclosed');
  });

  it('maps tags and uses a stable ID across repeated imports', () => {
    const word = toWord(
      ['word', 'translation', 'tag'],
      ['apple', '苹果\\n苹果树', 'gk cet4'],
    );
    expect(word).toMatchObject({
      word: 'apple',
      translation: '苹果\n苹果树',
      gk: true,
      cet4: true,
      gre: false,
    });
    expect(
      toWord(
        ['word', 'translation', 'tag'],
        ['apple', 'changed translation', ''],
      ).id,
    ).toBe(word.id);
    expect(() => toWord(['word', 'tag'], ['only-one-column'])).toThrow(
      'column',
    );
  });

  it('preserves existing words and skips duplicated source entries', async () => {
    const apple = toWord(
      ['word', 'translation', 'tag'],
      ['apple', '苹果', 'cet4'],
    );
    const pear = toWord(['word', 'translation', 'tag'], ['pear', '梨', 'cet4']);
    const store = {
      findMany: jest.fn().mockResolvedValue([{ word: 'apple' }]),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    await expect(insertBatch(store, [apple, pear, pear])).resolves.toBe(1);
    expect(store.createMany).toHaveBeenCalledWith({
      data: [pear],
      skipDuplicates: true,
    });
    store.findMany.mockResolvedValue([{ word: 'apple' }, { word: 'pear' }]);
    await expect(insertBatch(store, [apple, pear])).resolves.toBe(0);
    expect(store.createMany).toHaveBeenCalledTimes(1);
  });
});
