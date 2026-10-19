import { useCallback, useEffect, useRef, useState } from 'react'

interface AudioOptions {
  rate?: number
  volume?: number
  pitch?: number
  lang?: string
}

export function useAudio({ rate = 0.8, volume = 1, pitch = 1, lang = 'en-US' }: AudioOptions = {}) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [speakingWord, setSpeakingWord] = useState<string | null>(null)

  const stopAudio = useCallback(() => {
    if (utteranceRef.current) {
      window.speechSynthesis.cancel()
      utteranceRef.current = null
      setSpeakingWord(null)
    }
  }, [])

  const playAudio = useCallback((word: string): Promise<void> => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return Promise.reject(new Error('当前浏览器暂不支持语音播放，请使用 Chrome 或 Safari。'))
    }
    const text = word.trim()
    if (!text) return Promise.resolve()
    if (utteranceRef.current?.text === text && window.speechSynthesis.speaking) {
      stopAudio()
      return Promise.resolve()
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = rate
    utterance.volume = volume
    utterance.pitch = pitch
    const englishVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang === lang)
    if (englishVoice) utterance.voice = englishVoice
    utteranceRef.current = utterance
    return new Promise((resolve, reject) => {
      const finish = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null
          setSpeakingWord(null)
        }
      }
      utterance.onstart = () => {
        if (utteranceRef.current === utterance) setSpeakingWord(text)
      }
      utterance.onend = () => { finish(); resolve() }
      utterance.onerror = (event) => {
        finish()
        if (event.error === 'canceled' || event.error === 'interrupted') resolve()
        else reject(new Error('暂时无法播放发音，请稍后重试或检查系统语音设置。'))
      }
      window.speechSynthesis.speak(utterance)
    })
  }, [lang, pitch, rate, stopAudio, volume])

  useEffect(() => () => {
    if (utteranceRef.current) {
      utteranceRef.current.onstart = null
      utteranceRef.current.onend = null
      utteranceRef.current.onerror = null
      window.speechSynthesis.cancel()
      utteranceRef.current = null
    }
  }, [])
  return { playAudio, stopAudio, speakingWord }
}
