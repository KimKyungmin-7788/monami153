import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import styles from './Tutorial.module.css'
import asmStyles from './Assembly.module.css'
import {
  STEPS, getAssembledImgs,
  DraggablePart, WorkbenchDrop,
  KnockWorkbench, InkrefillWorkbench, SpringWorkbench, ConeWorkbench,
  PenReadyWorkbench, BoxZone,
  playDropSound, playSnapSound, playBoxSound, playFanfareSound,
} from './AssemblyCore'

/* ── TTS ── */
function speak(text) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ko-KR'
  u.rate = 0.9
  window.speechSynthesis.speak(u)
}

/* ── 정답 효과음 (C5→E5 밝은 2음) ── */
function playCorrectSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 659.25]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      const t = ctx.currentTime + i * 0.1
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
      osc.start(t); osc.stop(t + 0.3)
    })
  } catch (_) {}
}

/* ── 오답 효과음 (저음 buzzz) ── */
function playWrongSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sawtooth'; osc.frequency.value = 160
    gain.gain.setValueAtTime(0.14, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
    osc.start(); osc.stop(ctx.currentTime + 0.24)
  } catch (_) {}
}

/* ── 배열 섞기 ── */
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ══════════════════════════════════
   1단계: 카드 뒤집기
══════════════════════════════════ */

// 표시 순서: 축 → 잉크심 → (노크·스프링·선축)
const FLIP_ORDER = ['barrel', 'inkrefill', 'knock', 'spring', 'cone']
// 가로로 긴 카드 (부품이 길고 납작한 형태)
const WIDE_PARTS = new Set(['barrel', 'inkrefill'])

