import { useState, useEffect, useCallback } from 'react'
import './exam-source.css'
import './styles/exam-responsive.css'
import { API_BASE, authHeaders } from './services/api'

// ─── Data ─────────────────────────────────────────────────────────────────────

const questions = [
  // PART I — Multiple Choice
  {
    id: 1, part: 'I', partLabel: 'PART I: Multiple Choice',
    type: 'multiple-choice',
    text: 'What is the capital municipality of Camarines Norte?',
    options: ['Labo', 'Daet', 'Vinzons', 'Paracale'], correctAnswer: 1,
  },
  {
    id: 2, part: 'I', partLabel: 'PART I: Multiple Choice',
    type: 'multiple-choice',
    text: 'Camarines Norte holds the distinction of erecting the very first monument honoring Dr. Jose Rizal in 1898. In which municipality is this monument located?',
    options: ['Jose Panganiban', 'Vinzons', 'Daet', 'Basud'], correctAnswer: 2,
  },
  {
    id: 3, part: 'I', partLabel: 'PART I: Multiple Choice',
    type: 'multiple-choice',
    text: 'Which municipality is famous for its world-class Calaguas Islands featuring powdery white sand beaches?',
    options: ['Mercedes', 'Vinzons', 'Talisay', 'Capalonga'], correctAnswer: 1,
  },
  {
    id: 4, part: 'I', partLabel: 'PART I: Multiple Choice',
    text: 'Known as the "Gold Country of Camarines Norte," which town has been historical for gold mining and traditional jewelry making since the pre-Spanish period?',
    type: 'multiple-choice',
    options: ['Paracale', 'Santa Elena', 'San Vicente', 'Basud'], correctAnswer: 0,
  },
  {
    id: 5, part: 'I', partLabel: 'PART I: Multiple Choice',
    type: 'multiple-choice',
    text: 'Which municipality in Camarines Norte is the largest in terms of total land area and most populous?',
    options: ['Daet', 'Labo', 'Jose Panganiban', 'Basud'], correctAnswer: 1,
  },
  {
    id: 6, part: 'I', partLabel: 'PART I: Multiple Choice',
    type: 'multiple-choice',
    text: 'What major annual festival celebrated in Daet highlights the province\'s famous sweet Formosa pineapple?',
    options: ['Palong Festival', 'Rahugan Festival', 'Pinyasan Festival', 'Busig-On Festival'], correctAnswer: 2,
  },
  {
    id: 7, part: 'I', partLabel: 'PART I: Multiple Choice',
    type: 'multiple-choice',
    text: 'Wenceslao Q. Vinzons, a prominent native hero of Camarines Norte, was famous for leading which movement during World War II?',
    options: [
      'The Philippine Propaganda Movement',
      'Local guerrilla resistance against Japanese forces',
      'The Katipunan revolt against Spanish rule',
      'The Peace Commission during the American era',
    ], correctAnswer: 1,
  },
  {
    id: 8, part: 'I', partLabel: 'PART I: Multiple Choice',
    type: 'multiple-choice',
    text: 'Which island group located in the municipality of Mercedes is known for its major commercial fishing hub and cluster of seven islands?',
    options: [
      'Calaguas Group of Islands',
      'Mercedes Group of Islands',
      'Maculabo Islands',
      'Quinapaguian Islands',
    ], correctAnswer: 1,
  },
  // PART II — Identification
  {
    id: 9, part: 'II', partLabel: 'PART II: Identification',
    type: 'identification',
    text: 'The highest peak in Camarines Norte, standing at 1,544 meters above sea level.',
  },
  {
    id: 10, part: 'II', partLabel: 'PART II: Identification',
    type: 'identification',
    text: 'The historic Spanish-era province that merged both Camarines Norte and Camarines Sur before their final legislative division in March 1919.',
  },
  {
    id: 11, part: 'II', partLabel: 'PART II: Identification',
    type: 'identification',
    text: 'The municipality known for attracting thousands of pilgrims and tourists every May for the feast day of the Black Nazarene.',
  },
  {
    id: 12, part: 'II', partLabel: 'PART II: Identification',
    type: 'identification',
    text: 'The municipality formerly named Mambulao, which was renamed in honor of a Bicolano hero and patriot who contributed to the Propaganda Movement.',
  },
  // PART III — True or False
  {
    id: 13, part: 'III', partLabel: 'PART III: True or False',
    type: 'true-false',
    text: 'Camarines Norte is geographically bounded by Quezon Province to the west and Camarines Sur to the south.',
  },
  {
    id: 14, part: 'III', partLabel: 'PART III: True or False',
    type: 'true-false',
    text: 'The coastal town of Bagasbas in Daet is widely recognized as a popular destination for surfing.',
  },
  {
    id: 15, part: 'III', partLabel: 'PART III: True or False',
    type: 'true-false',
    text: 'There are a total of 16 municipalities in the province of Camarines Norte.',
  },
  // PART IV — Essay
  {
    id: 16, part: 'IV', partLabel: 'PART IV: Essay',
    type: 'essay',
    text: 'Essay Question (5 Points)',
    essayPrompt: 'Explain why Camarines Norte is called the "Gateway to Bicolandia." Discuss how its geographic location, history, and cultural influences shape its unique identity compared to other provinces in the Bicol Region.',
  },
]

