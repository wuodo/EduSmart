export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import ExcelJS from 'exceljs'
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000'

function parseCookie(request: NextRequest): string | null {
  const c = request.headers.get('cookie')
  return c && c.trim() ? c : null
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const m = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

function forwardHeaders(request: NextRequest, base?: Record<string, string>) {
  const headers: Record<string, string> = {}
  if (base) Object.assign(headers, base)
  const cookie = parseCookie(request)
  if (cookie) headers['cookie'] = cookie
  const tenantCookie = getCookieValue(cookie, 'tenant')
  if (tenantCookie) headers['x-tenant'] = tenantCookie
  const url = new URL(request.url)
  const qpTenant = url.searchParams.get('tenant')
  if (!headers['x-tenant'] && qpTenant) headers['x-tenant'] = qpTenant
  const hdrTenant = request.headers.get('x-tenant')
  if (!headers['x-tenant'] && hdrTenant) headers['x-tenant'] = hdrTenant
  return headers
}

// Helper to fetch data from backend endpoints
async function fetchData(endpoint: string, request: NextRequest, owner?: string | null, baseHeaders?: Record<string, string>) {
  const url = new URL(`${BACKEND}/api/${endpoint}`)
  if (owner) url.searchParams.set('owner', owner)
  const headers = forwardHeaders(request, baseHeaders)
  console.log(`Reports API - Fetching ${endpoint} with headers:`, headers, 'URL:', url.toString())
  try {
    const res = await fetch(url.toString(), { headers, cache: 'no-store' })
    if (!res.ok) return [] as any[]
    const data = await res.json()
    return data
  } catch {
    return [] as any[]
  }
}

function isAdminLike(roleRaw?: string | null) {
  const role = (roleRaw || '').toLowerCase()
  return role === 'admin' || role === 'senior_staff'
}

function normalizeOwnerLabel(ownerLabel: string | undefined, owner: string | null, email: string) {
  if (ownerLabel && ownerLabel.trim()) return ownerLabel
  if (owner) return owner
  return email || undefined
}

function filterByOwner(inquiries: any[], followups: any[], owner?: string | null) {
  if (!owner) return { inquiries, followups }
  const target = owner.toLowerCase()
  const oi = inquiries.filter(i => {
    const createdBy = (i.createdBy || i.owner || i.email || '').toLowerCase()
    const assignedTo = (i.assignedTo || '').toLowerCase()
    return createdBy === target || assignedTo === target
  })
  const of = followups.filter(f => {
    const createdBy = (f.createdBy || '').toLowerCase()
    const assignedTo = (f.assignedTo || '').toLowerCase()
    const inqCreated = (f.inquiry?.createdBy || '').toLowerCase()
    return createdBy === target || assignedTo === target || inqCreated === target
  })
  return { inquiries: oi, followups: of }
}

// Generate tailored insights with varied phrasing based on metrics and owner
function generateInsights(params: {
  owner?: string | null,
  role?: string | null,
  totalInquiries: number,
  totalFollowups: number,
  totalPaidRegistrations: number,
  conversionRate: number,
  avgResponseTimeHrs: number,
  responseRatePct: number,
  lettersSentRatePct: number,
  inquiriesBySource: Record<string, number>,
  topPrograms: [string, number][],
}) {
  const {
    owner,
    role,
    totalInquiries,
    totalFollowups,
    totalPaidRegistrations,
    conversionRate,
    avgResponseTimeHrs,
    responseRatePct,
    lettersSentRatePct,
    inquiriesBySource,
    topPrograms,
  } = params

  const scope = owner ? `for ${owner}` : 'across the team'
  const leadSource = Object.entries(inquiriesBySource).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'mixed sources'
  const topProgram = topPrograms?.[0]?.[0]
  const perfBand = conversionRate >= 45 ? 'strong' : conversionRate >= 30 ? 'steady' : 'developing'
  const speedBand = avgResponseTimeHrs <= 2 ? 'excellent' : avgResponseTimeHrs <= 4 ? 'good' : 'slow'

  const variantIndex = (Math.round(conversionRate) + Math.round(avgResponseTimeHrs) + (owner ? owner.length : 0)) % 3

  const executiveVariants = [
    `Performance ${scope} shows ${totalInquiries} inquiries and ${totalFollowups} follow-ups. Conversion sits at ${conversionRate}% with a ${speedBand} first-response time of ${avgResponseTimeHrs} hour(s). The funnel is primarily driven by ${leadSource}${topProgram ? `, with notable interest in ${topProgram}` : ''}.`,
    `Summary ${scope}: ${totalInquiries} inquiries led to ${totalPaidRegistrations} paid registrations (${conversionRate}% CR). Average first response is ${avgResponseTimeHrs}h (${speedBand}). ${leadSource} remains the top source${topProgram ? `; ${topProgram} is the leading program` : ''}.`,
    `Overview ${scope}: volume at ${totalInquiries} inquiries and ${totalFollowups} follow-ups; conversion rate ${conversionRate}%. First-response speed is ${avgResponseTimeHrs}h (${speedBand}). Pipeline composition is led by ${leadSource}${topProgram ? ` and interest clusters around ${topProgram}` : ''}.`,
  ]
  const executiveSummary = executiveVariants[variantIndex]

  const recs: string[] = []
  if (conversionRate < 30) recs.push('Tighten qualification and follow-up cadence to lift conversion above 30%.')
  if (responseRatePct < 60) recs.push('Raise response rate above 60% by acknowledging new inquiries within defined SLAs.')
  if (avgResponseTimeHrs > 4) recs.push('Reduce average first response time to under 4 hours to protect intent.')
  if (lettersSentRatePct < 50) recs.push('Accelerate sending admission letters to qualified prospects to compress decision time.')
  if ((inquiriesBySource['social'] || 0) < (inquiriesBySource['website'] || 0)) recs.push('Diversify top-of-funnel by boosting social campaigns to complement website traffic.')
  if (perfBand === 'strong' && speedBand !== 'excellent') recs.push('Maintain conversion momentum while sharpening first-response speed.')

  const actionPlansPools = [
    [
      'Block 2×30 minutes daily to clear pending follow-ups in priority order.',
      'Enable auto-acknowledgement and 24h reminders on fresh inquiries.',
      'Send admission letters within 24h post-qualification.',
      'Run a targeted campaign around the top 2 programs of interest.',
    ],
    [
      'Create a morning triage to respond to all overnight inquiries.',
      'Adopt a 3-touch sequence over 72 hours for new leads.',
      `Publish a quick-hit post to amplify ${leadSource} reach this week.`,
      'Review objection patterns and add answers to follow-up scripts.',
    ],
    [
      'Define SLAs: acknowledge <2h, first action <6h, closure <5 days.',
      'Prioritize prospects with prior engagement for letter dispatch.',
      `Host a mini-webinar on ${topProgram || 'top programs'} to warm intent.`,
      'Set a weekly review of conversion and speed KPIs by officer.',
    ],
  ]
  const actionPlan = actionPlansPools[variantIndex]

  return { executiveSummary, recommendations: recs, actionPlan }
}

function analyzeData(
  inquiries: any[],
  followups: any[],
  owner?: string | null,
  role?: string | null,
  allowedEmails?: Set<string>,
  emailToLabel?: Map<string, string>
) {
  // Ensure we work on locally filtered arrays if owner is provided
  const { inquiries: fi, followups: ff } = filterByOwner(inquiries, followups, owner)

  // Totals
  const totalInquiries = fi.length
  const totalFollowups = ff.length
  const totalPaidRegistrations = fi.filter(i => i.paymentStatus === 'Paid').length
  const conversionRate = totalInquiries ? Math.round((totalPaidRegistrations / totalInquiries) * 100) : 0

  // Compute response times and response rate from inquiries
  const responseHours: number[] = []
  let respondedCount = 0
  fi.forEach((i: any) => {
    const created = i.createdAt ? new Date(i.createdAt).getTime() : undefined
    const firstResp = i.firstResponseAt ? new Date(i.firstResponseAt).getTime() : undefined
    if (created && firstResp && firstResp >= created) {
      respondedCount += 1
      const diffHrs = (firstResp - created) / (1000 * 60 * 60)
      responseHours.push(diffHrs)
    }
  })
  const avgResponseTimeHrs = responseHours.length ? Math.round((responseHours.reduce((a, b) => a + b, 0) / responseHours.length) * 10) / 10 : 0
  const responseRatePct = totalInquiries ? Math.round((respondedCount / totalInquiries) * 100) : 0

  // Timeline: inquiries per day (last 30 days, local)
  const nowTimeline = new Date()
  const daysBack = 30
  const dayKeys: string[] = []
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(nowTimeline.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dayKeys.push(key)
  }
  const inqByDay: Record<string, number> = Object.fromEntries(dayKeys.map(k => [k, 0]))
  const regsByDay: Record<string, number> = Object.fromEntries(dayKeys.map(k => [k, 0]))
  fi.forEach((i: any) => {
    const createdKey = i?.createdAt ? String(i.createdAt).slice(0, 10) : ''
    if (createdKey && createdKey in inqByDay) inqByDay[createdKey] += 1
    if ((i?.paymentStatus === 'Paid') && createdKey && createdKey in regsByDay) regsByDay[createdKey] += 1
  })
  const inquiriesOverTime = dayKeys.map(k => ({ date: k, inquiries: inqByDay[k] || 0, registrations: regsByDay[k] || 0 }))

  // Letters sent vs inquiries
  const lettersSentCount = fi.filter((i: any) => {
    const s = (i.letterStatus || '').toLowerCase()
    return s === 'sent' || s === 'acknowledged'
  }).length
  const lettersSentRatePct = totalInquiries ? Math.round((lettersSentCount / totalInquiries) * 100) : 0

  // By source (dynamic)
  const uniqueSources = Array.from(new Set(fi.map(i => i.source || 'Unknown')))
  const inquiriesBySource = Object.fromEntries(
    uniqueSources.map(src => [src, fi.filter(i => (i.source || 'Unknown') === src).length])
  )

  // By program
  const programCounts = fi.reduce((acc: any, i: any) => {
    acc[i.programOfInterest] = (acc[i.programOfInterest] || 0) + 1
    return acc
  }, {})
  const topPrograms = (Object.entries(programCounts) as [string, number][]) .sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Followup stats
  const followupsByType = ['call', 'email', 'sms', 'whatsapp', 'meeting'].map(type => ({
    type,
    count: ff.filter(f => f.type === type).length
  }))
  const followupsByStatus = ['pending', 'completed', 'rescheduled', 'cancelled'].map(status => ({
    status,
    count: ff.filter(f => f.status === status).length
  }))

  const { executiveSummary, recommendations, actionPlan } = generateInsights({
    owner,
    role,
    totalInquiries,
    totalFollowups,
    totalPaidRegistrations,
    conversionRate,
    avgResponseTimeHrs,
    responseRatePct,
    lettersSentRatePct,
    inquiriesBySource,
    topPrograms,
  })

  const now = new Date();
  const overdueFollowups = ff.filter(f =>
    f.status === 'pending' && new Date(f.scheduledFor) < now
  );
  if (overdueFollowups.length > 0) {
    recommendations.push(`There are ${overdueFollowups.length} overdue follow-ups. Clear them within 24 hours.`);
    actionPlan.push('Assign time to clear all overdue follow-ups today.');
  }

  // Per-officer breakdown (registrations, followups, response, letters) and weighted performance index
  let users: Array<{ owner: string; ownerEmail: string; inquiries: number; followups: number; registrations: number; performanceIndex: number } & { responseRatePct?: number; avgResponseHrs?: number; lettersSentRatePct?: number }> | undefined
  {
    type Stats = { inquiries: number; followups: number; registrations: number; responded: number; sumRespHrs: number; lettersSent: number }
    const ownerTo: Record<string, Stats> = {}

    // Initialize with allowed emails so all admin-created users appear even with zero activity
    if (allowedEmails && allowedEmails.size > 0) {
      allowedEmails.forEach(e => {
        ownerTo[e] = { inquiries: 0, followups: 0, registrations: 0, responded: 0, sumRespHrs: 0, lettersSent: 0 }
      })
    }

    // Seed inquiries
    inquiries.forEach((i: any) => {
      const raw = i.createdBy || i.owner || i.email || 'unknown'
      const o = String(raw).toLowerCase()
      if (allowedEmails && allowedEmails.size > 0 && !allowedEmails.has(o)) return
      const s = ownerTo[o] || { inquiries: 0, followups: 0, registrations: 0, responded: 0, sumRespHrs: 0, lettersSent: 0 }
      s.inquiries += 1
      if (i.paymentStatus === 'Paid') s.registrations += 1
      const created = i.createdAt ? new Date(i.createdAt).getTime() : undefined
      const firstResp = i.firstResponseAt ? new Date(i.firstResponseAt).getTime() : undefined
      if (created && firstResp && firstResp >= created) {
        s.responded += 1
        s.sumRespHrs += (firstResp - created) / (1000 * 60 * 60)
      }
      const ls = (i.letterStatus || '').toLowerCase()
      if (ls === 'sent' || ls === 'acknowledged') s.lettersSent += 1
      ownerTo[o] = s
    })
    // Seed followups
    followups.forEach((f: any) => {
      const raw = f.assignedTo || f.createdBy || 'unknown'
      const o = String(raw).toLowerCase()
      if (allowedEmails && allowedEmails.size > 0 && !allowedEmails.has(o)) return
      const s = ownerTo[o] || { inquiries: 0, followups: 0, registrations: 0, responded: 0, sumRespHrs: 0, lettersSent: 0 }
      s.followups += 1
      ownerTo[o] = s
    })

    // Prepare arrays for normalization. Ensure every allowed user is present.
    const entries = Object.entries(ownerTo)
    const ownersArr = entries.map(([o, s]) => ({
      ownerEmail: o,
      inquiries: s.inquiries,
      followups: s.followups,
      registrations: s.registrations,
      responseRatePct: s.inquiries ? (s.responded / s.inquiries) * 100 : 0,
      avgResponseHrs: s.responded ? (s.sumRespHrs / s.responded) : 0,
      lettersSentRatePct: s.inquiries ? (s.lettersSent / s.inquiries) * 100 : 0,
    }))

    const maxRegs = Math.max(1, ...ownersArr.map(x => x.registrations))
    const maxFups = Math.max(1, ...ownersArr.map(x => x.followups))
    const validAvg = ownersArr.map(x => x.avgResponseHrs).filter(n => isFinite(n) && n > 0)
    const minAvgHrs = validAvg.length ? Math.min(...validAvg) : Infinity
    const maxAvgHrs = validAvg.length ? Math.max(...validAvg) : 0

    users = ownersArr.map(x => {
      const regScore = maxRegs > 0 ? (x.registrations / maxRegs) * 100 : 0
      const fupScore = maxFups > 0 ? (x.followups / maxFups) * 100 : 0
      const respRateScore = x.responseRatePct // already 0–100
      // Speed score: lower hours is better. If no data, default 50.
      let speedScore = 50
      if (isFinite(x.avgResponseHrs) && maxAvgHrs > 0 && minAvgHrs !== Infinity && maxAvgHrs !== minAvgHrs) {
        speedScore = ((maxAvgHrs - x.avgResponseHrs) / (maxAvgHrs - minAvgHrs)) * 100
        if (speedScore < 0) speedScore = 0
        if (speedScore > 100) speedScore = 100
      }
      const lettersScore = x.lettersSentRatePct // 0–100
      // Weights: registrations 40%, followups 20%, response rate 20%, speed 10%, letters 10%
      const weighted = regScore * 0.4 + fupScore * 0.2 + respRateScore * 0.2 + speedScore * 0.1 + lettersScore * 0.1
      return {
        owner: emailToLabel?.get(x.ownerEmail) || x.ownerEmail,
        ownerEmail: x.ownerEmail,
        inquiries: x.inquiries,
        followups: x.followups,
        registrations: x.registrations,
        performanceIndex: Math.round(weighted),
        responseRatePct: Math.round(respRateScore),
        avgResponseHrs: Math.round(x.avgResponseHrs * 10) / 10,
        lettersSentRatePct: Math.round(lettersScore),
      }
    }).sort((a, b) => b.performanceIndex - a.performanceIndex)
  }

  return {
    summary: {
      totalInquiries,
      totalFollowups,
      totalPaidRegistrations,
      conversionRate,
      avgResponseTimeHrs,
      responseRatePct,
      lettersSentCount,
      lettersSentRatePct,
      overdueFollowups: overdueFollowups.length,
    },
    charts: {
      inquiriesBySource,
      topPrograms,
      followupsByType,
      followupsByStatus,
      inquiriesOverTime,
    },
    tables: {
      inquiries: fi,
      followups: ff
    },
    recommendations,
    actionPlan,
    executiveSummary,
    overdueFollowups,
    users
  }
}

interface MarketingReport {
  summary: {
    totalInquiries: number
    totalFollowups: number
    totalPaidRegistrations: number
    conversionRate: number
    avgResponseTimeHrs: number
    responseRatePct: number
  }
  charts: {
    inquiriesBySource: { [key: string]: number }
    topPrograms: [string, number][]
    followupsByType: { type: string; count: number }[]
    followupsByStatus: { status: string; count: number }[]
  }
  tables: {
    inquiries: any[]
    followups: any[]
  }
  recommendations: string[]
  actionPlan: string[]
  overdueFollowups: any[]
  users?: Array<{ owner: string; ownerEmail: string; inquiries: number; followups: number; registrations: number; performanceIndex: number }>
  executiveSummary?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const status = searchParams.get('status') || 'all'
    const source = searchParams.get('source') || 'all'
    const format = searchParams.get('format') || 'json'
    let owner = searchParams.get('owner')
    const ownerLabelParam = searchParams.get('ownerLabel') || undefined
    // Resolve identity from backend session (no header/cookie trust)
    const cookie = parseCookie(request)
    const tenantCookie = getCookieValue(cookie, 'tenant')
    const baseHeaders: Record<string, string> = {}
    if (cookie) baseHeaders['cookie'] = cookie
    if (tenantCookie) baseHeaders['x-tenant'] = tenantCookie

    const resMe = await fetch(`${BACKEND}/api/users/me`, {
      headers: baseHeaders,
      cache: 'no-store'
    })
    if (!resMe.ok) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const me = await resMe.json().catch(() => ({} as any))
    const roleHdr = me?.role ? String(me.role) : ''
    let emailHdr = me?.email ? String(me.email) : ''

    // For admissions officers, always scope to their email when available
    if (!isAdminLike(roleHdr)) {
      if (emailHdr) owner = emailHdr
    }

    // Fetch full marketing data (pass owner for backend scoping when available)
    let inquiriesAll = await fetchData('inquiries', request, owner || undefined, baseHeaders)
    let followupsAll = await fetchData('followups', request, owner || undefined, baseHeaders)

    // Safety net: if officer-scoped fetch returns nothing, refetch unscoped and filter locally
    if (!isAdminLike(roleHdr)) {
      const total = (Array.isArray(inquiriesAll) ? inquiriesAll.length : 0) + (Array.isArray(followupsAll) ? followupsAll.length : 0)
      if (total === 0) {
        const unscopedInquiries = await fetchData('inquiries', request, undefined, baseHeaders)
        const unscopedFollowups = await fetchData('followups', request, undefined, baseHeaders)
        const emailLower = (emailHdr || '').toLowerCase()
        inquiriesAll = (unscopedInquiries || []).filter((i: any) => {
          const createdBy = (i?.createdBy || i?.owner || i?.email || '').toLowerCase()
          const assigned = (i?.assignedTo || '').toLowerCase()
          return createdBy === emailLower || assigned === emailLower
        })
        followupsAll = (unscopedFollowups || []).filter((f: any) => {
          const createdBy = (f?.createdBy || '').toLowerCase()
          const assignedTo = (f?.assignedTo || '').toLowerCase()
          const inqCreated = (f?.inquiry?.createdBy || '').toLowerCase()
          return createdBy === emailLower || assignedTo === emailLower || inqCreated === emailLower
        })
      }
    }

    // If admissions officer and email unknown, infer owner from data to avoid empty reports
    const adminLikeFlag = isAdminLike(roleHdr)
    if (!adminLikeFlag && !owner) {
      if (!emailHdr) {
        const fromInquiries = (Array.isArray(inquiriesAll) ? inquiriesAll : [])
          .map((i: any) => (i?.createdBy || i?.owner || i?.email || '').toLowerCase())
          .filter(Boolean)
        const guess = fromInquiries[0]
        if (guess) {
          owner = guess
        }
      } else {
        owner = emailHdr
      }
    }

    // Admin view: do not drop data by filtering to known users; keep full dataset to avoid empty reports

    // Build allowed admin-created user set for consistent per-officer comparison
    let allowedSet: Set<string> | undefined
    let emailToLabel: Map<string, string> | undefined
    try {
      const users: Array<{ email?: string; name?: string }> = await fetchData('users', request, undefined, baseHeaders)
      const emails = (users || []).map(u => (u?.email || '').toLowerCase()).filter(Boolean) as string[]
      allowedSet = new Set(emails)
      emailToLabel = new Map(
        (users || [])
          .map(u => {
            const e = (u?.email || '').toLowerCase()
            const label = (u?.name && String(u.name).trim()) ? String(u.name) : e
            return e ? [e, label] as [string, string] : undefined
          })
          .filter(Boolean) as [string, string][]
      )
    } catch {
      allowedSet = undefined
      emailToLabel = undefined
    }

    // Analyze and summarize (role-aware and owner-aware), always pass allowedSet so per-officer only shows admin-created users
    let report = analyzeData(inquiriesAll, followupsAll, owner, roleHdr, allowedSet, emailToLabel)

    // Also filter the per-officer breakdown to allowed users when in all-users admin view
    // If we have allowedSet but users list is empty (e.g., no activity), ensure we still show all admin-created users with zeros
    if (allowedSet && (!report.users || report.users.length === 0)) {
      report = {
        ...report,
        users: Array.from(allowedSet).map(email => ({ owner: emailToLabel?.get(email) || email, ownerEmail: email, inquiries: 0, followups: 0, registrations: 0, performanceIndex: 0 }))
      }
    }

    const ownerLabel = normalizeOwnerLabel(ownerLabelParam, owner, emailHdr)

    if (format === 'excel') {
      const buffer = await generateExcel(report, ownerLabel)
      const name = sanitizeFilename(ownerLabel || (owner ? owner : 'all-users'))
      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=marketing-report-${name}.xlsx`
        }
      })
    }

    if (format === 'pdf') {
      const pdfBuffer = await generatePDFReport(report, ownerLabel)
      const name = sanitizeFilename(ownerLabel || (owner ? owner : 'all-users'))
      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=marketing-report-${name}.pdf`
        }
      })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

