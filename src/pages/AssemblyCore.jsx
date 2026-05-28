import { useState, useEffect, useRef, useCallback } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import styles from './Assembly.module.css'

/* ── 조립 순서 정의 ── */
export const STEPS = [
  { id: 'barrel',    label: '축',    img: '/parts/barrel2.svg',    size: 'lg', hint: '축을 작업대에 놓으세요' },
  { id: 'knock',     label: '노크',  img: '/parts/knock2.svg',      size: 'sm', hint: '노크를 끼우세요' },
  { id: 'inkrefill', label: '잉크심', img: '/parts/inkrefill2.svg', size: 'sm', hint: '잉크심을 끼워넣으세요' },
  { id: 'spring',    label: '스프링', img: '/parts/spring2.svg',    size: 'sm', hint: '스프링을 올려놓으세요' },
  { id: 'cone',      label: '선축',  img: '/parts/cone2.svg',       size: 'xs', hint: '선축을 작업대에 놓으세요' },
]

/* ── 조립된 파츠 이미지 목록 반환 ── */
export function getAssembledImgs(assembled) {
  if (
    assembled.includes('barrel') && assembled.includes('knock') &&
    assembled.includes('inkrefill') && assembled.includes('spring')
  ) {
    const combined = [{ id: 'barrel-spring', src: '/parts/barrel-spring-done.svg', alt: '축+노크+잉크심+스프링' }]
    const rest = assembled
      .filter(id => !['barrel', 'knock', 'inkrefill', 'spring'].includes(id))
      .map(id => { const s = STEPS.find(x => x.id === id); return { id, src: s.img, alt: s.label } })
    return [...combined, ...rest]
  }
  if (assembled.includes('barrel') && assembled.includes('knock') && assembled.includes('inkrefill')) {
    const combined = [{ id: 'barrel-inked', src: '/parts/barrel-inked.svg', alt: '축+노크+잉크심' }]
    const rest = assembled
      .filter(id => id !== 'barrel' && id !== 'knock' && id !== 'inkrefill')
      .map(id => { const s = STEPS.find(x => x.id === id); return { id, src: s.img, alt: s.label } })
    return [...combined, ...rest]
  }
  if (assembled.includes('barrel') && assembled.includes('knock')) {
    const combined = [{ id: 'barrel-knocked', src: '/parts/barrel-knocked.svg', alt: '축+노크' }]
    const rest = assembled
      .filter(id => id !== 'barrel' && id !== 'knock')
      .map(id => { const s = STEPS.find(x => x.id === id); return { id, src: s.img, alt: s.label } })
    return [...combined, ...rest]
  }
  return assembled.map(id => {
    const s = STEPS.find(x => x.id === id)
    return { id, src: s.img, alt: s.label }
  })
}

/* ── 완성 효과음 (C5→E5→G5→C6 상승 화음) ── */
export function playCompletionSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99, 1046.50]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.28, t + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.52)
      osc.start(t)
      osc.stop(t + 0.55)
    })
  } catch (_) {}
}

/* ── 드롭 사운드 (부품 → 작업대에 놓을 때) ── */
export function playDropSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(300, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.09)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.14)
  } catch (_) {}
}

/* ── 스냅 사운드 (부품 끼워짐 딸깍) ── */
export function playSnapSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const len = Math.floor(ctx.sampleRate * 0.045)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource(); src.buffer = buf
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 2800; filt.Q.value = 0.9
    const gain = ctx.createGain(); gain.gain.value = 0.32
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination)
    src.start()
  } catch (_) {}
}

/* ── 밀어넣기 사운드 (노크 스와이프 완료) ── */
export function playPushSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(230, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(75, ctx.currentTime + 0.2)
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.07)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.26)
  } catch (_) {}
}

/* ── 박스 입함 사운드 (볼펜 → 완성 상자) ── */
export function playBoxSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 783.99]   // C5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      const t = ctx.currentTime + i * 0.11
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
      osc.start(t); osc.stop(t + 0.35)
    })
  } catch (_) {}
}

