'use client'

import { Suspense } from 'react'
import { CallbackPage } from './callback-page'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CallbackPage />
    </Suspense>
  )
} 