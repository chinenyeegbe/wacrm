'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

/**
 * Handles the two branches of accepting an invite:
 *   - signed in  -> "Accept invitation" button -> POST /api/join/accept
 *   - signed out -> links to login / signup that return here after auth
 *     (the `next` param), so the same button finishes the job.
 */
export function JoinClient({ token }: { token: string }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user)
      setChecking(false)
    })
  }, [])

  async function accept() {
    setAccepting(true)
    try {
      const res = await fetch('/api/join/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not accept invite')
        return
      }
      toast.success('Welcome aboard!')
      router.push('/dashboard')
      router.refresh()
    } finally {
      setAccepting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-3 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (!signedIn) {
    const next = encodeURIComponent(`/join/${token}`)
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-slate-400">
          Sign in or create an account to accept this invite.
        </p>
        <Button
          className="w-full"
          onClick={() => router.push(`/login?next=${next}`)}
        >
          Log in
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push(`/signup?next=${next}`)}
        >
          Create account
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={accept} disabled={accepting} className="w-full">
      {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Accept invitation
    </Button>
  )
}
