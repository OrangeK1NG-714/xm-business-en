import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../libs/shared/src/generated/prisma/client';
import { decodeFile, insertBatch, parseCsv, toWord } from './word-import';

async function main() {
  const args = process.argv.slice(2);
  const path = args.find((argument) => !argument.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const encoding =
    args
      .find((argument) => argument.startsWith('--encoding='))
      ?.split('=')[1] ?? 'gbk';
  if (
    !path ||
    args.some(
      (argument) =>
        argument.startsWith('--') &&
        argument !== '--dry-run' &&
        !argument.startsWith('--encoding='),
    )
  ) {
    throw new Error(
      'Usage: pnpm --filter @en/server db:import:words <CSV path> [--encoding=gbk|utf-8] [--dry-run]',
    );
  }
  if (!['gbk', 'utf-8'].includes(encoding))
    throw new Error('Encoding must be gbk or utf-8');
  if (!dryRun && !process.env.DATABASE_URL)
    throw new Error('DATABASE_URL must point to your development database');
  const database = dryRun
    ? undefined
    : new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
  let headers: string[] | undefined;
  let batch: ReturnType<typeof toWord>[] = [];
  let processed = 0;
  let inserted = 0;
  try {
    for await (const row of parseCsv(decodeFile(path, encoding))) {
      if (!headers) {
        headers = row.map((header) => header.replace(/^\uFEFF/, '').trim());
        if (
          !['word', 'translation', 'tag'].every((header) =>
            headers!.includes(header),
          )
        ) {
          throw new Error('Expected ECDICT headers: word, translation and tag');
        }
        continue;
      }
      const word = toWord(headers, row);
      processed++;
      if (database) batch.push(word);
      if (batch.length >= 500) {
        inserted += await insertBatch(database!.wordBook, batch);
        batch = [];
      }
      if (processed % 50_000 === 0)
        console.log(`已处理 ${processed} 条，新增 ${inserted} 条`);
    }
    if (!headers) throw new Error('CSV file is empty');
    if (database && batch.length)
      inserted += await insertBatch(database.wordBook, batch);
    console.log(
      dryRun
        ? `校验完成：${processed} 条词条，未连接数据库。`
        : `导入完成：处理 ${processed} 条，新增 ${inserted} 条；未删除或覆盖已有词条。`,
    );
  } finally {
    await database?.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error && !error.name.startsWith('Prisma')
      ? error.message
      : '数据库导入失败，请检查连接和迁移状态';
  console.error(message);
  process.exitCode = 1;
});
