import type { WordQuery } from '@en/common/word';
import { PrismaService, ResponseService } from '@libs/shared';
import { WordBookService } from './word-book.service';

describe('WordBookService course behavior', () => {
  const count = jest.fn();
  const findMany = jest.fn();
  let service: WordBookService;

  beforeEach(() => {
    jest.resetAllMocks();
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    service = new WordBookService(new ResponseService(), {
      wordBook: { count, findMany },
    } as unknown as PrismaService);
  });

  it('uses the course default pagination and empty response', async () => {
    await expect(service.findAll({} as WordQuery)).resolves.toEqual({
      code: 200,
      message: 'success',
      data: { list: [], total: 0 },
    });
    expect(count).toHaveBeenCalledWith({ where: { word: undefined } });
    expect(findMany).toHaveBeenCalledWith({
      where: { word: undefined },
      skip: 0,
      take: 12,
      orderBy: { frq: 'desc' },
    });
  });

  it('combines contains search with enabled query-string tags and numeric pagination', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const row = { id: 'one', word: 'Apple', createdAt, updatedAt: createdAt };
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([row]);
    const query = {
      page: '2',
      pageSize: '20',
      word: 'App',
      cet4: 'true',
      gk: 'false',
    } as unknown as WordQuery;
    const result = await service.findAll(query);
    const where = {
      word: { contains: 'App' },
      cet4: true,
      gk: undefined,
    };
    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith({
      where,
      skip: 20,
      take: 20,
      orderBy: { frq: 'desc' },
    });
    expect(result.data).toEqual({ total: 1, list: [row] });
  });

  it('ignores false query-string tags when filters are cleared', async () => {
    await service.findAll({
      page: 1,
      pageSize: 12,
      word: '',
      cet4: 'false',
      gk: 'false',
    } as unknown as WordQuery);
    expect(count).toHaveBeenCalledWith({
      where: { word: undefined, cet4: undefined, gk: undefined },
    });
  });

  it('propagates database failures instead of returning fabricated rows', async () => {
    count.mockRejectedValue(new Error('database unavailable'));
    await expect(service.findAll({} as WordQuery)).rejects.toThrow(
      'database unavailable',
    );
  });
});
