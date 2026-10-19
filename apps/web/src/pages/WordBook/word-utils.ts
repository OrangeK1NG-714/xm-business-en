import type { WordQuery } from '@en/common/word'

export type WordTag = Exclude<keyof WordQuery, 'page' | 'pageSize' | 'word'>
export const wordTags: { key: WordTag; label: string }[] = [
  { key: 'cet4', label: '四级 CET-4' },
  { key: 'cet6', label: '六级 CET-6' },
  { key: 'ky', label: '考研' },
  { key: 'ielts', label: 'IELTS' },
  { key: 'toefl', label: 'TOEFL' },
  { key: 'gre', label: 'GRE' },
  { key: 'gk', label: '高考' },
  { key: 'zk', label: '中考' },
]

export function wordText(value?: string | null): string {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\\[nr]|\r\n?/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .trim()
}