async function generatePDF(data: any[]) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Add title
  page.drawText('Marketing Report', {
    x: 50,
    y: height - 50,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0)
  })

  // Add date
  page.drawText(`Generated on: ${new Date().toLocaleDateString()}`, {
    x: 50,
    y: height - 80,
    size: 12,
    font: font,
    color: rgb(0, 0, 0)
  })

  // Add table headers
  const headers = ['Date', 'Source', 'Status', 'Name', 'Email', 'Phone', 'Program']
  let y = height - 120
  let x = 50

  headers.forEach((header, i) => {
    page.drawText(header, {
      x: x + (i * 80),
      y,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0)
    })
  })

  // Add data rows
  y -= 20
  data.forEach((row) => {
    if (y < 50) {
      // Add new page if we're running out of space
      const newPage = pdfDoc.addPage()
      y = newPage.getSize().height - 50
    }

    page.drawText(row.date, { x: 50, y, size: 10, font })
    page.drawText(row.source, { x: 130, y, size: 10, font })
    page.drawText(row.status, { x: 210, y, size: 10, font })
    page.drawText(row.name, { x: 290, y, size: 10, font })
    page.drawText(row.email, { x: 370, y, size: 10, font })
    page.drawText(row.phone, { x: 450, y, size: 10, font })
    page.drawText(row.program, { x: 530, y, size: 10, font })
    y -= 20
  })

  return await pdfDoc.save()
}

