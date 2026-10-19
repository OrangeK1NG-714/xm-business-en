import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

export async function* decodeFile(
  path: string,
  encoding = 'gbk',
): AsyncGenerator<string> {
  const decoder = new TextDecoder(encoding, { fatal: true });
  for await (const chunk of createReadStream(path)) {
    yield decoder.decode(chunk, { stream: true });
  }
  yield decoder.decode();
}

export async function* parseCsv(
  chunks: AsyncIterable<string>,
): AsyncGenerator<string[]> {
  let row: string[] = [];
  let field = '';
  let state: 'plain' | 'quoted' | 'closed' = 'plain';
  let carriageReturn = false;
  for await (const chunk of chunks) {
    for (const character of chunk) {
      if (carriageReturn && character === '\n') {
        carriageReturn = false;
        continue;
      }
      carriageReturn = false;
      if (state === 'quoted') {
        if (character === '"') state = 'closed';
        else field += character;
        continue;
      }
      if (state === 'closed' && character === '"') {
        field += '"';
        state = 'quoted';
        continue;
      }
      if (character === ',' || character === '\r' || character === '\n') {
        row.push(field);
        field = '';
        state = 'plain';
        if (character !== ',') {
          if (row.some((value) => value.length > 0)) yield row;
          row = [];
          carriageReturn = character === '\r';
        }
      } else if (state === 'closed') {
        if (character !== ' ' && character !== '\t')
          throw new Error('CSV quoted field has unexpected trailing text');
      } else if (character === '"' && !field) {
        state = 'quoted';
      } else {
        field += character;
      }
    }
  }
  if (state === 'quoted')
    throw new Error('CSV contains an unclosed quoted field');
  if (field || row.length) yield [...row, field];
}

const tags = [
  'zk',
  'gk',
  'cet4',
  'cet6',
  'ky',
  'toefl',
  'ielts',
  'gre',
] as const;

export function toWord(headers: string[], values: string[]) {
  if (headers.length !== values.length)
    throw new Error('CSV row column count does not match the header');
  const source = Object.fromEntries(
    headers.map((header, index) => [header, values[index]]),
  );
  const word = source.word?.trim();
  if (!word) throw new Error('CSV row is missing a word');
  const activeTags = new Set(source.tag?.split(/\s+/) ?? []);
  return {
    id: `ecdict-${createHash('sha256').update(word).digest('hex')}`,
    word,
    phonetic: source.phonetic || null,
    definition: source.definition?.replace(/\\n/g, '\n') || null,
    translation: source.translation?.replace(/\\n/g, '\n') || null,
    pos: source.pos || null,
    collins: source.collins || null,
    oxford: source.oxford || null,
    tag: source.tag || null,
    bnc: source.bnc || null,
    frq: source.frq || null,
    exchange: source.exchange || null,
    ...Object.fromEntries(tags.map((tag) => [tag, activeTags.has(tag)])),
  };
}

export interface WordImportStore {
  findMany(args: {
    where: { word: { in: string[] } };
    select: { word: true };
  }): Promise<{ word: string }[]>;
  createMany(args: {
    data: ReturnType<typeof toWord>[];
    skipDuplicates: true;
  }): Promise<{ count: number }>;
}

export async function insertBatch(
  store: WordImportStore,
  batch: ReturnType<typeof toWord>[],
) {
  const unique = new Map(batch.map((word) => [word.word, word]));
  const existing = await store.findMany({
    where: { word: { in: [...unique.keys()] } },
    select: { word: true },
  });
  for (const entry of existing) unique.delete(entry.word);
  if (!unique.size) return 0;
  return (
    await store.createMany({ data: [...unique.values()], skipDuplicates: true })
  ).count;
}
