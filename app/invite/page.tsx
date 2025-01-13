'use client'

import { Suspense } from 'react'
import { InvitePage } from './invite-page'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InvitePage />
    </Suspense>
  )
} 