async function generateExcel(report: MarketingReport, ownerLabel?: string) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Marketing Report')

  // Add title
  worksheet.mergeCells('A1:G1')
  worksheet.getCell('A1').value = 'Marketing Report'
  worksheet.getCell('A1').font = { size: 16, bold: true }
  worksheet.getCell('A1').alignment = { horizontal: 'center' }

  // Add date
  worksheet.mergeCells('A2:G2')
  worksheet.getCell('A2').value = `${ownerLabel ? `Officer: ${ownerLabel}` : 'Scope: All Users'} | Generated on: ${new Date().toLocaleDateString()}`
  worksheet.getCell('A2').alignment = { horizontal: 'center' }

  // Headers for detail table
  const headers = ['Created At', 'Source', 'Status', 'Name', 'Email', 'Phone', 'Program', 'Payment Status']
  worksheet.addRow(headers)
  worksheet.getRow(4).font = { bold: true }

  // Summary rows just below title
  worksheet.addRow([])
  worksheet.addRow(['Metric', 'Value'])
  const summaryRow = worksheet.lastRow!
  summaryRow.font = { bold: true }
  const summary = [
    ['Total Inquiries', report.summary.totalInquiries],
    ['Total Follow-ups', report.summary.totalFollowups],
    ['Paid Registrations', report.summary.totalPaidRegistrations],
    ['Conversion Rate (%)', report.summary.conversionRate],
    ['Avg. Response Time (hrs)', report.summary.avgResponseTimeHrs],
  ]
  summary.forEach(r => worksheet.addRow(r))
  worksheet.addRow([]) // spacer

  // Append inquiry rows
  report.tables.inquiries.forEach((i: any) => {
    worksheet.addRow([
      i.createdAt ? String(i.createdAt).slice(0, 19).replace('T', ' ') : '',
      i.source || '',
      i.status || '',
      i.fullName || i.name || '',
      i.email || '',
      i.phone || '',
      i.programOfInterest || '',
      i.paymentStatus || '',
    ])
  })

  // Append followup rows
  report.tables.followups.forEach((f: any) => {
    const inq = (f.inquiry || {}) as any
    worksheet.addRow([
      f.createdAt ? String(f.createdAt).slice(0, 19).replace('T', ' ') : '',
      f.type || '',
      f.status || '',
      inq.fullName || f.inquiryName || '',
      inq.email || '',
      inq.phone || '',
      inq.programOfInterest || '',
      inq.paymentStatus || '',
    ])
  })

  // Auto width for first 8 columns
  worksheet.columns.forEach((column: any, idx: number) => {
    if (!column) return
    const maxLen = Math.max(
      10,
      ...column.values
        .filter((v: any) => typeof v === 'string' || typeof v === 'number')
        .map((v: any) => String(v).length)
    )
    column.width = Math.min(40, maxLen + 2)
  })

  return await workbook.xlsx.writeBuffer()
}