/* ── 빵파레 사운드 (납품 완료 모달) ── */
export function playFanfareSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    // G4→C5→E5→G5, 마지막 C6 길게 — 트럼펫 빵파레 느낌
    const notes = [
      { freq: 392.00, dur: 0.13, t: 0.00 },  // G4
      { freq: 523.25, dur: 0.13, t: 0.14 },  // C5
      { freq: 659.25, dur: 0.13, t: 0.28 },  // E5
      { freq: 783.99, dur: 0.13, t: 0.42 },  // G5
      { freq: 1046.5, dur: 0.60, t: 0.56 },  // C6 (길게)
    ]
    notes.forEach(({ freq, dur, t }) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.value = freq
      const start = ctx.currentTime + t
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
      osc.start(start); osc.stop(start + dur + 0.02)
    })
  } catch (_) {}
}

/* ── 실패 사운드 (시간 초과, C5→G4→C4 하강 3음) ── */
export function playFailSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 392.00, 261.63]   // C5 → G4 → C4
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      const t = ctx.currentTime + i * 0.2
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.24, t + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
      osc.start(t); osc.stop(t + 0.58)
    })
  } catch (_) {}
}

/* ── 회전 틱 사운드 (선축 1바퀴 완성마다, 내부 전용) ── */
function playTickSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'triangle'; osc.frequency.value = 1100
    gain.gain.setValueAtTime(0.09, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.055)
  } catch (_) {}
}

/* ── 완성 스파클 파티클 ── */
export function SparkleEffect() {
  const colors = ['#52b788', '#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#90be6d', '#f9c74f']
  const particles = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * 360
    const rad = (angle * Math.PI) / 180
    const dist = 50 + (i % 5) * 14
    return { tx: Math.cos(rad) * dist, ty: Math.sin(rad) * dist, delay: (i % 4) * 0.07, color: colors[i % colors.length], size: 7 + (i % 4) * 3 }
  })
  return (
    <div className={styles.sparkleContainer}>
      {particles.map((p, i) => (
        <div key={i} className={styles.sparkleDot} style={{ '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, '--delay': `${p.delay}s`, '--color': p.color, width: `${p.size}px`, height: `${p.size}px`, marginLeft: `${-p.size / 2}px`, marginTop: `${-p.size / 2}px` }} />
      ))}
    </div>
  )
}

/* ── 드래그 가능한 부품 (트레이용) ── */
export function DraggablePart({ id, label, img, size, stackCount, disabled }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled })
  return (
    <div className={`${styles.stackWrap} ${disabled ? styles.stackDisabled : ''}`}>
      {stackCount > 1 && (
        <>
          {stackCount > 2 && <div className={`${styles.stackCard} ${styles.stackCard3}`} />}
          <div className={`${styles.stackCard} ${styles.stackCard2}`} />
        </>
      )}
      <div
        ref={setNodeRef}
        className={`${styles.partCard} ${size === 'lg' ? styles.partLg : size === 'xs' ? styles.partXs : styles.partSm} ${!disabled ? styles.partActive : ''} ${isDragging ? styles.partGhost : ''}`}
        {...(disabled ? {} : listeners)}
        {...(disabled ? {} : attributes)}
      >
        <img src={img} alt={label} className={styles.partImg} />
        {stackCount > 0 && <span className={styles.stackBadge}>{stackCount}</span>}
        <span className={styles.partLabel}>{label}</span>
      </div>
    </div>
  )
}

/* ── 작업대 드롭존 (기본) ── */
export function WorkbenchDrop({ id, label, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`${styles.workDrop} ${isOver ? styles.workDropOver : ''}`}>
      {children || <span className={styles.workDropLabel}>{label}</span>}
    </div>
  )
}

