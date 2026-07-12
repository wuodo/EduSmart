# QA Module — Enhancement Plan (Based on Salesforce/HubSpot/Zoho Standards)

## What Exists Now
- Auto-flag incomplete inquiries (10 field check) on create/update
- Manual review queue with approve/reject/comment
- Assignment to reviewers
- Per-item stats

## What World-Class CRMs Add

### 1. Stage-Gate Validation (Salesforce Blueprint / Zoho Blueprint)
**Problem:** Inquiries can move from "new" to "won" without required fields being filled.
**Fix:** Enforce required fields per pipeline stage transition.
```
Stage "new → contacted": email must be filled
Stage "contacted → qualified": phone + program must be filled
Stage "qualified → proposal": KCSE grade + intake must be filled
```
**Effort:** 8h (backend validation rules + UI for admin to configure them)

### 2. Duplicate Prevention (Salesforce Matching Rules)
**Problem:** Duplicate inquiries created for the same person.
**Fix:** Fuzzy matching on name + phone + email at create time. Show a warning modal with existing matches before allowing creation.
**Already partially done:** `findSmartDuplicate` exists but only blocks — never shows comparison UI.
**Effort:** 6h (UI modal showing duplicates side-by-side + merge flow)

### 3. Auto-Enrichment (HubSpot / Clearbit / Zoominfo)
**Problem:** Missing fields require manual data entry.
**Fix:** Auto-fill missing fields using free/public APIs:
- Phone → get carrier, location
- Email → get domain, company
- Name → get gender probability
**Effort:** 8h (backend service + API keys)

### 4. Data Quality Dashboard (Salesforce Data.com / HubSpot Data Quality)
**Problem:** No system-wide view of data health.
**Fix:** A dashboard showing:
- Completeness % over time (trend line)
- Top 10 missing fields across all inquiries
- Staff data quality leaderboard (who creates the most complete records)
- Records created with score < 50 (needs review)
**Effort:** 10h (charts + aggregation queries)

### 5. Mass Update Tool (Salesforce Mass Editor)
**Problem:** Cannot fix 50 inquiries with missing "intakePeriod" in one go.
**Fix:** "Mass Edit" that lets admins:
- Filter inquiries by missing field
- Set a default value for that field across all matched records
- Preview changes before applying
**Effort:** 8h (frontend table with inline edit + batch API)

### 6. Automated Data Cleanup (HubSpot Workflows)
**Problem:** Manual QA is tedious for low-value items.
**Fix:** Auto-fix rules that run on a schedule:
- IF `kcseGrade` is "Unknown" AND `status` is not "new", auto-tag for review
- IF `phone` has wrong format, attempt to normalize (already done in `phoneMatchVariants`)
- IF `email` is missing but `phone` exists, create a placeholder email
**Effort:** 6h (cron worker + rule engine)

### 7. QA Notification & Escalation
**Problem:** Assigned QA items sit in the queue unnoticed.
**Fix:** 
- Notify reviewer when items are assigned (in-app + email)
- Escalate unreviewed items after 48h to manager
- Daily digest of pending QA items
**Effort:** 4h (uses existing notification service)

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| **P1** | Stage-Gate Validation | 8h | 🔥🔥🔥🔥🔥 |
| **P1** | Data Quality Dashboard | 10h | 🔥🔥🔥🔥 |
| **P2** | Duplicate Prevention UI | 6h | 🔥🔥🔥🔥 |
| **P2** | QA Notifications | 4h | 🔥🔥🔥 |
| **P3** | Mass Update Tool | 8h | 🔥🔥🔥 |
| **P3** | Auto-Enrichment | 8h | 🔥🔥 |
| **P4** | Automated Cleanup | 6h | 🔥🔥 |

**Total estimated effort: ~50 hours**
