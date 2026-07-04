'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { BadgePoundSterling, Check, Loader2, X } from 'lucide-react'
import {
  confirmRecoveredValue,
  loadRecoveredRevenue,
  type RecoveredRevenueSummary,
} from '@/lib/dashboard/recovered-revenue'

/**
 * The number the product exists for: revenue recovered from existing
 * customers this month, plus a confirm queue for campaign replies the
 * owner hasn't valued yet. Confirming ("booked, £95") or dismissing
 * ("no job") takes one tap — that low friction is what keeps the
 * attribution data (and therefore this number) honest.
 */
export function RecoveredRevenueCard() {
  const [summary, setSummary] = useState<RecoveredRevenueSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const reload = useCallback(() => {
    const db = createClient()
    loadRecoveredRevenue(db)
      .then(setSummary)
      .catch((err) => console.error('[dashboard] recovered revenue failed:', err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function confirm(recipientId: string, value: number) {
    setSavingId(recipientId)
    try {
      const db = createClient()
      const { error } = await confirmRecoveredValue(db, recipientId, value)
      if (error) {
        toast.error(`Could not save: ${error}`)
        return
      }
      setValues((prev) => {
        const next = { ...prev }
        delete next[recipientId]
        return next
      })
      reload()
    } finally {
      setSavingId(null)
    }
  }

  const currency = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Recovered revenue this month
          </p>
          {loading || !summary ? (
            <div className="mt-3 h-7 w-28 animate-pulse rounded bg-secondary" />
          ) : (
            <>
              <p className="mt-3 text-[28px] leading-none font-bold tabular-nums text-foreground">
                {currency.format(summary.monthTotal)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {summary.monthJobs} job{summary.monthJobs === 1 ? '' : 's'} booked
                from campaigns
              </p>
            </>
          )}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BadgePoundSterling className="h-4 w-4" />
        </div>
      </div>

      {/* Confirm queue */}
      {!loading && summary && summary.pending.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Replies to confirm
          </p>
          <ul className="space-y-2">
            {summary.pending.map((p) => (
              <li
                key={p.recipientId}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{p.contactName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    replied to “{p.broadcastName}”
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  placeholder="£ value"
                  value={values[p.recipientId] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [p.recipientId]: e.target.value,
                    }))
                  }
                  className="h-8 w-24 rounded-lg border border-border bg-card px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <button
                  aria-label="Confirm booked job value"
                  disabled={savingId === p.recipientId || !values[p.recipientId]}
                  onClick={() => confirm(p.recipientId, Number(values[p.recipientId]))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {savingId === p.recipientId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
                <button
                  aria-label="No job came of this reply"
                  disabled={savingId === p.recipientId}
                  onClick={() => confirm(p.recipientId, 0)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