const TOTAL = questions.length

// ─── Timer hook ───────────────────────────────────────────────────────────────

function useTimer(initialSeconds) {
  const [seconds, setSeconds] = useState(initialSeconds)
  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => setSeconds(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [seconds])
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  return { display: `${mins}:${secs}`, seconds }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function ClockIcon({ warning }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={warning ? '#E5A259' : '#A7D9BF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

// ─── Submit Modal ─────────────────────────────────────────────────────────────

function SubmitModal({ answered, total, onConfirm, onCancel }) {
  const unanswered = total - answered
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-7 py-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E8F7EF' }}>
              <SendIcon />
            </div>
            <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Outfit, sans-serif' }}>Submit Examination?</h2>
          </div>
          <p className="text-sm text-gray-500 mt-2">Please review before submitting. This action cannot be undone.</p>
        </div>
        <div className="px-7 py-5">
          <div className="flex gap-4 mb-5">
            <div className="flex-1 rounded-xl p-4 text-center" style={{ backgroundColor: '#E8F7EF', border: '1px solid #A7D9BF' }}>
              <div className="text-2xl font-bold" style={{ color: '#008B47', fontFamily: 'Outfit, sans-serif' }}>{answered}</div>
              <div className="text-xs text-gray-500 mt-0.5 font-medium">Answered</div>
            </div>
            <div className="flex-1 rounded-xl p-4 text-center" style={{ backgroundColor: unanswered > 0 ? '#FFF2E2' : '#F3F8F5', border: `1px solid ${unanswered > 0 ? '#E5A259' : '#D1D5DB'}` }}>
              <div className="text-2xl font-bold" style={{ color: unanswered > 0 ? '#7A4B1A' : '#6B7280', fontFamily: 'Outfit, sans-serif' }}>{unanswered}</div>
              <div className="text-xs text-gray-500 mt-0.5 font-medium">Unanswered</div>
            </div>
          </div>
          {unanswered > 0 && (
            <div className="rounded-lg px-4 py-3 mb-4 text-sm" style={{ backgroundColor: '#FFF2E2', border: '1px solid #E5A259', color: '#7A4B1A' }}>
              ⚠ You have <strong>{unanswered}</strong> unanswered item{unanswered > 1 ? 's' : ''}. Unanswered items will receive no credit.
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-gray-50"
              style={{ borderColor: '#D1D5DB', color: '#374151', fontFamily: 'Outfit, sans-serif' }}
            >
              Review Answers
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: '#10A352', fontFamily: 'Outfit, sans-serif' }}
            >
              Submit Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ alreadySubmitted = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: '#F3F8F5' }}>
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ backgroundColor: '#10A352' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#008B47', fontFamily: 'Outfit, sans-serif' }}>{alreadySubmitted ? 'Examination Completed' : 'Exam Submitted!'}</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-2">{alreadySubmitted ? 'This examination has already been submitted.' : 'Your examination has been successfully submitted.'}</p>
        <p className="text-gray-400 text-xs">PGCEAP Qualifying Examination · A.Y. 2026–2027</p>
        <div className="mt-8 px-6 py-4 rounded-2xl" style={{ backgroundColor: '#E8F7EF', border: '1px solid #A7D9BF' }}>
          <p className="text-sm font-semibold" style={{ color: '#008B47', fontFamily: 'Outfit, sans-serif' }}>Thank you for taking the examination.</p>
          <p className="text-xs text-gray-500 mt-1">Results will be released by the LGU Scholarship Office.</p>
        </div>
        <a href="/applicant-dashboard" className="inline-flex items-center justify-center mt-5 px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#008B47', fontFamily: 'Outfit, sans-serif' }}>Return to applicant dashboard</a>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App({ token }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [mcAnswers, setMcAnswers] = useState({})
  const [idAnswers, setIdAnswers] = useState({})
  const [tfAnswers, setTfAnswers] = useState({})
  const [essayAnswer, setEssayAnswer] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [checkingSubmission, setCheckingSubmission] = useState(true)
  const { display: timeDisplay, seconds } = useTimer(44 * 60 + 12)
  const timerWarning = seconds < 5 * 60

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/applications/me`, { headers: authHeaders(token) })
      .then(response => response.ok ? response.json() : null)
      .then(body => {
        if (active && body?.examination?.completed) setAlreadySubmitted(true)
      })
      .catch(() => {})
      .finally(() => { if (active) setCheckingSubmission(false) })
    return () => { active = false }
  }, [token])

  const isAnswered = useCallback((q) => {
    if (q.type === 'multiple-choice') return mcAnswers[q.id] !== undefined
    if (q.type === 'identification') return (idAnswers[q.id] ?? '').trim().length > 0
    if (q.type === 'true-false') return tfAnswers[q.id] !== undefined
    if (q.type === 'essay') return essayAnswer.trim().length > 0
    return false
  }, [mcAnswers, idAnswers, tfAnswers, essayAnswer])

  const answeredCount = questions.filter(q => isAnswered(q)).length

  const current = questions[activeIndex]
  const partLabel = current.partLabel

  const letterOf = (i) => ['A', 'B', 'C', 'D'][i]

  // ── Navigator button state
  const navState = (q) => {
    if (q.id === current.id) return 'active'
    if (isAnswered(q)) return 'answered'
    return 'unanswered'
  }

  const handleSubmit = async () => {
    const score = questions.reduce((total, question) => {
      if (question.type === 'multiple-choice') return total + (mcAnswers[question.id] === question.correctAnswer ? 1 : 0)
      if (question.type === 'true-false') return total + (tfAnswers[question.id] === (question.id === 15 ? 'FALSE' : 'TRUE') ? 1 : 0)
      if (question.type === 'identification') return total + ((idAnswers[question.id] || '').trim() ? 1 : 0)
      return total + (essayAnswer.trim() ? 5 : 0)
    }, 0)
    const response = await fetch(`${API_BASE}/applications/me/exam-result`, { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ score }) })
    if (!response.ok) {
      if (response.status === 409) {
        setShowModal(false)
        setAlreadySubmitted(true)
      }
      return
    }
    setShowModal(false)
    setSubmitted(true)
  }

  if (checkingSubmission) return <div className="fixed inset-0 flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: '#F3F8F5', color: '#008B47', fontFamily: 'Outfit, sans-serif' }}>Checking examination status…</div>
  if (submitted || alreadySubmitted) return <SuccessScreen alreadySubmitted={alreadySubmitted} />

  return (
    <div className="exam-taking-page flex flex-col" style={{ height: '100vh', fontFamily: 'Inter, sans-serif', backgroundColor: '#F3F8F5' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="exam-taking-header flex items-center justify-between px-6 py-0 shrink-0" style={{ backgroundColor: '#008B47', height: '62px' }}>
        <div className="exam-taking-brand flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <ShieldIcon />
          </div>
          <div>
            <div className="text-white text-xs font-semibold tracking-widest uppercase opacity-70" style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '0.1em' }}>
              LOCAL GOVERNMENT UNIT
            </div>
            <div className="text-white text-sm font-bold leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Scholarship Monitoring System
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Exam badge */}
          <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#E8F7EF', fontFamily: 'Outfit, sans-serif' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse inline-block" />
            PGCEAP Qualifying Examination — A.Y. 2026–2027
          </div>

          {/* Timer */}
          <div
            className="exam-timer flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              backgroundColor: timerWarning ? '#FFF2E2' : 'rgba(255,255,255,0.12)',
              color: timerWarning ? '#7A4B1A' : 'white',
              border: timerWarning ? '1px solid #E5A259' : '1px solid rgba(255,255,255,0.2)',
              fontFamily: 'Outfit, sans-serif',
              minWidth: '120px',
            }}
          >
            <ClockIcon warning={timerWarning} />
            <span className="text-xs font-medium opacity-70">Time Remaining</span>
            <span className="font-bold tabular-nums">{timeDisplay}</span>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="exam-taking-body flex flex-1 overflow-hidden gap-4 p-4">

        {/* ── Left Panel ──────────────────────────────────────────────────── */}
        <aside className="exam-taking-sidebar flex flex-col gap-3 overflow-y-auto shrink-0" style={{ width: '300px' }}>

          {/* Progress Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: '1px solid #D6EDE3' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#008B47', fontFamily: 'Outfit, sans-serif' }}>Progress</span>
              <span className="text-xs font-semibold" style={{ color: '#10A352', fontFamily: 'Outfit, sans-serif' }}>
                {answeredCount} / {TOTAL}
              </span>
            </div>
            <div className="w-full rounded-full h-2.5 mb-2" style={{ backgroundColor: '#E8F7EF' }}>
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${(answeredCount / TOTAL) * 100}%`, backgroundColor: '#10A352' }}
              />
            </div>
            <div className="text-xs text-gray-400">{Math.round((answeredCount / TOTAL) * 100)}% completed</div>
          </div>

          {/* Question Grid */}
          <div className="bg-white rounded-2xl p-4 shadow-sm flex-1" style={{ border: '1px solid #D6EDE3' }}>
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#008B47', fontFamily: 'Outfit, sans-serif' }}>
              Question Navigator
            </div>
            <div className="grid grid-cols-4 gap-2">
              {questions.map(q => {
                const state = navState(q)
                const isActive = state === 'active'
                const isAnsw = state === 'answered'
                return (
                  <button
                    key={q.id}
                    onClick={() => setActiveIndex(q.id - 1)}
                    className="relative rounded-xl font-bold text-sm transition-all duration-150 hover:scale-105 active:scale-95 flex flex-col items-center justify-center"
                    style={{
                      height: '52px',
                      backgroundColor: isActive ? '#10A352' : isAnsw ? '#E8F7EF' : '#FFFFFF',
                      color: isActive ? '#FFFFFF' : isAnsw ? '#008B47' : '#9CA3AF',
                      border: isActive
                        ? '2px solid #008B47'
                        : isAnsw
                        ? '1.5px solid #A7D9BF'
                        : '1.5px solid #E5E7EB',
                      fontFamily: 'Outfit, sans-serif',
                      boxShadow: isActive ? '0 4px 12px rgba(16,163,82,0.3)' : 'none',
                    }}
                  >
                    <span>{q.id}</span>
                    {isAnsw && (
                      <span className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10A352' }} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-1.5 mt-4 pt-4" style={{ borderTop: '1px solid #F0F0F0' }}>
              {[
                { color: '#10A352', border: '#008B47', label: 'Active (Current)' },
                { color: '#E8F7EF', border: '#A7D9BF', label: 'Answered', textColor: '#008B47' },
                { color: '#FFFFFF', border: '#E5E7EB', label: 'Unanswered', textColor: '#9CA3AF' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md flex-shrink-0" style={{ backgroundColor: item.color, border: `1.5px solid ${item.border}` }} />
                  <span className="text-xs text-gray-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info Banner */}
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: '#FFF2E2', border: '1px solid #E5A259' }}>
            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5">📋</span>
              <div>
                <div className="text-xs font-bold mb-1" style={{ color: '#7A4B1A', fontFamily: 'Outfit, sans-serif' }}>EXAMINATION REMINDERS</div>
                <ul className="text-xs leading-relaxed space-y-1" style={{ color: '#7A4B1A' }}>
                  <li>• Read each question carefully.</li>
                  <li>• All items must be answered.</li>
                  <li>• No returning after submission.</li>
                  <li>• Essay minimum: 150 words.</li>
                </ul>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main className="exam-taking-main flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">

            {/* Part header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1" style={{ backgroundColor: '#D6EDE3' }} />
              <span className="text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full" style={{ color: '#008B47', backgroundColor: '#E8F7EF', fontFamily: 'Outfit, sans-serif' }}>
                {partLabel}
              </span>
              <div className="h-px flex-1" style={{ backgroundColor: '#D6EDE3' }} />
            </div>

            {/* Question Card */}
            <div className="exam-question-card bg-white rounded-2xl shadow-sm mb-4" style={{ border: '1px solid #D6EDE3' }}>
              {/* Question header */}
              <div className="exam-question-card-header flex items-start gap-4 px-6 pt-6 pb-5" style={{ borderBottom: '1px solid #F3F8F5' }}>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: '#10A352', color: 'white', fontFamily: 'Outfit, sans-serif', marginTop: '2px' }}
                >
                  {current.id}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold mb-1.5" style={{ color: '#10A352', fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Item {current.id} of {TOTAL} &nbsp;·&nbsp; {current.type === 'multiple-choice' ? '1 point' : current.type === 'essay' ? '5 points' : '1 point'}
                  </div>
                  {current.essayPrompt ? (
                    <>
                      <p className="text-gray-800 font-semibold leading-relaxed text-base" style={{ color: '#2D3748' }}>{current.text}</p>
                      <div className="mt-3 p-4 rounded-xl text-sm leading-relaxed" style={{ backgroundColor: '#F3F8F5', color: '#374151', border: '1px solid #D6EDE3' }}>
                        <span className="font-bold text-xs uppercase tracking-wider" style={{ color: '#008B47', fontFamily: 'Outfit, sans-serif' }}>Prompt: </span>
                        {current.essayPrompt}
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-800 font-semibold leading-relaxed text-base" style={{ color: '#2D3748' }}>{current.text}</p>
                  )}
                </div>
              </div>

              {/* Answer area */}
              <div className="exam-answer-area px-6 py-5">

                {/* Multiple Choice */}
                {current.type === 'multiple-choice' && current.options && (
                  <div className="flex flex-col gap-2.5">
                    {current.options.map((opt, i) => {
                      const selected = mcAnswers[current.id] === i
                      return (
                        <button
                          key={i}
                          onClick={() => setMcAnswers(prev => ({ ...prev, [current.id]: i }))}
                          className="flex items-center gap-4 w-full text-left px-5 py-3.5 rounded-xl transition-all duration-150 hover:shadow-sm group"
                          style={{
                            backgroundColor: selected ? '#E8F7EF' : '#FAFAFA',
                            border: selected ? '2px solid #10A352' : '1.5px solid #E5E7EB',
                            color: selected ? '#2D3748' : '#4B5563',
                          }}
                        >
                          {/* Radio */}
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all"
                            style={{
                              border: selected ? '2px solid #10A352' : '2px solid #D1D5DB',
                              backgroundColor: selected ? '#10A352' : 'white',
                            }}
                          >
                            {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className="font-bold text-xs shrink-0" style={{ color: selected ? '#10A352' : '#9CA3AF', fontFamily: 'Outfit, sans-serif', minWidth: '16px' }}>
                            {letterOf(i)}.
                          </span>
                          <span className="text-sm font-medium flex-1">{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Identification */}
                {current.type === 'identification' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#008B47', fontFamily: 'Outfit, sans-serif' }}>
                      Your Answer
                    </label>
                    <input
                      type="text"
                      value={idAnswers[current.id] ?? ''}
                      onChange={e => setIdAnswers(prev => ({ ...prev, [current.id]: e.target.value }))}
                      placeholder="Type your answer here..."
                      className="w-full px-5 py-3.5 rounded-xl text-sm transition-all outline-none"
                      style={{
                        border: `2px solid ${(idAnswers[current.id] ?? '').trim() ? '#10A352' : '#E5E7EB'}`,
                        backgroundColor: (idAnswers[current.id] ?? '').trim() ? '#E8F7EF' : '#FAFAFA',
                        color: '#2D3748',
                        fontFamily: 'Inter, sans-serif',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#10A352'; e.target.style.boxShadow = '0 0 0 3px rgba(16,163,82,0.12)' }}
                      onBlur={e => {
                        e.target.style.borderColor = (idAnswers[current.id] ?? '').trim() ? '#10A352' : '#E5E7EB'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                )}

                {/* True or False */}
                {current.type === 'true-false' && (
                  <div className="flex gap-4">
                    {(['TRUE', 'FALSE']).map(val => {
                      const selected = tfAnswers[current.id] === val
                      return (
                        <button
                          key={val}
                          onClick={() => setTfAnswers(prev => ({ ...prev, [current.id]: val }))}
                          className="flex-1 py-5 rounded-2xl text-sm font-bold tracking-wider uppercase transition-all duration-150 hover:shadow-md active:scale-95"
                          style={{
                            backgroundColor: selected ? (val === 'TRUE' ? '#10A352' : '#EF4444') : '#FAFAFA',
                            color: selected ? 'white' : '#9CA3AF',
                            border: selected
                              ? `2px solid ${val === 'TRUE' ? '#008B47' : '#DC2626'}`
                              : '1.5px solid #E5E7EB',
                            fontFamily: 'Outfit, sans-serif',
                            letterSpacing: '0.08em',
                            boxShadow: selected ? `0 4px 14px rgba(${val === 'TRUE' ? '16,163,82' : '239,68,68'},0.3)` : 'none',
                          }}
                        >
                          {val === 'TRUE' ? '✓ TRUE' : '✗ FALSE'}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Essay */}
                {current.type === 'essay' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#008B47', fontFamily: 'Outfit, sans-serif' }}>
                        Your Essay Response
                      </label>
                      <span className="text-xs" style={{ color: essayAnswer.trim().split(/\s+/).filter(Boolean).length >= 150 ? '#10A352' : '#9CA3AF' }}>
                        {essayAnswer.trim().split(/\s+/).filter(Boolean).length} / 150 words minimum
                      </span>
                    </div>
                    <textarea
                      value={essayAnswer}
                      onChange={e => setEssayAnswer(e.target.value)}
                      placeholder="Write your essay here. Aim for at least 150 words. Discuss geographic location, historical significance, and cultural identity..."
                      rows={10}
                      className="w-full px-5 py-4 rounded-xl text-sm resize-none transition-all outline-none leading-relaxed"
                      style={{
                        border: `2px solid ${essayAnswer.trim() ? '#10A352' : '#E5E7EB'}`,
                        backgroundColor: essayAnswer.trim() ? '#F7FDF9' : '#FAFAFA',
                        color: '#2D3748',
                        fontFamily: 'Inter, sans-serif',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#10A352'; e.target.style.boxShadow = '0 0 0 3px rgba(16,163,82,0.12)' }}
                      onBlur={e => {
                        e.target.style.borderColor = essayAnswer.trim() ? '#10A352' : '#E5E7EB'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                    {essayAnswer.trim().split(/\s+/).filter(Boolean).length >= 150 && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: '#10A352' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Word count requirement met.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Bottom Action Bar ──────────────────────────────────────────── */}
          <div
            className="exam-action-bar flex items-center justify-between pt-3 mt-auto shrink-0"
            style={{ borderTop: '1px solid #D6EDE3' }}
          >
            <button
              onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
              disabled={activeIndex === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ border: '1.5px solid #A7D9BF', color: '#008B47', fontFamily: 'Outfit, sans-serif', backgroundColor: 'transparent' }}
            >
              <ChevronLeft /> Previous
            </button>

            <div className="exam-action-dots flex items-center gap-1.5">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className="transition-all"
                  style={{
                    width: i === activeIndex ? '20px' : '6px',
                    height: '6px',
                    borderRadius: '3px',
                    backgroundColor: i === activeIndex ? '#10A352' : '#A7D9BF',
                  }}
                />
              ))}
            </div>

            <div className="exam-action-primary flex items-center gap-3">
              {activeIndex < TOTAL - 1 ? (
                <button
                  onClick={() => setActiveIndex(i => Math.min(TOTAL - 1, i + 1))}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: '#10A352', color: 'white', fontFamily: 'Outfit, sans-serif' }}
                >
                  Next <ChevronRight />
                </button>
              ) : (
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95 shadow-md"
                  style={{ backgroundColor: '#10A352', color: 'white', fontFamily: 'Outfit, sans-serif', boxShadow: '0 4px 14px rgba(16,163,82,0.35)' }}
                >
                  <SendIcon /> Submit Examination
                </button>
              )}
              {activeIndex < TOTAL - 1 && (
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{ border: '1.5px solid #10A352', color: '#10A352', fontFamily: 'Outfit, sans-serif', backgroundColor: 'transparent' }}
                >
                  <SendIcon /> Submit
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      {showModal && (
        <SubmitModal
          answered={answeredCount}
          total={TOTAL}
          onConfirm={handleSubmit}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
