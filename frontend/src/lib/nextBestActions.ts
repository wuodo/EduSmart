import type { Inquiry } from '@/types/inquiry'

export type NextBestAction = {
  id: string
  title: string
  reason: string
  /** Suggested navigation targets */
  href?: string
  priority: number
}

/**
 * Lightweight 0–100 score from status, lead score, SLA, and dormancy (v1).
 */
export function computeConversionLikelihood(inquiry: Inquiry): { score: number; label: string } {
  let score = 0
  const status = String(inquiry.status || '').toLowerCase()
  if (status === 'hot') score += 35
  else if (status === 'warm') score += 25
  else if (status === 'cold') score += 10
  else score += 15

  const s = typeof inquiry.score === 'number' && !Number.isNaN(inquiry.score) ? inquiry.score : 0
  score += Math.min(30, Math.max(0, s))

  if (inquiry.firstResponseAt) score += 15
  if (inquiry.smartMeta?.dormant) score -= 25

  const clamped = Math.min(100, Math.max(0, Math.round(score)))
  let label = 'Lower'
  if (clamped >= 70) label = 'High'
  else if (clamped >= 45) label = 'Medium'
  return { score: clamped, label }
}

/**
 * Rule-based next-best-action ranking (v1). Replace with recommendation API later.
 */
export function computeNextBestActions(inquiry: Inquiry): NextBestAction[] {
  const actions: NextBestAction[] = []
  const status = String(inquiry.status || '').toLowerCase()
  const letter = String(inquiry.letterStatus || 'Not Generated')

  if (!inquiry.firstResponseAt) {
    actions.push({
      id: 'first-touch',
      title: 'Make first contact',
      reason: 'No first-response time recorded yet. Fast outreach improves conversion.',
      href: '/followups',
      priority: 100,
    })
  }

  if (inquiry.smartMeta?.dormant) {
    actions.push({
      id: 'reengage',
      title: 'Re-engage this lead',
      reason: 'Marked dormant: no update past your smart-rules threshold.',
      href: '/followups',
      priority: 95,
    })
  }

  if (status === 'hot' || status === 'warm') {
    actions.push({
      id: 'schedule-followup',
      title: 'Schedule or complete a follow-up',
      reason: 'Hot/warm leads need a dated next step on the calendar.',
      href: '/followups',
      priority: 88,
    })
  }

  if (inquiry.smartMeta?.intakeWarning) {
    actions.push({
      id: 'capacity',
      title: 'Confirm programme capacity',
      reason: 'This programme is approaching your configured seat warning.',
      href: '/courses',
      priority: 82,
    })
  }

  const pref = String(inquiry.preferredContactMethod || '').toLowerCase()
  if (pref === 'whatsapp' && inquiry.phone) {
    actions.push({
      id: 'whatsapp',
      title: 'Reach out on WhatsApp',
      reason: 'Preferred channel is WhatsApp.',
      priority: 75,
    })
  }

  if (letter === 'Not Generated' || !letter) {
    actions.push({
      id: 'letter',
      title: 'Prepare admission letter',
      reason: 'Letter not generated; move the pipeline when the lead is qualified.',
      href: '/admission-letters',
      priority: 65,
    })
  }

  if (status === 'cold' || (Array.isArray(inquiry.leadTags) && inquiry.leadTags.includes('cold'))) {
    actions.push({
      id: 'review-cold',
      title: 'Review or recycle cold lead',
      reason: 'Status or tags suggest low urgency — confirm before archiving.',
      priority: 55,
    })
  }

  return [...actions].sort((a, b) => b.priority - a.priority).slice(0, 3)
}
