import { Injectable } from '@nestjs/common';
import type { WordQuery } from '@en/common/word';
import { ResponseService, PrismaService } from '@libs/shared';
@Injectable()
export class WordBookService {
  constructor(
    private readonly responseService: ResponseService,
    private readonly prismaService: PrismaService,
  ) {}
  findAll(query: WordQuery) {
    const { page = 1, pageSize = 12, word, ...rest } = query;
    console.log(rest);
    Object.entries(rest).map(([key, value]) => {
      console.log(key, value);
    });
    return this.responseService.success(`ceshi`);
  }
}
