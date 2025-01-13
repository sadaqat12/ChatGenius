'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get parameters from both search and hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        
        // Log all parameters for debugging
        console.log('Client-side callback params:', {
          token: searchParams.get('token'),
          type: searchParams.get('type'),
          email: searchParams.get('email'),
          code: searchParams.get('code'),
          error: hashParams.get('error'),
          error_code: hashParams.get('error_code'),
          error_description: hashParams.get('error_description')
        })

        // Handle errors first
        const error = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')
        if (error) {
          console.error('Auth error:', error, errorDescription)
          router.push(`/login?error=${encodeURIComponent(errorDescription || error)}`)
          return
        }

        // Check for access token in hash
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        
        if (accessToken && refreshToken) {
          // Send tokens to server to set up session
          const response = await fetch('/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
          })

          if (!response.ok) {
            throw new Error('Failed to set up session')
          }

          const data = await response.json()
          if (data.error) {
            throw new Error(data.error)
          }

          // Redirect based on server response
          router.push(data.redirectTo)
        } else {
          // No tokens found, redirect to login
          router.push('/login')
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        router.push('/login')
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Processing...</h2>
        <p className="text-gray-600">Please wait while we set up your account.</p>
      </div>
    </div>
  )
} 