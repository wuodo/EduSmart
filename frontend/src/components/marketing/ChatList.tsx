'use client'

import { format } from 'date-fns'

interface ChatRoom {
  id: number
  name?: string
  type: string
  unreadCount?: number
  otherParticipants: Array<{
    id: number
    email: string
    name?: string
    role: string
  }>
  lastMessage?: {
    id: number
    content: string
    sender: {
      id: number
      email: string
      name?: string
    }
    createdAt: string
  }
  updatedAt: string
}

interface Props {
  chatRooms: ChatRoom[]
  selectedChat: ChatRoom | null
  onSelectChat: (chat: ChatRoom) => void
  loading: boolean
}

export default function ChatList({ chatRooms, selectedChat, onSelectChat, loading }: Props) {
  if (loading) {
    return (
      <div className="flex-1 p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 rounded w-1/2 mt-2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (chatRooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No conversations</h3>
          <p className="mt-1 text-sm text-gray-500">Start a new conversation to begin messaging</p>
        </div>
      </div>
    )
  }

  const getDisplayName = (chat: ChatRoom) => {
    if (chat.name) return chat.name
    if (chat.otherParticipants.length > 0) {
      const participant = chat.otherParticipants[0]
      return participant.name || participant.email
    }
    return 'Unknown User'
  }

  const getLastMessagePreview = (chat: ChatRoom) => {
    if (!chat.lastMessage) return 'No messages yet'
    
    const senderName = chat.lastMessage.sender.name || chat.lastMessage.sender.email
    const content = chat.lastMessage.content.length > 50 
      ? chat.lastMessage.content.substring(0, 50) + '...'
      : chat.lastMessage.content
    
    return `${senderName}: ${content}`
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'now'
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`
    return format(date, 'MMM d')
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {chatRooms.map((chat) => (
        <div
          key={chat.id}
          onClick={() => onSelectChat(chat)}
          className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
            selectedChat?.id === chat.id ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700' : ''
          }`}
        >
          <div className="flex items-start space-x-3">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                {getDisplayName(chat).charAt(0).toUpperCase()}
              </div>
            </div>
            
            {/* Chat Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {getDisplayName(chat)}
                </h3>
                <div className="flex items-center gap-2">
                  {chat.unreadCount && chat.unreadCount > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold">
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </span>
                  ) : null}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getTimeAgo(chat.lastMessage?.createdAt || chat.updatedAt)}
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                {getLastMessagePreview(chat)}
              </p>
              
              {/* Participant roles */}
              {chat.otherParticipants.length > 0 && (
                <div className="flex items-center space-x-2 mt-1">
                  {chat.otherParticipants.map((participant, index) => (
                    <span
                      key={participant.id}
                      className={`text-xs px-2 py-1 rounded-full ${
                        participant.role === 'admin' 
                          ? 'bg-teal-100 text-teal-800'
                          : participant.role === 'senior_staff'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {participant.role.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
