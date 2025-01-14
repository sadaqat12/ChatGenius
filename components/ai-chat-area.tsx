import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, Send } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  role: 'user' | 'assistant'
  content: string
  debug?: {
    similarTweets?: Array<{
      content: string
      similarity: number
    }>
  }
}

export function AIChatArea() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.message,
        debug: data.debug
      }])
    } catch (error) {
      console.error('Error in AI chat:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="border-b p-4 flex items-center gap-2">
        <Bot className="h-5 w-5" />
        <h2 className="font-semibold">AI Assistant</h2>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, i) => (
            <div key={i}>
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg p-4",
                  message.role === 'assistant' 
                    ? "bg-gray-100" 
                    : "bg-blue-500 text-white"
                )}
              >
                {message.role === 'assistant' && (
                  <Bot className="h-5 w-5 mt-1" />
                )}
                <div className="flex-1">
                  {message.content}
                </div>
              </div>
              {/* Show debug info in development */}
              {process.env.NODE_ENV === 'development' && message.debug?.similarTweets && (
                <div className="mt-2 text-xs text-gray-500 p-2 border rounded">
                  <div className="font-semibold mb-1">Similar Tweets:</div>
                  {message.debug.similarTweets.map((tweet, j) => (
                    <div key={j} className="mb-1">
                      • {tweet.content} 
                      <span className="text-gray-400">
                        (Similarity: {(tweet.similarity * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-3 rounded-lg p-4 bg-gray-100">
              <Bot className="h-5 w-5 mt-1" />
              <div className="flex-1">
                Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask me anything..."
          disabled={loading}
        />
        <Button type="submit" disabled={loading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
} 