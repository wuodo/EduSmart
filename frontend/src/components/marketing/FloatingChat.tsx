'use client'

import { useEffect, useRef, useState } from 'react'
import ChatWindow from './ChatWindow'
import ChatList from './ChatList'
import { WEB_API } from '@/utils/api'
import {
  modalOverlayClass,
  modalPanelClass,
  modalHeaderClass,
  modalTitleClass,
  modalCloseButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/styles/modalForm'

interface ChatRoom {
  id: number
  name?: string
  type: string
  otherParticipants: Array<{ id: number; email: string; name?: string; role: string }>
  updatedAt: string
}

export default function FloatingChat({
  initialRoomId,
  focusMessageId,
  onClose,
  reopenSignal,
  unreadCount = 0,
  defaultOpen = false,
}: {
  initialRoomId?: number
  focusMessageId?: string
  onClose: () => void
  reopenSignal?: number
  unreadCount?: number
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [selected, setSelected] = useState<ChatRoom | null>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const dragData = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 450, h: 520 })
  const [dragging, setDragging] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('Group Chat')
  const [confirmRoom, setConfirmRoom] = useState<ChatRoom | null>(null)
  const [users, setUsers] = useState<Array<{ id: number; email: string; name?: string; role: string }>>([])
  const [userSearch, setUserSearch] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const userHeaders = () => ({} as Record<string, string>)

  const submitCreateGroup = async () => {
    try {
      const res = await fetch(`${WEB_API}/chat/group`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...userHeaders() }, body: JSON.stringify({ name: newGroupName || 'Group Chat' }) })
      if (res.ok) {
        const d = await res.json()
        setRooms(prev => [d.chatRoom, ...prev])
        setCreateOpen(false)
      }
    } catch {}
  }

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${WEB_API}/chat/rooms`, { headers: userHeaders(), cache: 'no-store' })
      const data = await res.json()
      const arr = Array.isArray(data?.chatRooms) ? data.chatRooms : []
      setRooms(arr)
      if (arr.length === 0) {
        // Prefetch users for first-time chat
        void fetchUsers()
      }
      if (initialRoomId && !selected) {
        const r = arr.find((x: any) => x.id === initialRoomId) || null
        if (r) setSelected(r)
      }
    } catch {}
  }

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await fetch(`${WEB_API}/chat/users`, { headers: userHeaders(), cache: 'no-store' })
      const data = await res.json()
      const arr = Array.isArray(data?.users) ? data.users : []
      setUsers(arr)
    } catch {
      setUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  const createDirect = async (email: string) => {
    try {
      const res = await fetch(`${WEB_API}/chat/direct`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...userHeaders() }, body: JSON.stringify({ participantEmail: email }) })
      const data = await res.json()
      if (res.ok && data?.chatRoom) {
        setRooms(prev => {
          const exists = prev.find(r => r.id === data.chatRoom.id)
          return exists ? prev : [data.chatRoom, ...prev]
        })
        setSelected(data.chatRoom)
      }
    } catch {}
  }

  const compactName = (display: string) => {
    const trimmed = String(display || '').trim()
    if (!trimmed) return 'User'
    const first = trimmed.split(' ')[0]
    return first || trimmed
  }

  useEffect(() => {
    fetchRooms()
  }, [])

  // Reopen on external signal
  useEffect(() => {
    if (reopenSignal !== undefined) setOpen(true)
  }, [reopenSignal])

  // Drag handlers
  useEffect(() => {
    const el = widgetRef.current
    if (!el) return
    el.style.position = 'fixed'
    el.style.right = '16px'
    el.style.bottom = '16px'
    const onMouseDown = (e: MouseEvent) => {
      const header = (e.target as HTMLElement).closest('[data-drag-handle]')
      if (!header) return
      const rect = el.getBoundingClientRect()
      dragData.current = { x: e.clientX, y: e.clientY, dx: rect.left, dy: rect.top }
      setDragging(true)
      // Prevent text selection while dragging
      const prev = document.body.style.userSelect
      document.body.setAttribute('data-prev-user-select', prev || '')
      document.body.style.userSelect = 'none'
      e.preventDefault()
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragData.current) return
      const { x, y, dx, dy } = dragData.current
      let nx = dx + (e.clientX - x)
      let ny = dy + (e.clientY - y)
      const maxX = (window.innerWidth - size.w - 8)
      const maxY = (window.innerHeight - size.h - 8)
      nx = Math.max(8, Math.min(nx, maxX))
      ny = Math.max(8, Math.min(ny, maxY))
      el.style.left = `${nx}px`
      el.style.top = `${ny}px`
      el.style.right = 'auto'
      el.style.bottom = 'auto'
    }
    const endDrag = () => {
      dragData.current = null
      setDragging(false)
      const prev = document.body.getAttribute('data-prev-user-select') || ''
      document.body.style.userSelect = prev
      document.body.removeAttribute('data-prev-user-select')
    }
    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('mouseleave', endDrag)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    window.addEventListener('blur', endDrag)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', endDrag)
      window.removeEventListener('mouseleave', endDrag)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      window.removeEventListener('blur', endDrag)
    }
  }, [size])

  if (!open) {
    return (
      <button
        ref={widgetRef as any}
        className="fixed z-50 text-white rounded-full shadow-lg"
        style={{ right: 16, bottom: 16, width: 48, height: 48 }}
        onClick={() => setOpen(true)}
        title="Open chat"
      >
        <span className="w-full h-full inline-flex items-center justify-center rounded-full bg-teal-600 relative">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] leading-[18px] text-center font-semibold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </button>
    )
  }

  return (
    <div ref={widgetRef} className="fixed z-50" style={{ right: 16, bottom: 16, width: size.w, height: size.h }}>
      <div className="flex flex-col w-full h-full rounded-lg shadow-xl bg-white border dark:bg-neutral-900 dark:text-neutral-100 overflow-hidden">
        <div data-drag-handle className="relative h-10 flex items-center justify-between px-3 bg-green-600 text-white rounded-t-lg cursor-move select-none dark:bg-emerald-700">
          <div className="min-w-0 flex items-center gap-2">
            <div className="text-[12px] font-medium truncate" title={(selected?.name || selected?.otherParticipants?.[0]?.name || selected?.otherParticipants?.[0]?.email || 'Chat') as string}>
              {(selected?.name || selected?.otherParticipants?.[0]?.name || selected?.otherParticipants?.[0]?.email || 'Chat')}
            </div>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          {/* Centered controls: group + search */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); setCreateOpen(true) }} title="New group" aria-label="New group" className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M16 11a4 4 0 10-8 0 4 4 0 008 0z"/>
                <path fillRule="evenodd" d="M12 14c-5.523 0-10 2.239-10 5v1a1 1 0 001 1h18a1 1 0 001-1v-1c0-2.761-4.477-5-10-5z" clipRule="evenodd"/>
              </svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setSearchOpen(true); if (users.length === 0) fetchUsers() }} title="Search users" aria-label="Search users" className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M10.5 3a7.5 7.5 0 105.226 12.926l3.674 3.674a.75.75 0 101.06-1.06l-3.674-3.674A7.5 7.5 0 0010.5 3zm-6 7.5a6 6 0 1112 0 6 6 0 01-12 0z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(false)} title="Minimize" className="opacity-90">—</button>
            <button onClick={() => { setOpen(false); onClose() }} title="Close" className="opacity-90">×</button>
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[92px] border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="h-8 flex items-center px-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-neutral-800">
              <span className="text-[12px] font-medium">Chats</span>
            </div>
            <div className="divide-y">
              {rooms.length === 0 ? (
                <div className="p-3 text-[12px] text-gray-500 dark:text-gray-400">
                  No conversations yet. Use search to start one.
                </div>
              ) : rooms.map(r => {
                const display = r.type === 'group' ? (r.name || 'Group Chat') : (r.name || (r.otherParticipants?.[0]?.name || r.otherParticipants?.[0]?.email || 'Chat'))
                const active = selected?.id === r.id
                return (
                  <div key={r.id} className={`group w-full flex items-center justify-between px-2 py-2 text-[12px] ${active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-50 dark:hover:bg-neutral-800'}`}>
                    <button onClick={() => setSelected(r)} className="flex-1 text-left truncate" title={display}>
                      <span className="truncate block">{compactName(display)}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmRoom(r) }}
                      className="opacity-60 hover:opacity-100 px-1 text-gray-400 hover:text-rose-500"
                      title={r.type === 'group' ? 'Leave group' : 'Delete chat'}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex-1 flex">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                <div className="text-center">
                  <div className="mb-2">Select a chat</div>
                  <div className="text-[12px] text-gray-400">Use search to start a new chat.</div>
                </div>
              </div>
            ) : (
              <ChatWindow chatRoom={selected} onMessageSent={fetchRooms} focusMessageId={focusMessageId} />
            )}
          </div>
        </div>
      </div>
      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={submitCreateGroup} value={newGroupName} onChange={setNewGroupName} />
      <ConfirmChatModal room={confirmRoom} onCancel={() => setConfirmRoom(null)} onConfirm={async (room) => {
        try {
          await fetch(`${WEB_API}/chat/rooms/${room.id}`, { method: 'DELETE', headers: userHeaders() })
          setRooms(prev => prev.filter(x => x.id !== room.id))
          if (selected?.id === room.id) setSelected(null)
        } catch {}
        setConfirmRoom(null)
      }} />
      <SearchUserModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        users={users.map(u => ({ id: u.id, email: u.email, name: u.name }))}
        loading={loadingUsers}
        onRefresh={fetchUsers}
        onSelect={async (email) => {
          await createDirect(email)
          setSearchOpen(false)
        }}
      />
    </div>
  )
}


