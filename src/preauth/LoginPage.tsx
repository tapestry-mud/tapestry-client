import { useState, useRef, useEffect } from 'react'
import { deriveAuthBaseUrl } from '../config/clientConfig'
import { WebSocketClient } from '../connection/WebSocketClient'
import { WheelMark } from './WheelMark'
import './preauth.css'

/* -- Shared sub-components -- */

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <nav className="step-row" aria-label={step === 1 ? 'Step 1 of 2: Login' : 'Step 2 of 2: Character'}>
      <span className={`step-pip ${step > 1 ? 'done' : 'active'}`} aria-hidden="true">
        {step > 1 ? '✓' : '1'}
      </span>
      <span className={step === 1 ? 'step-label-active' : ''}>Login</span>
      <span className={`step-line ${step > 1 ? 'lit' : ''}`} aria-hidden="true" />
      <span className={`step-pip ${step > 1 ? 'active' : ''}`} aria-hidden="true">2</span>
      <span className={step > 1 ? 'step-label-active' : ''}>Character</span>
    </nav>
  )
}

function LoadingDots() {
  return (
    <>
      <span className="dots-load" aria-hidden="true"><i /><i /><i /></span>
      <span className="pa-sr-only">Loading</span>
    </>
  )
}

/* -- Step 1: Email + Password login -- */

function LoginStep({ onAdvance }: { onAdvance: (accountId: string, characters: string[]) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) { return }

    setError('')
    setBusy(true)
    try {
      const baseUrl = deriveAuthBaseUrl()
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      })
      if (res.status === 429) {
        throw new Error('Too many attempts. Please wait a moment and try again.')
      }
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Login failed')
      }
      onAdvance(data.account_id, data.characters ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  const isDisabled = busy || !email.trim() || !password

  return (
    <div className="pa-card">
      <StepIndicator step={1} />
      <h2 className="pa-form-h">Speak your name into the loom.</h2>
      <p className="pa-form-sub">Step <span className="gold">01</span> &middot; Login</p>
      <form onSubmit={handleSubmit} aria-busy={busy}>
        <div className="pa-field">
          <label className="pa-field-label" htmlFor="pa-email">Email</label>
          <div className="pa-input-wrap">
            <span className="pa-input-prompt" aria-hidden="true">&rsaquo;</span>
            <input
              ref={inputRef}
              id="pa-email"
              className="pa-input"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              value={email}
              disabled={busy}
              onChange={(e) => { setEmail(e.target.value) }}
            />
          </div>
        </div>
        <div className="pa-field">
          <label className="pa-field-label" htmlFor="pa-password">Password</label>
          <div className="pa-input-wrap">
            <span className="pa-input-prompt" aria-hidden="true">&middot;</span>
            <input
              id="pa-password"
              className="pa-input"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              disabled={busy}
              onChange={(e) => { setPassword(e.target.value) }}
            />
          </div>
        </div>
        <div className="pa-error-slot" role="alert" aria-live="polite">
          {error && (
            <>
              <span className="pa-error-icon" aria-hidden="true">!</span>
              {error}
            </>
          )}
        </div>
        <button
          className="pa-submit"
          type="submit"
          disabled={isDisabled}
          aria-disabled={isDisabled}
        >
          {busy ? <LoadingDots /> : 'Continue →'}
        </button>
      </form>
    </div>
  )
}

/* -- Step 2: Character select or create -- */

