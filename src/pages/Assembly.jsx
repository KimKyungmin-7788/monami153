import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import styles from './Assembly.module.css'
import {
  STEPS, getAssembledImgs,
  DraggablePart, WorkbenchDrop,
  KnockWorkbench, InkrefillWorkbench, SpringWorkbench, ConeWorkbench,
  PenReadyWorkbench, BoxZone, DoneModal, FailModal,
  playDropSound, playSnapSound, playBoxSound,
} from './AssemblyCore'

export default function Assembly() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { mode, count = 1, time } = state || {}

  const [activePartId, setActivePartId] = useState(null)
  const activePart = STEPS.find(s => s.id === activePartId) ?? null

  const [step, setStep] = useState(0)
  const [pensDone, setPensDone] = useState(0)
  const [assembled, setAssembled] = useState([])

  const [knockSub, setKnockSub] = useState(0)
  const [inkSub, setInkSub] = useState(0)
  const [springSub, setspringSub] = useState(0)
  const [coneSub, setConeSub] = useState(0)
  const [penReady, setPenReady] = useState(false)

  const [timeLeft, setTimeLeft] = useState(time ?? null)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  const startTime = useRef(Date.now())

  useEffect(() => {
    if (timeLeft === null || done || failed) return
    if (timeLeft <= 0) { setFailed(true); return }
    const t = setInterval(() => setTimeLeft(v => v - 1), 1000)
    return () => clearInterval(t)
  }, [timeLeft, done, failed])

  function resetGame() {
    setStep(0)
    setPensDone(0)
    setAssembled([])
    setKnockSub(0); setInkSub(0); setspringSub(0); setConeSub(0)
    setPenReady(false)
    setTimeLeft(time ?? null)
    setDone(false)
    setFailed(false)
    startTime.current = Date.now()
  }

  function fmt(s) {
    if (s === null) return '∞'
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  function remainCount() {
    return count - pensDone
  }

  const advance = useCallback(() => {
    if (step < STEPS.length - 1) {
      setAssembled(prev => [...prev, STEPS[step].id])
      setStep(s => s + 1)
      setKnockSub(0); setInkSub(0); setspringSub(0); setConeSub(0)
    } else {
      setPenReady(true)
    }
  }, [step])

  const boxPen = useCallback(() => {
    const next = pensDone + 1
    setPensDone(next)
    setStep(0)
    setAssembled([])
    setPenReady(false)
    setKnockSub(0); setInkSub(0); setspringSub(0); setConeSub(0)
  }, [pensDone])

  function handleDragStart({ active }) {
    setActivePartId(active.id)
  }

  function handleDragEnd({ active, over }) {
    setActivePartId(null)
    if (!over) return
    if (active.id === 'pen-complete' && over.id === 'zone-box') { playBoxSound(); boxPen(); return }
    const part = STEPS[step]
    if (part.id === 'barrel'    && over.id === 'zone-work') { playDropSound(); advance() }
    if (part.id === 'inkrefill' && over.id === 'zone-work') { playSnapSound(); setInkSub(1) }
    if (part.id === 'spring'    && over.id === 'zone-work') { playSnapSound(); setspringSub(1) }
    if (part.id === 'cone'      && over.id === 'zone-work') { playDropSound(); setConeSub(1) }
    if (part.id === 'knock' && knockSub === 0 && over.id === 'zone-work') { playSnapSound(); setKnockSub(1) }
  }

  const elapsed = Math.round((Date.now() - startTime.current) / 1000)
  const currentPart = STEPS[step]

  function hintText() {
    if (penReady) return '완성된 볼펜을 완성 상자에 넣어주세요'
    if (currentPart.id === 'knock' && knockSub === 1) return '노크를 꾹 눌러 완성하세요'
    if (currentPart.id === 'cone' && coneSub === 1) return '화살표를 시계 방향으로 5바퀴 돌리세요'
    return currentPart.hint
  }

  return (
    <>
      {done && (
        <DoneModal pensDone={pensDone} elapsed={elapsed} onBack={() => navigate('/')} />
      )}
      {failed && (
        <FailModal onRetry={resetGame} onBack={() => navigate('/')} />
      )}

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={styles.page}>

          {/* ── 상단 바 ── */}
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={() => navigate('/')}>← 나가기</button>
            <div className={styles.topCenter}>
              <span className={`${styles.timerBig} ${timeLeft !== null && timeLeft <= 30 ? styles.timerWarning : ''}`}>
                {fmt(timeLeft)}
              </span>
              <div className={styles.stepDots}>
                {STEPS.map((p, i) => (
                  <div key={p.id} className={`${styles.dot} ${(i < step || penReady) ? styles.dotDone : ''} ${i === step && !penReady ? styles.dotActive : ''}`} />
                ))}
              </div>
            </div>
            <span className={styles.penCount}>{pensDone + 1}/{count}개</span>
          </div>

          {/* ── 힌트 ── */}
          <div className={styles.hintBox}>
            <strong>{currentPart.label}</strong> — {hintText()}
          </div>

          {/* ── 메인 작업 영역 ── */}
          <div className={styles.mainArea}>

            {/* 왼쪽: 부품 트레이 */}
            <div className={styles.tray}>
              <p className={styles.trayTitle}>부품 트레이</p>
              <div className={styles.trayGrid}>
                {STEPS.map((s, i) => {
                  const isCurrentStep = i === step
                  const isDone = i < step
                  // 작업대에 배치된 순간 즉시 숨김 (step 전환 딜레이 방지)
                  const isPlaced =
                    (s.id === 'knock'     && knockSub >= 1) ||
                    (s.id === 'inkrefill' && inkSub >= 1)   ||
                    (s.id === 'spring'    && springSub >= 1) ||
                    (s.id === 'cone'      && coneSub >= 1)
                  const cnt = (isDone || isPlaced) ? 0 : remainCount()
                  if (cnt === 0) return null
                  return (
                    <DraggablePart
                      key={s.id}
                      id={s.id}
                      label={s.label}
                      img={s.img}
                      size={s.size}
                      stackCount={cnt}
                      disabled={!isCurrentStep || penReady}
                    vertical={['inkrefill', 'spring', 'cone'].includes(s.id)}
                    />
                  )
                })}
              </div>
            </div>

            {/* 오른쪽: 작업대 */}
            <div className={styles.workbench}>
              <p className={styles.workTitle}>작업대</p>
              {penReady ? (
                <PenReadyWorkbench />
              ) : currentPart.id === 'cone' ? (
                <ConeWorkbench assembled={assembled} isDraggingCone={activePartId === 'cone'} coneSub={coneSub} onAdvance={advance} />
              ) : currentPart.id === 'knock' ? (
                <KnockWorkbench knockSub={knockSub} isDraggingKnock={activePartId === 'knock'} onAdvance={advance} />
              ) : currentPart.id === 'inkrefill' ? (
                <InkrefillWorkbench assembled={assembled} isDraggingInkrefill={activePartId === 'inkrefill'} inkSub={inkSub} onAdvance={advance} />
              ) : currentPart.id === 'spring' ? (
                <SpringWorkbench assembled={assembled} isDraggingSpring={activePartId === 'spring'} springSub={springSub} onAdvance={advance} />
              ) : (
                <WorkbenchDrop id="zone-work" label="여기에 놓으세요">
                  {assembled.length > 0 && (
                    <div className={styles.assembledRow}>
                      {getAssembledImgs(assembled).map(item => (
                        <img key={item.id} src={item.src} alt={item.alt} className={styles.assembledImg} />
                      ))}
                    </div>
                  )}
                  {assembled.length === 0 && <span className={styles.workDropLabel}>여기에 놓으세요</span>}
                </WorkbenchDrop>
              )}
            </div>
          </div>

          {/* ── 완성 상자 (항상 표시, 분홍 테두리) ── */}
          <BoxZone penReady={penReady} pensDone={pensDone} count={count} className={styles.doneAreaSolo} vertical />

          {/* ── 납품하기 버튼 ── */}
          <button
            className={`${styles.deliverBtn} ${pensDone < count ? styles.deliverDisabled : ''}`}
            disabled={pensDone < count}
            onClick={() => { playBoxSound(); setDone(true) }}
          >
            {pensDone >= count ? `납품하기 (${pensDone}개 완성) →` : `납품하기 (${pensDone}/${count}개)`}
          </button>

        </div>

        {/* ── 드래그 오버레이 ── */}
        <DragOverlay dropAnimation={null}>
          {activePart ? (
            <img src={activePart.img} alt={activePart.label} style={{
              maxHeight: activePart.size === 'lg' ? '64px' : activePart.size === 'xs' ? '32px' : '48px',
              maxWidth: '200px', width: 'auto', height: 'auto', objectFit: 'contain',
              filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.28))',
              pointerEvents: 'none', cursor: 'grabbing', userSelect: 'none',
            }} />
          ) : activePartId === 'pen-complete' ? (
            <img src="/parts/pen-complete.svg" alt="완성된 볼펜" style={{
              maxWidth: '200px', width: 'auto', height: 'auto', objectFit: 'contain',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))',
              pointerEvents: 'none', cursor: 'grabbing', userSelect: 'none',
            }} />
          ) : null}
        </DragOverlay>

      </DndContext>
    </>
  )
}
