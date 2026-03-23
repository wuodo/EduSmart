'use client'

import { useState, useEffect } from 'react'
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

interface User {
  id: number
  email: string
  name?: string
  role: string
}

interface Props {
  onClose: () => void
  onStartChat: (participantEmail: string) => void
}

export default function NewChatModal({ onClose, onStartChat }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const userHeaders = () => ({} as Record<string, string>)

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${WEB_API}/chat/users`, {
        headers: userHeaders(),
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase()
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower)
    )
  })

  const handleStartChat = () => {
    if (selectedUser) {
      onStartChat(selectedUser.email)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-teal-100 text-teal-800'
      case 'senior_staff':
        return 'bg-sky-100 text-sky-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={modalOverlayClass}>
      <div className={`${modalPanelClass} max-w-md mx-4`}>
        <div className={modalHeaderClass}>
          <h2 className={modalTitleClass}>New Conversation</h2>
          <button onClick={onClose} className={modalCloseButtonClass} aria-label="Close">
            ✕
          </button>
        </div>

          {/* Search input */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Users list */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                <span className="ml-2 text-gray-500">Loading users...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                {searchQuery ? 'No users found' : 'No users available'}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedUser?.id === user.id
                      ? 'border-primary bg-teal-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {user.name || user.email}
                      </div>
                      {user.name && (
                        <div className="text-sm text-gray-500">{user.email}</div>
                      )}
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    {selectedUser?.id === user.id && (
                      <div className="text-primary">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              onClick={handleStartChat}
              disabled={!selectedUser}
              className={primaryButtonClass}
            >
              Start Chat
            </button>
          </div>
      </div>
    </div>
  )
}
