'use client'

import { useState, useRef, useEffect } from 'react'
import { WEB_API } from '@/utils/api'

interface Props {
  onSendMessage: (content: string, tags: any[], metadata?: any) => void
  replyTo?: { id: string; content: string; senderName?: string }
  onCancelReply?: () => void
  minRows?: number
  maxRows?: number
}

interface Tag {
  type: 'inquiry' | 'user'
  targetId: string
  targetName: string
}

export default function MessageInput({ onSendMessage, replyTo, onCancelReply, minRows = 2, maxRows = 8 }: Props) {
  const [message, setMessage] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [tags, setTags] = useState<Tag[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const userHeaders = () => ({} as Record<string, string>)

  // Search for inquiries and users
  const searchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    setIsSearching(true)
    try {
      // Search inquiries
      const inquiryResponse = await fetch(`${WEB_API}/chat/search/inquiries?query=${encodeURIComponent(query)}`, {
        headers: userHeaders(),
        cache: 'no-store'
      })
      
      // Search users
      const userResponse = await fetch(`${WEB_API}/chat/users`, {
        headers: userHeaders(),
        cache: 'no-store'
      })

      const [inquiryData, userData] = await Promise.all([
        inquiryResponse.ok ? inquiryResponse.json() : { inquiries: [] },
        userResponse.ok ? userResponse.json() : { users: [] }
      ])

      const inquirySuggestions = (inquiryData.inquiries || []).map((inquiry: any) => ({
        ...inquiry,
        type: 'inquiry',
        displayName: `${inquiry.fullName}${inquiry.phone ? ` (${inquiry.phone})` : ''}`,
        searchText: `@${inquiry.fullName}${inquiry.phone ? ` (${inquiry.phone})` : ''}`
      }))

      const userSuggestions = (userData.users || []).map((user: any) => ({
        ...user,
        type: 'user',
        displayName: user.name || user.email,
        searchText: `@${user.name || user.email}`
      }))

      const allSuggestions = [...inquirySuggestions, ...userSuggestions]
        .filter(item => 
          item.displayName.toLowerCase().includes(query.toLowerCase()) ||
          item.searchText.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 10)

      setSuggestions(allSuggestions)
    } catch (error) {
      console.error('Error searching suggestions:', error)
      setSuggestions([])
    } finally {
      setIsSearching(false)
    }
  }

  // Handle input changes and detect @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessage(value)

    // Check for @ mentions
    const lastAtSymbol = value.lastIndexOf('@')
    if (lastAtSymbol !== -1) {
      const query = value.substring(lastAtSymbol + 1)
      const beforeAt = value.substring(0, lastAtSymbol)
      
      // Check if we're still typing the tag (no space after @)
      if (!query.includes(' ')) {
        setTagQuery(query)
        setShowTagSuggestions(true)
        searchSuggestions(query)
        return
      }
    }
    
    setShowTagSuggestions(false)
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: any) => {
    const lastAtSymbol = message.lastIndexOf('@')
    const beforeAt = message.substring(0, lastAtSymbol)
    const afterTag = message.substring(lastAtSymbol + tagQuery.length + 1)
    
    const newMessage = beforeAt + suggestion.searchText + ' ' + afterTag
    setMessage(newMessage)
    
    // Add tag
    const newTag: Tag = {
      type: suggestion.type,
      targetId: suggestion.id.toString(),
      targetName: suggestion.displayName
    }
    
    setTags(prev => [...prev, newTag])
    setShowTagSuggestions(false)
    setTagQuery('')
    setSuggestions([])
    
    // Focus back to input
    inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showTagSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestion(prev => (prev + 1) % suggestions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length)
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSuggestionSelect(suggestions[selectedSuggestion])
      } else if (e.key === 'Escape') {
        setShowTagSuggestions(false)
        setSuggestions([])
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Send message
  const handleSend = () => {
    if (message.trim()) {
      const metadata: any = {}
      if (replyTo?.id) {
        metadata.replyToMessageId = replyTo.id
        metadata.replyPreview = (replyTo.content || '').slice(0, 160)
        metadata.replySender = replyTo.senderName || ''
      }
      onSendMessage(message.trim(), tags, metadata)
      setMessage('')
      setTags([])
      setShowTagSuggestions(false)
      setSuggestions([])
      onCancelReply && onCancelReply()
    }
  }

  // Remove tag
  const removeTag = (index: number) => {
    setTags(prev => prev.filter((_, i) => i !== index))
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowTagSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      {replyTo && (
        <div className="mb-2 px-3 py-2 rounded border border-primary/30 bg-primary/5 text-sm text-gray-700 flex items-start justify-between gap-3">
          <div>
            <div className="text-primary font-medium">Replying to {replyTo.senderName || 'message'}</div>
            <div className="line-clamp-2 text-gray-600">{replyTo.content}</div>
          </div>
          <button onClick={onCancelReply} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
      )}
      {/* Tags display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                tag.type === 'inquiry' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              @{tag.targetName}
              <button
                onClick={() => removeTag(index)}
                className="ml-1 text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Message input */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... Use @ to mention inquiries or users"
            className="w-full h-full border-0 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={minRows}
            style={{ minHeight: `${minRows * 24}px`, maxHeight: `${maxRows * 24}px` }}
          />
          
          {/* Tag suggestions */}
          {showTagSuggestions && (
            <div
              ref={suggestionsRef}
              className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10"
            >
              {isSearching ? (
                <div className="p-3 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>
                  <span className="ml-2">Searching...</span>
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.id}`}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                      index === selectedSuggestion ? 'bg-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        suggestion.type === 'inquiry' 
                          ? 'bg-green-500 text-white' 
                          : 'bg-blue-500 text-white'
                      }`}>
                        {suggestion.type === 'inquiry' ? 'I' : 'U'}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{suggestion.displayName}</div>
                        <div className="text-xs text-gray-500">
                          {suggestion.type === 'inquiry' 
                            ? `Inquiry • ${suggestion.programOfInterest}`
                            : suggestion.role?.replace('_', ' ')
                          }
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : tagQuery.length >= 2 ? (
                <div className="p-3 text-center text-gray-500">
                  No results found for "{tagQuery}"
                </div>
              ) : null}
            </div>
          )}
        </div>
        
        <button
          onClick={handleSend}
          disabled={!message.trim()}
          className="w-12 rounded-md self-stretch inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed bg-transparent hover:bg-transparent"
          title="Send"
          aria-label="Send"
        >
          <svg className="w-5 h-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.4 20.6 21 12 3.4 3.4 3 10l12 2-12 2 .4 6.6Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
