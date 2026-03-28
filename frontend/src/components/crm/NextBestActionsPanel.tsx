'use client'

import Link from 'next/link'
import type { Inquiry } from '@/types/inquiry'
import { computeConversionLikelihood, computeNextBestActions } from '@/lib/nextBestActions'
import { SparklesIcon } from '@heroicons/react/24/outline'

const SparklesIconAny: any = SparklesIcon

export default function NextBestActionsPanel({ inquiry }: { inquiry: Inquiry }) {
  const actions = computeNextBestActions(inquiry)
  const likelihood = computeConversionLikelihood(inquiry)

  return (
    <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30 px-3 py-3 mb-3 text-left">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-800 dark:text-teal-200 mb-2">
        <SparklesIconAny className="h-4 w-4" />
        Suggested next steps
      </div>
      <p className="text-[11px] text-teal-900/90 dark:text-teal-100/90 mb-3 leading-snug">
        Estimated conversion signal: <span className="font-semibold">{likelihood.label}</span> ({likelihood.score}/100) — heuristic
        from status, score, first response, and dormancy flags.
      </p>
      <ol className="space-y-2">
        {actions.length === 0 && (
          <li className="text-xs text-gray-600 dark:text-gray-400">No extra suggestions right now.</li>
        )}
        {actions.map((a, idx) => (
          <li key={a.id} className="text-sm">
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{a.title}</div>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">{a.reason}</p>
                {a.href && (
                  <Link
                    href={a.href}
                    className="inline-block mt-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                  >
                    {a.href === '/followups'
                      ? 'Open follow-ups'
                      : a.href === '/admission-letters'
                        ? 'Open admission letters'
                        : a.href === '/courses'
                          ? 'Open courses'
                          : 'Open module'}
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
