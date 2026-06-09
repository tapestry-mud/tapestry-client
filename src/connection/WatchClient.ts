import { ProtocolParser } from './ProtocolParser'
import { getTerminal } from '../terminal/terminalStore'
import { useWatchStore } from '../stores/watchStore'

/// The anonymous /watch spectator transport (Slice B). A lightweight, tokenless WebSocket that does
/// NOT run the player login/preauth/connectionStore flow and does NOT fire the on-open
/// `Core.Supports.Set` GMCP handshake — it only opens `?mode=watch`, reuses the shared ProtocolParser
/// demux for incoming frames, and sends the tiny watch control protocol (`watch <id>` / `unwatch`).
let ws: WebSocket | null = null

function deriveWatchUrl(): string {
  const { hostname, host, protocol } = window.location
  // Local Vite dev (no reverse proxy): talk to the engine WebSocket directly.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://localhost:4001/?mode=watch'
  }
  // Served behind Caddy (e.g. lf.localhost / production): the /ws route proxies to the engine.
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${host}/ws?mode=watch`
}

function connect(): void {
  if (ws) { return }
  const url = deriveWatchUrl()
  useWatchStore.getState().setConnectionStatus('connecting')

  ws = new WebSocket(url)

  ws.onopen = () => {
    useWatchStore.getState().setConnectionStatus('connected')
    // Deliberately NO GMCP handshake and NO login — a watcher is a pure stream consumer.
  }

  ws.onmessage = (event) => {
    ProtocolParser.parseMessage(event.data as string)
  }

  ws.onerror = () => {
    useWatchStore.getState().setConnectionStatus('error')
  }

  ws.onclose = () => {
    useWatchStore.getState().setConnectionStatus('disconnected')
    ws = null
  }
}

function send(command: string): void {
  if (ws?.readyState !== WebSocket.OPEN) { return }
  ws.send(JSON.stringify({ type: 'command', data: command }))
}

function watch(entityId: string): void {
  // Clear/reset the terminal on (re)subscribe so the new stream starts clean (design section 6/8);
  // the engine also sends an SGR reset as the first watch frame.
  getTerminal()?.reset()
  useWatchStore.getState().setCurrentTargetId(entityId)
  send('watch ' + entityId)
}

function unwatch(): void {
  useWatchStore.getState().setCurrentTargetId(null)
  send('unwatch')
}

function disconnect(): void {
  const current = ws
  ws = null
  current?.close()
}

export const WatchClient = { connect, disconnect, watch, unwatch, send, deriveWatchUrl }
