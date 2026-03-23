'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/utils/apiClient'

type EventItem = { id: string; title: string; date: string; type: 'followup' | 'task'; status?: string }
type Task = { id: number; title: string; description?: string; dueDate?: string; status: string; ownerEmail?: string; visibility?: string; type?: string; outcome?: string; reminderAt?: string }

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init)
  const text = await res.text()
  let data: any
  try { data = text ? JSON.parse(text) : {} } catch { throw new Error(text || 'Non-JSON response') }
  if (!res.ok) throw new Error(data.error || text || 'Request failed')
  return data
}

export default function CalendarPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [taskType, setTaskType] = useState<'call'|'email'|'meeting'|'demo'|'other'>('call')
  const [reminderAt, setReminderAt] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [error, setError] = useState('')
  const [view, setView] = useState<'month' | 'week' | 'list'>('month')
  const [cursor, setCursor] = useState<Date>(new Date())
  const [quickDate, setQuickDate] = useState<string>('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [dueReminders, setDueReminders] = useState<Task[]>([])
  const [dragItem, setDragItem] = useState<{ kind: 'task'|'followup'; id: number; time?: string }|null>(null)

  const load = async () => {
    setError('')
    try {
      const { events } = await fetchJSON<{ events: EventItem[] }>(`/calendar/events`)
      const qs = ownerFilter ? `?owner=${encodeURIComponent(ownerFilter)}` : ''
      const { tasks } = await fetchJSON<{ tasks: Task[] }>(`/calendar/tasks${qs}`)
      setEvents(events)
      setTasks(tasks)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar')
    }
  }

  useEffect(() => { load() }, [ownerFilter])
  // Prefer list view on very small screens
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setView('list')
    }
  }, [])

  // Poll for due reminders every 60s
  useEffect(() => {
    let mounted = true
    const poll = async () => {
      try {
        const currentUser = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : ''
        const owner = ownerFilter || currentUser
        const qs = `?owner=${encodeURIComponent(owner)}&withinMinutes=5`
        const data = await fetchJSON<{ tasks: Task[] }>(`/calendar/reminders/due${qs}`)
        if (mounted) setDueReminders(data.tasks || [])
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, 60000)
    return () => { mounted = false; clearInterval(id) }
  }, [ownerFilter])

  const groupedByDate = useMemo(() => {
    const map: Record<string, { events: EventItem[]; tasks: Task[] }> = {}
    for (const e of events) {
      const d = e.date?.slice(0,10)
      if (!d) continue
      map[d] ||= { events: [], tasks: [] }
      map[d].events.push(e)
    }
    for (const t of tasks) {
      const d = t.dueDate?.slice(0,10) || 'No Due'
      map[d] ||= { events: [], tasks: [] }
      map[d].tasks.push(t)
    }
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
  }, [events, tasks])

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const currentUser = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : ''
      const res: any = await fetchJSON(`/calendar/tasks`, {
        method: 'POST',
        body: JSON.stringify({ title, dueDate: dueDate || null, type: taskType, ownerEmail: currentUser, reminderAt: reminderAt || null })
      })
      if (res && (res as any).error) throw new Error((res as any).error)
      setTitle(''); setDueDate(''); setReminderAt('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add task')
    }
  }

  const toggleTask = async (task: Task) => {
    try {
      if (task.status === 'completed') {
        await fetchJSON(`/calendar/tasks/${task.id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'pending' })
        })
      } else {
        const outcome = typeof window !== 'undefined' ? (window.prompt('Outcome (e.g., connected, no answer, rescheduled, converted)', 'connected') || 'connected') : 'connected'
        await fetchJSON(`/calendar/tasks/${task.id}/complete`, {
          method: 'POST',
          body: JSON.stringify({ outcome })
        })
      }
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to update task') }
  }

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h1 className="text-lg sm:text-xl font-bold text-teal-700 dark:text-teal-300">Calendar</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="px-2 py-1 border rounded text-teal-700 border-teal-300 hover:bg-teal-50 text-sm" onClick={()=>setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1))}>Prev</button>
          <div className="text-xs sm:text-sm w-32 sm:w-40 text-center">{cursor.toLocaleString(undefined,{month:'long', year:'numeric'})}</div>
          <button className="px-2 py-1 border rounded text-teal-700 border-teal-300 hover:bg-teal-50 text-sm" onClick={()=>setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1))}>Next</button>
          <select value={view} onChange={e=>setView(e.target.value as any)} className="ml-0 sm:ml-2 px-2 py-1 border rounded border-teal-300 text-sm">
            <option value="month">Month</option>
            <option value="week">Week</option>
            <option value="list">List</option>
          </select>
          <input placeholder="Filter by owner email" value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)} className="w-full sm:w-64 ml-0 sm:ml-2 px-2 py-1 border rounded border-teal-300 text-sm" />
        </div>
      </div>
      {error && <div className="text-rose-600 mb-2 text-sm">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded shadow p-2 md:p-4 overflow-x-auto sm:overflow-visible">
          {view==='list' && (
            <div className="space-y-3 max-h-[60vh] overflow-auto">
              {groupedByDate.map(([date, data]) => (
                <div key={date}>
                  <div className="text-xs text-gray-500 mb-1">{date}</div>
                  <div className="space-y-1">
                    {data.events.map(ev => (
                      <div key={ev.id} className="text-sm px-3 py-2 rounded border flex items-center justify-between">
                        <span>{ev.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${ev.type==='followup' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{ev.type}</span>
                      </div>
                    ))}
                    {data.tasks.map(tsk => (
                      <div key={`tsk-${tsk.id}`} className="text-sm px-3 py-2 rounded border flex items-center justify-between">
                        <span className={tsk.status==='completed' ? 'line-through text-gray-500' : ''}>{tsk.title}</span>
                        <button onClick={()=>toggleTask(tsk)} className={`text-xs px-2 py-0.5 rounded ${tsk.status==='completed' ? 'bg-gray-200' : 'bg-green-600 text-white'}`}>{tsk.status==='completed' ? 'Undo' : 'Done'}</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {view!=='list' && (
            <MonthWeekGrid
              mode={view}
              date={cursor}
              events={[...events, ...tasks.filter(t=>t.dueDate).map(t=>({ id:`task-${t.id}`, title:t.title, date:t.dueDate as string, type:'task' as const }))]}
              onDayClick={(iso)=>{ setQuickDate(iso); setShowQuickAdd(true) }}
              onDragStart={(payload)=> setDragItem(payload)}
              onDrop={async (iso)=>{
                try {
                  if (!dragItem) return
                  if (dragItem.kind === 'task') {
                    const t = tasks.find(x=>x.id===dragItem.id)
                    const base = iso
                    const time = (t?.dueDate && t.dueDate.includes('T')) ? t.dueDate.split('T')[1] : '09:00:00.000Z'
                    const newDate = `${base}T${time}`
                    await fetchJSON(`/calendar/tasks/${dragItem.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ dueDate: newDate }) })
                    await load()
                  }
                } finally { setDragItem(null) }
              }}
            />
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded shadow p-3 sm:p-4">
          <h2 className="font-semibold mb-2">Add Task</h2>
          <form onSubmit={addTask} className="space-y-2">
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task title" className="w-full border rounded px-2 py-1 text-sm" required />
            <input value={dueDate} onChange={e=>setDueDate(e.target.value)} type="datetime-local" className="w-full border rounded px-2 py-1 text-sm" />
            <div className="flex gap-2 flex-col sm:flex-row">
              <select value={taskType} onChange={e=>setTaskType(e.target.value as any)} className="w-full sm:w-1/2 border rounded px-2 py-1 text-sm">
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="demo">Demo</option>
                <option value="other">Other</option>
              </select>
              <input value={reminderAt} onChange={e=>setReminderAt(e.target.value)} type="datetime-local" className="w-full sm:w-1/2 border rounded px-2 py-1 text-sm" placeholder="Reminder" />
            </div>
            <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white py-1.5 rounded text-sm">Add</button>
          </form>
          <div className="mt-4 text-xs text-gray-500">Click a date in the calendar to quick-add for that day.</div>
        </div>
      </div>

      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={()=>setShowQuickAdd(false)}>
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Add Task</h3>
            <form onSubmit={async (e)=>{ e.preventDefault(); try { const currentUser = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : ''; await fetchJSON(`/calendar/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title, dueDate: quickDate+'T09:00', type: taskType, ownerEmail: currentUser }) }); setTitle(''); setShowQuickAdd(false); await load(); } catch(err){ setError(err instanceof Error ? err.message : 'Failed') } }} className="space-y-2">
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={`Task for ${quickDate}`} className="w-full border rounded px-2 py-1" required />
              <div className="flex gap-2 justify-end">
                <button type="button" className="px-3 py-1 border rounded" onClick={()=>setShowQuickAdd(false)}>Cancel</button>
                <button type="submit" className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminder toasts */}
      <div className="fixed right-2 left-2 sm:left-auto sm:right-4 bottom-2 sm:bottom-4 z-40 space-y-2 w-auto sm:w-72">
        {dueReminders.map(t => (
          <div key={`rem-${t.id}`} className="rounded shadow bg-white dark:bg-gray-800 border border-teal-200 p-3 text-sm">
            <div className="font-semibold text-teal-700 dark:text-teal-200">Reminder: {t.title}</div>
            <div className="text-gray-500">Type: {t.type || 'task'}</div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={async ()=>{ try { await fetchJSON(`/calendar/tasks/${t.id}/complete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ outcome: 'completed from reminder' }) }); await load(); setDueReminders(dueReminders.filter(x=>x.id!==t.id)); } catch(e){ setError(e instanceof Error? e.message:'Failed') } }}
                className="px-2 py-1 bg-teal-600 text-white rounded"
              >Done</button>
              <button
                onClick={async ()=>{ try { const newAt = new Date(Date.now()+10*60*1000).toISOString(); await fetchJSON(`/calendar/tasks/${t.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ reminderAt: newAt }) }); setDueReminders(dueReminders.filter(x=>x.id!==t.id)); } catch(e){ setError(e instanceof Error? e.message:'Failed') } }}
                className="px-2 py-1 border rounded"
              >Snooze 10m</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthWeekGrid({ mode, date, events, onDayClick, onDragStart, onDrop }: { mode: 'month' | 'week', date: Date, events: EventItem[], onDayClick: (iso:string)=>void, onDragStart: (payload: {kind:'task'|'followup', id:number, time?:string})=>void, onDrop: (iso:string)=>void }) {
  const start = new Date(date)
  start.setDate(1)
  const startDay = start.getDay() // 0 Sun
  const firstCell = new Date(start)
  firstCell.setDate(start.getDate() - ((startDay + 6) % 7)) // Monday-first grid
  const cells = mode==='week' ? 7 : 42
  const days = Array.from({length: cells}, (_,i)=>{
    const d = new Date(firstCell)
    d.setDate(firstCell.getDate()+i)
    return d
  })
  const eventsByDay: Record<string, EventItem[]> = {}
  for (const ev of events) {
    if (!ev.date) continue
    const key = new Date(ev.date).toISOString().slice(0,10)
    ;(eventsByDay[key] ||= []).push(ev)
  }
  return (
    <div className="grid grid-cols-7 gap-px bg-teal-200/60 dark:bg-teal-900/40">
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(h=> (
        <div key={h} className="hidden md:block text-xs text-center py-1 bg-teal-50 dark:bg-teal-900 text-teal-700 dark:text-teal-200">{h}</div>
      ))}
      {days.map(d=>{
        const iso = d.toISOString().slice(0,10)
        const isToday = new Date().toDateString() === d.toDateString()
        return (
          <div key={iso} onClick={()=>onDayClick(iso)} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{ e.preventDefault(); onDrop(iso) }} className={`min-h-[90px] md:min-h-[110px] bg-white dark:bg-gray-800 p-1 text-left hover:bg-teal-50 focus:outline-none ${d.getMonth()===date.getMonth() ? '' : 'opacity-60'}`}>
            <div className={`text-xs ${isToday ? 'text-teal-600 font-semibold' : 'text-gray-500'}`}>{d.getDate()}</div>
            <div className="mt-1 space-y-1">
              {(eventsByDay[iso]||[]).slice(0,3).map(ev=> (
                <div key={ev.id} draggable onDragStart={()=>{ if (ev.type==='task') { const id = Number(String(ev.id).split('-')[1]); onDragStart({ kind:'task', id }) }}} className={`truncate text-[10px] px-1 py-0.5 rounded cursor-move ${ev.type==='followup' ? 'bg-teal-100 text-teal-700' : 'bg-rose-100 text-rose-700'}`}>{ev.title}</div>
              ))}
              {(eventsByDay[iso]||[]).length>3 && <div className="text-[10px] text-gray-400">+{(eventsByDay[iso]||[]).length-3} more</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}


