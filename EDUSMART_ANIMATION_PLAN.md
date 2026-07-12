# System-Wide Animation & Dashboard Live Plan

## 1. Dashboard — Live & Animated

### 1.1 Auto-Refresh
- Stat cards and charts refresh every 30 seconds via existing `setInterval`
- Briefing banner already refreshes every 60s
- Add a pulsing green dot indicator showing "Live" in the dashboard header

### 1.2 Stat Card Animations
```
When a stat card value changes:
1. Brief flash/glow effect (green for increase, amber for decrease)
2. Number counts up/down smoothly over 500ms
3. Subtle scale bounce on mount: scale(0.95) → scale(1) over 300ms
```

### 1.3 Chart Animations
- Chart.js already supports `animation.duration` — set to 800ms
- Add `animation.easing: 'easeOutQuart'` for smooth transitions
- Doughnut charts: add `animation.animateRotate: true`

### 1.4 Activity Feed
- Add a real-time activity ticker showing recent actions:
  - "John created inquiry #123" 
  - "Jane completed follow-up for Mary"
  - Fades in from right, auto-dismisses after 5s

---

## 2. System-Wide Animations (CSS)

### 2.1 Page Transitions
```css
/* Fade in on page load */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
main { animation: fadeIn 200ms ease-out; }

/* Slide up for content sections */
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.content-section { animation: slideUp 300ms ease-out; }
```

### 2.2 Card & List Item Hover
```css
/* Card hover lift */
.card { transition: transform 150ms ease, box-shadow 150ms ease; }
.card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

/* List row hover */
.list-row { transition: background-color 100ms ease; }
```

### 2.3 Button Interactions
```css
/* Button press */
button:active { transform: scale(0.97); }

/* Loading spinner on buttons */
button.loading svg { animation: spin 600ms linear infinite; }
```

### 2.4 Modal & Dropdown
```css
/* Modal backdrop fade */
.modal-overlay { animation: fadeIn 150ms ease-out; }
.modal-panel { animation: slideUp 200ms ease-out; }

/* Dropdown fade + slide */
.dropdown { animation: fadeIn 100ms ease, slideUp 80ms ease; }
```

### 2.5 Notification Toasts
```css
/* Toast slide in from right */
.toast { animation: slideInRight 300ms ease-out; }
@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.toast-exit { animation: slideOutRight 200ms ease-in; }
```

### 2.6 Skeleton Loading
- Replace static "Loading..." text with shimmer skeleton placeholders
- Use Tailwind `animate-pulse` on gray rectangles matching content shape

---

## 3. Implementation Plan

| # | Feature | Effort | File(s) |
|---|---------|--------|---------|
| 1 | Stat card mount animation (scale bounce) | 1h | `globals.css` + keyframes |
| 2 | Page fade-in on main content | 0.5h | `globals.css` |
| 3 | Card hover lift effect | 0.5h | `globals.css` |
| 4 | Modal/dropdown slide-up animation | 1h | `globals.css` |
| 5 | Button active press effect | 0.5h | `globals.css` |
| 6 | Toast notification slide-in | 1h | New `Toast.tsx` component |
| 7 | Chart animation duration config | 0.5h | `marketing/page.tsx` chart options |
| 8 | Skeleton loading states | 2h | Per-page loading components |
| 9 | Live activity feed ticker | 3h | New `ActivityFeed.tsx` component + SSE |
| 10 | Live indicator dot on dashboard | 0.5h | `DashboardLayout.tsx` |

**Total estimated effort: ~10 hours**

---

## 4. Notes
- Animations use `prefers-reduced-motion: reduce` media query to respect accessibility settings
- All animations are CSS-based where possible (no JS libraries)
- Chart animations use existing Chart.js config (no extra dependencies)
- Activity feed requires SSE endpoint (already created at `/api/chat/events`)
