# Campaigns & Chat — Analysis & Implementation Plan

## 1. Current State

### Campaigns (`/marketing/campaigns`)
- **Files scanned**: `frontend/app/marketing/campaigns/` — empty/stub page only
- **No campaign functionality exists** — the route shows no content
- No campaign creation, tracking, analytics, or automation
- No integration with inquiries or follow-ups

### Chat (`backend/src/controllers/chat.controller.ts`, `frontend/src/components/marketing/FloatingChat.tsx`)
- **Backend**: Full CRUD for chat rooms, messages, participants, mentions, read tracking
- **Frontend**: Floating chat widget with room list, message input, inquiry/user tagging
- **Gaps identified**:
  - No real-time updates (WebSocket/SSE) — relies on manual refresh
  - No push notifications for new messages
  - No file/image sharing
  - No chat history persistence beyond DB (no export)
  - No unread badge on sidebar/browser tab
  - No search within chat history
  - No typing indicators
  - No message reactions
  - No group chat admin controls

---

## 2. Campaigns Module — Full Feature Plan

### 2.1 Campaign Types (based on HubSpot/Mailchimp standards)

| Type | Description | Channels |
|------|-------------|----------|
| **Email Blast** | Batch email to filtered leads | Email (via tenant SMTP) |
| **SMS Broadcast** | SMS to filtered leads | SMS (via Africa's Talking/Twilio) |
| **WhatsApp Campaign** | Automated WhatsApp sequences | WhatsApp Business API |
| **Multi-Step Sequence** | Drip campaign (Day 1: Email, Day 3: SMS, Day 7: Call) | Email + SMS + WhatsApp |

### 2.2 Core Features

```
Campaigns
├── Create Campaign
│   ├── Name, Description, Type (Email/SMS/WhatsApp/Sequence)
│   ├── Audience (filter by: status, source, program, KCSE grade, score range, date range)
│   ├── Schedule (send now, schedule later, recurring)
│   └── Content (email body/SMS text/WhatsApp template)
├── Campaign List
│   ├── Status (Draft, Scheduled, Sending, Sent, Completed, Paused, Failed)
│   ├── Stats (sent, delivered, opened, clicked, replied, bounced, unsubscribed)
│   ├── Progress bar (% sent)
│   └── Actions (pause, resume, duplicate, archive, delete)
├── Campaign Detail
│   ├── Performance chart (sends over time)
│   ├── Audience breakdown
│   ├── Per-recipient delivery status
│   └── A/B test results (if applicable)
├── Templates
│   ├── Email templates (rich HTML with merge fields)
│   ├── SMS templates (with character counting)
│   └── Sequence blueprints (pre-built multi-step journeys)
└── Reporting
    ├── Campaign ROI (conversions attributed to campaign)
    ├── Channel comparison
    ├── Best send time analysis
    └── Export (CSV/PDF)
```

### 2.3 Data Model

```prisma
model Campaign {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  type        String   // email, sms, whatsapp, sequence
  status      String   @default("draft") // draft, scheduled, sending, sent, completed, paused, failed
  audience    Json?    // filter criteria ({ statusIn: string[], sourceEquals: string, ... })
  content     Json?    // { subject, body, html, smsText, whatsappTemplate }
  scheduleAt  DateTime?
  completedAt DateTime?
  sentCount   Int      @default(0)
  openedCount Int      @default(0)
  repliedCount Int     @default(0)
  bouncedCount Int     @default(0)
  tenantId    Int?
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  steps       CampaignStep[]
  @@map("campaigns")
}

model CampaignStep {
  id          Int      @id @default(autoincrement())
  campaignId  Int
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  stepOrder   Int
  delayDays   Int      // days after previous step
  type        String   // email, sms, whatsapp, call
  content     Json?    // step-specific content
  createdAt   DateTime @default(now())
  @@map("campaign_steps")
}

model CampaignRecipient {
  id         Int      @id @default(autoincrement())
  campaignId Int
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  inquiryId  Int
  inquiry    Inquiry  @relation(fields: [inquiryId], references: [id])
  email      String?
  phone      String?
  status     String   @default("pending") // pending, sent, delivered, opened, clicked, replied, bounced, failed
  sentAt     DateTime?
  openedAt   DateTime?
  repliedAt  DateTime?
  error      String?
  createdAt  DateTime @default(now())
  @@unique([campaignId, inquiryId])
  @@map("campaign_recipients")
}
```

### 2.4 Execution Engine

A new background worker (`backend/src/workers/campaignWorker.ts`) will:
- Every 5 minutes: check for campaigns where `scheduleAt <= now` and `status = 'scheduled'`
- Process recipients in batches of 50
- For multi-step sequences: check if it's time for the next step
- Update `CampaignRecipient` status based on delivery feedback
- Requires SMS/WhatsApp provider integration for actual sending

---

## 3. Chat System — Gaps & Improvements

### 3.1 Critical Gaps

| Gap | Impact | Fix |
|-----|--------|-----|
| **No real-time updates** | Users must refresh to see new messages | Add WebSocket or SSE via `socket.io` or Server-Sent Events |
| **No push notifications** | Users don't know they have new messages | Integrate with browser Notification API + email fallback |
| **No file/image sharing** | Can't share screenshots, documents | Add file upload to chat messages (use existing upload infrastructure) |
| **No search** | Can't find past messages | Add `GET /chat/search?q=` full-text search on messages |
| **No typing indicators** | Users don't know when someone is typing | Add WebSocket event for typing status |
| **No unread badge on sidebar** | Users miss messages | Show unread count on chat icon in sidebar |

### 3.2 UI Improvements

| Current | Target |
|---------|--------|
| Floating chat bubble (bottom-right) | Full chat panel that can be opened as a side panel |
| No message status | Show ✓, ✓✓, ✓✓✓ (sent, delivered, read) |
| No message timestamps grouping | Group by "Today", "Yesterday", "This Week" |
| No emoji/quick reactions | Add emoji picker + message reactions |
| No chat history export | Add "Export Chat" button |
| No pinned messages | Allow pinning important messages |
| No chat search bar | Add search input at top of chat panel |

### 3.3 Technical Implementation

```typescript
// WebSocket service (backend/src/services/chatSocket.ts)
// Connect to Next.js custom server or standalone WebSocket server
// Events:
//   chat:message — new message
//   chat:typing — typing indicator
//   chat:read — read receipt
//   chat:online — user online status
```

---

## 4. Implementation Priority

| Priority | Feature | Effort | Dependencies |
|----------|---------|--------|-------------|
| **P1** | Campaign CRUD (create, list, detail) | 12h | None (new files) |
| **P1** | Campaign audience filter builder | 6h | Inquiry list API |
| **P2** | Campaign execution worker | 8h | Campaign CRUD |
| **P2** | Chat real-time via SSE | 8h | Existing chat API |
| **P2** | Chat file sharing | 4h | File upload infra |
| **P3** | Campaign email sending | 6h | Email service + Campaign execution |
| **P3** | Chat push notifications | 4h | Notification API |
| **P3** | Chat search + typing indicators | 6h | WebSocket service |
| **P4** | Multi-step sequences | 8h | Campaign steps model |
| **P4** | Campaign reporting | 6h | Campaign CRUD |
| **P4** | SMS/WhatsApp provider integration | 8h | 3rd party API keys |

**Total estimated effort: ~70 hours**
