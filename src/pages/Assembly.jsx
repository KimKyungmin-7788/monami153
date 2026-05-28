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
              {/* 트레이 레이아웃: 축(상단 전체) / 잉크심(좌 tall) + 노크·스프링·선축(우 열) */}
              {(() => {
                const barrelCnt  = step > 0 ? 0 : remainCount()
                const knockCnt   = (step > 1 || knockSub  >= 1) ? 0 : remainCount()
                const inkCnt     = (step > 2 || inkSub    >= 1) ? 0 : remainCount()
                const sprCnt     = (step > 3 || springSub >= 1) ? 0 : remainCount()
                const coneCnt    = coneSub >= 1 ? 0 : remainCount()
                const showRight  = knockCnt > 0 || sprCnt > 0 || coneCnt > 0
                return (
                  <div className={styles.trayLayout}>
                    {barrelCnt > 0 && (
                      <DraggablePart key="barrel" id="barrel" label={STEPS[0].label} img={STEPS[0].img}
                        size={STEPS[0].size} stackCount={barrelCnt} disabled={step !== 0 || penReady} />
                    )}
                    {(inkCnt > 0 || showRight) && (
                      <div className={styles.traySlotBottom}>
                        {inkCnt > 0 && (
                          <div className={styles.traySlotLeft}>
                            <DraggablePart key="inkrefill" id="inkrefill" label={STEPS[2].label} img={STEPS[2].img}
                              size={STEPS[2].size} stackCount={inkCnt} disabled={step !== 2 || penReady} vertical tall />
                          </div>
                        )}
                        {showRight && (
                          <div className={styles.traySlotRight}>
                            {knockCnt > 0 && (
                              <DraggablePart key="knock" id="knock" label={STEPS[1].label} img={STEPS[1].img}
                                size={STEPS[1].size} stackCount={knockCnt} disabled={step !== 1 || penReady} />
                            )}
                            {sprCnt > 0 && (
                              <DraggablePart key="spring" id="spring" label={STEPS[3].label} img={STEPS[3].img}
                                size={STEPS[3].size} stackCount={sprCnt} disabled={step !== 3 || penReady} vertical />
                            )}
                            {coneCnt > 0 && (
                              <DraggablePart key="cone" id="cone" label={STEPS[4].label} img={STEPS[4].img}
                                size={STEPS[4].size} stackCount={coneCnt} disabled={step !== 4 || penReady} vertical />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}
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
          {activePart && ['inkrefill', 'spring', 'cone'].includes(activePart.id) ? (
            <div style={{ position: 'relative', width: '18px', height: '80px', overflow: 'visible' }}>
              <img src={activePart.img} alt={activePart.label} style={{
                position: 'absolute', width: '80px', height: '18px',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%) rotate(90deg)',
                objectFit: 'contain',
                filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.28))',
                pointerEvents: 'none', cursor: 'grabbing', userSelect: 'none',
              }} />
            </div>
          ) : activePart ? (
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
