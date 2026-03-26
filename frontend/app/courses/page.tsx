'use client'

import { useState, useEffect } from 'react'
import { WEB_API } from '@/utils/api'
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

const PlusIconAny: any = PlusIcon
const TrashIconAny: any = TrashIcon
const PencilIconAny: any = PencilIcon

interface Course {
  id: string
  name: string
  code?: string
  category: string
  duration: string
  level: string
  description?: string
  createdAt: string
  updatedAt: string
}

const LEVELS = ['All', 'Diploma', 'Certificate', 'Artisan', 'Craft', 'Higher Diploma', 'Degree', 'Short Course']
const CATEGORIES = ['Health Sciences', 'Business', 'ICT', 'Engineering', 'Education', 'Agriculture', 'Other']

const LEVEL_COLORS: Record<string, string> = {
  'Diploma': 'bg-blue-50 text-blue-700 border-blue-100',
  'Certificate': 'bg-green-50 text-green-700 border-green-100',
  'Artisan': 'bg-orange-50 text-orange-700 border-orange-100',
  'Craft': 'bg-purple-50 text-purple-700 border-purple-100',
  'Higher Diploma': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Degree': 'bg-rose-50 text-rose-700 border-rose-100',
  'Short Course': 'bg-yellow-50 text-yellow-700 border-yellow-100',
}

const emptyForm = { name: '', code: '', category: '', duration: '', level: '', description: '' }

function userHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem('tenant') || ''
    if (t) h['x-tenant'] = t
  }
  return h
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeLevel, setActiveLevel] = useState('All')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [userRole, setUserRole] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const m = document.cookie.match(/(?:^|; )role=([^;]+)/)
        const c = m ? decodeURIComponent(m[1]) : ''
        setUserRole(c || localStorage.getItem('userRole') || '')
      } catch {
        setUserRole(localStorage.getItem('userRole') || '')
      }
    }
  }, [])

  const canManage = userRole === 'admin' || userRole === 'senior_staff'

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${WEB_API}/courses`, { credentials: 'include', headers: userHeaders() })
      const data = await res.json()
      setCourses(Array.isArray(data) ? data : [])
    } catch {
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCourses() }, [])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Course name is required'
    if (!form.category.trim()) e.category = 'Category is required'
    if (!form.duration.trim()) e.duration = 'Duration is required'
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
      const url = editingId ? `${WEB_API}/courses/${editingId}` : `${WEB_API}/courses`
      const res = await fetch(url, { method, credentials: 'include', headers: userHeaders(), body: JSON.stringify(form) })
      if (!res.ok) throw new Error('Save failed')
      setShowForm(false)
      setEditingId(null)
      setForm({ ...emptyForm })
      setErrors({})
      await fetchCourses()
    } catch {
      alert('Failed to save course.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (course: Course) => {
    setForm({ name: course.name, code: course.code || '', category: course.category, duration: course.duration, level: course.level, description: course.description || '' })
    setEditingId(course.id)
    setShowForm(true)
    setErrors({})
    setSidebarOpen(false)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await fetch(`${WEB_API}/courses/${deleteId}`, { method: 'DELETE', credentials: 'include', headers: userHeaders() })
      setDeleteId(null)
      await fetchCourses()
    } catch {
      alert('Failed to delete course.')
    }
  }

  const levelCounts = LEVELS.reduce((acc, l) => {
    acc[l] = l === 'All' ? courses.length : courses.filter(c => c.level === l).length
    return acc
  }, {} as Record<string, number>)

  const filtered = courses.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    const matchLevel = activeLevel === 'All' || c.level === activeLevel
    return matchSearch && matchLevel
  })

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-0.5'

  return (
    <div className="flex h-full min-h-0">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Left sub-sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 lg:z-auto
        w-56 bg-white border-r border-gray-200 flex flex-col shrink-0
        transform transition-transform duration-200 lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Courses</h2>
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
              {levelCounts[level] > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  activeLevel === level ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
                }`}>{levelCounts[level]}</span>
              )}
            </button>
          ))}
        </nav>
        {canManage && (
          <div className="p-3 border-t border-gray-200">
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...emptyForm }); setErrors({}); setSidebarOpen(false) }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 text-white text-sm font-semibold rounded-md hover:bg-teal-700 transition"
            >
              <PlusIconAny className="h-4 w-4" /> Add Course
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <button className="lg:hidden p-1.5 rounded text-gray-600 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">
              {activeLevel === 'All' ? 'All Courses' : `${activeLevel} Programmes`}
            </h1>
            <p className="text-xs text-gray-500">{filtered.length} course{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-40 sm:w-52 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Add/Edit Form */}
          {showForm && canManage && (
            <div className="mb-5 bg-white border border-gray-200 rounded-lg shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-800">{editingId ? 'Edit Course' : 'Add New Course'}</h2>
                <button onClick={() => { setShowForm(false); setEditingId(null); setErrors({}) }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Course Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Diploma in Nursing" />
                  {errors.name && <p className="text-rose-500 text-xs mt-0.5">{errors.name}</p>}
                </div>
                <div>
                  <label className={labelCls}>Course Code</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inputCls} placeholder="e.g. DIP-NRS-01" />
                </div>
                <div>
                  <label className={labelCls}>Level *</label>
                  <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} className={inputCls}>
                    <option value="">Select level...</option>
                    {LEVELS.filter(l => l !== 'All').map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {errors.level && <p className="text-rose-500 text-xs mt-0.5">{errors.level}</p>}
                </div>
                <div>
                  <label className={labelCls}>Category *</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                    <option value="">Select category...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.category && <p className="text-rose-500 text-xs mt-0.5">{errors.category}</p>}
                </div>
                <div>
                  <label className={labelCls}>Duration *</label>
                  <input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className={inputCls} placeholder="e.g. 2 years, 18 months" />
                  {errors.duration && <p className="text-rose-500 text-xs mt-0.5">{errors.duration}</p>}
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Short description (optional)" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setShowForm(false); setEditingId(null); setErrors({}) }} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 font-semibold">
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Course'}
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading courses...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              {courses.length === 0
                ? 'No courses added yet. Click "Add Course" to get started.'
                : `No ${activeLevel === 'All' ? '' : activeLevel + ' '}courses found${search ? ' matching your search' : ''}.`}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm bg-white">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200 w-8">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200">Course Name</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200 hidden sm:table-cell">Code</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200">Level</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200 hidden md:table-cell">Category</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200 hidden md:table-cell">Duration</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200 hidden lg:table-cell">Description</th>
                    {canManage && <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200">Actions</th>}
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
                      <td className="px-3 py-2 border-b border-gray-100 text-gray-600 text-xs hidden md:table-cell">{course.category}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-gray-600 text-xs hidden md:table-cell">{course.duration}</td>
                      <td className="px-3 py-2 border-b border-gray-100 text-gray-400 text-xs hidden lg:table-cell max-w-[180px] truncate" title={course.description}>{course.description || '—'}</td>
                      {canManage && (
                        <td className="px-3 py-2 border-b border-gray-100 text-right whitespace-nowrap">
                          <button onClick={() => handleEdit(course)} className="text-teal-600 hover:text-teal-800 mr-2" title="Edit">
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

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-semibold text-gray-800 mb-2">Delete Course</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this course? This action cannot be undone.</p>
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