function drawTable(page: any, font: any, boldFont: any, startY: number, headers: string[], rows: any[][], colWidths: number[]) {
  let y = startY;
  const rowHeight = 18;
  // Draw headers
  let x = 50;
  headers.forEach((header, i) => {
    page.drawText(header, { x, y, size: 12, font: boldFont });
    x += colWidths[i];
  });
  y -= rowHeight;
  // Draw rows
  rows.forEach(row => {
    let x = 50;
    row.forEach((cell, i) => {
      page.drawText(String(cell), { x, y, size: 12, font });
      x += colWidths[i];
    });
    y -= rowHeight;
  });
  return y;
}

async function generatePDFReport(report: MarketingReport, ownerLabel?: string) {
  const doc = new jsPDF();

  const page = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
  const margin = 14;
  let cursorY = margin;

  function sectionTitle(text: string) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, cursorY);
    cursorY += 6;
    doc.setDrawColor(0, 128, 128);
    doc.setLineWidth(0.6);
    doc.line(margin, cursorY, page.width - margin, cursorY);
    cursorY += 4;
  }

  function paragraph(text: string) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, page.width - margin * 2);
    doc.text(lines, margin, cursorY);
    cursorY += lines.length * 5 + 3;
  }

  function bullet(items: string[]) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    items.forEach((t) => {
      const lines = doc.splitTextToSize(`• ${t}`, page.width - margin * 2 - 6);
      doc.text(lines, margin + 3, cursorY);
      cursorY += lines.length * 5 + 2;
    });
    cursorY += 2;
  }

  function drawBarChart(title: string, data: Array<[string, number]>, options?: { maxBars?: number; colors?: number[][] }) {
    const maxBars = options?.maxBars ?? 6;
    const chartData = data.slice(0, maxBars);
    if (chartData.length === 0) return;

    // Title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, cursorY);
    cursorY += 6;

    const chartLeft = margin;
    const chartTop = cursorY;
    const chartWidth = page.width - margin * 2;
    const chartHeight = 50;

    // Axis
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(chartLeft, chartTop + chartHeight, chartLeft + chartWidth, chartTop + chartHeight);

    const maxValue = Math.max(...chartData.map(([, v]) => v)) || 1;
    const barGap = 6;
    const barWidth = (chartWidth - (chartData.length + 1) * barGap) / chartData.length;
    const labelFontSize = 9;

    chartData.forEach(([label, value], i) => {
      const x = chartLeft + barGap + i * (barWidth + barGap);
      const barH = Math.round((value / maxValue) * (chartHeight - 12));
      const y = chartTop + chartHeight - barH;

      const color = options?.colors?.[i % (options.colors.length)] || [59, 130, 246]; // blue
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(x, y, barWidth, barH, 'F');

      // Value label
      doc.setFontSize(8);
      doc.setTextColor(60);
      doc.text(String(value), x + barWidth / 2, y - 2, { align: 'center' as const });

      // X label
      doc.setFontSize(labelFontSize);
      doc.setTextColor(0);
      const lbl = label.length > 12 ? label.slice(0, 12) + '…' : label;
      doc.text(lbl, x + barWidth / 2, chartTop + chartHeight + 5, { align: 'center' as const });
    });

    cursorY = chartTop + chartHeight + 12;
  }

  // Cover Title
  doc.setFontSize(20);
  doc.setTextColor(0, 128, 128);
  doc.setFont('helvetica', 'bold');
  doc.text('SALES AND MARKETING REPORT', page.width / 2, cursorY + 4, { align: 'center' as const });
  cursorY += 14;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const scopeText = ownerLabel ? `Officer: ${ownerLabel}` : 'Scope: All Users';
  doc.text(`${scopeText} | Generated on: ${new Date().toLocaleDateString()}`, page.width / 2, cursorY, { align: 'center' as const });
  cursorY += 10;

  // Executive Summary (narrative)
  sectionTitle('Executive Summary');
  paragraph(report.executiveSummary || `This report summarizes performance with ${report.summary.totalInquiries} inquiries and ${report.summary.totalFollowups} follow-ups. Conversion is ${report.summary.conversionRate}% with average first response ${report.summary.avgResponseTimeHrs} hour(s).`);

  // Key Metrics (single compact table)
  autoTable(doc, {
    startY: cursorY,
    head: [['Metric', 'Value']],
    body: [
      ['Total Inquiries', String(report.summary.totalInquiries)],
      ['Total Follow-ups', String(report.summary.totalFollowups)],
      ['Paid Registrations', String(report.summary.totalPaidRegistrations)],
      ['Conversion Rate', `${report.summary.conversionRate}%`],
      ['Avg. Response Time', `${report.summary.avgResponseTimeHrs} h`],
    ],
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [0, 128, 128] },
    margin: { left: margin, right: margin },
  });
  cursorY = (doc as any).lastAutoTable.finalY + 10;

  // Inquiries by Source (bar chart)
  const sourcePairs = Object.entries(report.charts.inquiriesBySource).map(([k, v]) => [k, Number(v)]) as [string, number][];
  if (cursorY > page.height - 80) { doc.addPage(); cursorY = margin; }
  drawBarChart('Inquiry Sources (volume)', sourcePairs, { maxBars: 6 });

  // Top Programs (bar chart)
  if (cursorY > page.height - 80) { doc.addPage(); cursorY = margin; }
  drawBarChart('Top Programs of Interest', report.charts.topPrograms, { maxBars: 6, colors: [[59,130,246],[16,185,129],[234,179,8],[244,63,94],[99,102,241],[5,150,105]] });

  // Follow-up Trends (narrative)
  if (cursorY > page.height - 60) { doc.addPage(); cursorY = margin; }
  sectionTitle('Follow-up Trends');
  const byType = report.charts.followupsByType
    .filter(f => f.count > 0)
    .map(f => `${f.type}: ${f.count}`)
    .join(', ');
  const byStatus = report.charts.followupsByStatus
    .filter(s => s.count > 0)
    .map(s => `${s.status}: ${s.count}`)
    .join(', ');
  paragraph(
    `Engagement has been driven primarily through these channels — ${byType}. ` +
    `Status distribution shows ${byStatus}. We recommend prioritizing high-yield contact methods and ` +
    `reducing cycle time for pending and rescheduled follow-ups.`
  );

  // Recommendations
  if (cursorY > page.height - 80) { doc.addPage(); cursorY = margin; }
  sectionTitle('Recommendations');
  bullet(report.recommendations);

  // Action Plan
  if (cursorY > page.height - 80) { doc.addPage(); cursorY = margin; }
  sectionTitle('Action Plan');
  bullet(report.actionPlan);

  // Per-Officer Breakdown (only if users are available)
  if (report.users && report.users.length > 0) {
    if (cursorY > page.height - 80) { doc.addPage(); cursorY = margin; }
    sectionTitle('Per-Officer Performance');
    const tableHeaders = ['Officer', 'Inquiries', 'Follow-ups', 'Registrations', 'Performance Index'];
    const tableRows: any[][] = [];
    report.users.forEach(user => {
      tableRows.push([
        user.owner,
        user.inquiries,
        user.followups,
        user.registrations,
        `${user.performanceIndex}%`
      ]);
    });
    autoTable(doc, {
      startY: cursorY,
      head: [tableHeaders],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 128, 128] },
      margin: { left: margin, right: margin },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Appendix: Top inquiries table (limited to 40)
  if (cursorY > page.height - 80) { doc.addPage(); cursorY = margin; }
  sectionTitle('Top Inquiries (sample)');
  const topInquiries = (report.tables.inquiries || []).slice(0, 40);
  if (topInquiries.length > 0) {
    const inquiryRows = topInquiries.map((i: any) => [
      i.createdAt ? String(i.createdAt).slice(0, 10) : '',
      i.source || '',
      i.status || '',
      i.fullName || i.name || '',
      i.email || '',
      i.phone || '',
      i.programOfInterest || '',
      i.paymentStatus || '',
    ]);
    autoTable(doc, {
      startY: cursorY,
      head: [['Date', 'Source', 'Status', 'Name', 'Email', 'Phone', 'Program', 'Payment']],
      body: inquiryRows,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 128, 128] },
      margin: { left: margin, right: margin },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Appendix: Top follow-ups table (limited to 40)
  if (cursorY > page.height - 80) { doc.addPage(); cursorY = margin; }
  sectionTitle('Top Follow-ups (sample)');
  const topFollowups = (report.tables.followups || []).slice(0, 40);
  if (topFollowups.length > 0) {
    const rows = topFollowups.map((f: any) => {
      const inq = (f.inquiry || {}) as any;
      return [
        f.createdAt ? String(f.createdAt).slice(0, 10) : '',
        f.type || '',
        f.status || '',
        inq.fullName || f.inquiryName || '',
        inq.phone || '',
        f.notes || '',
      ];
    });
    autoTable(doc, {
      startY: cursorY,
      head: [['Date', 'Type', 'Status', 'Inquiry', 'Phone', 'Notes']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 128, 128] },
      margin: { left: margin, right: margin },
    });
  }

  return doc.output('arraybuffer');
}

// Helper to convert number to Roman numerals
function toRoman(num: number) {
  const lookup: Record<string, number> = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  const roman: string[] = [];
  for (const key of Object.keys(lookup)) {
    while (num >= lookup[key]) {
      roman.push(key);
      num -= lookup[key];
    }
  }
  return roman.join('');
}

function sanitizeFilename(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/gi, '')
}