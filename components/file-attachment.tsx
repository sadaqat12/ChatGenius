import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

interface FileAttachmentProps {
  file: {
    name: string
    type: string
    size: number
    url: string
    path?: string
  }
}

export function FileAttachment({ file }: FileAttachmentProps) {
  const [url, setUrl] = useState(file.url)
  const [imageError, setImageError] = useState(false)

  // Refresh URL if it's expired
  const refreshUrl = async () => {
    if (!file.path) return

    try {
      const { data } = await supabase
        .storage
        .from('message-attachments')
        .createSignedUrl(file.path, 365 * 24 * 60 * 60) // 1 year expiration

      if (data) {
        setUrl(data.signedUrl)
        setImageError(false)
      }
    } catch (error) {
      console.error('Error refreshing file URL:', error)
      setImageError(true)
    }
  }

  // Handle image load error (which might indicate an expired URL)
  const handleError = () => {
    if (file.path && !imageError) {
      refreshUrl()
    }
  }

  // Default to 'application/octet-stream' if type is missing
  const isImage = (file.type || 'application/octet-stream').startsWith('image/')

  if (isImage && !imageError) {
    return (
      <div className="relative w-64 h-64">
        <Image
          src={url}
          alt={file.name}
          fill
          className="object-contain rounded-md"
          onError={handleError}
          unoptimized // Skip Next.js image optimization for Supabase URLs
        />
      </div>
    )
  }

  // Fallback for non-image files or failed image loads
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 rounded bg-gray-100 hover:bg-gray-200"
      onClick={(e) => {
        if (!url || !url.includes('token=')) {
          e.preventDefault()
          refreshUrl().then(() => window.open(url, '_blank'))
        }
      }}
    >
      <svg
        className="w-6 h-6 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span className="text-sm text-gray-700">{file.name}</span>
    </a>
  )
}

