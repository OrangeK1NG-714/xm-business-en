import { request } from './index'
import type { WordList, WordQuery } from '@en/common/word'

export function getWordBookList(params: WordQuery, signal?: AbortSignal) {
  return request<WordList>({ url: '/word-book', params, signal })
}
