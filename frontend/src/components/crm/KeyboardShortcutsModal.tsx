'use client'

export default function KeyboardShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal
      aria-label="Keyboard shortcuts"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Keyboard shortcuts</h2>
          <button type="button" className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
          <li className="px-4 py-3 flex justify-between gap-4">
            <span className="text-gray-700 dark:text-gray-300">Command palette (search & jump)</span>
            <kbd className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-mono text-xs">Ctrl K</kbd>
          </li>
          <li className="px-4 py-3 flex justify-between gap-4">
            <span className="text-gray-700 dark:text-gray-300">Command palette (Mac)</span>
            <kbd className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-mono text-xs">⌘ K</kbd>
          </li>
          <li className="px-4 py-3 flex justify-between gap-4">
            <span className="text-gray-700 dark:text-gray-300">This help</span>
            <kbd className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-mono text-xs">?</kbd>
          </li>
        </ul>
        <p className="px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
          Press ? when not typing in a field. Close dialogs with Esc.
        </p>
      </div>
    </div>
  )
}
