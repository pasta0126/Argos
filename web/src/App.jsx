import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import GitHubLink from './components/GitHubLink'
import HealthBadge from './components/HealthBadge'
import PayloadPanel from './components/PayloadPanel'
import ResultView from './components/ResultView'
import Stepper, { STEPS } from './components/Stepper'
import { useHealth } from './hooks'
import { explainError, request as apiRequest, requestWithRetry } from './lib/api'
import { buildRequest, emptyDraft } from './lib/draft'
import { forgetKey, loadKey, maskKey, saveKey } from './lib/keyStore'
import { draftReducer } from './lib/reducer'
import { validate } from './lib/validate'
import KeyStep from './steps/KeyStep'
import ModeStep from './steps/ModeStep'
import OptionsStep from './steps/OptionsStep'
import QuestionsStep from './steps/QuestionsStep'
import ReviewStep from './steps/ReviewStep'
import TextStep from './steps/TextStep'

const stepIndex = (key) => STEPS.findIndex((s) => s.key === key)
const IDLE = { phase: 'idle' }

export default function App() {
  const health = useHealth()
  const stored = useMemo(() => loadKey(), [])

  const [key, setKey] = useState(null) // verified key
  const [remember, setRemember] = useState(stored?.remember ?? false)
  const [keyCheck, setKeyCheck] = useState({ checking: stored != null, error: null })
  const [presets, setPresets] = useState(null)

  const [draft, dispatch] = useReducer(draftReducer, undefined, emptyDraft)
  const [step, setStep] = useState(0)
  const [view, setView] = useState('wizard') // 'wizard' | 'result'
  const [attempted, setAttempted] = useState(() => new Set())
  const [focusQid, setFocusQid] = useState(null)
  const [run, setRun] = useState(IDLE)
  const [toast, setToast] = useState(null)
  const abortRef = useRef(null)
  const toastTimer = useRef(null)

  const errors = useMemo(() => validate(draft), [draft])
  const request = useMemo(() => buildRequest(draft), [draft])
  const errorsOf = useCallback((k) => errors.filter((e) => e.step === k), [errors])
  const showErrors = useCallback((k) => attempted.has(k) || STEPS[step]?.key === 'review', [attempted, step])

  const say = (text) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  // Applies the result of checking a key with GET /v1/presets (cheap, works while the model loads).
  const applyKeyCheck = useCallback((res, candidate, rememberIt) => {
    if (res.ok) {
      saveKey(candidate, rememberIt)
      setKey(candidate)
      setRemember(rememberIt)
      setPresets(res.data.presets)
      setKeyCheck({ checking: false, error: null })
      setStep((s) => (s === 0 ? 1 : s))
      return
    }
    const explained = explainError(res)
    const error =
      res.status === 401 ? 'Esta clave no es válida. Revisa que la has copiado entera.' : `${explained.title}. ${explained.detail}`
    setKeyCheck({ checking: false, error })
  }, [])

  const verifyKey = async (candidate, rememberIt) => {
    setKeyCheck({ checking: true, error: null })
    applyKeyCheck(await apiRequest({ path: '/v1/presets', key: candidate }), candidate, rememberIt)
  }

  // A key kept in this browser is checked on load (keyCheck starts as "checking").
  useEffect(() => {
    if (!stored) return
    let alive = true
    apiRequest({ path: '/v1/presets', key: stored.key }).then((res) => alive && applyKeyCheck(res, stored.key, stored.remember))
    return () => {
      alive = false
    }
  }, [stored, applyKeyCheck])

  const forget = () => {
    forgetKey()
    setKey(null)
    setPresets(null)
    setView('wizard')
    setStep(0)
    say('Clave olvidada en este navegador')
  }

  const reachable = (i) => {
    if (i <= step || i === 0) return true
    if (!key) return false
    return STEPS.slice(1, i).every((s) => errorsOf(s.key).length === 0)
  }

  const go = (i) => {
    setView('wizard')
    setStep(i)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Logo and title: back to the start (mode step, or the key step without a key). The draft is kept.
  const goHome = () => {
    if (run.phase === 'running' || run.phase === 'waiting') abortRef.current?.abort()
    setRun(IDLE)
    go(key ? stepIndex('mode') : 0)
  }

  const next = () => {
    const k = STEPS[step].key
    if (errorsOf(k).length) {
      setAttempted((a) => new Set(a).add(k))
      return
    }
    go(step + 1)
  }

  const goToQuestion = (qid) => {
    setAttempted((a) => new Set(a).add('questions'))
    go(stepIndex('questions'))
    setFocusQid({ id: qid, at: Date.now() })
  }

  const send = async () => {
    if (errors.length) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const req = buildRequest(draft)
    const startedAt = Date.now()
    setRun({ phase: 'running', request: req, startedAt, attempt: 1 })
    try {
      const res = await requestWithRetry(
        { ...req, key, signal: ctrl.signal },
        {
          onAttempt: (attempt) => setRun((r) => ({ ...r, phase: 'running', attempt })),
          onWait: (wait) => setRun((r) => ({ ...r, phase: 'waiting', wait })),
        },
      )
      const wallMs = Date.now() - startedAt
      if (res.ok) {
        setRun({ phase: 'done', request: req, response: res, wallMs, attempts: res.attempts })
        setView('result')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setRun({ phase: 'error', request: req, response: res, error: explainError(res) })
      }
    } catch (e) {
      if (e?.name === 'AbortError') setRun({ phase: 'cancelled' })
      else setRun({ phase: 'error', request: req, response: null, error: { title: 'Error inesperado', detail: String(e), action: 'retry' } })
    }
  }

  const cancel = () => abortRef.current?.abort()

  const onErrorAction = (error) => {
    if (error.action === 'key') {
      setKeyCheck({ checking: false, error: 'La API ha rechazado la clave. Introduce una válida; tu petición se conserva.' })
      setKey(null)
      go(0)
    } else if (error.action === 'question') {
      const q = draft.questions.find((x) => x.name === error.question)
      if (q) goToQuestion(q.id)
      else go(stepIndex('questions'))
    }
  }

  const onGoError = (e) => (e.qid ? goToQuestion(e.qid) : go(stepIndex(e.step)))

  const resultDefs =
    run.phase === 'done'
      ? run.request.path === '/v1/decide'
        ? run.request.body.questions
        : presets?.[run.response.data.preset]?.questions
      : null

  const current = STEPS[step].key
  const showPayload = view === 'wizard' && step >= 1 && draft.mode != null

  let body
  if (view === 'result' && run.phase === 'done') {
    body = (
      <ResultView
        run={run}
        defs={resultDefs}
        onEdit={() => {
          setRun(IDLE)
          go(stepIndex('review'))
        }}
        onNew={() => {
          setRun(IDLE)
          dispatch({ type: 'reset' })
          setAttempted(new Set())
          go(1)
        }}
      />
    )
  } else {
    const stepErrors = showErrors(current) ? errorsOf(current) : []
    body = (
      <div className="card">
        {current === 'key' && (
          <KeyStep
            initialKey={stored?.key ?? ''}
            initialRemember={remember}
            checking={keyCheck.checking}
            error={keyCheck.error}
            onVerify={verifyKey}
          />
        )}
        {current === 'mode' && (
          <ModeStep
            draft={draft}
            presets={presets}
            dispatch={dispatch}
            onLoaded={(msg) => {
              say(msg)
              go(stepIndex('text'))
            }}
          />
        )}
        {current === 'text' && <TextStep draft={draft} dispatch={dispatch} errors={stepErrors} />}
        {current === 'questions' && (
          <QuestionsStep draft={draft} presets={presets} dispatch={dispatch} errors={stepErrors} focusQid={focusQid} />
        )}
        {current === 'options' && <OptionsStep draft={draft} dispatch={dispatch} />}
        {current === 'review' && (
          <ReviewStep
            draft={draft}
            presets={presets}
            request={request}
            errors={errors}
            run={run}
            health={health}
            onSend={send}
            onCancel={cancel}
            onGoError={onGoError}
            onErrorAction={onErrorAction}
            onBack={() => go(step - 1)}
          />
        )}
        {current !== 'key' && current !== 'review' && (
          <div className="nav">
            <button type="button" className="btn" onClick={() => go(step - 1)}>
              ← Atrás
            </button>
            {current !== 'mode' || draft.mode ? (
              <button type="button" className="btn primary" onClick={next}>
                Siguiente →
              </button>
            ) : (
              <span className="hint">Elige una opción para continuar</span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a
            href="/"
            className="brand"
            onClick={(e) => {
              e.preventDefault()
              goHome()
            }}
          >
            <img src="/logo.png" alt="" width="36" height="36" />
            <div>
              <strong>Argos</strong> <span>asistente de decisiones</span>
            </div>
          </a>
          <HealthBadge health={health} />
          {key && (
            <span className="chip">
              Clave <span className="mono">{maskKey(key)}</span>
              {remember && <span className="hint">· recordada</span>}
              <button type="button" className="btn ghost small" onClick={forget}>
                Olvidar
              </button>
            </span>
          )}
          <GitHubLink />
        </div>
      </header>

      <main className="page">
        {view === 'wizard' && (
          <Stepper
            current={step}
            reachable={reachable}
            stepErrors={(k) => errorsOf(k).length > 0}
            showErrors={showErrors}
            onGo={go}
          />
        )}
        <div className={`layout ${showPayload ? 'with-aside' : ''}`}>
          <div>
            {body}
            {showPayload && (
              <details className="aside-mobile">
                <summary>Ver JSON de la petición</summary>
                <PayloadPanel request={request} />
              </details>
            )}
          </div>
          {showPayload && (
            <aside className="aside">
              <PayloadPanel request={request} />
            </aside>
          )}
        </div>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}