function Stage1({ onNext, onBack }) {
  const [flipped, setFlipped] = useState(new Set())
  const allFlipped = flipped.size === STEPS.length

  function handleFlip(id, label) {
    if (flipped.has(id)) return
    setFlipped(prev => new Set([...prev, id]))
    speak(label)
  }

  return (
    <div className={styles.stagePage}>
      <div className={styles.stageHeader}>
        <button className={styles.backBtn} onClick={onBack}>← 나가기</button>
        <div className={styles.stageTitleBlock}>
          <span className={styles.stageChip}>1단계</span>
          <span className={styles.stageTitle}>부품 이름 알아보기</span>
        </div>
        <div className={styles.headerSpacer} />
      </div>

      <div className={styles.stageBody}>
        <p className={styles.stageDesc}>카드를 눌러 부품 이름을 알아보세요!</p>

        <div className={styles.cardGrid}>
          {FLIP_ORDER.map(id => {
            const step = STEPS.find(s => s.id === id)
            const isFlipped = flipped.has(id)
            const isWide = WIDE_PARTS.has(id)
            return (
              <div
                key={id}
                className={isWide ? styles.flipCardWide : styles.flipCard}
                onClick={() => handleFlip(id, step.label)}
                role="button"
                tabIndex={0}
                aria-label={`${step.label} 카드`}
              >
                <div className={`${styles.flipCardInner} ${isFlipped ? styles.flipped : ''}`}>
                  {/* 앞면 (클릭 후 보임): 부품 이미지 + 이름 */}
                  <div className={`${styles.flipCardFace} ${isWide ? styles.flipCardFrontWide : styles.flipCardFront}`}>
                    <img
                      src={step.img}
                      alt={step.label}
                      className={isWide ? styles.flipCardImgWide : styles.flipCardImg}
                    />
                    <span className={styles.flipCardFrontName}>{step.label}</span>
                  </div>
                  {/* 뒷면 (처음에 보임): 이름 카드 */}
                  <div className={`${styles.flipCardFace} ${isWide ? styles.flipCardBackWide : styles.flipCardBack}`}>
                    <span className={styles.flipCardBackName}>{step.label}</span>
                    <span className={styles.flipCardTapHint}>눌러서 확인</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.stageFooter}>
        <p className={styles.progressText}>{flipped.size} / {STEPS.length}개 확인</p>
        <button
          className={`${styles.nextBtn} ${!allFlipped ? styles.nextBtnDisabled : ''}`}
          disabled={!allFlipped}
          onClick={onNext}
        >
          다음 단계로 →
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════
   2단계: 선으로 연결하기
══════════════════════════════════ */
function Stage2({ onNext, onBack }) {
  const [imgOrder]  = useState(() => shuffle(STEPS.map(s => s.id)))
  const [nameOrder] = useState(() => shuffle(STEPS.map(s => s.id)))
  const [connections, setConnections] = useState({})     // imgId → nameId
  const [mode, setMode]               = useState('drag') // 'drag' | 'tap'

  // 드래그 모드 상태
  const [dragging, setDragging]     = useState(null)     // { fromId, startX,startY,curX,curY }
  const [wrongFlash, setWrongFlash] = useState(null)     // { x1,y1,x2,y2 }

  // 터치 모드 상태
  const [tapSelected, setTapSelected] = useState(null)   // 선택된 imgId
  const [tapWrong, setTapWrong]       = useState(null)   // 오답 nameId (흔들림)

  const allMatched = Object.keys(connections).length === STEPS.length
  const isDrag = mode === 'drag'

  const containerRef = useRef(null)
  const imgDotRefs   = useRef({})
  const nameDotRefs  = useRef({})

  /** 점의 컨테이너 기준 좌표 반환 */
  function getDotPos(type, id) {
    const el = type === 'img' ? imgDotRefs.current[id] : nameDotRefs.current[id]
    if (!el || !containerRef.current) return null
    const r = el.getBoundingClientRect()
    const c = containerRef.current.getBoundingClientRect()
    return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top }
  }

  /** 정답 연결 처리 (모드 공통) */
  function confirmConnect(imgId) {
    const step = STEPS.find(s => s.id === imgId)
    playCorrectSound()
    if (step) speak(step.label)   // TTS: 부품 이름 읽기
    setConnections(prev => ({ ...prev, [imgId]: imgId }))
  }

  // ── 드래그 모드: 이미지 점 누름 ──
  function handleImgDotPointerDown(e, imgId) {
    if (!isDrag) return
    e.preventDefault(); e.stopPropagation()
    setConnections(prev => { const n = { ...prev }; delete n[imgId]; return n })
    const pos = getDotPos('img', imgId)
    if (!pos) return
    setDragging({ fromId: imgId, startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y })

    function onMove(ev) {
      const cRect = containerRef.current?.getBoundingClientRect()
      if (!cRect) return
      setDragging(prev => prev
        ? { ...prev, curX: ev.clientX - cRect.left, curY: ev.clientY - cRect.top }
        : null)
    }

    function onUp(ev) {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      for (const nameId of Object.keys(nameDotRefs.current)) {
        const el = nameDotRefs.current[nameId]
        if (!el) continue
        const r = el.getBoundingClientRect()
        const hit = ev.clientX >= r.left - 14 && ev.clientX <= r.right  + 14
                 && ev.clientY >= r.top  - 14 && ev.clientY <= r.bottom + 14
        if (hit) {
          if (imgId === nameId) {
            confirmConnect(imgId)
          } else {
            playWrongSound()
            const s = getDotPos('img', imgId)
            const t = getDotPos('name', nameId)
            if (s && t) {
              setWrongFlash({ x1: s.x, y1: s.y, x2: t.x, y2: t.y })
              setTimeout(() => setWrongFlash(null), 500)
            }
          }
          break
        }
      }
      setDragging(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ── 터치 모드: 이미지 카드 탭 ──
  function handleTapImg(imgId) {
    if (isDrag) return
    if (imgId in connections) return
    setTapSelected(s => s === imgId ? null : imgId)
  }

  // ── 터치 모드: 이름 카드 탭 ──
  function handleTapName(nameId) {
    if (isDrag || !tapSelected) return
    if (Object.values(connections).includes(nameId)) return
    if (tapSelected === nameId) {
      confirmConnect(tapSelected)
      setTapSelected(null)
    } else {
      playWrongSound()
      setTapWrong(nameId)
      setTimeout(() => setTapWrong(null), 430)
      setTapSelected(null)
    }
  }

  // ── 모드 전환 ──
  function switchMode() {
    setMode(m => m === 'drag' ? 'tap' : 'drag')
    setDragging(null); setWrongFlash(null)
    setTapSelected(null); setTapWrong(null)
  }

  const selectedStep = tapSelected ? STEPS.find(s => s.id === tapSelected) : null

  return (
    <div className={styles.stagePage}>
      <div className={styles.stageHeader}>
        <button className={styles.backBtn} onClick={onBack}>← 나가기</button>
        <div className={styles.stageTitleBlock}>
          <span className={styles.stageChip}>2단계</span>
          <span className={styles.stageTitle}>이름과 부품 연결하기</span>
        </div>
        <div className={styles.headerSpacer} />
      </div>

      <div className={styles.stageBody}>
        {/* 설명 + 모드 전환 버튼 */}
        <div className={styles.s2DescRow}>
          <p className={styles.stageDesc}>
            {isDrag
              ? '부품 아래 점을 눌러 이름으로 선을 그어보세요!'
              : selectedStep
                ? `"${selectedStep.label}" — 맞는 이름을 눌러보세요!`
                : '부품 카드를 먼저 눌러보세요!'}
          </p>
          <button className={styles.modeToggleBtn} onClick={switchMode}>
            {isDrag ? '터치 방식' : '드래그 방식'}
          </button>
        </div>

        <div ref={containerRef} className={styles.matchingArea}>

          {/* SVG 선 레이어 (드래그 모드만 표시) */}
          {isDrag && (
            <svg className={styles.svgOverlay}>
              {Object.entries(connections).map(([imgId, nameId]) => {
                const s = getDotPos('img', imgId)
                const t = getDotPos('name', nameId)
                if (!s || !t) return null
                return (
                  <line key={imgId}
                    x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    stroke="var(--green)" strokeWidth="3" strokeLinecap="round"
                  />
                )
              })}
              {wrongFlash && (
                <line
                  x1={wrongFlash.x1} y1={wrongFlash.y1}
                  x2={wrongFlash.x2} y2={wrongFlash.y2}
                  stroke="#e76f51" strokeWidth="3" strokeLinecap="round" opacity="0.85"
                />
              )}
              {dragging && (
                <line
                  x1={dragging.startX} y1={dragging.startY}
                  x2={dragging.curX}   y2={dragging.curY}
                  stroke="var(--text-sub)" strokeWidth="2.5"
                  strokeDasharray="8,4" strokeLinecap="round"
                />
              )}
            </svg>
          )}

          {/* ── 이미지 행 ── */}
          <div className={styles.matchImgRow}>
            {imgOrder.map(id => {
              const step = STEPS.find(s => s.id === id)
              const isConnected = id in connections
              const isTapSel = tapSelected === id
              return (
                <div key={id} className={styles.matchCardWrap}>
                  <div
                    className={[
                      styles.matchImgCard2,
                      isConnected ? styles.matchCardDone    : '',
                      isTapSel    ? styles.matchCardTapSel  : '',
                      !isDrag && !isConnected ? styles.matchCardClickable : '',
                    ].join(' ')}
                    onClick={() => handleTapImg(id)}
                  >
                    <img src={step.img} alt={step.label} className={styles.matchImg2} />
                  </div>
                  {/* 점: 항상 렌더(위치 추적), 터치 모드에서 시각적 숨김 */}
                  <div
                    ref={el => { imgDotRefs.current[id] = el }}
                    className={[
                      styles.connDot,
                      isConnected ? styles.connDotDone : styles.connDotImg,
                      !isDrag ? styles.connDotHidden : '',
                    ].join(' ')}
                    onPointerDown={e => handleImgDotPointerDown(e, id)}
                    style={{ touchAction: 'none' }}
                  />
                </div>
              )
            })}
          </div>

          {/* 행 간격 */}
          <div className={isDrag ? styles.linesGap : styles.linesGapTap} />

          {/* ── 이름 행 ── */}
          <div className={styles.matchNameRow}>
            {nameOrder.map(id => {
              const step = STEPS.find(s => s.id === id)
              const isConnected = Object.values(connections).includes(id)
              const isWrong = tapWrong === id
              return (
                <div key={id} className={styles.matchCardWrap}>
                  {/* 점: 항상 렌더(위치 추적), 터치 모드에서 시각적 숨김 */}
                  <div
                    ref={el => { nameDotRefs.current[id] = el }}
                    className={[
                      styles.connDot,
                      isConnected ? styles.connDotDone : styles.connDotName,
                      !isDrag ? styles.connDotHidden : '',
                    ].join(' ')}
                  />
                  <div
                    className={[
                      styles.matchNameCard2,
                      isConnected ? styles.matchCardDone      : '',
                      isWrong     ? styles.matchNameCardWrong : '',
                      !isDrag && !isConnected && tapSelected
                        ? styles.matchCardClickable : '',
                    ].join(' ')}
                    onClick={() => handleTapName(id)}
                  >
                    <span className={styles.matchName2}>{step.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className={styles.stageFooter}>
        <p className={styles.progressText}>{Object.keys(connections).length} / {STEPS.length}개 연결</p>
        <button
          className={`${styles.nextBtn} ${!allMatched ? styles.nextBtnDisabled : ''}`}
          disabled={!allMatched}
          onClick={onNext}
        >
          조립 시작하기 →
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════
   3단계: 직접 해보기 (조립 1개)
══════════════════════════════════ */
function Stage3({ onDone, onBack }) {
  const [activePartId, setActivePartId] = useState(null)
  const activePart = STEPS.find(s => s.id === activePartId) ?? null

  const [step, setStep]             = useState(0)
  const [pensDone, setPensDone]     = useState(0)
  const [assembled, setAssembled]   = useState([])
  const [knockSub, setKnockSub]     = useState(0)
  const [inkSub, setInkSub]         = useState(0)
  const [springSub, setspringSub]   = useState(0)
  const [coneSub, setConeSub]       = useState(0)
  const [penReady, setPenReady]     = useState(false)
  const [done, setDone]             = useState(false)

  // 3단계 진입 1회성 가이드 (1→2→3→0)
  const [tutoStep, setTutoStep] = useState(1)
  const [tutoFading, setTutoFading] = useState(false)
  function advanceTuto() {
    if (tutoFading) return
    setTutoFading(true)
    setTimeout(() => {
      setTutoStep(s => (s >= 3 ? 0 : s + 1))
      setTutoFading(false)
    }, 220)
  }

  const count = 1

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
    setPensDone(n => n + 1)
    setStep(0); setAssembled([]); setPenReady(false)
    setKnockSub(0); setInkSub(0); setspringSub(0); setConeSub(0)
  }, [])

  function handleDragStart({ active }) { setActivePartId(active.id) }

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

  const currentPart = STEPS[step]
  const canSubmit = pensDone >= count

  function hintText() {
    if (penReady) return '완성된 볼펜을 완성 상자에 넣어주세요'
    if (currentPart.id === 'knock' && knockSub === 1) return '노크를 꾹 눌러 완성하세요'
    if (currentPart.id === 'cone'  && coneSub  === 1) return '화살표를 시계 방향으로 5바퀴 돌리세요'
    return currentPart.hint
  }

  return (
    <>
      {done && <TutorialDoneModal onBack={onDone} />}
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={styles.s3Page}>

          {/* 헤더 */}
          <div className={styles.s3TopBar}>
            <button className={styles.backBtn} onClick={onBack}>← 나가기</button>
            <div className={styles.s3TopCenter}>
              <span className={styles.stageChip}>3단계</span>
              <div className={asmStyles.stepDots}>
                {STEPS.map((p, i) => (
                  <div
                    key={p.id}
                    className={`${asmStyles.dot} ${(i < step || penReady) ? asmStyles.dotDone : ''} ${i === step && !penReady ? asmStyles.dotActive : ''}`}
                  />
                ))}
              </div>
            </div>
            <span className={styles.s3PenCount}>{pensDone}/{count}개</span>
          </div>

          {/* 힌트 */}
          <div className={asmStyles.hintBox}>
            <strong>{currentPart.label}</strong> — {hintText()}
          </div>

          {/* 메인 작업 영역 */}
          <div className={asmStyles.mainArea}>
            {/* 부품 트레이 */}
            <div className={`${asmStyles.tray} ${tutoStep === 1 ? styles.tutoHighlight : ''}`}>
              <p className={asmStyles.trayTitle}>부품 트레이</p>
              <div className={asmStyles.trayGrid}>
                {STEPS.map((s, i) => {
                  const isCurrentStep = i === step
                  const isDone = i < step
                  const isPlaced =
                    (s.id === 'knock'     && knockSub >= 1) ||
                    (s.id === 'inkrefill' && inkSub >= 1)   ||
                    (s.id === 'spring'    && springSub >= 1) ||
                    (s.id === 'cone'      && coneSub >= 1)
                  const cnt = (isDone || isPlaced) ? 0 : (count - pensDone)
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

            {/* 작업대 */}
            <div className={`${asmStyles.workbench} ${tutoStep === 2 ? styles.tutoHighlight : ''}`}>
              <p className={asmStyles.workTitle}>작업대</p>
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
                    <div className={asmStyles.assembledRow}>
                      {getAssembledImgs(assembled).map(item => (
                        <img key={item.id} src={item.src} alt={item.alt} className={asmStyles.assembledImg} />
                      ))}
                    </div>
                  )}
                  {assembled.length === 0 && <span className={asmStyles.workDropLabel}>여기에 놓으세요</span>}
                </WorkbenchDrop>
              )}
            </div>
          </div>

          {/* 완성 상자 */}
          <BoxZone
            penReady={penReady}
            pensDone={pensDone}
            count={count}
            className={`${asmStyles.doneAreaSolo} ${tutoStep === 3 ? styles.tutoHighlight : ''}`}
            vertical
          />

          {/* 납품하기 버튼 */}
          <button
            className={`${asmStyles.deliverBtn} ${!canSubmit ? asmStyles.deliverDisabled : ''}`}
            disabled={!canSubmit}
            onClick={() => { playBoxSound(); setDone(true) }}
          >
            {canSubmit ? `튜토리얼 완료하기 (${pensDone}개 완성) →` : `납품하기 (${pensDone}/${count}개)`}
          </button>
        </div>

        {/* 드래그 오버레이 */}
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
            <img
              src={activePart.img}
              alt={activePart.label}
              style={{
                maxHeight: activePart.size === 'lg' ? '64px' : activePart.size === 'xs' ? '32px' : '48px',
                maxWidth: '200px', width: 'auto', height: 'auto', objectFit: 'contain',
                filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.28))',
                pointerEvents: 'none', cursor: 'grabbing', userSelect: 'none',
              }}
            />
          ) : activePartId === 'pen-complete' ? (
            <img
              src="/parts/pen-complete.svg"
              alt="완성된 볼펜"
              style={{
                maxWidth: '200px', width: 'auto', height: 'auto', objectFit: 'contain',
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))',
                pointerEvents: 'none', cursor: 'grabbing', userSelect: 'none',
              }}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── 3단계 진입 가이드 오버레이 (1회) ── */}
      {tutoStep > 0 && (
        <>
          <div
            key={`tuto-overlay-${tutoStep}`}
            className={`${styles.tutoOverlay} ${tutoFading ? styles.tutoFadeOut : ''}`}
            onClick={advanceTuto}
          />
          <div
            key={`tuto-msg-${tutoStep}`}
            className={`${styles.tutoMsg} ${tutoFading ? styles.tutoFadeOut : ''}`}
          >
            <p className={styles.tutoMsgBadge}>{tutoStep} / 3</p>
            <p className={styles.tutoMsgText}>
              {tutoStep === 1
                ? '부품 트레이에서\n부품을 선택하세요'
                : tutoStep === 2
                  ? '부품을\n작업대에 내려놓으세요'
                  : '완성된 볼펜을\n완성 상자에 넣으세요'}
            </p>
            <button
              className={styles.tutoMsgBtn}
              onClick={e => { e.stopPropagation(); advanceTuto() }}
            >
              확인
            </button>
          </div>
        </>
      )}
    </>
  )
}

/* ── 튜토리얼 완료 모달 ── */
function TutorialDoneModal({ onBack }) {
  useEffect(() => { playFanfareSound() }, [])
  return (
    <div className={styles.doneOverlay}>
      <div className={styles.doneModal}>
        <img src="/parts/pen-complete.svg" alt="완성된 볼펜" className={styles.doneModalPen} />
        <h2 className={styles.doneModalTitle}>튜토리얼 완료!</h2>
        <p className={styles.doneModalSub}>볼펜 조립 방법을 배웠어요!</p>
        <p className={styles.doneModalMsg}>이제 혼자서도 만들 수 있어요</p>
        <button className={styles.doneModalBtn} onClick={onBack}>처음으로 돌아가기</button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════
   튜토리얼 메인 (3단계 진행)
══════════════════════════════════ */
export default function Tutorial() {
  const navigate = useNavigate()
  const [stage, setStage] = useState(1)

  if (stage === 1) return <Stage1 onNext={() => setStage(2)} onBack={() => navigate('/')} />
  if (stage === 2) return <Stage2 onNext={() => setStage(3)} onBack={() => navigate('/')} />
  if (stage === 3) return <Stage3 onDone={() => navigate('/')} onBack={() => navigate('/')} />
}