function CharacterStep({
  accountId,
  characters,
  onBack,
}: {
  accountId: string
  characters: string[]
  onBack: () => void
}) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (characters.length === 0) {
      inputRef.current?.focus()
    }
  }, [characters.length])

  async function selectCharacter(character: string) {
    setError('')
    setBusy(true)
    try {
      const baseUrl = deriveAuthBaseUrl()
      const res = await fetch(`${baseUrl}/auth/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, character }),
      })
      if (res.status === 429) {
        throw new Error('Too many attempts. Please wait a moment and try again.')
      }
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Selection failed')
      }
      const serverUrl = WebSocketClient.deriveServerUrl()
      if (serverUrl) {
        WebSocketClient.connect(serverUrl, data.token)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Selection failed.')
      setBusy(false)
    }
  }

  async function createCharacter(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) { return }

    setError('')
    setBusy(true)
    try {
      const baseUrl = deriveAuthBaseUrl()
      const res = await fetch(`${baseUrl}/auth/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, newCharacter: trimmed }),
      })
      if (res.status === 429) {
        throw new Error('Too many attempts. Please wait a moment and try again.')
      }
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Creation failed')
      }
      const serverUrl = WebSocketClient.deriveServerUrl()
      if (serverUrl) {
        WebSocketClient.connect(serverUrl, data.token)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed.')
      setBusy(false)
    }
  }

  return (
    <div className="pa-card">
      <StepIndicator step={2} />
      <h2 className="pa-form-h">Choose your thread.</h2>
      <p className="pa-form-sub">Step <span className="gold">02</span> &middot; Character</p>

      {characters.length > 0 && (
        <div className="pa-char-list">
          {characters.map((name) => (
            <button
              key={name}
              className="pa-char-btn"
              type="button"
              disabled={busy}
              onClick={() => { selectCharacter(name) }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={createCharacter} aria-busy={busy}>
        <div className="pa-field">
          <label className="pa-field-label" htmlFor="pa-new-char">
            {characters.length > 0 ? 'Or create a new character' : 'Create your first character'}
          </label>
          <div className="pa-input-wrap">
            <span className="pa-input-prompt" aria-hidden="true">&rsaquo;</span>
            <input
              ref={inputRef}
              id="pa-new-char"
              className="pa-input"
              type="text"
              placeholder="Enter a name"
              autoComplete="off"
              value={newName}
              disabled={busy}
              onChange={(e) => { setNewName(e.target.value) }}
            />
          </div>
        </div>
        <div className="pa-error-slot" role="alert" aria-live="polite">
          {error && (
            <>
              <span className="pa-error-icon" aria-hidden="true">!</span>
              {error}
            </>
          )}
        </div>
        <button
          className="pa-submit"
          type="submit"
          disabled={busy || !newName.trim()}
          aria-disabled={busy || !newName.trim()}
        >
          {busy ? <LoadingDots /> : 'Create & enter →'}
        </button>
      </form>

      <div className="pa-back-row">
        <button
          className="pa-back-link"
          type="button"
          onClick={onBack}
          disabled={busy}
          aria-disabled={busy}
        >
          &larr; Use a different account
        </button>
      </div>
    </div>
  )
}

/* -- Main LoginPage -- */

type Step =
  | { phase: 'login' }
  | { phase: 'character'; accountId: string; characters: string[] }

export function LoginPage({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>({ phase: 'login' })

  function handleLoginAdvance(accountId: string, characters: string[]) {
    setStep({ phase: 'character', accountId, characters })
  }

  function handleStepBack() {
    setStep({ phase: 'login' })
  }

  return (
    <main className="preauth">
      <div className="pa-stage">
        <img src="/assets/tapestry-logo.png" alt="Tapestry" className="pa-login-logo" />
        <WheelMark size={72} />
        <div className="pa-fili" aria-hidden="true">&diams; &loz; &diams;</div>
        <p className="pa-page-sub">The loom remembers every thread.</p>

        <h1 className="pa-sr-only">Tapestry Login</h1>

        {step.phase === 'login' && (
          <LoginStep onAdvance={handleLoginAdvance} />
        )}
        {step.phase === 'character' && (
          <CharacterStep
            accountId={step.accountId}
            characters={step.characters}
            onBack={handleStepBack}
          />
        )}

        <div className="pa-below">
          <button type="button" onClick={onBack}>&larr; Home</button>
          <span className="dot" aria-hidden="true">&middot;</span>
          <span>
            <span className="pa-conn-led" aria-hidden="true" />
            {' '}Server online
          </span>
        </div>
      </div>
    </main>
  )
}