/* ── 노크 밀어넣기 스와이프 컨트롤 ── */
function SwipePush({ onPush }) {
  const trackRef = useRef(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startOffset = useRef(0)
  const THUMB_W = 52
  const PAD = 6

  function maxTravel() { return (trackRef.current?.offsetWidth ?? 220) - THUMB_W - PAD * 2 }
  function cx(e) { return e.touches ? e.touches[0].clientX : e.clientX }

  function down(e) {
    e.preventDefault()
    startX.current = cx(e)
    startOffset.current = offset
    setDragging(true)
  }
  function move(e) {
    if (!dragging) return
    e.preventDefault()
    const delta = startX.current - cx(e)
    const max = maxTravel()
    setOffset(Math.max(0, Math.min(max, startOffset.current + delta)))
  }
  function up() {
    if (!dragging) return
    setDragging(false)
    if (offset >= maxTravel() * 0.78) onPush()
    else setOffset(0)
  }

  return (
    <div ref={trackRef} className={styles.swipePush}
      onMouseDown={down} onMouseMove={dragging ? move : undefined} onMouseUp={up} onMouseLeave={() => dragging && up()}
      onTouchStart={down} onTouchMove={dragging ? move : undefined} onTouchEnd={up}
    >
      <div className={styles.swipeArrows}>
        <span className={styles.swipeArrow} style={{ animationDelay: '0s' }}>←</span>
        <span className={styles.swipeArrow} style={{ animationDelay: '0.18s' }}>←</span>
        <span className={styles.swipeArrow} style={{ animationDelay: '0.36s' }}>←</span>
      </div>
      <div className={`${styles.swipeThumb} ${dragging ? styles.swipeThumbActive : ''}`}
        style={{ transform: `translateX(-${offset}px)`, transition: dragging ? 'none' : 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        <img src="/parts/knock2.svg" alt="노크" className={styles.swipeThumbImg} />
      </div>
    </div>
  )
}

/* ── 노크 전용 작업대 ── */
export function KnockWorkbench({ knockSub, isDraggingKnock, onAdvance }) {
  const [pushing, setPushing] = useState(false)
  const [knockDone, setKnockDone] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: 'zone-work' })
  const knockStep = STEPS.find(s => s.id === 'knock')
  const barrelStep = STEPS.find(s => s.id === 'barrel')

  useEffect(() => {
    if (!knockDone) return
    const t = setTimeout(onAdvance, 900)
    return () => clearTimeout(t)
  }, [knockDone, onAdvance])

  let slotClass = styles.knockSlot
  if (pushing) slotClass += ` ${styles.knockPushing}`
  else if (knockSub === 1) slotClass += ` ${styles.knockSlotFilled}`
  else if (isDraggingKnock) slotClass += isOver ? ` ${styles.knockSlotHover}` : ` ${styles.knockSlotDragging}`

  if (knockDone) {
    return (
      <div className={styles.workDrop}>
        <img src="/parts/barrel-knocked.svg" alt="노크 끼움 완료" className={styles.knockDoneImg} />
      </div>
    )
  }
  return (
    <div ref={setNodeRef} className={`${styles.workDrop} ${isOver && knockSub === 0 ? styles.workDropOver : ''}`}>
      <div className={styles.knockLayout}>
        <div className={styles.knockBarrelWrap}>
          <img src={barrelStep.img} alt="축" className={`${styles.knockBarrel} ${pushing ? styles.knockBarrelAccept : ''}`} />
        </div>
        <div className={slotClass} onAnimationEnd={pushing ? () => setKnockDone(true) : undefined}>
          <img src={knockStep.img} alt="노크" className={styles.knockSlotImg} />
        </div>
      </div>
      {knockSub === 1 && !pushing && <SwipePush onPush={() => { playPushSound(); setPushing(true) }} />}
    </div>
  )
}

/* ── 잉크심 전용 작업대 ── */
export function InkrefillWorkbench({ assembled, isDraggingInkrefill, inkSub, onAdvance }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'zone-work' })
  const inkrefillStep = STEPS.find(s => s.id === 'inkrefill')
  const showGhost = isDraggingInkrefill && isOver

  useEffect(() => {
    if (inkSub !== 1) return
    const t = setTimeout(onAdvance, 900)
    return () => clearTimeout(t)
  }, [inkSub, onAdvance])

  if (inkSub === 1) {
    return (
      <div className={styles.workDrop}>
        <img src="/parts/barrel-inked.svg" alt="잉크심 삽입 완료" className={styles.inkDoneImg} />
      </div>
    )
  }
  const assembledImgs = getAssembledImgs(assembled)
  return (
    <div ref={setNodeRef} className={`${styles.workDrop} ${isOver ? styles.workDropOver : ''}`}>
      {assembledImgs.length > 0 ? (
        <div className={styles.inkrefillBarrelWrap}>
          <img src={assembledImgs[0].src} alt={assembledImgs[0].alt} className={styles.inkrefillBarrelImg} />
          {showGhost && <img src={inkrefillStep.img} alt="잉크심 미리보기" className={styles.inkrefillGhost} />}
        </div>
      ) : (
        <span className={styles.workDropLabel}>여기에 놓으세요</span>
      )}
    </div>
  )
}

