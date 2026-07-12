"use client";
import { useEffect, useState, useCallback } from 'react';
import { format, addDays, subDays, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, getHours, getMinutes, setHours, setMinutes } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Search, Clock, CalendarDays, List, Check, Trash2, Sun, Moon, Filter } from 'lucide-react';

type CalendarEvent = {
  id: string; dbId: number; title: string; date: string; type: 'followup' | 'task';
  subType: string; status: string; notes?: string; assignedTo?: string;
  ownerEmail?: string; inquiryId?: number; color: string;
};

type ViewMode = 'month' | 'week' | 'day';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const COLOR_LABELS: Record<string, string> = { call: '#0d9488', sms: '#6366f1', whatsapp: '#22c55e', email: '#3b82f6', meeting: '#f59e0b', demo: '#8b5cf6', followup: '#0d9488', task: '#6b7280' };

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDate, setCreateDate] = useState('');
  const [createInquiryId, setCreateInquiryId] = useState('');
  const [createType, setCreateType] = useState('call');
  const [createNotes, setCreateNotes] = useState('');
  const [inquiries, setInquiries] = useState<{ id: number; fullName: string }[]>([]);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (view === 'month') { params.set('month', String(currentDate.getMonth())); params.set('year', String(currentDate.getFullYear())); }
    if (search) params.set('search', search);
    if (filterType !== 'all') params.set('type', filterType);
    try {
      const r = await fetch(`/api/proxy/calendar/events?${params}`);
      const d = await r.json();
      if (d.events) setEvents(d.events);
    } catch {}
    setLoading(false);
  }, [currentDate, view, search, filterType]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (showCreateModal && inquiries.length === 0) {
      fetch('/api/proxy/inquiries?limit=100').then(r => r.json()).then(d => {
        const list = d.inquiries || d.data || d;
        if (Array.isArray(list)) setInquiries(list.map((i: any) => ({ id: i.id, fullName: i.fullName })));
      }).catch(() => {});
    }
  }, [showCreateModal, inquiries.length]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
  });

  const weekDays = eachDayOfInterval({ start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) });

  const eventsForDay = (date: Date) => events.filter(e => {
    const d = parseISO(e.date);
    return isSameDay(d, date);
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const eventsForHour = (date: Date, hour: number) => eventsForDay(date).filter(e => getHours(parseISO(e.date)) === hour);

  const handleDayClick = (date: Date) => {
    setCreateDate(date.toISOString().slice(0, 16));
    setShowCreateModal(true);
  };

  const handleEventClick = (e: CalendarEvent) => {
    setSelectedEvent(e);
    setShowEditModal(true);
  };

  const createFollowup = async () => {
    if (!createInquiryId || !createDate) return;
    const r = await fetch('/api/proxy/calendar/followups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inquiryId: Number(createInquiryId), type: createType, scheduledFor: createDate, notes: createNotes }),
    });
    if (r.ok) { setShowCreateModal(false); fetchEvents(); }
  };

  const completeEvent = async (ev: CalendarEvent) => {
    if (ev.type === 'followup') await fetch(`/api/proxy/calendar/followups/${ev.dbId}/complete`, { method: 'POST' });
    else await fetch(`/api/proxy/calendar/tasks/${ev.dbId}/complete`, { method: 'POST' });
    setShowEditModal(false); fetchEvents();
  };

  const deleteEvent = async (ev: CalendarEvent) => {
    if (ev.type === 'followup') await fetch(`/api/proxy/inquiries/${ev.dbId}`).catch(() => {});
    else await fetch(`/api/proxy/calendar/tasks/${ev.dbId}`, { method: 'DELETE' });
    setShowEditModal(false); fetchEvents();
  };

  const rescheduleEvent = async (ev: CalendarEvent, newDate: string) => {
    const endpoint = ev.type === 'followup' ? `/api/proxy/calendar/followups/${ev.dbId}/reschedule` : `/api/proxy/calendar/tasks/${ev.dbId}/reschedule`;
    await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduledFor: newDate, dueDate: newDate }) });
    fetchEvents();
  };

  const handleDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    if (!draggedEvent) return;
    const newDate = setHours(setMinutes(date, 0), getHours(parseISO(draggedEvent.date)) || 9);
    await rescheduleEvent(draggedEvent, newDate.toISOString());
    setDraggedEvent(null);
  };

  const navigate = (dir: number) => {
    if (view === 'month') setCurrentDate(dir < 0 ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(dir < 0 ? subDays(currentDate, 7) : addDays(currentDate, 7));
    else setCurrentDate(dir < 0 ? subDays(currentDate, 1) : addDays(currentDate, 1));
  };

  const viewLabel = view === 'month' ? format(currentDate, 'MMMM yyyy') : view === 'week' ? `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}` : format(currentDate, 'EEEE, MMMM d, yyyy');

  const todayEvents = events.filter(e => isSameDay(parseISO(e.date), new Date()));
  const overdue = events.filter(e => e.status === 'pending' && new Date(e.date) < new Date());
  const pending = events.filter(e => e.status === 'pending');
  const completed = events.filter(e => e.status === 'completed');

  const filteredEvents = events.filter(e => {
    if (search) { const q = search.toLowerCase(); if (!e.title.toLowerCase().includes(q) && !(e.notes || '').toLowerCase().includes(q)) return false; }
    if (filterType !== 'all' && e.subType !== filterType && e.type !== filterType) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-3 text-xs text-gray-500 border-l-2 border-teal-400 pl-3 py-1 bg-teal-50/30">
        <strong>Calendar</strong> — View and manage all follow-ups and tasks in one place. Schedule new follow-ups, track overdue items, and stay on top of daily priorities. Click any date to create a follow-up, drag events to reschedule.
      </div>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div className="bg-white border p-2.5"><div className="text-lg font-bold text-teal-600">{todayEvents.length}</div><div className="text-[10px] text-gray-500">Today</div></div>
        <div className="bg-white border p-2.5"><div className="text-lg font-bold text-amber-600">{overdue.length}</div><div className="text-[10px] text-gray-500">Overdue</div></div>
        <div className="bg-white border p-2.5"><div className="text-lg font-bold text-blue-600">{pending.length}</div><div className="text-[10px] text-gray-500">Pending</div></div>
        <div className="bg-white border p-2.5"><div className="text-lg font-bold text-green-600">{completed.length}</div><div className="text-[10px] text-gray-500">Completed</div></div>
      </div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded"><ChevronLeft size={18} /></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-2 py-1 text-xs font-medium hover:bg-gray-100 rounded">Today</button>
          <button onClick={() => navigate(1)} className="p-1.5 hover:bg-gray-100 rounded"><ChevronRight size={18} /></button>
          <h2 className="text-lg font-semibold ml-2">{viewLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..." className="pl-8 pr-3 py-1.5 text-xs border rounded w-44 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-xs border rounded px-2 py-1.5">
            <option value="all">All types</option><option value="call">Call</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="followup">Follow-ups</option><option value="task">Tasks</option>
          </select>
          <div className="flex bg-gray-100 rounded p-0.5">
            {(['month', 'week', 'day'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-xs rounded font-medium capitalize ${view === v ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {view === 'month' && (
        <div className="flex-1 bg-white border rounded-xl flex flex-col min-h-0">
          <div className="grid grid-cols-7 border-b">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>)}
          </div>
          <div className="flex-1 grid grid-cols-7 auto-rows-fr" onDragOver={e => e.preventDefault()}>
            {days.map((day, i) => {
              const dayEvents = eventsForDay(day);
              return (
                <div key={i} className={`border-b border-r p-1 min-h-[80px] relative group ${!isSameMonth(day, currentDate) ? 'bg-gray-50/50' : ''}`} onDrop={e => handleDrop(e, day)} onDragOver={e => e.preventDefault()}>
                  <span className={`text-xs font-medium ${isToday(day) ? 'bg-teal-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-gray-600'} ${!isSameMonth(day, currentDate) ? 'opacity-40' : ''}`}>{format(day, 'd')}</span>
                  <button onClick={() => handleDayClick(day)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded"><Plus size={12} className="text-gray-400" /></button>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} onClick={() => handleEventClick(ev)} draggable onDragStart={() => setDraggedEvent(ev)} className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 text-white" style={{ backgroundColor: ev.color }}>
                        {format(parseISO(ev.date), 'HH:mm')} {ev.title.slice(0, 25)}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="flex-1 bg-white border rounded-xl flex flex-col min-h-0 overflow-auto">
          <div className="grid grid-cols-7 border-b sticky top-0 bg-white z-10">
            {weekDays.map((day, i) => (
              <div key={i} className={`text-center py-2 border-r ${isToday(day) ? 'bg-teal-50' : ''}`}>
                <div className="text-[10px] text-gray-500">{format(day, 'EEE')}</div>
                <div className={`text-sm font-semibold ${isToday(day) ? 'text-teal-600' : 'text-gray-700'}`}>{format(day, 'd')}</div>
              </div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7 min-h-0" onDragOver={e => e.preventDefault()}>
            {weekDays.map((day, di) => {
              const dayEvents = eventsForDay(day);
              return (
                <div key={di} className="border-r p-1 relative" onDrop={e => handleDrop(e, day)} onDragOver={e => e.preventDefault()}>
                  <button onClick={() => handleDayClick(day)} className="absolute top-1 right-1 p-0.5 hover:bg-gray-100 rounded"><Plus size={12} className="text-gray-400" /></button>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.map(ev => (
                      <div key={ev.id} onClick={() => handleEventClick(ev)} draggable onDragStart={() => setDraggedEvent(ev)} className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 text-white" style={{ backgroundColor: ev.color }}>
                        {format(parseISO(ev.date), 'HH:mm')} {ev.title.slice(0, 20)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'day' && (
        <div className="flex-1 bg-white border rounded-xl overflow-y-auto" onDragOver={e => e.preventDefault()}>
          {HOURS.map(hour => {
            const hourEvents = eventsForHour(currentDate, hour);
            return (
              <div key={hour} className="flex border-b min-h-[60px] group" onDrop={e => {
                e.preventDefault();
                if (draggedEvent) {
                  const newDate = setHours(setMinutes(currentDate, 0), hour);
                  rescheduleEvent(draggedEvent, newDate.toISOString());
                  setDraggedEvent(null);
                }
              }} onDragOver={e => e.preventDefault()}>
                <div className="w-16 text-right pr-3 py-1 text-[11px] text-gray-400 font-medium border-r shrink-0">{hour.toString().padStart(2, '0')}:00</div>
                <div className="flex-1 relative min-h-[60px] p-1">
                  <button onClick={() => { const d = setHours(setMinutes(currentDate, 30), hour); setCreateDate(d.toISOString().slice(0, 16)); setShowCreateModal(true); }} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 rounded"><Plus size={12} className="text-gray-400" /></button>
                  {hourEvents.map(ev => (
                    <div key={ev.id} onClick={() => handleEventClick(ev)} draggable onDragStart={() => setDraggedEvent(ev)} className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded text-xs cursor-pointer hover:opacity-80 text-white" style={{ backgroundColor: ev.color }}>
                      <span className="font-medium">{format(parseISO(ev.date), 'HH:mm')}</span>
                      <span className="truncate">{ev.title}</span>
                      <span className="text-white/70 text-[10px] ml-auto">{ev.subType}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: selectedEvent.color }}></div>
                <h3 className="font-semibold text-gray-900">{selectedEvent.title}</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2"><Clock size={14} /> {format(parseISO(selectedEvent.date), 'EEEE, MMMM d, yyyy HH:mm')}</div>
              <div className="flex items-center gap-2"><Filter size={14} /> Type: {selectedEvent.subType || selectedEvent.type}</div>
              <div className="flex items-center gap-2"><Sun size={14} /> Status: <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${selectedEvent.status === 'completed' ? 'bg-green-100 text-green-700' : selectedEvent.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{selectedEvent.status}</span></div>
              {selectedEvent.assignedTo && <div className="flex items-center gap-2"><Moon size={14} /> Assigned: {selectedEvent.assignedTo}</div>}
              {selectedEvent.notes && <div className="mt-2 p-2 bg-gray-50 rounded text-xs">{selectedEvent.notes}</div>}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t">
              <button onClick={() => completeEvent(selectedEvent)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"><Check size={14} /> Mark Complete</button>
              <button onClick={() => deleteEvent(selectedEvent)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700"><Trash2 size={14} /> Delete</button>
              <button onClick={() => setShowEditModal(false)} className="px-3 py-1.5 border text-xs rounded hover:bg-gray-50 ml-auto">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Follow-up Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Schedule Follow-up</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500 block mb-0.5">Inquiry</label>
                <input value={createInquiryId} onChange={e => setCreateInquiryId(e.target.value)} placeholder="Enter inquiry ID or search..." list="inquiry-list" className="w-full border rounded px-2 py-1.5 text-sm" />
                <datalist id="inquiry-list">{inquiries.map(i => <option key={i.id} value={String(i.id)}>{i.id} - {i.fullName}</option>)}</datalist>
              </div>
              <div><label className="text-xs text-gray-500 block mb-0.5">Type</label>
                <select value={createType} onChange={e => setCreateType(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="call">Call</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option>
                </select>
              </div>
              <div><label className="text-xs text-gray-500 block mb-0.5">Date & Time</label>
                <input type="datetime-local" value={createDate} onChange={e => setCreateDate(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div><label className="text-xs text-gray-500 block mb-0.5">Notes</label>
                <textarea value={createNotes} onChange={e => setCreateNotes(e.target.value)} rows={3} className="w-full border rounded px-2 py-1.5 text-sm resize-none" />
              </div>
              <button onClick={createFollowup} className="w-full py-2 bg-teal-600 text-white text-sm rounded font-medium hover:bg-teal-700">Create Follow-up</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
