'use client'

import { Suspense } from 'react'
import { SetPasswordPage } from './set-password-page'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SetPasswordPage />
    </Suspense>
  )
} 