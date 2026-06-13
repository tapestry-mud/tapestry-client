import { useState, useRef, useEffect, Fragment } from 'react'
import { deriveAuthBaseUrl } from '../config/clientConfig'
import { WebSocketClient } from '../connection/WebSocketClient'
import { WheelMark } from './WheelMark'
import './preauth.css'

function LoadingDots() {
  return (
    <>
      <span className="dots-load" aria-hidden="true"><i /><i /><i /></span>
      <span className="pa-sr-only">Loading</span>
    </>
  )
}

function StepIndicator({ labels, current }: { labels: string[]; current: number }) {
  return (
    <nav className="step-row" aria-label={`Step ${current + 1} of ${labels.length}: ${labels[current]}`}>
      {labels.map((label, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className={`step-line ${i <= current ? 'lit' : ''}`} aria-hidden="true" />
          )}
          <span
            className={`step-pip ${i < current ? 'done' : i === current ? 'active' : ''}`}
            aria-hidden="true"
          >
            {i < current ? '✓' : i + 1}
          </span>
          <span className={i === current ? 'step-label-active' : ''}>{label}</span>
        </Fragment>
      ))}
    </nav>
  )
}

/* -- Step 1: Character name -- */

function NameStep({
  onReturning,
  onNew,
}: {
  onReturning: (character: string) => void
  onNew: (character: string) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { return }

    setError('')
    setBusy(true)
    try {
      const baseUrl = deriveAuthBaseUrl()
      const res = await fetch(`${baseUrl}/auth/check?name=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!data.nameValid) {
        setError(data.error ?? 'Invalid character name.')
        setBusy(false)
        return
      }
      if (data.exists) {
        onReturning(trimmed)
      } else {
        onNew(trimmed)
      }
    } catch {
      setError('Could not reach the server.')
      setBusy(false)
    }
  }

  const isDisabled = busy || !name.trim()

  return (
    <div className="pa-card">
      <StepIndicator labels={['Name']} current={0} />
      <h2 className="pa-form-h">Speak your name.</h2>
      <p className="pa-form-sub">Step <span className="gold">01</span> &middot; Enter</p>
      <form onSubmit={handleSubmit} aria-busy={busy}>
        <div className="pa-field">
          <label className="pa-field-label" htmlFor="pa-name">Character name</label>
          <div className="pa-input-wrap">
            <span className="pa-input-prompt" aria-hidden="true">&rsaquo;</span>
            <input
              ref={inputRef}
              id="pa-name"
              className="pa-input"
              type="text"
              placeholder="Enter your character name"
              autoComplete="off"
              value={name}
              disabled={busy}
              onChange={(e) => { setName(e.target.value) }}
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

/* -- Step 2a: Password for returning player -- */

function ReturningPasswordStep({
  character,
  onBack,
}: {
  character: string
  onBack: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) { return }

    setError('')
    setBusy(true)
    try {
      const baseUrl = deriveAuthBaseUrl()
      const res = await fetch(`${baseUrl}/auth/login-by-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character, password }),
      })
      if (res.status === 429) {
        throw new Error('Too many attempts. Please wait a moment and try again.')
      }
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Login failed.')
      }
      const serverUrl = WebSocketClient.deriveServerUrl()
      if (serverUrl) {
        WebSocketClient.connect(serverUrl, data.token)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
      setBusy(false)
    }
  }

  const isDisabled = busy || !password

  return (
    <div className="pa-card">
      <StepIndicator labels={['Name', 'Password']} current={1} />
      <h2 className="pa-form-h">Welcome back, {character}.</h2>
      <p className="pa-form-sub">Step <span className="gold">02</span> &middot; Password</p>
      <form onSubmit={handleSubmit} aria-busy={busy}>
        <div className="pa-field">
          <label className="pa-field-label" htmlFor="pa-password">Password</label>
          <div className="pa-input-wrap">
            <span className="pa-input-prompt" aria-hidden="true">&middot;</span>
            <input
              ref={inputRef}
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
          {busy ? <LoadingDots /> : 'Enter →'}
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
          &larr; Not you?
        </button>
      </div>
    </div>
  )
}

