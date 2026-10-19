import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../libs/shared/src/generated/prisma/client';

const words = [
  {
    id: 'demo-apple',
    word: 'apple',
    phonetic: '/ˈæpəl/',
    translation: '苹果',
    pos: 'n.',
    cet4: true,
    gk: true,
    frq: '500',
  },
  {
    id: 'demo-learn',
    word: 'learn',
    phonetic: '/lɜːrn/',
    translation: '学习；学会',
    pos: 'v.',
    cet4: true,
    gk: true,
    frq: '490',
  },
  {
    id: 'demo-business',
    word: 'business',
    phonetic: '/ˈbɪznəs/',
    translation: '商业；事务',
    pos: 'n.',
    cet4: true,
    ielts: true,
    frq: '480',
  },
  {
    id: 'demo-achieve',
    word: 'achieve',
    phonetic: '/əˈtʃiːv/',
    translation: '达到；实现',
    pos: 'v.',
    cet6: true,
    ielts: true,
    frq: '470',
  },
  {
    id: 'demo-curious',
    word: 'curious',
    phonetic: '/ˈkjʊəriəs/',
    translation: '好奇的',
    pos: 'adj.',
    cet6: true,
    toefl: true,
    frq: '460',
  },
  {
    id: 'demo-resilient',
    word: 'resilient',
    phonetic: '/rɪˈzɪliənt/',
    translation: '有韧性的；适应力强的',
    pos: 'adj.',
    gre: true,
    toefl: true,
    frq: '450',
  },
];

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error('请先配置 server/.env 中的 DATABASE_URL');
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const result = await database.wordBook.createMany({
      data: words,
      skipDuplicates: true,
    });
    console.log(`新增 ${result.count} 条演示词条；已有词条保持不变。`);
  } finally {
    await database.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.name : 'Seed failed');
  process.exitCode = 1;
});
