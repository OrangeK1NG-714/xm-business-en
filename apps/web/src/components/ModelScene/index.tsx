import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import './index.css'

interface ModelSceneProps {
  src: string
  className?: string
  label?: string
}

const modelCredits: Record<string, { title: string; author: string; source: string; authorUrl: string; nonCommercial?: boolean }> = {
  '/models/hologram/scene.gltf': { title: 'Primary Ion Drive ///', author: 'indierocktopus', source: 'https://sketchfab.com/3d-models/primary-ion-drive-d3f50a66fee74c6588dd9bc92f7fe7b3', authorUrl: 'https://sketchfab.com/indierocktopus' },
  '/models/login/scene.gltf': { title: '[Blue Archive]Kasumizawa Miyu', author: 'Onerui(momo)', source: 'https://sketchfab.com/3d-models/blue-archivekasumizawa-miyu-108d81dfd5a44dab92e4dccf0cc51a02', authorUrl: 'https://sketchfab.com/hswangrui' },
  '/models/register/scene.gltf': { title: 'anime girl Mia Ter Excited Preview', author: 'ChamberSu1996', source: 'https://sketchfab.com/3d-models/anime-girl-mia-ter-excited-preview-bda66b935705449dad31f6c5d96780a7', authorUrl: 'https://sketchfab.com/chambersu1996', nonCommercial: true },
}

function disposeModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    geometries.add(object.geometry)
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    meshMaterials.forEach((material) => {
      materials.add(material)
      Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value) })
    })
    if (object instanceof THREE.SkinnedMesh && object.skeleton.boneTexture) textures.add(object.skeleton.boneTexture)
  })
  textures.forEach((texture) => {
    texture.dispose()
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close()
  })
  materials.forEach((material) => material.dispose())
  geometries.forEach((geometry) => geometry.dispose())
}