/* -- Step 2b: Email for new character -- */

function NewEmailStep({
  character,
  onExistingAccount,
  onNewAccount,
  onBack,
}: {
  character: string
  onExistingAccount: (email: string) => void
  onNewAccount: (email: string) => void
  onBack: () => void
}) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) { return }

    setError('')
    setBusy(true)
    try {
      const baseUrl = deriveAuthBaseUrl()
      const res = await fetch(`${baseUrl}/auth/check-email?email=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (data.exists) {
        onExistingAccount(trimmed)
      } else {
        onNewAccount(trimmed)
      }
    } catch {
      setError('Could not reach the server.')
      setBusy(false)
    }
  }

  const isDisabled = busy || !email.trim()

  return (
    <div className="pa-card">
      <StepIndicator labels={['Name', 'Email', 'Password']} current={1} />
      <h2 className="pa-form-h">Link your thread.</h2>
      <p className="pa-form-sub">Step <span className="gold">02</span> &middot; Email</p>
      <div className="pa-new-badge">{character}</div>
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
      <div className="pa-back-row">
        <button
          className="pa-back-link"
          type="button"
          onClick={onBack}
          disabled={busy}
          aria-disabled={busy}
        >
          &larr; Different name
        </button>
      </div>
    </div>
  )
}

/* -- Step 3a: Password for new character on existing account -- */

function ExistingAccountPasswordStep({
  character,
  email,
  onBack,
}: {
  character: string
  email: string
  onBack: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) { return }

    setError('')
    setBusy(true)
    try {
      const baseUrl = deriveAuthBaseUrl()

      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (loginRes.status === 429) {
        throw new Error('Too many attempts. Please wait a moment and try again.')
      }
      const loginData = await loginRes.json()
      if (!loginRes.ok) {
        throw new Error(loginData.error ?? 'Login failed.')
      }

      const selectRes = await fetch(`${baseUrl}/auth/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: loginData.session_token, newCharacter: character }),
      })
      if (selectRes.status === 429) {
        throw new Error('Too many attempts. Please wait a moment and try again.')
      }
      const selectData = await selectRes.json()
      if (!selectRes.ok) {
        throw new Error(selectData.error ?? 'Character creation failed.')
      }

      const serverUrl = WebSocketClient.deriveServerUrl()
      if (serverUrl) {
        WebSocketClient.connect(serverUrl, selectData.token)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
      setBusy(false)
    }
  }

  const isDisabled = busy || !password

  return (
    <div className="pa-card">
      <StepIndicator labels={['Name', 'Email', 'Password']} current={2} />
      <h2 className="pa-form-h">Account found.</h2>
      <p className="pa-form-sub">Step <span className="gold">03</span> &middot; Password</p>
      <div className="pa-new-badge">{character}</div>
      <form onSubmit={handleSubmit} aria-busy={busy}>
        <div className="pa-field">
          <label className="pa-field-label" htmlFor="pa-password">Password</label>
          <div className="pa-input-wrap">
            <span className="pa-input-prompt" aria-hidden="true">&middot;</span>
            <input
              ref={inputRef}
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
          &larr; Different email
        </button>
      </div>
    </div>
  )
}

/* -- Step 3b: Password + confirm for brand new account -- */

