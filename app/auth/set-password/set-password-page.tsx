'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from '@/lib/supabase'
import { ChatGeniusHeader } from '@/components/chat-genius-header'

export function SetPasswordPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const teamId = searchParams.get('team')

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }
      setEmail(session.user.email || '')
      setLoading(false)
    } catch (err) {
      console.error('Error checking session:', err)
      router.push('/login')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        throw new Error('No active session')
      }

      // Update user's password and data
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { 
          name,
          has_set_password: true
        }
      })

      if (updateError) throw updateError

      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: session.user.id,
          name: name,
        })
      
      if (profileError) throw profileError

      // If there's a team ID, add user to team and accept invitation
      if (teamId) {
        // Add user to team_members
        const { error: memberError } = await supabase
          .from('team_members')
          .upsert({
            team_id: teamId,
            user_id: session.user.id,
            role: 'member'
          })
        
        if (memberError && !memberError.message.includes('duplicate key')) {
          throw memberError
        }

        // Update invitation status to accepted
        const { error: inviteError } = await supabase
          .from('team_invites')
          .update({ status: 'accepted' })
          .eq('team_id', teamId)
          .eq('email', email)

        if (inviteError) {
          console.error('Error updating invitation:', inviteError)
          // Continue anyway since the user is already added to the team
        }
      }

      // Redirect to teams dashboard
      router.push('/teams')
    } catch (err) {
      console.error('Error setting up account:', err)
      setError(err instanceof Error ? err.message : 'Failed to set up account')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <ChatGeniusHeader />
        <div className="flex-1 flex items-center justify-center">
          <div>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ChatGeniusHeader />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-8">
          <h2 className="text-2xl font-bold text-center mb-8">Complete Your Account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Full Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Choose a password"
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Setting up account...' : 'Complete Setup'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
} 