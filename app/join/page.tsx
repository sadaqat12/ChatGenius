'use client'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Invitation {
  id: string
  email: string
  team_id: string
  team: {
    name: string
  }
}

function JoinPageContent({ invitation }: { invitation: Invitation }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          name
        })

      if (profileError) throw profileError

      // Accept invitation
      const { error: acceptError } = await supabase
        .from('team_members')
        .insert({
          team_id: invitation.team_id,
          role: 'member'
        })

      if (acceptError) throw acceptError

      // Update invitation status
      await supabase
        .from('team_invites')
        .update({ status: 'accepted' })
        .eq('id', invitation.id)

      router.push(`/teams/${invitation.team_id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Complete Your Profile</h2>
          <p className="mt-2 text-gray-600">
            Set up your profile to join {invitation.team.name}
          </p>
        </div>

        <form onSubmit={handleCreateProfile} className="mt-8 space-y-6">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="name" className="sr-only">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="relative block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder="Name"
              />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled
                value={invitation.email}
                className="relative block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error setting up profile
                  </h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {loading ? 'Setting up profile...' : 'Complete profile & join team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default async function JoinPage({
  searchParams
}: {
  searchParams: { invitation: string }
}) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const invitationId = searchParams.invitation

  if (!invitationId) {
    redirect('/')
  }

  // Get invitation details
  const { data: invitation, error: inviteError } = await supabase
    .from('team_invites')
    .select('*, team:teams(name)')
    .eq('id', invitationId)
    .single()

  if (inviteError || !invitation) {
    redirect('/')
  }

  // If no session, redirect to login
  if (!session) {
    return redirect(`/login?invitation=${invitationId}`)
  }

  // If user is logged in and email matches invitation
  if (session.user.email === invitation.email) {
    // Check if user already has a profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .single()

    if (profile) {
      // User has profile, accept invitation directly
      const { error: joinError } = await supabase
        .from('team_members')
        .insert({
          team_id: invitation.team_id,
          user_id: session.user.id,
          role: 'member'
        })

      if (!joinError) {
        // Update invitation status
        await supabase
          .from('team_invites')
          .update({ status: 'accepted' })
          .eq('id', invitationId)

        redirect(`/teams/${invitation.team_id}`)
      }
    }

    // User needs to create profile
    return <JoinPageContent invitation={invitation} />
  }

  // If user is logged in but email doesn't match
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Wrong Account</h2>
          <p className="mt-2 text-gray-600">
            This invitation was sent to {invitation.email}. Please sign out and sign in with the correct account.
          </p>
        </div>
      </div>
    </div>
  )
} 