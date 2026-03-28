'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, TrashIcon, PencilIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

const PlusIconAny: any = PlusIcon
const TrashIconAny: any = TrashIcon
const PencilIconAny: any = PencilIcon
const ArrowPathIconAny: any = ArrowPathIcon

interface Course {
  id: number
  name: string
  code?: string | null
  category?: string | null
  duration?: string | null
  level: string
  description?: string | null
  intake?: string | null
  seats?: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Exactly the four levels the institution uses
const LEVELS = ['All', 'Diploma', 'Certificate', 'Artisan', 'Short Course']
const CATEGORIES = ['Health Sciences', 'Business', 'ICT', 'Engineering', 'Education', 'Agriculture', 'Hospitality', 'Other']

const LEVEL_COLORS: Record<string, string> = {
  'Diploma': 'bg-blue-50 text-blue-700 border-blue-100',
  'Certificate': 'bg-green-50 text-green-700 border-green-100',
  'Artisan': 'bg-orange-50 text-orange-700 border-orange-100',
  'Craft': 'bg-purple-50 text-purple-700 border-purple-100',
  'Higher Diploma': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Degree': 'bg-rose-50 text-rose-700 border-rose-100',
  'Short Course': 'bg-yellow-50 text-yellow-700 border-yellow-100',
}

const emptyForm = { name: '', code: '', category: '', duration: '', level: '', description: '', intake: '', seats: '' }

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [activeLevel, setActiveLevel] = useState('All')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [userRole, setUserRole] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    try {
      const m = document.cookie.match(/(?:^|; )role=([^;]+)/)
      setUserRole((m ? decodeURIComponent(m[1]) : localStorage.getItem('userRole') || '').toLowerCase())
    } catch { setUserRole(localStorage.getItem('userRole') || '') }
  }, [])

  const canManage = userRole === 'admin' || userRole === 'senior_staff'

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proxy/courses', { credentials: 'include' })
      const data = await res.json()
      setCourses(Array.isArray(data) ? data : [])
    } catch { setCourses([]) }
    finally { setLoading(false) }
  }, [])

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/courses/suggest', { credentials: 'include' })
      const data = await res.json()
      setSuggestions(Array.isArray(data) ? data : [])
    } catch {}
  }, [])

  useEffect(() => { fetchCourses(); fetchSuggestions() }, [fetchCourses, fetchSuggestions])

  const openAdd = () => { setForm({ ...emptyForm }); setEditingId(null); setErrors({}); setShowModal(true); setSidebarOpen(false) }
  const openEdit = (c: Course) => {
    setForm({ name: c.name, code: c.code || '', category: c.category || '', duration: c.duration || '', level: c.level, description: c.description || '', intake: c.intake || '', seats: c.seats != null ? String(c.seats) : '' })
    setEditingId(c.id); setErrors({}); setShowModal(true); setSidebarOpen(false)
  }
  const closeModal = () => { setShowModal(false); setEditingId(null); setErrors({}) }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Programme name is required'
    if (!form.level.trim()) e.level = 'Level is required'
    return e
  }

  const handleSave = async () => {
    const v = validate()
    setErrors(v)
    if (Object.keys(v).length > 0) return
    setSaving(true)
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `/api/proxy/courses/${editingId}` : '/api/proxy/courses'
      const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, seats: form.seats ? Number(form.seats) : undefined }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Save failed') }
      closeModal()
      showToast(editingId ? 'Programme updated' : 'Programme added')
      await fetchCourses()
    } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to save', false) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/proxy/courses/${deleteId}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error('Delete failed')
      setDeleteId(null)
      showToast('Programme deleted')
      await fetchCourses()
    } catch (e) { showToast(e instanceof Error ? e.message : 'Failed to delete', false) }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/proxy/courses/seed', { method: 'POST', credentials: 'include' })
      const d = await res.json().catch(() => ({}))
      showToast(`Imported ${d.seeded ?? 0} new programmes from inquiry records`)
      await fetchCourses()
    } catch { showToast('Seed failed', false) }
    finally { setSeeding(false) }
  }

  const levelCounts = LEVELS.reduce((acc, l) => {
    acc[l] = l === 'All' ? courses.length : courses.filter(c => c.level === l).length
    return acc
  }, {} as Record<string, number>)

  const filtered = courses.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q)
    const matchLevel = activeLevel === 'All' || c.level === activeLevel
    return matchSearch && matchLevel
  })

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-0.5'

  return (
    <div className="flex h-full min-h-0 relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 right-4 z-[60] px-4 py-2 rounded shadow-lg text-sm border ${toast.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {toast.msg}
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Left sub-sidebar — level filter */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 lg:z-auto
        w-56 bg-white border-r border-gray-200 flex flex-col shrink-0
        transform transition-transform duration-200 lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Programmes</h2>
              <p className="text-xs text-gray-500 mt-0.5">{courses.length} total</p>
            </div>
            <button className="lg:hidden text-gray-400 hover:text-gray-600" onClick={() => setSidebarOpen(false)}>✕</button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {LEVELS.map(level => (
            <button
              key={level}
              onClick={() => { setActiveLevel(level); setSidebarOpen(false) }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors ${
                activeLevel === level
                  ? 'bg-teal-50 text-teal-700 font-semibold border-r-2 border-teal-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{level}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                activeLevel === level ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
              }`}>{levelCounts[level] ?? 0}</span>
            </button>
          ))}
        </nav>
        {canManage && (
          <div className="p-3 border-t border-gray-200 space-y-2">
            <button
              onClick={openAdd}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 text-white text-sm font-semibold rounded-md hover:bg-teal-700 transition"
            >
              <PlusIconAny className="h-4 w-4" /> Add Programme
            </button>
            {suggestions.length > 0 && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-200 transition disabled:opacity-50"
                title="Auto-import programme names found in inquiry records"
              >
                <ArrowPathIconAny className={`h-3.5 w-3.5 ${seeding ? 'animate-spin' : ''}`} />
                {seeding ? 'Importing…' : `Import from Inquiries (${suggestions.length})`}
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0 flex-wrap">
          <button className="lg:hidden p-1.5 rounded text-gray-600 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">
              {activeLevel === 'All' ? 'All Programmes' : `${activeLevel} Programmes`}
            </h1>
            <p className="text-xs text-gray-500">{filtered.length} programme{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-36 sm:w-48 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          {canManage && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-sm font-semibold rounded-md hover:bg-teal-700 transition"
            >
              <PlusIconAny className="h-4 w-4" /> Add Programme
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading programmes…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              {courses.length === 0
                ? <span>No programmes yet. {canManage && <button onClick={openAdd} className="text-teal-600 underline">Add one</button>}{canManage && suggestions.length > 0 && <> or <button onClick={handleSeed} className="text-teal-600 underline">import from inquiries</button></>}.</span>
                : `No ${activeLevel === 'All' ? '' : activeLevel + ' '}programmes found${search ? ' matching your search' : ''}.`}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm bg-white">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead style={{ backgroundColor: 'var(--brand-table-header-bg, #f1f5f9)', color: 'var(--brand-table-header-text, #374151)' }}>
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold border-b border-gray-200 w-8">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold border-b border-gray-200">Programme Name</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold border-b border-gray-200 hidden sm:table-cell">Code</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold border-b border-gray-200">Level</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold border-b border-gray-200 hidden md:table-cell">Category</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold border-b border-gray-200 hidden md:table-cell">Duration</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold border-b border-gray-200 hidden lg:table-cell">Intake</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold border-b border-gray-200 hidden lg:table-cell">Seats</th>
                    {canManage && <th className="text-right px-3 py-2.5 text-xs font-semibold border-b border-gray-200">Actions</th>}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filtered.map((course, idx) => (
                    <tr key={course.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                      <td className="px-3 py-2 border-b border-gray-100 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 border-b border-gray-100 font-medium text-gray-800">{course.name}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-gray-500 text-xs hidden sm:table-cell">{course.code || '—'}</td>
                      <td className="px-3 py-2 border-b border-gray-100">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium border ${LEVEL_COLORS[course.level] || 'bg-gray-50 text-gray-700 border-gray-100'}`}>{course.level}</span>
                      </td>
                      <td className="px-3 py-2 border-b border-gray-100 text-gray-600 text-xs hidden md:table-cell">{course.category || '—'}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-gray-600 text-xs hidden md:table-cell">{course.duration || '—'}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-gray-500 text-xs hidden lg:table-cell">{course.intake || '—'}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-gray-500 text-xs hidden lg:table-cell">{course.seats ?? '—'}</td>
                      {canManage && (
                        <td className="px-3 py-2 border-b border-gray-100 text-right whitespace-nowrap">
                          <button onClick={() => openEdit(course)} className="text-teal-600 hover:text-teal-800 mr-2" title="Edit">
                            <PencilIconAny className="h-4 w-4 inline" />
                          </button>
                          <button onClick={() => setDeleteId(course.id)} className="text-rose-500 hover:text-rose-700" title="Delete">
                            <TrashIconAny className="h-4 w-4 inline" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && canManage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">{editingId ? 'Edit Programme' : 'Add New Programme'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Programme Name — with autocomplete from inquiry data */}
              <div className="sm:col-span-2">
                <label className={labelCls}>Programme Name *</label>
                <input
                  list="suggestions-list"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Diploma in Nursing"
                />
                <datalist id="suggestions-list">
                  {suggestions.map(s => <option key={s} value={s} />)}
                </datalist>
                {errors.name && <p className="text-rose-500 text-xs mt-0.5">{errors.name}</p>}
              </div>
              <div>
                <label className={labelCls}>Level *</label>
                <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} className={inputCls}>
                  <option value="">Select level…</option>
                  {LEVELS.filter(l => l !== 'All').map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                {errors.level && <p className="text-rose-500 text-xs mt-0.5">{errors.level}</p>}
              </div>
              <div>
                <label className={labelCls}>Programme Code</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inputCls} placeholder="e.g. DIP-NRS-01" />
              </div>
              <div>
                <label className={labelCls}>Category / Department</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                  <option value="">Select category…</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Duration</label>
                <input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className={inputCls} placeholder="e.g. 2 years, 18 months" />
              </div>
              <div>
                <label className={labelCls}>Intake Period</label>
                <input value={form.intake} onChange={e => setForm(f => ({ ...f, intake: e.target.value }))} className={inputCls} placeholder="e.g. January / September / Annual" />
              </div>
              <div>
                <label className={labelCls}>Max Seats per Intake</label>
                <input type="number" min="0" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} className={inputCls} placeholder="e.g. 40" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} rows={3} placeholder="Short description of the programme (optional)" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={closeModal} className="px-4 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-1.5 text-sm font-semibold rounded-md text-white disabled:opacity-50 transition"
                style={{ backgroundColor: 'var(--brand-action-btn, #0d9488)' }}
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Programme'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-semibold text-gray-800 mb-2">Delete Programme</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-1.5 text-sm bg-rose-600 text-white rounded-md hover:bg-rose-700 font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
