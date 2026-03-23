'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { WEB_API } from '@/utils/api'
import MessageInput from './MessageInput'

interface ChatRoom {
  id: number
  name?: string
  type: string
  otherParticipants: Array<{
    id: number
    email: string
    name?: string
    role: string
  }>
}

interface Message {
  id: number
  content: string
  messageType: string
  sender: {
    id: number
    email: string
    name?: string
  }
  tags: Array<{
    id: number
    type: string
    targetId: string
    targetName: string
  }>
  createdAt: string
  readBy: Record<string, string>
  metadata?: any
}

interface Props {
  chatRoom: ChatRoom
  onMessageSent: () => void
  focusMessageId?: string
}

export default function ChatWindow({ chatRoom, onMessageSent, focusMessageId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const lastFocusedId = useRef<string | null>(null)
  const lastSigRef = useRef<string>('')
  const lastScrollHeightRef = useRef<number>(0)
  const currentUserEmail = typeof window !== 'undefined' ? localStorage.getItem('userEmail') || '' : ''
  const [quickView, setQuickView] = useState<{ id: string, name: string } | null>(null)
  const [quickViewData, setQuickViewData] = useState<any | null>(null)
  const [quickViewFollowups, setQuickViewFollowups] = useState<any[]>([])
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; senderName?: string } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  const userHeaders = () => ({} as Record<string, string>)

  const logTaggedInquiryAction = async (action: string, inquiryId: string, inquiryName: string) => {
    try {
      const actor = typeof window !== 'undefined'
        ? (localStorage.getItem('userEmail') || localStorage.getItem('userName') || 'unknown')
        : 'unknown'
      await fetch('/api/marketing/settings/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          module: 'chat',
          user: actor,
          details: {
            inquiryId,
            inquiryName,
            chatRoomId: chatRoom.id,
            chatRoomType: chatRoom.type,
            happenedAt: new Date().toISOString(),
          },
        }),
      })
    } catch {}
  }

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${WEB_API}/chat/rooms/${chatRoom.id}/messages`, {
        headers: userHeaders(),
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        const arr: Message[] = Array.isArray(data.messages) ? data.messages : []
        // Deduplicate and sort chronologically (oldest first) like WhatsApp
        const byId: Record<string, Message> = {}
        for (const m of arr) byId[String(m.id)] = m
        const sorted = Object.values(byId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        const sig = sorted.map(m => `${m.id}:${m.createdAt}`).join('|')
        if (sig !== lastSigRef.current) {
          lastSigRef.current = sig
          setMessages(sorted)
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = (smooth: boolean) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  const isNearBottom = (): boolean => {
    const el = messagesContainerRef.current
    if (!el) return true
    const threshold = 120
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }

  useEffect(() => {
    fetchMessages()
    // Jump to bottom on initial load of a room
    setTimeout(() => scrollToBottom(false), 0)
  }, [chatRoom.id])

  // Do not auto-scroll on every messages change; only when near bottom
  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const heightChanged = el.scrollHeight !== lastScrollHeightRef.current
    if (isNearBottom() && heightChanged) {
      scrollToBottom(false)
    }
    lastScrollHeightRef.current = el.scrollHeight
  }, [messages])

  // If a focusMessageId is provided, attempt to scroll to it after messages load
  useEffect(() => {
    if (!focusMessageId) return
    const el = document.querySelector(`[data-message-id=\"${focusMessageId}\"]`)
    if (el && lastFocusedId.current !== focusMessageId) {
      (el as HTMLElement).scrollIntoView({ behavior: 'auto', block: 'center' })
      lastFocusedId.current = focusMessageId
    } else if (!el) {
      // Fetch the message and inject into the list so it appears inline
      ;(async () => {
        try {
          const res = await fetch(`${WEB_API}/chat/messages/${focusMessageId}`, { headers: userHeaders(), cache: 'no-store' })
          const data = await res.json()
          if (res.ok && data?.message) {
            setMessages(prev => {
              const byId: Record<string, Message> = {}
              for (const m of prev) byId[String(m.id)] = m
              byId[String(data.message.id)] = data.message
              const merged = Object.values(byId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              const sig = merged.map(m => `${m.id}:${m.createdAt}`).join('|')
              lastSigRef.current = sig
              return merged
            })
            // Scroll after React paints
            setTimeout(() => {
              const el2 = document.querySelector(`[data-message-id=\"${focusMessageId}\"]`)
              if (el2 && lastFocusedId.current !== focusMessageId) {
                (el2 as HTMLElement).scrollIntoView({ behavior: 'auto', block: 'center' })
                lastFocusedId.current = focusMessageId
              }
            }, 200)
          }
        } catch {}
      })()
    }
  }, [messages, focusMessageId])

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(() => {
      // Only poll when near bottom to avoid jumpy UX while user scrolls up
      if (isNearBottom()) {
        fetchMessages()
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [chatRoom.id])

  const handleSendMessage = async (content: string, tags: any[] = [], metadata?: any) => {
    try {
      const response = await fetch(`${WEB_API}/chat/rooms/${chatRoom.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...userHeaders()
        },
        body: JSON.stringify({
          content,
          messageType: tags.length > 0 ? 'tagged' : 'text',
          tags,
          metadata
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => {
          const byId: Record<string, Message> = {}
          for (const m of prev) byId[String(m.id)] = m
          byId[String(data.message.id)] = data.message
          const merged = Object.values(byId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          const sig = merged.map(m => `${m.id}:${m.createdAt}`).join('|')
          lastSigRef.current = sig
          return merged
        })
        onMessageSent()
        setReplyTo(null)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const getDisplayName = () => {
    if (chatRoom.name) return chatRoom.name
    const others = Array.isArray((chatRoom as any).otherParticipants) ? (chatRoom as any).otherParticipants : []
    if (others.length > 0) {
      const participant = others[0]
      return (participant?.name || participant?.email) as string
    }
    return 'Unknown User'
  }

  const isOwnMessage = (message: Message) => {
    return message.sender.email === currentUserEmail
  }

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm')
  }

  // load inquiry + followups when quickView opens
  useEffect(() => {
    const load = async () => {
      if (!quickView) return
      try {
        const headers = userHeaders()
        const [inqRes, folRes] = await Promise.all([
          fetch(`${WEB_API}/inquiries/${quickView.id}`, { headers, cache: 'no-store' }),
          fetch(`${WEB_API}/followups?inquiryId=${encodeURIComponent(quickView.id)}`, { headers, cache: 'no-store' })
        ])
        setQuickViewData(inqRes.ok ? await inqRes.json() : null)
        setQuickViewFollowups(folRes.ok ? await folRes.json() : [])
      } catch (e) {
        setQuickViewData(null)
        setQuickViewFollowups([])
      }
    }
    load()
  }, [quickView])

  // Handle click on inquiry tag buttons inside message bubbles
  useEffect(() => {
    const handler = (e: any) => {
      const raw = e.target as HTMLElement
      const target = raw?.closest && raw.closest('[data-inquiry-id]') as HTMLElement | null
      if (target) {
        if ((target as HTMLAnchorElement).tagName === 'A') e.preventDefault()
        const id = target.getAttribute('data-inquiry-id') || ''
        const name = target.getAttribute('data-inquiry-name') || ''
        if (id) setQuickView({ id, name })
      }
    }
    // Attach on capture phase to beat any other handlers
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  const renderMessageContent = (message: Message) => {
    let content = message.content

    // Replace tags with styled components
    if (message.tags && message.tags.length > 0) {
      message.tags.forEach(tag => {
        const safeName = tag.targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const tagRegex = new RegExp(`@${safeName}`, 'g')
        const isInquiry = tag.type === 'inquiry'
        const element = isInquiry
          ? `<a href=\"#\" role=\"button\" data-inquiry-id=\"${tag.targetId}\" data-inquiry-name=\"${tag.targetName}\" class=\"inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium underline decoration-dotted cursor-pointer\">@${tag.targetName}</a>`
          : `<span class=\"inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium\">@${tag.targetName}</span>`
        content = content.replace(tagRegex, element)
      })
    }

    return content
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const raw = e.target as HTMLElement
    const target = raw?.closest && raw.closest('[data-inquiry-id]') as HTMLElement | null
    if (target) {
      if ((target as HTMLAnchorElement).tagName === 'A') e.preventDefault()
      e.stopPropagation()
      const id = target.getAttribute('data-inquiry-id') || ''
      const name = target.getAttribute('data-inquiry-name') || ''
      if (id) setQuickView({ id, name })
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header (minimal) */}
      <div className="px-3 py-2 border-b border-gray-200 bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-gray-900 truncate" title={getDisplayName()}>{getDisplayName()}</h2>
          <div />
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 dark:bg-neutral-900" onClick={handleContainerClick} onMouseDown={handleContainerClick as any}>
        {messages.length === 0 ? (
          <div className="text-center text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              data-message-id={String(message.id)}
              className={`flex ${isOwnMessage(message) ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`relative max-w-xs lg:max-w-md ${isOwnMessage(message) ? 'order-2' : 'order-1'}`}>
                <div
                  className={`rounded-lg px-3 py-2 pr-8 text-[13px] leading-5 ${
                    isOwnMessage(message)
                      ? 'text-gray-900'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                  style={isOwnMessage(message) ? { backgroundColor: '#cdf8e5' } : undefined}
                >
                  {/* Kebab menu trigger */}
                  <div className="absolute top-1 right-2">
                    <button
                      className="text-gray-500 hover:text-gray-700 px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(prev => prev === message.id ? null : message.id)
                      }}
                      aria-label="More actions"
                    >
                      ⋯
                    </button>
                  </div>
                  {!isOwnMessage(message) && (
                    <div className="text-xs font-medium mb-1 opacity-75">
                      {message.sender.name || message.sender.email}
                    </div>
                  )}
                  {message.metadata?.replyToMessageId && (
                    <div className={`mb-1 text-[11px] px-2 py-1 rounded border ${isOwnMessage(message) ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}>
                      <span className="font-medium">Reply</span> · {message.metadata.replySender || 'message'}: {message.metadata.replyPreview || ''}
                    </div>
                  )}
                  <div 
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: renderMessageContent(message) }}
                  />
                  <div className={`text-[11px] mt-1 ${isOwnMessage(message) ? 'text-emerald-700' : 'text-gray-500 dark:text-gray-400'}`}>
                    {formatTime(message.createdAt)}
                  </div>
                </div>
                {/* Actions menu */}
                {openMenuId === message.id && (
                  <div className="absolute top-6 right-0 bg-white border rounded shadow-md z-10 text-[12px] min-w-[140px]">
                    <button
                      className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                      onClick={() => { setReplyTo({ id: String(message.id), content: message.content, senderName: message.sender.name || message.sender.email }); setOpenMenuId(null) }}
                    >
                      Reply
                    </button>
                    <button
                      className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          const current = (document.querySelector('textarea') as HTMLTextAreaElement | null)
                          if (current) {
                            const name = message.sender.name || message.sender.email
                            const cursor = current.selectionStart || current.value.length
                            const before = current.value.slice(0, cursor)
                            const after = current.value.slice(cursor)
                            current.value = `${before}@${name} ${after}`
                            current.focus()
                            current.selectionStart = current.selectionEnd = (before + '@' + name + ' ').length
                          }
                        }
                        setReplyTo({ id: String(message.id), content: message.content, senderName: message.sender.name || message.sender.email })
                        setOpenMenuId(null)
                      }}
                    >
                      Reply & mention
                    </button>
                    <button
                      className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                      onClick={async () => { setOpenMenuId(null); const ok = confirm('Forward this message to a different chat?'); if (!ok) return; alert('Forwarding picker coming soon.'); }}
                    >
                      Forward
                    </button>
                    {isOwnMessage(message) && (
                      <button
                        className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-rose-500"
                        onClick={async () => {
                          setOpenMenuId(null)
                          const ok = confirm('Delete this message?')
                          if (!ok) return
                          try {
                            await fetch(`${WEB_API}/chat/messages/${message.id}`, { method: 'DELETE', headers: userHeaders() })
                            setMessages(prev => prev.filter(m => m.id !== message.id))
                          } catch {}
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-2 sm:p-3 border-t border-gray-200 bg-white">
        <MessageInput onSendMessage={handleSendMessage} replyTo={replyTo || undefined} onCancelReply={() => setReplyTo(null)} minRows={2} maxRows={8} />
      </div>

      {quickView && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-[90vw] max-w-2xl p-6 relative">
            <button className="absolute top-2 right-2 text-gray-500" onClick={() => setQuickView(null)}>×</button>
            <h3 className="text-lg font-semibold mb-2">{quickView.name}</h3>
            {quickViewData ? (
              <div className="mb-4 text-sm text-gray-700">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-gray-500">Program:</span> {quickViewData.programOfInterest || '-'}</div>
                  <div><span className="text-gray-500">Phone:</span> {quickViewData.phone || '-'}</div>
                  <div><span className="text-gray-500">Email:</span> {quickViewData.email || '-'}</div>
                  <div><span className="text-gray-500">Status:</span> {quickViewData.status || '-'}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 mb-4">Loading details…</div>
            )}
            <div className="mb-4 max-h-60 overflow-y-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {quickViewFollowups.map((f, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{format(new Date(f.scheduledFor), 'PP')}</td>
                      <td className="px-3 py-2 capitalize">{f.type}</td>
                      <td className="px-3 py-2 capitalize">{f.status}</td>
                      <td className="px-3 py-2">{f.notes || ''}</td>
                    </tr>
                  ))}
                  {quickViewFollowups.length === 0 && (
                    <tr><td className="px-3 py-2 text-gray-500" colSpan={4}>No follow-up history</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  await logTaggedInquiryAction('chat_tagged_inquiry_whatsapp', quickView.id, quickView.name)
                  window.open(`https://wa.me/?text=${encodeURIComponent('Hello ' + quickView.name)}`, '_blank')
                }}
                className="px-3 py-2 bg-green-600 text-white rounded"
              >
                Chat on WhatsApp
              </button>
              <button
                type="button"
                onClick={async () => {
                  await logTaggedInquiryAction('chat_tagged_inquiry_open_followups', quickView.id, quickView.name)
                  const q = new URLSearchParams({
                    inquiryId: String(quickView.id),
                    source: 'chat_tag',
                    chatRoomId: String(chatRoom.id),
                    inquiryName: String(quickView.name || ''),
                  })
                  window.location.href = `/followups?${q.toString()}`
                }}
                className="px-3 py-2 bg-primary text-white rounded"
              >
                Update Follow-up
              </button>
              <button
                type="button"
                onClick={async () => {
                  await logTaggedInquiryAction('chat_tagged_inquiry_open_reminder', quickView.id, quickView.name)
                  const q = new URLSearchParams({
                    remind: String(quickView.id),
                    source: 'chat_tag',
                    chatRoomId: String(chatRoom.id),
                    inquiryName: String(quickView.name || ''),
                  })
                  window.location.href = `/inquiries?${q.toString()}`
                }}
                className="px-3 py-2 border rounded"
              >
                Send Reminder
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
