'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from '@/lib/supabase'
import { useToast } from "@/components/ui/use-toast"

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setLoading(true)

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/update-password`,
      })

      if (error) throw error

      setSubmitted(true)
      toast({
        title: "Reset link sent",
        description: "Check your email for the password reset link.",
      })
    } catch (error) {
      console.error('Reset password error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send reset link",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Check Your Email</h2>
          <p className="text-gray-600 mb-8">
            We've sent a password reset link to your email address.
            Please check your inbox and follow the instructions.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/login')}
          >
            Return to Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-center mb-4">Reset Password</h2>
        <p className="text-gray-600 text-center mb-8">
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
          <div className="text-center text-sm">
            <Link href="/login" className="text-blue-600 hover:underline">
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
} 