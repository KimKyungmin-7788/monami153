import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import twoStyles from './TwoPlayer.module.css'
import asmStyles from './Assembly.module.css'

/* ── 캐릭터 정의 ── */
const CHARS = {
  1: { name: '토끼',   img: '/parts/rabbit.svg',   color: 'playerColor1' },
  2: { name: '다람쥐', img: '/parts/squirrel.svg',  color: 'playerColor2' },
}
import {
  STEPS, getAssembledImgs,
  DraggablePart, WorkbenchDrop,
  KnockWorkbench, InkrefillWorkbench, SpringWorkbench, ConeWorkbench,
  PenReadyWorkbench, BoxZone, FailModal,
  playDropSound, playSnapSound, playBoxSound,
} from './AssemblyCore'

/* ── 결과 모달 ── */
function ResultModal({ firstSubmitter, onBack }) {
  const winner = firstSubmitter ? CHARS[firstSubmitter] : null

  return (
    <div className={twoStyles.resultOverlay}>
      <div className={twoStyles.resultModal}>
        {winner && (
          <img src={winner.img} alt={winner.name} className={twoStyles.resultWinChar} />
        )}
        <p className={twoStyles.resultTitle}>승부 결과</p>
        <div className={twoStyles.resultWinner}>
          {winner ? `${winner.name} 승리!` : '무승부'}
        </div>
        <p className={twoStyles.resultSub}>
          {winner ? '먼저 납품을 완료했어요!' : '아무도 납품하지 못했어요'}
        </p>
        <div className={twoStyles.resultRow}>
          {[1, 2].map(num => {
            const ch = CHARS[num]
            const isWinner = firstSubmitter === num
            return (
              <div key={num} className={`${twoStyles.resultPlayer} ${isWinner ? twoStyles.resultPlayerWin : twoStyles.resultPlayerLose}`}>
                <img src={ch.img} alt={ch.name} className={twoStyles.resultCharSm} />
                <span className={twoStyles.resultPlayerName}>{ch.name}</span>
                <span className={`${twoStyles.resultBadge} ${!isWinner ? twoStyles.resultBadgeLose : ''}`}>
                  {isWinner ? '승리' : '패배'}
                </span>
              </div>
            )
          })}
        </div>
        <button className={twoStyles.resultBtn} onClick={onBack}>처음으로</button>
      </div>
    </div>
  )
}

/* ── 개별 플레이어 패널 ── */
function PlayerPanel({ playerNum, count, onSubmit, submitted, timeOver }) {
  const char = CHARS[playerNum]
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

  function remainCount() { return count - pensDone }

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
    setStep(0)
    setAssembled([])
    setPenReady(false)
    setKnockSub(0); setInkSub(0); setspringSub(0); setConeSub(0)
  }, [])

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

  const currentPart = STEPS[step]
  const canSubmit = pensDone >= count

  function hintText() {
    if (penReady) return '완성된 볼펜을 완성 상자에 넣어주세요'
    if (currentPart.id === 'knock' && knockSub === 1) return '노크를 꾹 눌러 완성하세요'
    if (currentPart.id === 'cone' && coneSub === 1) return '화살표를 시계 방향으로 5바퀴 돌리세요'
    return currentPart.hint
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={`${twoStyles.panel} ${submitted ? twoStyles.panelSubmitted : ''}`}>

        {/* 패널 헤더 */}
        <div className={`${twoStyles.panelHeader} ${playerNum === 1 ? twoStyles.header1 : twoStyles.header2}`}>
          <div className={twoStyles.panelLeft}>
            <img src={char.img} alt={char.name} className={twoStyles.playerChar} />
            <span className={`${twoStyles.panelName} ${twoStyles[char.color]}`}>
              {char.name}
            </span>
            <div className={twoStyles.stepDots}>
              {STEPS.map((p, i) => (
                <div
                  key={p.id}
                  className={`${twoStyles.dot} ${(i < step || penReady) ? twoStyles.dotDone : ''} ${i === step && !penReady ? twoStyles.dotActive : ''}`}
                />
              ))}
            </div>
            <span className={twoStyles.penCount}>{pensDone}/{count}개</span>
          </div>
        </div>

        {/* 힌트 */}
        <div className={twoStyles.hintBox}>
          <strong>{currentPart.label}</strong> — {hintText()}
        </div>

        {/* 메인 작업 영역 */}
        <div className={twoStyles.mainArea}>

          {/* 부품 트레이 */}
          <div className={twoStyles.tray}>
            <p className={twoStyles.trayTitle}>부품 트레이</p>
            <div className={twoStyles.trayGrid}>
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
                    disabled={!isCurrentStep || penReady || submitted || timeOver}
                  />
                )
              })}
            </div>
          </div>

          {/* 작업대 */}
          <div className={twoStyles.workbench}>
            <p className={twoStyles.workTitle}>작업대</p>
            {penReady ? (
              <PenReadyWorkbench />
            ) : currentPart.id === 'cone' ? (
              <ConeWorkbench
                assembled={assembled}
                isDraggingCone={activePartId === 'cone'}
                coneSub={coneSub}
                onAdvance={advance}
              />
            ) : currentPart.id === 'knock' ? (
              <KnockWorkbench
                knockSub={knockSub}
                isDraggingKnock={activePartId === 'knock'}
                onAdvance={advance}
              />
            ) : currentPart.id === 'inkrefill' ? (
              <InkrefillWorkbench
                assembled={assembled}
                isDraggingInkrefill={activePartId === 'inkrefill'}
                inkSub={inkSub}
                onAdvance={advance}
              />
            ) : currentPart.id === 'spring' ? (
              <SpringWorkbench
                assembled={assembled}
                isDraggingSpring={activePartId === 'spring'}
                springSub={springSub}
                onAdvance={advance}
              />
            ) : (
              <WorkbenchDrop id="zone-work" label="여기에 놓으세요">
                {assembled.length > 0 && (
                  <div className={asmStyles.assembledRow}>
                    {getAssembledImgs(assembled).map(item => (
                      <img key={item.id} src={item.src} alt={item.alt} className={asmStyles.assembledImg} />
                    ))}
                  </div>
                )}
                {assembled.length === 0 && (
                  <span className={asmStyles.workDropLabel}>여기에 놓으세요</span>
                )}
              </WorkbenchDrop>
            )}
          </div>
        </div>

        {/* 완성 상자 + 납품하기 버튼 (항상 표시, 하단 푸터) */}
        <div className={twoStyles.panelFooter}>
          <BoxZone penReady={penReady} pensDone={pensDone} count={count} />
          <button
            className={`${twoStyles.deliverBtn} ${submitted ? twoStyles.deliverDone : !canSubmit ? twoStyles.deliverDisabled : ''}`}
            disabled={!canSubmit || timeOver || submitted}
            onClick={onSubmit}
          >
            {submitted ? '납품 완료!' : canSubmit ? `납품하기 (${pensDone}개 완성) →` : `납품하기 (${pensDone}/${count}개)`}
          </button>
        </div>

      </div>

      {/* 드래그 오버레이 */}
      <DragOverlay dropAnimation={null}>
        {activePart ? (
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
  )
}