/* ── 스프링 전용 작업대 ── */
export function SpringWorkbench({ assembled, isDraggingSpring, springSub, onAdvance }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'zone-work' })
  const showGhost = isDraggingSpring && isOver

  useEffect(() => {
    if (springSub !== 1) return
    const t = setTimeout(onAdvance, 900)
    return () => clearTimeout(t)
  }, [springSub, onAdvance])

  if (springSub === 1) {
    return (
      <div className={styles.workDrop}>
        <img src="/parts/barrel-spring-done.svg" alt="스프링 조립 완료" className={styles.inkDoneImg} />
      </div>
    )
  }
  const assembledImgs = getAssembledImgs(assembled)
  return (
    <div ref={setNodeRef} className={`${styles.workDrop} ${isOver ? styles.workDropOver : ''}`}>
      {assembledImgs.length > 0 ? (
        <div className={styles.inkrefillBarrelWrap}>
          <img src={assembledImgs[0].src} alt={assembledImgs[0].alt} className={styles.inkrefillBarrelImg} />
          {showGhost && <img src="/parts/barrel-spring.svg" alt="스프링 미리보기" className={styles.springGhost} />}
        </div>
      ) : (
        <span className={styles.workDropLabel}>여기에 놓으세요</span>
      )}
    </div>
  )
}

