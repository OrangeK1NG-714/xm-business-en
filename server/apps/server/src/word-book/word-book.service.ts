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
    return this.responseService.success(`ceshi`);
  }
}
