# EduSmart CRM — Transformation Roadmap

## Phase 1: Foundation (Week 1)
### Core Stabilization + Quick Wins

| # | Feature | Module | Effort | Files |
|---|---------|--------|--------|-------|
| 1.1 | **Daily Briefing Banner** — AI-prioritized task queue per staff member on dashboard | Dashboard | 4h | `frontend/src/components/layout/DashboardLayout.tsx`, `backend/src/services/digestProcessor.ts` |
| 1.2 | **Focus Queue** — sorted view of today's priorities (hot leads, overdue follow-ups, high-score) | Inquiries | 6h | `frontend/src/components/crm/NextBestActionsPanel.tsx`, `backend/src/routes/inquiryRoutes.ts` |
| 1.3 | **One-Click Actions** — inline complete/snooze/reschedule on calendar and follow-up list | Calendar, Follow-ups | 6h | `frontend/app/calendar/page.tsx`, `frontend/src/components/marketing/FollowupList.tsx` |
| 1.4 | **Auto-Send Sequence for Letters** — Generate → Email PDF → SMS notification → Track opens | Admission Letters | 8h | `backend/src/controllers/admissionLetter.controller.ts`, `backend/src/routes/emailMessaging.routes.ts` |
| 1.5 | **QR Code on Letters** — auto-verify at registration desk | Admission Letters | 4h | `backend/src/controllers/admissionLetter.controller.ts` |

**Phase 1 Total:** ~28h

---

## Phase 2: Communication Hub (Week 2)
### Omnichannel Inbox + Smart Messaging

| # | Feature | Module | Effort | Files |
|---|---------|--------|--------|-------|
| 2.1 | **Unified Inbox** — email + SMS + WhatsApp + calls grouped by lead thread | Communication | 16h | `frontend/app/email/inbox/page.tsx` (rebuild), `backend/src/routes/emailMessaging.routes.ts` |
| 2.2 | **Quick Reply Templates** — saved snippets per team | Communication | 4h | `backend/src/utils/emailMessageStore.ts`, `frontend/src/components/email/` |
| 2.3 | **Scheduled Send** — compose now, deliver at optimal time | Communication | 4h | `backend/src/routes/emailMessaging.routes.ts` |
| 2.4 | **Bulk Broadcast** — send SMS/WhatsApp to filtered lead lists | Marketing | 8h | `backend/src/routes/broadcast.routes.ts` (new), `frontend/src/components/marketing/BroadcastComposer.tsx` (new) |
| 2.5 | **Read/Delivery Tracking** — track email opens, SMS delivery, link clicks | Communication | 8h | `backend/src/utils/trackingPixel.ts` (new), frontend email template update |

**Phase 2 Total:** ~40h

---

## Phase 3: Smart Automation (Week 3)
### Visual Workflow Builder + SLA Engine

| # | Feature | Module | Effort | Files |
|---|---------|--------|--------|-------|
| 3.1 | **Visual Workflow Builder** — drag-drop triggers, conditions, actions | Automation | 24h | `frontend/app/marketing/settings/Automations.tsx` (rewrite), `backend/src/utils/inquiryAutomation.ts` (extend) |
| 3.2 | **Multi-Step Sequences** — Day 1→3→7→14 nurture cadences | Automation | 8h | `backend/src/services/sequenceWorker.ts` (new), `backend/src/workers/schedulerService.ts` |
| 3.3 | **SLA Management** — auto-escalate overdue: staff→manager→admin | Automation | 6h | `backend/src/services/escalationService.ts` (extend) |
| 3.4 | **Time-Based Triggers** — "Every Monday 8am send report", "Every hour check dormant" | Automation | 4h | `backend/src/workers/schedulerService.ts` |
| 3.5 | **Conditional Branching** — IF/ELSE in automation rules (score > 70 → assign senior, else → assign junior) | Automation | 6h | `backend/src/utils/inquiryAutomation.ts` |

**Phase 3 Total:** ~48h

---

## Phase 4: Predictive Intelligence (Week 4)
### ML Scoring + Smart Recommendations

| # | Feature | Module | Effort | Files |
|---|---------|--------|--------|-------|
| 4.1 | **Lead Scoring 2.0** — 20-factor ML scoring (source, response time, engagement, channel preference) | Inquiries | 12h | `backend/src/utils/marketingSmartFeatures.ts` (rewrite), `backend/src/utils/llmClient.ts` |
| 4.2 | **Best Time to Contact AI** — per-lead optimal contact window prediction | Follow-ups | 8h | `backend/src/services/smartScheduler.ts` (new) |
| 4.3 | **Predictive Conversion** — "% likely to convert in N days" with reasoning | Analytics | 8h | `backend/src/controllers/analytics.controller.ts` (extend) |
| 4.4 | **Channel Optimization** — "This lead responds best to WhatsApp, not email" | Communication | 6h | `backend/src/utils/followupNurturing.ts` (extend) |
| 4.5 | **Auto-Enrichment** — fetch LinkedIn/social data on inquiry create | Inquiries | 8h | `backend/src/services/enrichmentService.ts` (new) |