/* ── 선축 전용 작업대 ── */
export function ConeWorkbench({ assembled, isDraggingCone, coneSub, onAdvance }) {
  const TARGET = 5
  const [turns, setTurns] = useState(0)
  const [arrowRotation, setArrowRotation] = useState(0)
  const [coneDone, setConeDone] = useState(false)
  const lastAngle = useRef(null)
  const totalAngle = useRef(0)
  const dragging = useRef(false)
  const arrowRef = useRef(null)
  const soundPlayed = useRef(false)
  const prevFloor = useRef(0)    // 틱 사운드용: 직전 완성 바퀴 수
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'zone-work' })
  const showGhost = isDraggingCone && isOver

  useEffect(() => {
    if (!coneDone) return
    if (!soundPlayed.current) { soundPlayed.current = true; playCompletionSound() }
    const t = setTimeout(onAdvance, 1500)
    return () => clearTimeout(t)
  }, [coneDone, onAdvance])

  const getAngle = useCallback((e) => {
    if (!arrowRef.current) return 0
    const rect = arrowRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const { clientX, clientY } = e.touches ? e.touches[0] : e
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI)
  }, [])

  const onStart = useCallback((e) => { e.preventDefault(); dragging.current = true; lastAngle.current = getAngle(e) }, [getAngle])
  const onMove = useCallback((e) => {
    if (!dragging.current) return
    e.preventDefault()
    const cur = getAngle(e)
    let delta = cur - lastAngle.current
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    if (delta > 0) {
      totalAngle.current += delta
      const newTurns = totalAngle.current / 360
      setTurns(Math.min(newTurns, TARGET))
      setArrowRotation(r => r + delta)
      // 바퀴가 하나 새로 완성될 때마다 틱 사운드
      const newFloor = Math.floor(Math.min(newTurns, TARGET))
      if (newFloor > prevFloor.current) { playTickSound(); prevFloor.current = newFloor }
      if (newTurns >= TARGET) { dragging.current = false; setConeDone(true) }
    }
    lastAngle.current = cur
  }, [getAngle])
  const onEnd = useCallback(() => { dragging.current = false }, [])

  useEffect(() => {
    if (coneSub !== 1 || coneDone) return
    const el = arrowRef.current
    if (!el) return
    el.addEventListener('mousedown', onStart)
    el.addEventListener('touchstart', onStart, { passive: false })
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchend', onEnd)
    return () => {
      el.removeEventListener('mousedown', onStart)
      el.removeEventListener('touchstart', onStart)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchend', onEnd)
    }
  }, [coneSub, coneDone, onStart, onMove, onEnd])

  const progress = Math.min(turns / TARGET, 1)
  const assembledImgs = getAssembledImgs(assembled)

  if (coneDone) {
    return (
      <div className={styles.workDrop} style={{ position: 'relative', overflow: 'visible' }}>
        <div className={styles.coneCrossfadeWrap}>
          <img src="/parts/barrel-cone-final.svg" alt="선축 완전 조립" className={styles.coneFadeBase} />
        </div>
        <SparkleEffect />
      </div>
    )
  }
  if (coneSub === 1) {
    return (
      <div className={styles.workDrop}>
        <div className={styles.coneCrossfadeWrap}>
          <img src="/parts/barrel-cone-done.svg" alt="선축 위치" className={styles.coneFadeBase} style={{ opacity: 1 - progress }} />
          <img src="/parts/barrel-cone-final.svg" alt="선축 삽입 중" className={styles.coneFadeFinal} style={{ opacity: progress }} />
          <div ref={arrowRef} className={styles.coneArrowOverlay} style={{ transform: `translate(-50%, -50%) rotate(${arrowRotation}deg)` }}>
            <img src="/parts/rotate-arrow.svg" alt="돌리기" className={styles.coneArrowImg} />
          </div>
        </div>
        <div className={styles.coneProgress}>
          <span>{Math.floor(turns)} / {TARGET} 바퀴</span>
          <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${progress * 100}%` }} /></div>
        </div>
      </div>
    )
  }
  return (
    <div ref={setDropRef} className={`${styles.workDrop} ${isOver ? styles.workDropOver : ''}`}>
      {assembledImgs.length > 0 ? (
        <div className={styles.coneCrossfadeWrap}>
          <img src={assembledImgs[0].src} alt={assembledImgs[0].alt} className={styles.coneFadeBase} />
          {showGhost && <img src="/parts/barrel-cone-done.svg" alt="선축 미리보기" className={styles.coneGhostFull} />}
        </div>
      ) : (
        <span className={styles.workDropLabel}>여기에 놓으세요</span>
      )}
    </div>
  )
}

/* ── 완성된 볼펜 대기 워크벤치 ── */
export function PenReadyWorkbench() {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: 'pen-complete' })
  return (
    <div className={styles.workDrop}>
      <div ref={setNodeRef} {...listeners} {...attributes}
        className={`${styles.penReadyCard} ${isDragging ? styles.penReadyGhost : ''}`}
      >
        <img src="/parts/pen-complete.svg" alt="완성된 볼펜" className={styles.penReadyImg} />
        <span className={styles.penReadyLabel}>완성! 상자에 넣어주세요</span>
      </div>
    </div>
  )
}

/* ── 완성 상자 드롭 영역 ── */
export function BoxZone({ penReady, pensDone, count, className = '' }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'zone-box', disabled: !penReady })
  return (
    <div ref={setNodeRef}
      className={`${styles.doneArea} ${penReady ? styles.doneAreaDroppable : ''} ${isOver ? styles.doneAreaOver : ''} ${className}`}
    >
      <p className={styles.doneAreaTitle}>
        완성 상자
        <span className={styles.boxCount}> ({pensDone}/{count}개)</span>
        {penReady && <span className={styles.boxHint}> — 볼펜을 여기에 넣어주세요</span>}
      </p>
      <div className={styles.donePenRow}>
        {Array.from({ length: pensDone }).map((_, i) => (
          <img key={i} src="/parts/pen-complete.svg" alt={`완성 볼펜 ${i + 1}`} className={styles.donePenImg} />
        ))}
      </div>
    </div>
  )
}

/* ── 시간 초과 실패 모달 ── */
export function FailModal({ onRetry, onBack }) {
  useEffect(() => { playFailSound() }, [])
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <p className={styles.failIcon}>😢</p>
        <h2 className={styles.modalTitle}>시간 초과!</h2>
        <p className={styles.modalSub}>제한시간이 끝났어요</p>
        <p className={styles.modalMsg}>아쉽지만 다음엔 더 잘할 수 있어요!</p>
        <div className={styles.failBtnRow}>
          <button className={styles.failRetryBtn} onClick={onRetry}>다시하기</button>
          <button className={styles.failHomeBtn} onClick={onBack}>홈으로가기</button>
        </div>
      </div>
    </div>
  )
}

/* ── 납품 완료 모달 ── */
export function DoneModal({ pensDone, elapsed, onBack }) {
  useEffect(() => { playFanfareSound() }, [])
  function fmt(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <img src="/parts/pen-complete.svg" alt="완성 볼펜" className={styles.modalPen} />
        <h2 className={styles.modalTitle}>납품 완료!</h2>
        <p className={styles.modalSub}>{pensDone}개 완성 · {fmt(elapsed)} 소요</p>
        <div className={styles.starRow}>
          {[1,2,3,4,5].map(i => <span key={i} className={styles.star}>★</span>)}
        </div>
        <p className={styles.modalMsg}>잘했어요! 모두 완성했어요!</p>
        <button className={styles.modalBtn} onClick={onBack}>처음으로</button>
      </div>
    </div>
  )
}