function NewAccountPasswordStep({
  character,
  email,
  onBack,
}: {
  character: string
  email: string
  onBack: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || !confirm) { return }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setBusy(true)
    try {
      const baseUrl = deriveAuthBaseUrl()
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, character }),
      })
      if (res.status === 429) {
        throw new Error('Too many attempts. Please wait a moment and try again.')
      }
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Registration failed.')
      }
      const serverUrl = WebSocketClient.deriveServerUrl()
      if (serverUrl) {
        WebSocketClient.connect(serverUrl, data.token)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
      setBusy(false)
    }
  }

  const canSubmit = !!password && !!confirm && !busy

  return (
    <div className="pa-card">
      <StepIndicator labels={['Name', 'Email', 'Password']} current={2} />
      <h2 className="pa-form-h">Weave a new thread.</h2>
      <p className="pa-form-sub">Step <span className="gold">03</span> &middot; Account</p>
      <div className="pa-new-badge">{character}</div>
      <form onSubmit={handleSubmit} aria-busy={busy}>
        <div className="pa-field">
          <label className="pa-field-label" htmlFor="pa-password">Choose a password</label>
          <div className="pa-input-wrap">
            <span className="pa-input-prompt" aria-hidden="true">&middot;</span>
            <input
              ref={inputRef}
              id="pa-password"
              className="pa-input"
              type="password"
              placeholder="Create a password"
              autoComplete="new-password"
              value={password}
              disabled={busy}
              onChange={(e) => { setPassword(e.target.value) }}
            />
          </div>
        </div>
        <div className="pa-field">
          <label className="pa-field-label" htmlFor="pa-confirm">Confirm password</label>
          <div className="pa-input-wrap">
            <span className="pa-input-prompt" aria-hidden="true">&middot;</span>
            <input
              id="pa-confirm"
              className="pa-input"
              type="password"
              placeholder="Confirm your password"
              autoComplete="new-password"
              value={confirm}
              disabled={busy}
              onChange={(e) => { setConfirm(e.target.value) }}
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
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
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
          &larr; Different email
        </button>
      </div>
    </div>
  )
}

/* -- Main LoginPage -- */

type Step =
  | { phase: 'name' }
  | { phase: 'returning-password'; character: string }
  | { phase: 'new-email'; character: string }
  | { phase: 'new-existing-password'; character: string; email: string }
  | { phase: 'new-account-password'; character: string; email: string }

export function LoginPage({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>({ phase: 'name' })

  return (
    <main className="preauth">
      <div className="pa-stage">
        <img src="/assets/tapestry-logo.png" alt="Tapestry" className="pa-login-logo" />
        <WheelMark size={72} />
        <div className="pa-fili" aria-hidden="true">&diams; &loz; &diams;</div>
        <p className="pa-page-sub">The loom remembers every thread.</p>

        <h1 className="pa-sr-only">Tapestry Login</h1>

        {step.phase === 'name' && (
          <NameStep
            onReturning={(character) => { setStep({ phase: 'returning-password', character }) }}
            onNew={(character) => { setStep({ phase: 'new-email', character }) }}
          />
        )}
        {step.phase === 'returning-password' && (
          <ReturningPasswordStep
            character={step.character}
            onBack={() => { setStep({ phase: 'name' }) }}
          />
        )}
        {step.phase === 'new-email' && (
          <NewEmailStep
            character={step.character}
            onExistingAccount={(email) => {
              setStep({ phase: 'new-existing-password', character: step.character, email })
            }}
            onNewAccount={(email) => {
              setStep({ phase: 'new-account-password', character: step.character, email })
            }}
            onBack={() => { setStep({ phase: 'name' }) }}
          />
        )}
        {step.phase === 'new-existing-password' && (
          <ExistingAccountPasswordStep
            character={step.character}
            email={step.email}
            onBack={() => {
              setStep({ phase: 'new-email', character: step.character })
            }}
          />
        )}
        {step.phase === 'new-account-password' && (
          <NewAccountPasswordStep
            character={step.character}
            email={step.email}
            onBack={() => {
              setStep({ phase: 'new-email', character: step.character })
            }}
          />
        )}

        <div className="pa-below">
          <button type="button" onClick={onBack}>&larr; Home</button>
          <span className="dot" aria-hidden="true">&middot;</span>
          <span>
            <span className="pa-conn-led" aria-hidden="true" />
            {' '}Server online
          </span>
          <span className="dot" aria-hidden="true">&middot;</span>
          <a href="https://discord.gg/YQtbBqZ69J" target="_blank" rel="noopener noreferrer">Discord</a>
        </div>
      </div>
    </main>
  )
}
