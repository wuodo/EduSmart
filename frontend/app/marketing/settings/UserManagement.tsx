'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { EyeIcon as EyeIconHero, EyeSlashIcon as EyeSlashIconHero } from '@heroicons/react/24/outline'

const EyeIcon = EyeIconHero as React.ElementType
const EyeSlashIcon = EyeSlashIconHero as React.ElementType

type Role = 'admin' | 'senior_staff' | 'admissions_officer'

type User = {
  id: number
  email: string
  role: Role
  approved?: boolean
  name?: string | null
  gender?: string | null
  phone?: string | null
  createdAt?: string
}

function getUserHeaders() {
  return {};
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('admissions_officer')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const isAdmin = useMemo(() => {
    if (typeof window === 'undefined') return true
    try {
      const m = document.cookie.match(/(?:^|; )role=([^;]+)/)
      const r = (m ? decodeURIComponent(m[1]) : '').toLowerCase()
      if (r) return r === 'admin' || r === 'senior_staff'
    } catch {}
    // Until role known, allow actions to avoid false disable in admin flow
    return true
  }, [])

  async function loadUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/users', {
        credentials: 'include',
        headers: getUserHeaders(),
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `Failed to fetch users (${res.status})`)
      }
      setUsers(Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function openCreateModal() {
    setShowCreateModal(true)
    setCreateError(null)
    setEmail('')
    setPassword('')
    setRole('admissions_officer')
    setName('')
    setPhone('')
    setGender('')
  }

  function closeCreateModal() {
    setShowCreateModal(false)
    setCreateError(null)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCreateError(null)
    setCreateLoading(true)
    try {
      const res = await fetch('/api/proxy/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
        body: JSON.stringify({ email, password, role, name: name || undefined, phone: phone || undefined, gender: gender || undefined })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.message || body?.error || 'Failed to create user')
      }
      setSuccess('User created successfully')
      setTimeout(() => setSuccess(null), 2000)
      closeCreateModal()
      await loadUsers()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create user')
      setError(e instanceof Error ? e.message : 'Failed to create user')
    } finally {
      setCreateLoading(false)
    }
  }

  async function deleteUser(id: number) {
    if (!confirm('Delete this user?')) return
    try {
      const res = await fetch(`/api/proxy/users/${id}`, { method: 'DELETE', headers: getUserHeaders() })
      if (!res.ok) throw new Error('Failed to delete user')
      await loadUsers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user')
    }
  }

  // Edit modal state
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditOpen = editingId !== null
  const [editRole, setEditRole] = useState<Role>('admissions_officer')
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editApproved, setEditApproved] = useState<boolean>(true)

  function startEdit(u: User) {
    setEditingId(u.id)
    setEditRole(u.role)
    setEditName(u.name || '')
    setEditPhone(u.phone || '')
    setEditGender(u.gender || '')
    setEditApproved(u.approved !== false)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(u: User) {
    try {
      setError(null)
      const payload: any = {
        role: editRole,
        approved: editApproved,
        name: editName || null,
        phone: editPhone || null,
        gender: editGender || null,
      }
      const res = await fetch(`/api/proxy/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || body?.error || 'Failed to update user')
      }
      setSuccess('User updated')
      setTimeout(() => setSuccess(null), 1500)
      setEditingId(null)
      await loadUsers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user')
    }
  }

  // Change password modal state
  const [pwUserId, setPwUserId] = useState<number | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  function openPasswordModal(userId: number) {
    setPwUserId(userId)
    setPw1('')
    setPw2('')
    setPwError(null)
    setPwOpen(true)
  }

  function closePasswordModal() {
    setPwOpen(false)
    setPwUserId(null)
    setPw1('')
    setPw2('')
    setPwError(null)
  }

  async function submitPasswordChange() {
    try {
      if (!pwUserId) return
      if (pw1.length < 6) { setPwError('Password must be at least 6 characters'); return }
      if (pw1 !== pw2) { setPwError('Passwords do not match'); return }
      setPwLoading(true)
      setPwError(null)
      const res = await fetch(`/api/proxy/users/${pwUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
        body: JSON.stringify({ password: pw1 })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || body?.error || 'Failed to change password')
      }
      setPwLoading(false)
      setSuccess('Password updated')
      setTimeout(() => setSuccess(null), 1500)
      closePasswordModal()
    } catch (e) {
      setPwLoading(false)
      setPwError(e instanceof Error ? e.message : 'Failed to change password')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">User Management</h2>
          <p className="text-sm text-gray-600">Create and manage system users.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadUsers} className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50">Refresh</button>
          <button onClick={openCreateModal} disabled={!isAdmin} className={`px-4 py-2 rounded text-white ${isAdmin ? 'bg-primary hover:bg-primary/90' : 'bg-gray-400 cursor-not-allowed'}`}>Create User</button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded border border-rose-200 bg-rose-50 text-rose-700">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded border border-green-300 bg-green-50 text-green-700">{success}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded border">
        <div className="px-4 py-2 border-b font-medium flex items-center justify-between">
          <span>Users ({users.length})</span>
          {loading && <span className="text-sm text-gray-500">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-gray-50/80">
              <tr className="text-left">
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800">Name</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800">Email</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800">Role</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800">Phone</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800">Gender</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800">Approved</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800">Created</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 ? (
                <tr><td className="px-3 py-2 text-[13px]" colSpan={8}>No users found.</td></tr>
              ) : users.map(u => {
                return (
                  <tr key={u.id}>
                    <td className="px-3 py-2 text-[13px] align-top">
                      <div className="font-medium">{u.name?.trim() ? u.name : u.email}</div>
                    </td>
                    <td className="px-3 py-2 text-[13px] align-top">
                      <div className="text-gray-700">{u.email}</div>
                    </td>
                    <td className="px-3 py-2 text-[13px] align-top">
                      <span className="px-2 py-0.5 rounded bg-gray-100 border text-gray-700">{u.role}</span>
                    </td>
                    <td className="px-3 py-2 text-[13px] align-top">
                      <span className="text-gray-700">{u.phone || '-'}</span>
                    </td>
                    <td className="px-3 py-2 text-[13px] align-top">
                      <span className="text-gray-700">{u.gender || '-'}</span>
                    </td>
                    <td className="px-3 py-2 text-[13px] align-top">
                      <span className={`px-2 py-0.5 rounded border ${u.approved === false ? 'bg-teal-100 text-teal-800 border-teal-200' : 'bg-green-50 text-green-700 border-green-200'}`}>{u.approved === false ? 'No' : 'Yes'}</span>
                    </td>
                    <td className="px-3 py-2 text-[13px] align-top text-gray-600">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-3 py-2 text-[13px] align-top">
                      <div className="flex justify-end gap-2">
                        <>
                          <button disabled={!isAdmin} onClick={() => startEdit(u)} className={`px-3 py-1.5 rounded border ${isAdmin ? 'bg-white hover:bg-gray-50' : 'bg-gray-100 cursor-not-allowed'}`}>Edit</button>
                          <button disabled={!isAdmin} onClick={() => openPasswordModal(u.id)} className={`px-3 py-1.5 rounded border ${isAdmin ? 'bg-white hover:bg-gray-50' : 'bg-gray-100 cursor-not-allowed'}`}>Change Password</button>
                          <button disabled={!isAdmin} onClick={() => deleteUser(u.id)} className={`px-3 py-1.5 rounded border ${isAdmin ? 'border-rose-300 text-rose-500 hover:bg-rose-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>Delete</button>
                        </>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeCreateModal} />
          <div className="relative bg-white rounded shadow-lg w-full max-w-md mx-4">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Create New User</div>
              <button onClick={closeCreateModal} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">Close</button>
            </div>
            <form onSubmit={createUser} className="p-5 space-y-4">
              {createError && <div className="p-2 rounded border border-rose-200 bg-rose-50 text-rose-700 text-sm">{createError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input className="border rounded px-3 py-2 w-full" type="email" placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <PasswordField value={password} onChange={setPassword} placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select className="border rounded px-3 py-2 w-full" value={role} onChange={e => setRole(e.target.value as Role)}>
                  <option value="admissions_officer">Admissions Officer</option>
                  <option value="senior_staff">Senior Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name (optional)</label>
                <input className="border rounded px-3 py-2 w-full" type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                <input className="border rounded px-3 py-2 w-full" type="tel" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender (optional)</label>
                <select className="border rounded px-3 py-2 w-full" value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={closeCreateModal} className="px-4 py-2 rounded border bg-white hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={createLoading || !isAdmin} className={`px-4 py-2 rounded text-white ${isAdmin ? 'bg-primary hover:bg-primary/90' : 'bg-gray-400 cursor-not-allowed'}`}>{createLoading ? 'Creating...' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closePasswordModal} />
          <div className="relative bg-white rounded shadow-lg w-full max-w-md mx-4">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Change Password</div>
              <button onClick={closePasswordModal} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">Close</button>
            </div>
            <div className="p-5 space-y-4">
              {pwError && <div className="p-2 rounded border border-rose-200 bg-rose-50 text-rose-700 text-sm">{pwError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <PasswordField value={pw1} onChange={setPw1} placeholder="Enter new password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <PasswordField value={pw2} onChange={setPw2} placeholder="Re-enter new password" />
              </div>
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button onClick={closePasswordModal} className="px-4 py-2 rounded border bg-white hover:bg-gray-50">Cancel</button>
              <button onClick={submitPasswordChange} disabled={pwLoading || !isAdmin} className={`px-4 py-2 rounded text-white ${isAdmin ? 'bg-primary hover:bg-primary/90' : 'bg-gray-400 cursor-not-allowed'}`}>{pwLoading ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelEdit} />
          <div className="relative bg-white rounded shadow-lg w-full max-w-xl mx-4">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Edit User</div>
              <button onClick={cancelEdit} className="px-2 py-1 rounded border bg-white hover:bg-gray-50">Close</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select className="border rounded px-3 py-2 w-full" value={editRole} onChange={e => setEditRole(e.target.value as Role)}>
                  <option value="admissions_officer">Admissions Officer</option>
                  <option value="senior_staff">Senior Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Approved</label>
                <label className="inline-flex items-center gap-2 text-gray-700">
                  <input type="checkbox" checked={editApproved} onChange={e => setEditApproved(e.target.checked)} />
                  <span>Approved</span>
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input className="border rounded px-3 py-2 w-full" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input className="border rounded px-3 py-2 w-full" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select className="border rounded px-3 py-2 w-full" value={editGender} onChange={e => setEditGender(e.target.value)}>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button onClick={cancelEdit} className="px-4 py-2 rounded border bg-white hover:bg-gray-50">Cancel</button>
              <button onClick={() => saveEdit(users.find(u => u.id === editingId)!)} className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PasswordField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded px-3 py-2 pr-10"
      />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
      </button>
    </div>
  )
}