**Phase 4 Total:** ~42h

---

## Phase 5: Document Intelligence (Week 5)
### E-Signature + Portal + Smart Templates

| # | Feature | Module | Effort | Files |
|---|---------|--------|--------|-------|
| 5.1 | **Dynamic Letter Templates** — template editor with merge fields, conditional sections | Admission Letters | 12h | `frontend/app/marketing/settings/LetterTemplates.tsx` (new), `backend/src/services/letterTemplateService.ts` (new) |
| 5.2 | **E-Signature Integration** — prospect signs online, PDF stamped with signature + timestamp | Admission Letters | 10h | `backend/src/controllers/admissionLetter.controller.ts` (extend), `frontend/src/components/esign/` (new) |
| 5.3 | **Document Portal** — self-service view/download/sign all documents per prospect | Portal | 8h | `frontend/app/portal/` (new route), `backend/src/routes/portal.routes.ts` (new) |
| 5.4 | **Bulk Smart Generation** — 500+ letters with progress tracking, error log, retry | Admission Letters | 6h | `backend/src/controllers/admissionLetter.controller.ts` (extend) |
| 5.5 | **Auto-Track Letter Status** — generated → emailed → opened → signed → verified | Admission Letters | 4h | `backend/src/services/letterTracking.ts` (new) |

**Phase 5 Total:** ~40h

---

## Phase 6: Team Intelligence (Week 6)
### Staff Performance + Mobile + Sync

| # | Feature | Module | Effort | Files |
|---|---------|--------|--------|-------|
| 6.1 | **Staff Performance Leaderboard** — real-time conversion rates, response times, workload | Analytics | 8h | `frontend/app/cpanel/accountability/page.tsx` (extend) |
| 6.2 | **Round-Robin Calendar View** — see all staff schedules side by side, drag to reassign | Calendar | 10h | `frontend/app/calendar/page.tsx` (extend) |
| 6.3 | **Google Calendar 2-Way Sync** — OAuth + push/pull events | Calendar | 16h | `backend/src/services/googleCalendarSync.ts` (new) |
| 6.4 | **Automated Report Delivery** — weekly PDF/Excel emailed to management | Reports | 8h | `backend/src/workers/reportWorker.ts` (new) |
| 6.5 | **Real-Time Dashboard** — live leads, conversions, activity feed | Analytics | 8h | `frontend/app/analytics/page.tsx` (rewrite) |

**Phase 6 Total:** ~50h

---

## Architecture Principles

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  Dashboard │ Inbox │ Calendar │ Analytics │ Automation   │
└──────────────────┬──────────────────────────────────────┘
                   │ Proxy
┌──────────────────▼──────────────────────────────────────┐
│                    Backend (Express+Prisma)              │
│  Workers │ API Routes │ Services │ Utils │ Integrations  │
└──────────────────┬──────────────────────────────────────┘
                   │ Queries
┌──────────────────▼──────────────────────────────────────┐
│                    PostgreSQL (Supabase)                 │
│  Inquiries │ Followups │ Tasks │ Tenants │ Config        │
└─────────────────────────────────────────────────────────┘
```

### Service Layer Pattern
All new features follow this structure:
- `backend/src/routes/` — API endpoints (thin — validation + delegation)
- `backend/src/services/` — Business logic (thick — all rules, calculations)
- `backend/src/workers/` — Background jobs (scheduled, event-driven)
- `backend/src/utils/` — Shared helpers (email, LLM, PDF, etc.)

### Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Background jobs | In-process `setInterval` (via schedulerService.ts) | Zero external dependencies, works on Railway free tier |
| ML/AI | Groq API (free) + rule-based fallback | No infra cost, good enough for CRM predictions |
| File storage | PostgreSQL JSON + DB columns | Avoids S3/complex storage setup |
| Email delivery | Per-tenant SMTP via cPanel settings | User controls their own email reputation |
| Real-time | Polling every 30s (initially) | Simpler than WebSocket for MVP; upgrade to SSE later |

---

## Effort Summary

| Phase | Hours | Focus |
|-------|-------|-------|
| Phase 1 — Foundation | ~28h | Quick wins, daily briefing, auto-letter send |
| Phase 2 — Communication Hub | ~40h | Unified inbox, bulk broadcast, tracking |
| Phase 3 — Smart Automation | ~48h | Visual workflow builder, SLA engine |
| Phase 4 — Predictive Intelligence | ~42h | ML scoring, best-time AI, auto-enrichment |
| Phase 5 — Document Intelligence | ~40h | E-signature, portal, smart templates |
| Phase 6 — Team Intelligence | ~50h | Leaderboard, Google sync, live dashboard |
| **Total** | **~248h** | **6 weeks full-time** |

---

## Quick Start — First 3 Features

If you want to start TODAY with the highest-impact 3 features:

1. **Daily Briefing Banner** (~4h) — shows each staff member their priority queue on login
2. **Auto-Send Admission Letter Sequence** (~8h) — generate → email PDF → SMS notification
3. **Unified Inbox** (~16h) — all prospect communications in one threaded view

These 3 alone deliver 80% of the value. Ready to start? Pick one.