export default function ModelScene({ src, className = '', label = '可拖动旋转的 3D 模型' }: ModelSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [loadState, setLoadState] = useState<{ key: string; status: 'ready' | 'error' } | null>(null)
  const sourceKey = `${src}:${attempt}`
  const status = loadState?.key === sourceKey ? loadState.status : 'loading'
  const credit = modelCredits[src]

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    let disposed = false
    let failed = false
    let inView = true
    let frame = 0
    let previousTime = 0
    let renderer: THREE.WebGLRenderer | undefined
    let controls: OrbitControls | undefined
    let mixer: THREE.AnimationMixer | undefined
    let model: THREE.Object3D | undefined
    let resizeObserver: ResizeObserver | undefined
    let visibilityObserver: IntersectionObserver | undefined
    let radius = 1
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const render = () => {
      if (!disposed && !failed && renderer && inView && !document.hidden) renderer.render(scene, camera)
    }
    const animate = (time: number) => {
      if (disposed || failed || !inView || document.hidden || reducedMotion.matches) return
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0
      previousTime = time
      mixer?.update(delta)
      controls?.update(delta)
      render()
      frame = requestAnimationFrame(animate)
    }
    const syncActivity = () => {
      cancelAnimationFrame(frame)
      previousTime = 0
      if (controls) {
        controls.autoRotate = !reducedMotion.matches
        controls.enableDamping = !reducedMotion.matches
      }
      render()
      if (renderer && model && inView && !document.hidden && !disposed && !failed && !reducedMotion.matches) frame = requestAnimationFrame(animate)
    }
    const fitCamera = () => {
      const verticalFov = THREE.MathUtils.degToRad(camera.fov)
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
      const distance = radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.15
      const direction = camera.position.clone().normalize()
      if (direction.lengthSq() === 0) direction.set(0.12, 0.08, 1).normalize()
      camera.position.copy(direction.multiplyScalar(distance))
      camera.near = Math.max(radius / 100, 0.001)
      camera.far = distance + radius * 20
      camera.updateProjectionMatrix()
      if (controls) {
        controls.minDistance = radius * 1.15
        controls.maxDistance = distance * 2
        controls.update()
      }
      render()
    }
    const resize = () => {
      if (!renderer || disposed) return
      const width = Math.max(container.clientWidth, 1)
      const height = Math.max(container.clientHeight, 1)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      fitCamera()
    }
    const fail = () => {
      if (disposed) return
      failed = true
      cancelAnimationFrame(frame)
      setLoadState({ key: sourceKey, status: 'error' })
    }
    const contextLost = (event: Event) => { event.preventDefault(); fail() }
    const initFrame = requestAnimationFrame(() => {
      if (disposed) return
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.15
        scene.add(new THREE.HemisphereLight(0xf0ffff, 0x546575, 2.8))
        const keyLight = new THREE.DirectionalLight(0xffffff, 3)
        keyLight.position.set(4, 6, 5)
        scene.add(keyLight)
        const fillLight = new THREE.DirectionalLight(0x9ed8ce, 1.4)
        fillLight.position.set(-4, 1, -2)
        scene.add(fillLight)
        controls = new OrbitControls(camera, canvas)
        controls.enablePan = false
        controls.enableZoom = false
        controls.autoRotateSpeed = 0.45
        controls.maxPolarAngle = Math.PI * 0.84
        controls.minPolarAngle = Math.PI * 0.16
        controls.addEventListener('change', render)
        canvas.addEventListener('webglcontextlost', contextLost)
        document.addEventListener('visibilitychange', syncActivity)
        reducedMotion.addEventListener('change', syncActivity)
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(container)
        visibilityObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncActivity() })
        visibilityObserver.observe(container)
        resize()
        new GLTFLoader().load(src, (gltf) => {
          if (disposed || failed) { disposeModel(gltf.scene); return }
          model = gltf.scene
          const wrapper = new THREE.Group()
          wrapper.add(model)
          const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere())
          radius = Number.isFinite(sphere.radius) && sphere.radius > 0 ? sphere.radius : 1
          wrapper.position.copy(sphere.center).multiplyScalar(-1)
          scene.add(wrapper)
          if (gltf.animations.length) {
            mixer = new THREE.AnimationMixer(model)
            gltf.animations.forEach((clip) => mixer?.clipAction(clip).play())
          }
          fitCamera()
          setLoadState({ key: sourceKey, status: 'ready' })
          syncActivity()
        }, undefined, fail)
      } catch { fail() }
    })
    return () => {
      disposed = true
      cancelAnimationFrame(initFrame)
      cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      visibilityObserver?.disconnect()
      document.removeEventListener('visibilitychange', syncActivity)
      reducedMotion.removeEventListener('change', syncActivity)
      canvas.removeEventListener('webglcontextlost', contextLost)
      controls?.removeEventListener('change', render)
      controls?.dispose()
      mixer?.stopAllAction()
      if (model) { mixer?.uncacheRoot(model); disposeModel(model) }
      scene.clear()
      renderer?.dispose()
      renderer?.forceContextLoss()
    }
  }, [src, sourceKey])

  return (
    <div ref={containerRef} className={`model-scene ${className}`} aria-busy={status === 'loading'}>
      <canvas key={sourceKey} ref={canvasRef} className={`model-scene-canvas${status === 'ready' ? ' model-scene-ready' : ''}`} role="img" aria-label={label} />
      {status === 'loading' && <div className="model-scene-status" role="status"><span className="model-scene-spinner" /><span>正在载入 3D 世界</span></div>}
      {status === 'error' && <div className="model-scene-status" role="status"><span className="model-scene-fallback" aria-hidden="true">Aa</span><span>3D 模型暂不可用</span><button type="button" onClick={() => setAttempt((value) => value + 1)}>重新加载</button></div>}
      {credit && <details className="model-scene-credit"><summary>模型署名</summary><p><a href={credit.source} target="_blank" rel="noreferrer">{credit.title}</a> · <a href={credit.authorUrl} target="_blank" rel="noreferrer">{credit.author}</a><br /><a href={`https://creativecommons.org/licenses/${credit.nonCommercial ? 'by-nc' : 'by'}/4.0/`} target="_blank" rel="noreferrer">{credit.nonCommercial ? 'CC BY-NC 4.0 · 仅限非商业用途' : 'CC BY 4.0'}</a></p></details>}
    </div>
  )
}
