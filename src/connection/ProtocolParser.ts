import { IncomingEnvelopeSchema } from '../types/gmcp'
import { useDebugStore } from '../stores/debugStore'
import { GmcpDispatcher } from './GmcpDispatcher'
import { getTerminal } from '../terminal/terminalStore'
import { useWatchStore } from '../stores/watchStore'

export const ProtocolParser = {
  parseMessage(raw: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }

    const result = IncomingEnvelopeSchema.safeParse(parsed)
    if (!result.success) { return }

    const envelope = result.data
    if (envelope.type === 'text') {
      useDebugStore.getState().logText(envelope.data)
      getTerminal()?.write(envelope.data)
    } else if (envelope.type === 'gmcp') {
      useDebugStore.getState().logGmcp(envelope.package, envelope.data, 'in')
      GmcpDispatcher.dispatch(envelope.package, envelope.data)
    } else if (envelope.type === 'watch') {
      // Watch-mode (Slice B): a chunk of the watched player's rendered ANSI -> the (read-only) terminal.
      getTerminal()?.write(envelope.data)
    } else if (envelope.type === 'roster') {
      useWatchStore.getState().setRoster(envelope.data)
    } else if (envelope.type === 'status') {
      useWatchStore.getState().setStatus(envelope.data)
    }
  },
}
