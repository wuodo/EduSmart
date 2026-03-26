'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { WEB_API } from '@/utils/api'
import {
  modalOverlayClass,
  modalPanelClass,
  modalHeaderClass,
  modalTitleClass,
  modalCloseButtonClass,
  inputClass,
  textareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/styles/modalForm'

export default function FloatingAskAi() {
  const [open, setOpen] = useState(false)
  const [inquiryId, setInquiryId] = useState('')
  const [followupId, setFollowupId] = useState('')
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [pendingChoice, setPendingChoice] = useState<string | null>(null)
  const [messages, setMessages] = useState<
    Array<{
      id: string
      role: 'user' | 'assistant'
      content: string
      actions?: Array<{ label: string; href: string }>
    }>
  >([])
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const canSend = useMemo(() => question.trim().length > 0 && !loading, [question, loading])

  const genId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

  const parseOptionalInt = (s: string): number | undefined => {
    const t = String(s || '').trim()
    if (!t) return undefined
    const n = Number(t)
    if (!Number.isFinite(n)) return undefined
    const int = Math.trunc(n)
    return int > 0 ? int : undefined
  }

  useEffect(() => {
    if (!open) return
    setPendingChoice(null)
    if (messages.length > 0) return
    setMessages([
      {
        id: genId(),
        role: 'assistant',
        content: 'Hi! Ask me about inquiries, follow-ups, admission letters, or registrations.',
      },
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, open])

  const submit = async () => {
    setLoading(true)
    let typingId = ''
    try {
      const trimmed = question.trim()
      if (!trimmed) return

      setMessages(prev => [
        ...prev,
        { id: genId(), role: 'user', content: trimmed },
      ])
      setQuestion('')
      typingId = genId()
      setMessages(prev => [
        ...prev,
        { id: typingId, role: 'assistant', content: 'Typing…' },
      ])

      const payload = {
        question: trimmed,
        context: {
          inquiryId: parseOptionalInt(inquiryId),
          followupId: parseOptionalInt(followupId),
          pathname: pathname || undefined,
          pendingChoice: pendingChoice || undefined,
        },
      }

      const res = await fetch(`${WEB_API}/ask-ai/ask`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const msg =
          data?.error ||
          data?.message ||
          data?.details ||
          `Ask failed (status ${res.status})`
        await new Promise(r => setTimeout(r, 300 + Math.random() * 500))
        setMessages(prev => prev.map(m => (m.id === typingId ? { ...m, content: String(msg), actions: undefined } : m)))
        return
      }

      if (!data?.answer) {
        await new Promise(r => setTimeout(r, 300 + Math.random() * 500))
        setMessages(prev => prev.map(m => (m.id === typingId ? { ...m, content: 'Ask failed: unexpected response format.', actions: undefined } : m)))
        return
      }

      const delay = 300 + Math.random() * 500
      await new Promise(r => setTimeout(r, delay))

      setMessages(prev =>
        prev.map(m =>
          m.id === typingId
            ? {
                ...m,
                content: String(data.answer),
                actions: Array.isArray(data?.actions) ? data.actions : undefined,
              }
            : m
        )
      )

      setPendingChoice(data?.pendingChoice ?? null)
    } catch (e: any) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 500))
      setMessages(prev =>
        prev.map(m => (typingId && m.id === typingId ? { ...m, content: e?.message ? String(e.message) : 'Ask failed.', actions: undefined } : m))
      )
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        className="fixed z-50 text-white rounded-full shadow-lg bg-transparent"
        style={{ right: 16, bottom: 88, width: 48, height: 48 }}
        onClick={() => setOpen(true)}
        title="Ask Me"
      >
        <span className="w-full h-full inline-flex items-center justify-center rounded-full bg-orange-600 relative">
          <span className="text-[10px] font-bold leading-tight">Ask Me</span>
        </span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className={modalOverlayClass} onClick={() => setOpen(false)} />
      <div
        className={modalPanelClass + ' max-w-2xl w-full relative z-[60]'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={modalHeaderClass}>
          <h3 className={modalTitleClass}>Ask Me</h3>
          <button className={modalCloseButtonClass} onClick={() => setOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex flex-col h-[70vh]">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between">
              <button
                className={secondaryButtonClass + ' px-3 py-1'}
                onClick={() => setContextOpen(v => !v)}
                disabled={loading}
              >
                {contextOpen ? 'Hide context' : 'Add context (optional)'}
              </button>
            </div>

            {contextOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs mb-1 font-medium text-gray-600">Inquiry ID (optional)</label>
                  <input
                    className={inputClass}
                    value={inquiryId}
                    onChange={(e) => setInquiryId(e.target.value)}
                    placeholder="e.g. 12"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1 font-medium text-gray-600">Follow-up ID (optional)</label>
                  <input
                    className={inputClass}
                    value={followupId}
                    onChange={(e) => setFollowupId(e.target.value)}
                    placeholder="e.g. 77"
                    inputMode="numeric"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="space-y-3">
              {messages.map(m => (
                <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={m.role === 'user' ? 'max-w-[85%]' : 'max-w-[85%]'}>
                    <div
                      className={
                        m.role === 'user'
                          ? 'bg-orange-600 text-white rounded-2xl px-4 py-2 whitespace-pre-wrap text-sm'
                          : 'bg-white border border-gray-200 text-gray-900 rounded-2xl px-4 py-2 whitespace-pre-wrap text-sm'
                      }
                    >
                      {m.content}
                    </div>
                    {m.actions && m.actions.length > 0 && m.role === 'assistant' && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {m.actions.map(a => (
                          <a
                            key={`${m.id}-${a.href}-${a.label}`}
                            href={a.href}
                            className="text-xs px-3 py-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-900"
                            onClick={() => setOpen(false)}
                          >
                            {a.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 text-gray-900 rounded-2xl px-4 py-2 max-w-[85%] whitespace-pre-wrap text-sm">
                    Asking…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t px-3 py-2">
            <textarea
              className={textareaClass}
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about inquiries, follow-ups, admission letters, or registrations…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (canSend) void submit()
                }
              }}
            />

            <div className="flex items-center justify-between gap-2 mt-2">
              <button
                className={secondaryButtonClass}
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Close
              </button>
              <button
                className={primaryButtonClass}
                onClick={() => void submit()}
                disabled={!canSend}
              >
                {loading ? 'Asking…' : 'Ask'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

