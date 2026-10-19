import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Empty, Input, Modal, Skeleton, message } from 'antd'
import type { InputRef } from 'antd'
import { ArrowUpOutlined, CopyOutlined, ReloadOutlined, SearchOutlined, SoundOutlined } from '@ant-design/icons'
import type { WordList } from '@en/common/word'
import { getWordBookList } from '@/api/word-book'
import { useAudio } from '@/hooks/useAudio'
import { wordTags, wordText } from '@/pages/WordBook/word-utils'
import './styles.css'

interface SearchProps { open: boolean; onClose: () => void }
interface SearchResult { key: string; data: WordList | null; error: string | null }

export default function Search({ open, onClose }: SearchProps) {
  const inputRef = useRef<InputRef>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [result, setResult] = useState<SearchResult>({ key: '', data: null, error: null })
  const { playAudio, stopAudio, speakingWord } = useAudio()
  const searchWord = keyword.trim()
  const requestKey = JSON.stringify({ word: debouncedKeyword, retryAttempt })
  const loading = Boolean(searchWord) && (searchWord !== debouncedKeyword || result.key !== requestKey)
  const data = !loading && searchWord ? result.data : null
  const error = !loading && searchWord ? result.error : null

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setDebouncedKeyword(searchWord), 500)
    return () => window.clearTimeout(timer)
  }, [open, searchWord])

  useEffect(() => {
    if (!open || !debouncedKeyword || debouncedKeyword !== searchWord) return
    const controller = new AbortController()
    getWordBookList({ word: debouncedKeyword, page: 1, pageSize: 20 }, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data: response, error: null })
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data: null, error: reason instanceof Error ? reason.message : '搜索失败，请稍后重试。' })
      })
    return () => controller.abort()
  }, [open, debouncedKeyword, requestKey, searchWord])

  const close = () => {
    stopAudio()
    onClose()
  }
  const copyWord = async (word: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(word)
      void messageApi.success(`已复制 ${word}`)
    } catch {
      void messageApi.error('浏览器暂时无法访问剪贴板，请手动选中并复制单词。')
    }
  }
  const pronounce = (word: string) => {
    void playAudio(word).catch((reason: unknown) => {
      void messageApi.error(reason instanceof Error ? reason.message : '发音播放失败，请重试。')
    })
  }

  return <>
    {contextHolder}
    <Modal
      className="search-dialog"
      open={open}
      width={680}
      footer={null}
      centered
      destroyOnHidden
      onCancel={close}
      title={<div className="search-dialog-title"><SearchOutlined /><span>快速查词</span><small>QUICK LOOKUP</small></div>}
      afterOpenChange={(visible) => {
        if (visible) inputRef.current?.focus({ cursor: 'end' })
        else { stopAudio(); setKeyword(''); setDebouncedKeyword(''); setResult({ key: '', data: null, error: null }) }
      }}
      styles={{ container: { padding: 0, overflow: 'hidden', borderRadius: 16 }, header: { padding: '24px 26px 16px', marginBottom: 0 }, body: { padding: 0 } }}
    >
      <div className="search-input-area">
        <Input ref={inputRef} className="search-input" size="large" prefix={<SearchOutlined />} placeholder="输入英文单词，发现它的含义…" aria-label="全局单词搜索" maxLength={100} allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} autoComplete="off" suffix={<kbd>ESC</kbd>} />
      </div>
      <div className="search-results" aria-busy={loading}>
        {!searchWord && <div className="search-intro"><div className="search-intro-icon"><SearchOutlined /></div><h3>好奇心，从一个单词开始。</h3><p>输入想了解的单词，随时找到释义与发音。</p><div className="search-examples"><span>试着搜索</span>{['possibility', 'curious', 'learn'].map((word) => <button type="button" key={word} onClick={() => setKeyword(word)}>{word}<ArrowUpOutlined /></button>)}</div></div>}
        {loading && <div className="search-loading" aria-label="正在搜索单词">{Array.from({ length: 3 }, (_, index) => <div key={index}><Skeleton active title={{ width: '32%' }} paragraph={{ rows: 1, width: '75%' }} /></div>)}</div>}
        {error && <div className="search-error"><Alert type="error" showIcon title="搜索暂时不可用" description={error} /><Button icon={<ReloadOutlined />} onClick={() => setRetryAttempt((current) => current + 1)}>重试搜索</Button></div>}
        {data && data.list.length === 0 && <div className="search-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><strong>没有找到 “{searchWord}”</strong><p>检查一下拼写，或尝试输入单词的一部分。</p></>} /></div>}
        {data && data.list.length > 0 && <>
          <div className="search-result-label"><span>单词与释义</span><span>{data.total > 20 ? '显示前 20 条结果' : `${data.total} 个匹配结果`}</span></div>
          <ul className="search-list">{data.list.map((word) => <li key={word.id}>
            <button type="button" className="search-word" aria-label={`复制单词 ${word.word}`} onClick={() => void copyWord(word.word)}>
              <div className="search-word-heading"><strong>{word.word}</strong>{word.phonetic && <span>{wordText(word.phonetic)}</span>}<CopyOutlined className="search-copy-icon" /></div>
              <p>{wordText(word.translation) || wordText(word.definition) || '暂无释义'}</p>
              <div className="search-word-tags">{wordTags.filter(({ key }) => word[key]).slice(0, 3).map(({ key, label }) => <span key={key}>{label}</span>)}</div>
            </button>
            <button className={`search-sound${speakingWord === word.word ? ' search-sound-active' : ''}`} type="button" title={speakingWord === word.word ? '停止发音' : '播放英语发音'} aria-label={`${speakingWord === word.word ? '停止' : '播放'} ${word.word} 的发音`} onClick={() => pronounce(word.word)}><SoundOutlined /></button>
          </li>)}</ul>
        </>}
      </div>
      <footer className="search-footer"><span><CopyOutlined /> 点击结果复制单词</span><span role="status" aria-live="polite">{loading ? '正在查找…' : data ? `找到 ${new Intl.NumberFormat('zh-CN').format(data.total)} 个单词` : <><kbd>esc</kbd> 关闭搜索</>}</span></footer>
    </Modal>
  </>
}