/* ── 둘이서하기 페이지 ── */
export default function TwoPlayer() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { count = 1, time } = state || {}

  const [timeLeft, setTimeLeft] = useState(time ?? null)
  const [timeOver, setTimeOver] = useState(false)
  const [player1Submitted, setPlayer1Submitted] = useState(false)
  const [player2Submitted, setPlayer2Submitted] = useState(false)
  const [firstSubmitter, setFirstSubmitter] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [showFail, setShowFail] = useState(false)
  // PlayerPanel 리마운트용 키 (다시하기 시 초기화)
  const [gameKey, setGameKey] = useState(0)

  // 공유 타이머
  useEffect(() => {
    if (timeLeft === null || timeOver) return
    if (timeLeft <= 0) {
      setTimeOver(true)
      setShowFail(true)   // 시간 초과 → 실패 모달
      return
    }
    const t = setInterval(() => setTimeLeft(v => v - 1), 1000)
    return () => clearInterval(t)
  }, [timeLeft, timeOver])

  function resetGame() {
    setTimeLeft(time ?? null)
    setTimeOver(false)
    setPlayer1Submitted(false)
    setPlayer2Submitted(false)
    setFirstSubmitter(null)
    setShowResult(false)
    setShowFail(false)
    setGameKey(k => k + 1)   // PlayerPanel 리마운트 → 내부 상태 초기화
  }

  function fmt(s) {
    if (s === null) return '∞'
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  function handleSubmit(playerNum) {
    // 먼저 납품한 플레이어 기록
    if (firstSubmitter === null) setFirstSubmitter(playerNum)

    if (playerNum === 1) {
      setPlayer1Submitted(true)
      // 2번이 이미 납품했으면 결과 표시
      if (player2Submitted) setShowResult(true)
    } else {
      setPlayer2Submitted(true)
      // 1번이 이미 납품했으면 결과 표시
      if (player1Submitted) setShowResult(true)
    }
  }

  const timerWarning = timeLeft !== null && timeLeft <= 30

  return (
    <>
      {showResult && (
        <ResultModal
          firstSubmitter={firstSubmitter}
          isTimeout={timeOver}
          onBack={() => navigate('/')}
        />
      )}
      {showFail && (
        <FailModal onRetry={resetGame} onBack={() => navigate('/')} />
      )}

      <div className={twoStyles.page}>

        {/* 공유 상단 바 */}
        <div className={twoStyles.sharedBar}>
          <button className={twoStyles.backBtn} onClick={() => navigate('/')}>← 나가기</button>
          {/* 타이머: 항상 중앙 절대 배치 */}
          <div className={twoStyles.timerBlock}>
            <span className={`${twoStyles.sharedTimer} ${timerWarning ? twoStyles.timerWarning : ''}`}>
              {fmt(timeLeft)}
            </span>
            <span className={twoStyles.sharedTimerLabel}>남은 시간</span>
          </div>
          <span className={twoStyles.sharedTitle}>둘이서하기</span>
        </div>

        {/* 두 플레이어 패널 */}
        <div className={twoStyles.panels}>
          <PlayerPanel
            key={`p1-${gameKey}`}
            playerNum={1}
            count={count}
            onSubmit={() => handleSubmit(1)}
            submitted={player1Submitted}
            timeOver={timeOver}
          />
          <PlayerPanel
            key={`p2-${gameKey}`}
            playerNum={2}
            count={count}
            onSubmit={() => handleSubmit(2)}
            submitted={player2Submitted}
            timeOver={timeOver}
          />
        </div>

      </div>
    </>
  )
}
