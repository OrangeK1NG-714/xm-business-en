import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Input, Pagination, Skeleton, message } from 'antd'
import { ArrowRightOutlined, BookOutlined, ReloadOutlined, SearchOutlined, SoundOutlined } from '@ant-design/icons'
import type { WordList, WordQuery } from '@en/common/word'
import { getWordBookList } from '@/api/word-book'
import { useAudio } from '@/hooks/useAudio'
import { wordTags, wordText } from './word-utils'
import type { WordTag } from './word-utils'
import './styles.css'

interface WordResult { key: string; data: WordList | null; error: string | null }
type WordPageQuery = WordQuery & { page: number; pageSize: number }
const initialQuery: WordPageQuery = { page: 1, pageSize: 12, word: '' }
const numberFormatter = new Intl.NumberFormat('zh-CN')

export default function WordBook() {
  const [messageApi, contextHolder] = message.useMessage()
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState<WordPageQuery>(initialQuery)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [result, setResult] = useState<WordResult>({ key: '', data: null, error: null })
  const { playAudio, speakingWord } = useAudio()
  const requestKey = JSON.stringify({ query, retryAttempt })
  const loading = result.key !== requestKey
  const data = loading ? null : result.data
  const error = loading ? null : result.error
  const selectedTags = wordTags.filter(({ key }) => query[key])
  const hasFilters = selectedTags.length > 0 || Boolean(query.word)

  useEffect(() => {
    const controller = new AbortController()
    getWordBookList(query, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data: response, error: null })
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data: null, error: reason instanceof Error ? reason.message : '词库加载失败，请稍后重试。' })
      })
    return () => controller.abort()
  }, [query, requestKey])

  const search = () => {
    const word = keyword.trim()
    setKeyword(word)
    setQuery((current) => ({ ...current, word, page: 1 }))
    if (word === query.word && query.page === 1) setRetryAttempt((current) => current + 1)
  }
  const toggleTag = (tag: WordTag) => setQuery((current) => ({ ...current, [tag]: !current[tag], page: 1 }))
  const clearFilters = () => { setKeyword(''); setQuery(initialQuery) }
  const pronounce = (word: string) => {
    void playAudio(word).catch((reason: unknown) => {
      void messageApi.error(reason instanceof Error ? reason.message : '发音播放失败，请重试。')
    })
  }

  return (
    <section className="word-page" aria-labelledby="word-page-title">
      {contextHolder}
      <header className="word-intro">
        <div>
          <div className="word-eyebrow"><span /> YOUR PERSONAL LEXICON</div>
          <h1 id="word-page-title">每一个新词，<br className="word-mobile-break" />都是新的可能<span>。</span></h1>
          <p>从认识一个单词开始，慢慢拥有表达世界的能力。</p>
        </div>
        <div className="word-intro-note"><BookOutlined aria-hidden /><div><strong>积累词汇，拓宽世界</strong><span>A word a day. A world of possibilities.</span></div></div>
      </header>

      <div className="word-library">
        <div className="word-library-heading">
          <div className="word-library-title"><BookOutlined aria-hidden /><h2>探索词库</h2><span>WORD LIBRARY</span></div>
          <div className="word-source">收录 ECDICT 开源词典 · 多考试词表</div>
        </div>
        <div className="word-tools">
          <form className="word-search-form" onSubmit={(event) => { event.preventDefault(); search() }}>
            <Input className="word-search-input" size="large" prefix={<SearchOutlined aria-hidden />} placeholder="输入想认识的单词，如 possibility" aria-label="搜索词库中的英文单词" maxLength={100} value={keyword} allowClear onChange={(event) => {
              setKeyword(event.target.value)
              if (!event.target.value && query.word) setQuery((current) => ({ ...current, word: '', page: 1 }))
            }} />
            <Button size="large" type="primary" htmlType="submit" icon={<ArrowRightOutlined />} iconPlacement="end">查找单词</Button>
          </form>
          <div className="word-filter-row" aria-label="按考试类型筛选">
            <span className="word-filter-label">学习目标</span>
            <div className="word-filter-options">
              <button type="button" className={`word-filter-chip${selectedTags.length === 0 ? ' word-filter-chip-active' : ''}`} aria-pressed={selectedTags.length === 0} onClick={() => setQuery({ page: 1, pageSize: 12, word: query.word })}>全部词汇</button>
              {wordTags.map(({ key, label }) => <button key={key} type="button" className={`word-filter-chip${query[key] ? ' word-filter-chip-active' : ''}`} aria-pressed={Boolean(query[key])} onClick={() => toggleTag(key)}>{label}</button>)}
            </div>
          </div>
        </div>
        <div className="word-results-heading">
          <div aria-live="polite"><strong>{query.word ? `“${query.word}” 的搜索结果` : '在这里，遇见新词'}</strong>{data && <span>共 {numberFormatter.format(data.total)} 个单词</span>}{loading && <span>正在查找词汇…</span>}</div>
          {hasFilters ? <button className="word-reset" type="button" onClick={clearFilters}>清除筛选</button> : <span className="word-order">默认排序</span>}
        </div>
        {selectedTags.length > 1 && <p className="word-filter-hint">同时满足已选的 {selectedTags.length} 类考试词表。</p>}
        <div className="word-results" aria-busy={loading}>
          {loading && <div className="word-grid" aria-label="正在加载词库">{Array.from({ length: 6 }, (_, index) => <div className="word-card word-skeleton" key={index}><Skeleton active title={{ width: '48%' }} paragraph={{ rows: 3, width: ['36%', '94%', '72%'] }} /></div>)}</div>}
          {error && <div className="word-state"><Alert type="error" showIcon title="暂时没能打开词库" description={error} action={<Button icon={<ReloadOutlined />} onClick={() => setRetryAttempt((current) => current + 1)}>重新加载</Button>} /></div>}
          {data && data.list.length === 0 && <div className="word-state word-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><strong>还没有找到这个单词</strong><p>试试缩短关键词，或减少考试类型筛选。</p></>} /><Button onClick={clearFilters}>查看全部词汇</Button></div>}
          {data && data.list.length > 0 && <div className="word-grid">{data.list.map((word, index) => (
            <article className="word-card" key={word.id}>
              <div className="word-card-top"><span className="word-card-number">{String((query.page - 1) * query.pageSize + index + 1).padStart(2, '0')}</span><button className={`word-sound${speakingWord === word.word ? ' word-sound-active' : ''}`} type="button" title={speakingWord === word.word ? '停止发音' : '播放英语发音'} aria-label={`${speakingWord === word.word ? '停止' : '播放'} ${word.word} 的发音`} onClick={() => pronounce(word.word)}><SoundOutlined /></button></div>
              <h3>{word.word}</h3>
              <div className="word-phonetic">{word.phonetic ? wordText(word.phonetic) : '音标暂未收录'}</div>
              <p className="word-translation" title={wordText(word.translation)}>{wordText(word.translation) || '暂无中文释义'}</p>
              {word.definition && <p className="word-definition" title={wordText(word.definition)}>{wordText(word.definition)}</p>}
              <div className="word-card-tags">{wordTags.filter(({ key }) => word[key]).map(({ key, label }) => <span key={key}>{label}</span>)}{!wordTags.some(({ key }) => word[key]) && <span className="word-tag-general">通用词汇</span>}</div>
            </article>
          ))}</div>}
        </div>
        {data && data.total > 0 && <footer className="word-pagination"><span>每页 12 个单词，给记忆留一点空间。</span><Pagination current={query.page} pageSize={query.pageSize} total={data.total} showSizeChanger={false} responsive onChange={(page) => setQuery((current) => ({ ...current, page }))} /></footer>}
      </div>
      <footer className="word-bottom-note"><span>SMALL STEPS, LASTING PROGRESS.</span><span>用一点点积累，换一种看世界的方式。</span></footer>
    </section>
  )
}
