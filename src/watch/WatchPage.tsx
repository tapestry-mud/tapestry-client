import { useEffect } from 'react'
import { OutputViewport } from '../panels/OutputViewport'
import { WatchClient } from '../connection/WatchClient'
import { useWatchStore } from '../stores/watchStore'
import { nextEntityId } from './watchLogic'

/// The anonymous /watch spectator surface (Slice B). A distinct read-only entry point — NOT the
/// player client: it never runs login/preauth/connectionStore and never fires the GMCP handshake.
/// It opens a tokenless watch connection, renders the watched player's output into a read-only
/// terminal (reusing OutputViewport / the terminal singleton), and offers a roster + a client-driven
/// "next" control that cycles the roster by id.
export function WatchPage() {
  const roster = useWatchStore((s) => s.roster)
  const status = useWatchStore((s) => s.status)
  const connectionStatus = useWatchStore((s) => s.connectionStatus)
  const currentTargetId = useWatchStore((s) => s.currentTargetId)

  useEffect(() => {
    WatchClient.connect()
    return () => { WatchClient.disconnect() }
  }, [])

  function handleNext() {
    const next = nextEntityId(roster, currentTargetId)
    if (next) { WatchClient.watch(next) }
  }

  return (
    <div className="flex h-screen flex-col bg-surface-deep text-[#e0e0e0]">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <h1 className="text-sm font-semibold tracking-wide">TAPESTRY -- WATCH</h1>
        <span className="text-xs opacity-70">{connectionStatus}</span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 flex-col border-r border-white/10">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold uppercase opacity-70">Live ({roster.length})</span>
            <button
              onClick={handleNext}
              disabled={roster.length === 0}
              className="rounded bg-accent px-2 py-0.5 text-xs text-white hover:opacity-80 disabled:opacity-30"
            >
              Next
            </button>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {roster.length === 0 && (
              <li className="px-3 py-2 text-xs opacity-50">No one is live right now.</li>
            )}
            {roster.map((p) => (
              <li key={p.entityId}>
                <button
                  onClick={() => WatchClient.watch(p.entityId)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${
                    p.entityId === currentTargetId ? 'bg-white/10 font-semibold' : ''
                  }`}
                >
                  <div>{p.name}</div>
                  {p.roomId && <div className="text-xs opacity-50">{p.roomId}</div>}
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-white/10 px-3 py-2 text-xs opacity-70">
            {status || 'Pick a player to watch.'}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1">
          <OutputViewport />
        </main>
      </div>
    </div>
  )
}