// Modals
// Create Group Modal
export function CreateGroupModal({ open, onClose, onSubmit, value, onChange }: { open: boolean; onClose: () => void; onSubmit: () => void; value: string; onChange: (v: string) => void }) {
  if (!open) return null
  return (
    <div className={modalOverlayClass}>
      <div className={`${modalPanelClass} max-w-sm w-[90vw] dark:bg-neutral-900 dark:text-neutral-100`}>
        <div className={modalHeaderClass}>
          <h3 className={modalTitleClass}>Create Group</h3>
          <button className={modalCloseButtonClass} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <label className="block text-xs mb-1">Group name</label>
        <input className={`${inputClass} dark:bg-neutral-800`} value={value} onChange={e => onChange(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <button className={secondaryButtonClass} onClick={onClose}>Cancel</button>
          <button className={primaryButtonClass} onClick={onSubmit}>Create</button>
        </div>
      </div>
    </div>
  )
}

// Confirm Delete/Leave Modal
export function ConfirmChatModal({ room, onCancel, onConfirm }: { room: ChatRoom | null; onCancel: () => void; onConfirm: (room: ChatRoom) => void }) {
  if (!room) return null
  const isGroup = room.type === 'group'
  return (
    <div className={modalOverlayClass}>
      <div className={`${modalPanelClass} max-w-sm w-[90vw] dark:bg-neutral-900 dark:text-neutral-100`}>
        <div className={modalHeaderClass}>
          <h3 className={modalTitleClass}>{isGroup ? 'Leave group' : 'Delete conversation'}</h3>
          <button className={modalCloseButtonClass} onClick={onCancel} aria-label="Close">✕</button>
        </div>
        <p className="text-sm mb-4">{isGroup ? 'You will be removed from this group chat.' : 'This will permanently delete this conversation.'}</p>
        <div className="mt-2 flex justify-end gap-2">
          <button className={secondaryButtonClass} onClick={onCancel}>Cancel</button>
          <button className="px-4 py-2 bg-rose-600 text-white text-sm hover:bg-rose-700 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => onConfirm(room)}>{isGroup ? 'Leave' : 'Delete'}</button>
        </div>
      </div>
    </div>
  )
}

// Search Users Modal
export function SearchUserModal({ open, onClose, users, loading, onRefresh, onSelect }: { open: boolean; onClose: () => void; users: Array<{ id: number; email: string; name?: string }>; loading: boolean; onRefresh: () => void; onSelect: (email: string) => void }) {
  const [q, setQ] = useState('')
  if (!open) return null
  const filtered = users.filter(u => (u.name || u.email).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className={modalOverlayClass}>
      <div className={`${modalPanelClass} max-w-md w-[90vw] dark:bg-neutral-900 dark:text-neutral-100`}>
        <div className={modalHeaderClass}>
          <h3 className={modalTitleClass}>Start new chat</h3>
          <button className={modalCloseButtonClass} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="flex gap-2 mb-3">
          <input className={`flex-1 ${inputClass} dark:bg-neutral-800`} placeholder="Search users by name or email" value={q} onChange={e => setQ(e.target.value)} />
          <button className={primaryButtonClass} onClick={onRefresh}>Refresh</button>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {loading ? (
            <div className="p-2 text-sm text-gray-500">Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="p-2 text-sm text-gray-500">No users found</div>
          ) : filtered.map(u => (
            <button key={u.id} className="w-full text-left px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center gap-2" onClick={() => onSelect(u.email)}>
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">
                {String(u.name || u.email).split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <span className="truncate">{u.name || u.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
