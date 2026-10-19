import { useEffect, useRef } from 'react'
import { ArrowDownOutlined, ArrowRightOutlined, AudioOutlined, BookOutlined, SearchOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import ModelScene from '@/components/ModelScene'
import { useLogin } from '@/hooks/useLogin'
import './index.css'

const features = [
  { number: '01', icon: <BookOutlined />, title: '找到适合你的词汇', text: '从中考、高考到四六级、考研和出国考试，按目标筛选词库，把注意力放在需要的单词上。', caption: 'A WORD AT A TIME' },
  { number: '02', icon: <SearchOutlined />, title: '让每次好奇都有答案', text: '遇到陌生单词，随时打开全局搜索。查看释义与音标，聆听英语发音，让理解更完整。', caption: 'STAY CURIOUS' },
  { number: '03', icon: <AudioOutlined />, title: '从看懂到听见', text: '在词库中听单词发音，把拼写、含义和声音联系起来。今天掌握一点，明天多懂一点。', caption: 'LISTEN. LEARN. REPEAT.' },
]

export default function Home() {
  const pageRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const requireLogin = useLogin()
  const openWordBook = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    requireLogin(() => navigate('/word-book'))
  }

  useEffect(() => {
    const page = pageRef.current
    if (!page || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const elements = Array.from(page.querySelectorAll<HTMLElement>('[data-home-reveal]'))
    const animationFrames = new Set<number>()
    elements.forEach((element) => element.classList.add('home-will-reveal'))
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const element = entry.target as HTMLElement
        element.classList.add('home-is-visible')
        observer.unobserve(element)
        element.querySelectorAll<HTMLElement>('[data-home-count]').forEach((counter) => {
          const target = Number(counter.dataset.homeCount)
          const started = performance.now()
          let frame = 0
          const update = (now: number) => {
            animationFrames.delete(frame)
            const progress = Math.min((now - started) / 1000, 1)
            counter.textContent = String(Math.round(target * (1 - (1 - progress) ** 3)))
            if (progress < 1) { frame = requestAnimationFrame(update); animationFrames.add(frame) }
          }
          frame = requestAnimationFrame(update)
          animationFrames.add(frame)
        })
      })
    }, { threshold: 0.12 })
    elements.forEach((element) => observer.observe(element))
    return () => {
      observer.disconnect()
      animationFrames.forEach(cancelAnimationFrame)
      elements.forEach((element) => element.classList.remove('home-will-reveal', 'home-is-visible'))
    }
  }, [])

  return (
    <div className="home-page" ref={pageRef}>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <span className="home-eyebrow home-eyebrow-light"><span /> YOUR NEXT CHAPTER</span>
          <h1 id="home-title">多懂一个单词，<br />多看一点<span>世界。</span></h1>
          <p className="home-hero-english">Small words.<br /><em>New possibilities.</em></p>
          <p className="home-hero-description">从一份适合你的词库开始。<br />让每一次查找、聆听和理解，成为向前的一小步。</p>
          <div className="home-hero-actions">
            <Link className="home-button home-button-primary" to="/word-book" onClick={openWordBook}>开启词汇之旅 <ArrowRightOutlined /></Link>
            <a className="home-explore" href="#home-discover">了解更多 <ArrowDownOutlined /></a>
          </div>
          <div className="home-hero-note"><span className="home-note-line" /> 今天，就是开始的好时候</div>
        </div>
        <div className="home-hero-visual">
          <div className="home-orbit home-orbit-outer" aria-hidden="true" />
          <div className="home-orbit home-orbit-inner" aria-hidden="true" />
          <span className="home-scene-label">EXPLORE A NEW WORLD</span>
          <ModelScene src="/models/hologram/scene.gltf" className="home-model" label="可拖动旋转的全息装置模型" />
          <div className="home-word-note"><span>possibility</span><small>/ˌpɒsəˈbɪləti/</small><p>n. 可能性；机会</p></div>
          <span className="home-scene-hint">拖动模型，换个角度看世界</span>
        </div>
      </section>
      <section className="home-intro" id="home-discover" aria-labelledby="home-intro-title" data-home-reveal>
        <div><span className="home-eyebrow">MAKE ROOM FOR GROWTH</span><h2 id="home-intro-title">不必一口气走很远，<br />只要每天<span>靠近一点。</span></h2></div>
        <p>学习英语，从理解每一个词开始。选定目标、查清含义、听见发音，把零散的词汇，慢慢变成属于自己的语言。</p>
      </section>
      <section className="home-stats" aria-label="词库功能" data-home-reveal>
        <div className="home-stat"><p aria-label="8 类考试词库"><span data-home-count="8" aria-hidden="true">8</span><small aria-hidden="true">类</small></p><span>考试词库，按目标探索</span></div>
        <div className="home-stat"><p aria-label="3 种了解单词的方式"><span data-home-count="3" aria-hidden="true">3</span><small aria-hidden="true">种</small></p><span>看释义 · 读音标 · 听发音</span></div>
        <div className="home-stat home-stat-statement"><p>One more.</p><span>每天，都比昨天多懂一点</span></div>
      </section>
      <section className="home-features" aria-labelledby="home-features-title">
        <div className="home-section-heading" data-home-reveal>
          <div><span className="home-eyebrow">BUILT FOR YOUR EVERYDAY</span><h2 id="home-features-title">让学习，自然发生。</h2></div>
          <span className="home-section-caption">简单的工具，踏实的积累。</span>
        </div>
        <div className="home-feature-grid">{features.map((feature) => (
          <article className="home-feature" key={feature.number} data-home-reveal>
            <div className="home-feature-top"><span className="home-feature-icon">{feature.icon}</span><span className="home-feature-number">{feature.number}</span></div>
            <h3>{feature.title}</h3><p>{feature.text}</p><span className="home-feature-caption">{feature.caption}</span>
          </article>
        ))}</div>
      </section>
      <section className="home-bottom-cta" data-home-reveal>
        <div><span className="home-eyebrow">YOUR JOURNEY STARTS HERE</span><h2>下一个单词，会是什么？</h2></div>
        <Link className="home-button home-button-dark" to="/word-book" onClick={openWordBook}>去词库看看 <ArrowRightOutlined /></Link>
      </section>
      <footer className="home-footer"><span>XM ENGLISH <i>·</i> Learn a little. Live a little more.</span><span>保持好奇，持续生长。</span></footer>
    </div>
  )
}
