import { useEffect, useMemo, useRef } from 'react'
import { useCommandPaletteStore } from '../stores/commandPaletteStore'
import { useCommandCategoriesStore } from '../stores/commandCategoriesStore'
import { useCommandsStore } from '../stores/commandsStore'
import { useCommandBarStore } from '../stores/commandBarStore'

let savedFocus: Element | null = null

export function CommandsModal() {
  const { isOpen, filter, close, setFilter } = useCommandPaletteStore()
  const categories = useCommandCategoriesStore((s) => s.categories)
  const commands = useCommandsStore((s) => s.commands)
  const setPending = useCommandBarStore((s) => s.setPending)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) { return }
    if (isOpen) {
      if (!savedFocus) { savedFocus = document.activeElement }
      dialog.showModal()
      filterRef.current?.focus()
    } else {
      dialog.close()
      if (savedFocus instanceof HTMLElement) { savedFocus.focus() }
      savedFocus = null
    }
  }, [isOpen])

  // Map native <dialog> Escape to the store so React state stays in sync.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) { return }
    const handleCancel = (e: Event) => { e.preventDefault(); close() }
    dialog.addEventListener('cancel', handleCancel)
    return () => { dialog.removeEventListener('cancel', handleCancel) }
  }, [close])

  const q = filter.toLowerCase()
  const grouped = useMemo(() => {
    const labelById = new Map(categories.map((c) => [c.id, c.label]))
    return categories
      .map((cat) => ({
        id: cat.id,
        label: cat.label,
        items: commands
          .filter((cmd) => cmd.category === cat.id)
          .filter((cmd) => {
            if (!q) { return true }
            return (
              cmd.keyword.toLowerCase().includes(q) ||
              cmd.description.toLowerCase().includes(q) ||
              cmd.category.toLowerCase().includes(q) ||
              (labelById.get(cmd.category) ?? '').toLowerCase().includes(q) ||
              cmd.aliases.some((a) => a.toLowerCase().includes(q))
            )
          })
          .sort((a, b) => a.keyword.localeCompare(b.keyword)),
      }))
      .filter((section) => section.items.length > 0)
  }, [categories, commands, q])

  const total = useMemo(
    () => grouped.reduce((n, s) => n + s.items.length, 0),
    [grouped],
  )

  const fill = (keyword: string) => {
    setPending(keyword + ' ')
    close()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="command-palette-title"
      className="fixed z-50 m-auto max-w-3xl w-full max-h-[80vh] rounded-lg bg-gray-900 text-gray-100 shadow-2xl p-0 backdrop:bg-black/60 border border-gray-700"
      onClick={(e) => { if (e.target === dialogRef.current) { close() } }}
    >
      <div className="relative flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0 pr-12">
          <h2 id="command-palette-title" className="text-lg font-semibold">Command Palette</h2>
          <span className="text-sm text-gray-400">{total} commands</span>
        </div>
        <div className="px-4 py-2 border-b border-gray-700 shrink-0">
          <input
            ref={filterRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter commands..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 outline-none focus:border-blue-400"
          />
        </div>
        <div className="overflow-y-auto px-4 py-3 flex-1 space-y-4">
          {grouped.map((section) => (
            <div key={section.id}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                {section.label} ({section.items.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {section.items.map((cmd) => (
                  <button
                    key={cmd.keyword}
                    title={cmd.description || undefined}
                    onClick={() => fill(cmd.keyword)}
                    className="font-mono text-xs bg-gray-800 hover:bg-blue-600 text-gray-100 rounded px-2 py-1"
                  >
                    {cmd.keyword}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <p className="text-sm text-gray-400 italic">No commands match.</p>
          )}
        </div>
        <div className="px-4 py-2 border-t border-gray-700 shrink-0 text-xs text-gray-400">
          Click a command to fill the input. Esc to close.
        </div>
        <button
          onClick={close}
          className="absolute top-3 right-4 text-gray-400 hover:text-gray-100 text-xl leading-none"
          aria-label="Close command palette"
        >
          &times;
        </button>
      </div>
    </dialog>
  )
}
