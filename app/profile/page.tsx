'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { ChatGeniusHeader } from '@/components/chat-genius-header'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from 'lucide-react'

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setAvatarUrl(profile.avatar_url)
    }
  }, [profile])

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return
      }

      setUploading(true)
      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `${user?.id}/${Math.random()}.${fileExt}`

      if (avatarUrl) {
        const oldFilePath = avatarUrl.split('/').pop()
        if (oldFilePath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user?.id}/${oldFilePath}`])
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        if (uploadError.message === "Bucket not found") {
          throw new Error("Storage not configured. Please contact support.")
        }
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)
      
      toast({
        title: "Avatar uploaded",
        description: "Your profile picture has been updated.",
      })
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast({
        title: "Error uploading avatar",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return

    try {
      setSaving(true)

      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          name,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (error) throw error

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      })

      router.push('/teams')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: "Error updating profile",
        description: "Please try again later",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <ChatGeniusHeader />
        <div className="flex-1 flex items-center justify-center">
          <div>Loading profile...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ChatGeniusHeader />
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
          
          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback>{name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-4">
                <Label htmlFor="avatar" className="cursor-pointer">
                  <div className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
                    {uploading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </div>
                    ) : (
                      'Upload New Picture'
                    )}
                  </div>
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </Label>
              </div>
            </div>

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your display name"
              />
            </div>

            {/* Email Field (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-gray-50"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push('/teams')}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </div>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 