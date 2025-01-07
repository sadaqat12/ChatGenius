import { Sparkles } from 'lucide-react'

export function ChatGeniusHeader() {
  return (
    <div className="bg-indigo-600 text-white p-3 flex items-center justify-center">
      <Sparkles className="w-6 h-6 mr-2" />
      <h1 className="text-2xl font-bold tracking-wider">ChatGenius</h1>
      <Sparkles className="w-6 h-6 ml-2" />
    </div>
  )
}

