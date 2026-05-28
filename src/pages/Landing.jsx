import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Landing.module.css'

const COUNT_OPTIONS = [
  { value: 1, label: '1개' },
  { value: 3, label: '3개' },
  { value: 5, label: '5개' },
  { value: 'custom', label: '수동입력' },
]

const TIME_OPTIONS = [
  { value: 60, label: '1분' },
  { value: 180, label: '3분' },
  { value: 300, label: '5분' },
  { value: null, label: '무제한' },
  { value: 'custom', label: '수동입력' },
]

export default function Landing() {
  const navigate = useNavigate()
  const [mode, setMode] = useState(null)
  const [selectedCount, setSelectedCount] = useState(1)
  const [customCount, setCustomCount] = useState('')
  const [selectedTime, setSelectedTime] = useState(60)
  const [customTime, setCustomTime] = useState('')

  const canStart = mode !== null

  function handleStart() {
    if (!canStart) return
    const count =
      selectedCount === 'custom' ? Math.max(1, parseInt(customCount) || 1) : selectedCount
    const time =
      selectedTime === 'custom'
        ? Math.max(1, parseInt(customTime) || 1) * 60
        : selectedTime
    // 둘이서하기는 /two-player로, 혼자하기는 /assembly로
    const path = mode === 'duo' ? '/two-player' : '/assembly'
    navigate(path, { state: { mode, count, time } })
  }

  return (
    <div className={styles.page}>
      <div className={styles.blob} />

      <div className={styles.inner}>
        {/* 타이틀 */}
        <div className={styles.titleBox}>
          <div className={styles.titleContent}>
            <img src="/brand-logo.svg" alt="저요저요 Me! Me!" className={styles.brandLogo} />
            <h1 className={styles.titleMain}>모나미 볼펜 조립</h1>
          </div>
        </div>

        {/* 튜토리얼 */}
        <button className={styles.tutorialBtn} onClick={() => navigate('/tutorial')}>
          튜토리얼 시작하기
        </button>

        {/* 모드 선택 */}
        <div className={styles.modeGrid}>
          <button
            className={`${styles.modeCard} ${styles.mintCard} ${mode === 'solo' ? styles.modeSelected : ''}`}
            onClick={() => setMode('solo')}
          >
            <div className={styles.characterArea}>
              <img src="/parts/rabbit.svg" alt="토끼" className={styles.character} />
            </div>
            <span className={styles.modeLabel}>혼자하기</span>
          </button>
          <button
            className={`${styles.modeCard} ${styles.pinkCard} ${mode === 'duo' ? styles.modeSelected : ''}`}
            onClick={() => setMode('duo')}
          >
            <div className={styles.characterArea}>
              <img src="/parts/rabbit.svg" alt="토끼" className={styles.characterSm} />
              <img src="/parts/squirrel.svg" alt="다람쥐" className={styles.characterSm} />
            </div>
            <span className={styles.modeLabel}>둘이서하기</span>
          </button>
        </div>

        {/* 조립 개수 */}
        <div className={styles.optionRow}>
          <span className={styles.optionLabel}>조립 개수</span>
          <div className={styles.chipGroup}>
            {COUNT_OPTIONS.map(({ value, label }) => {
              const isCustom = value === 'custom'
              const isSelected = selectedCount === value

              if (isCustom && isSelected) {
                return (
                  <input
                    key="custom-count"
                    type="number"
                    min="1"
                    max="30"
                    autoFocus
                    className={styles.inlineInput}
                    placeholder="개수"
                    value={customCount}
                    onChange={(e) => setCustomCount(e.target.value)}
                  />
                )
              }
              return (
                <button
                  key={label}
                  className={`${styles.chip} ${isSelected ? styles.chipOn : ''}`}
                  onClick={() => setSelectedCount(value)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 제한시간 */}
        <div className={styles.optionRow}>
          <span className={styles.optionLabel}>제한시간</span>
          <div className={styles.chipGroup}>
            {TIME_OPTIONS.map(({ value, label }) => {
              const isCustom = value === 'custom'
              const isSelected = selectedTime === value

              if (isCustom && isSelected) {
                return (
                  <input
                    key="custom-time"
                    type="number"
                    min="1"
                    autoFocus
                    className={styles.inlineInput}
                    placeholder="분"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                  />
                )
              }
              return (
                <button
                  key={label}
                  className={`${styles.chip} ${isSelected ? styles.chipOn : ''}`}
                  onClick={() => setSelectedTime(value)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 시작 버튼 */}
        <button
          className={`${styles.startBtn} ${!canStart ? styles.startDisabled : ''}`}
          onClick={handleStart}
          disabled={!canStart}
        >
          {canStart ? '조립 시작하기  →' : '모드를 선택해주세요'}
        </button>
      </div>
    </div>
  )
}
