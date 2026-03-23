'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { WEB_API } from '@/utils/api'
import ChatList from '@/components/marketing/ChatList'
import ChatWindow from '@/components/marketing/ChatWindow'
import NewChatModal from '@/components/marketing/NewChatModal'

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

function ChatPageContent() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null)
  const searchParams = useSearchParams()

  const userHeaders = () => ({} as Record<string, string>)

  const fetchChatRooms = async () => {
    try {
      const response = await fetch(`${WEB_API}/chat/rooms`, {
        headers: userHeaders(),
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        setChatRooms(data.chatRooms || [])
      }
    } catch (error) {
      console.error('Error fetching chat rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChatRooms()
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchChatRooms, 5000)
    return () => clearInterval(interval)
  }, [])

  // Select room based on query params when rooms are loaded
  useEffect(() => {
    const roomParam = searchParams?.get('room')
    const focusParam = searchParams?.get('focus')
    if (roomParam && chatRooms.length > 0) {
      const roomId = parseInt(roomParam)
      const room = chatRooms.find(r => r.id === roomId) || null
      if (room) setSelectedChat(room)
    }
    if (focusParam) setFocusMessageId(focusParam)
  }, [chatRooms, searchParams])

  const handleNewChat = async (participantEmail: string) => {
    try {
      const response = await fetch(`${WEB_API}/chat/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...userHeaders()
        },
        body: JSON.stringify({ participantEmail })
      })
      
      if (response.ok) {
        const data = await response.json()
        const newChat = data.chatRoom
        
        // Format the chat room for our component
        const currentUserEmail = localStorage.getItem('userEmail') || ''
        const otherParticipants = newChat.participants
          .filter((p: any) => p.user.email !== currentUserEmail)
          .map((p: any) => p.user)
        
        const formattedChat: ChatRoom = {
          id: newChat.id,
          type: newChat.type,
          otherParticipants,
          updatedAt: newChat.updatedAt
        }
        
        setChatRooms(prev => [formattedChat, ...prev])
        setSelectedChat(formattedChat)
        setShowNewChat(false)
      }
    } catch (error) {
      console.error('Error creating new chat:', error)
    }
  }

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Chat List Sidebar */}
      <div className="w-64 min-w-[16rem] border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Messages</h1>
            <button
              onClick={() => setShowNewChat(true)}
              className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              title="New conversation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
        
        <ChatList
          chatRooms={chatRooms}
          selectedChat={selectedChat}
          onSelectChat={setSelectedChat}
          loading={loading}
        />
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedChat ? (
          <ChatWindow
            chatRoom={selectedChat}
            onMessageSent={fetchChatRooms}
            focusMessageId={focusMessageId || undefined}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No chat selected</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onStartChat={handleNewChat}
        />
      )}
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
      <ChatPageContent />
    </Suspense>
  )
}
