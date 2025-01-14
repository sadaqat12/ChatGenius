'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

interface InviteMembersDialogProps {
  teamId: string
  onInviteSent?: () => void
}

export function InviteMembersDialog({ teamId, onInviteSent }: InviteMembersDialogProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setLoading(true)
      const response = await fetch(`/api/teams/${teamId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Cannot Send Invitation",
          description: data.error || 'Failed to send invitation. Please try again.',
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      // Handle success case, including when user already has a pending invite
      const message = data.message || "We've sent an invitation to " + email
      toast({
        title: "Success",
        description: message,
      })
      
      setEmail('')
      setOpen(false)
      onInviteSent?.()
    } catch (error) {
      console.error('Invitation error:', error)
      toast({
        title: "Cannot Send Invitation",
        description: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setEmail('')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Invite Members</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite team members</DialogTitle>
          <DialogDescription>
            Invite existing users to your team. New users must create an account before they can be invited.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              disabled={loading}
            />
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 