'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  Target,
  Bell,
  Moon,
  Copy,
  GraduationCap,
  FileSpreadsheet,
  Clock,
  ClipboardCheck,
} from 'lucide-react'

interface SmartConfig {
  leadScoring: {
    enabled: boolean
    weights: {
      hasEmail: number
      hasPhone: number
      hasKcseGrade: number
      followedUp: number
      highIntakeUrgency: number
      repeatContact: number
    }
  }
  autoReminders: {
    enabled: boolean
    firstReminderDays: number
    repeatIntervalDays: number
    channels: { email: boolean; sms: boolean; whatsapp: boolean }
    maxReminders: number
  }
  dormantLeads: {
    enabled: boolean
    thresholdDays: number
    alertAdmins: boolean
    autoTagAsCold: boolean
  }
  duplicateDetection: {
    enabled: boolean
    matchPhone: boolean
    matchEmail: boolean
    matchName: boolean
    blockOnDuplicate: boolean
  }
  intakeCapacity: {
    enabled: boolean
    warnAtPercent: number
    lockOnFull: boolean
  }
  exportSchedule: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'monthly'
    dayOfWeek: number
    recipients: string
  }
  responseSla: {
    enabled: boolean
    targetHours: number
  }
  profileHygiene: {
    enabled: boolean
    nudgeIncompleteHours: number
  }
}

const DEFAULTS: SmartConfig = {
  leadScoring: {
    enabled: true,
    weights: { hasEmail: 10, hasPhone: 10, hasKcseGrade: 15, followedUp: 20, highIntakeUrgency: 25, repeatContact: 20 },
  },
  autoReminders: {
    enabled: true, firstReminderDays: 2, repeatIntervalDays: 5, maxReminders: 4,
    channels: { email: true, sms: false, whatsapp: false },
  },
  dormantLeads: { enabled: true, thresholdDays: 14, alertAdmins: true, autoTagAsCold: true },
  duplicateDetection: { enabled: true, matchPhone: true, matchEmail: true, matchName: false, blockOnDuplicate: false },
  intakeCapacity: { enabled: false, warnAtPercent: 80, lockOnFull: false },
  exportSchedule: { enabled: false, frequency: 'weekly', dayOfWeek: 1, recipients: '' },
  responseSla: { enabled: false, targetHours: 24 },
  profileHygiene: { enabled: true, nudgeIncompleteHours: 48 },
}

function mergeConfig(patch: Partial<SmartConfig> | null | undefined): SmartConfig {
  if (!patch) return { ...DEFAULTS, leadScoring: { ...DEFAULTS.leadScoring, weights: { ...DEFAULTS.leadScoring.weights } } }
  return {
    ...DEFAULTS,
    ...patch,
    leadScoring: {
      ...DEFAULTS.leadScoring,
      ...patch.leadScoring,
      weights: { ...DEFAULTS.leadScoring.weights, ...patch.leadScoring?.weights },
    },
    autoReminders: {
      ...DEFAULTS.autoReminders,
      ...patch.autoReminders,
      channels: { ...DEFAULTS.autoReminders.channels, ...patch.autoReminders?.channels },
    },
    dormantLeads: { ...DEFAULTS.dormantLeads, ...patch.dormantLeads },
    duplicateDetection: { ...DEFAULTS.duplicateDetection, ...patch.duplicateDetection },
    intakeCapacity: { ...DEFAULTS.intakeCapacity, ...patch.intakeCapacity },
    exportSchedule: { ...DEFAULTS.exportSchedule, ...patch.exportSchedule },
    responseSla: { ...DEFAULTS.responseSla, ...patch.responseSla },
    profileHygiene: { ...DEFAULTS.profileHygiene, ...patch.profileHygiene },
  }
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? 'bg-teal-600' : 'bg-gray-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

function FeatureSection({
  title,
  icon: Icon,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  enabled: boolean
  onToggle: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <section className={`rounded-xl border overflow-hidden mb-4 transition-all ${enabled ? 'border-teal-200 bg-teal-50/20 dark:border-teal-900 dark:bg-teal-950/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
            </div>
            <Toggle checked={enabled} onChange={onToggle} />
          </div>
        </div>
      </div>
      {enabled && children && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40">
          {children}
        </div>
      )}
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {hint && <p className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

const inputCls = 'px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 w-20 text-right bg-white dark:bg-gray-800 text-gray-900 dark:text-white'

export default function SmartFeatures() {
  const [cfg, setCfg] = useState<SmartConfig>(() => mergeConfig(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/marketing/settings/smart', { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.smartConfig) setCfg(mergeConfig(d.smartConfig))
        else setCfg(mergeConfig(null))
      })
      .catch(() => {
        try {
          const ls = localStorage.getItem('smartFeaturesConfig')
          if (ls) setCfg(mergeConfig(JSON.parse(ls)))
        } catch {
          setCfg(mergeConfig(null))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const set = useCallback(<K extends keyof SmartConfig>(section: K, patch: Partial<SmartConfig[K]>) => {
    setCfg(prev => ({ ...prev, [section]: { ...prev[section], ...patch } }))
  }, [])

  const setNested = useCallback(<K extends keyof SmartConfig, NK extends keyof SmartConfig[K]>(
    section: K, subsection: NK, patch: Partial<SmartConfig[K][NK]>
  ) => {
    setCfg(prev => ({
      ...prev,
      [section]: { ...prev[section], [subsection]: { ...(prev[section][subsection] as object), ...(patch as object) } },
    }))
  }, [])

  const save = async () => {
    setSaving(true); setError('')
    try {
      localStorage.setItem('smartFeaturesConfig', JSON.stringify(cfg))
      const res = await fetch('/api/marketing/settings/smart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ smartConfig: cfg }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as any)?.error || 'Server rejected save')
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  const w = cfg.leadScoring.weights
  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="text-center text-gray-600 dark:text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          Loading smart features…
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 w-full min-w-0">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Target className="h-7 w-7 text-primary" />
          Other Smart Features
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Tenant rules stored in the central configuration database (same store as marketing settings). Lead scoring and duplicate checks run on the inquiry API; dormant and capacity hints appear on the inquiry list.
        </p>
      </div>

       {error && (
        <div className="text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm">
          {error}. Changes were kept in this browser as a fallback.
        </div>
      )}
      {saved && !error && (
        <div className="text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm">
          Saved to server.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-4 text-sm text-gray-600 dark:text-gray-300 space-y-2">
        <p className="font-medium text-gray-800 dark:text-gray-200">How this module works</p>
        <ul className="list-disc pl-5 space-y-1 text-xs leading-relaxed">
          <li><strong className="font-medium text-gray-700 dark:text-gray-200">Lead scoring</strong> recalculates the numeric score when inquiries are created or updated, using the weights you enable here (capped at 100).</li>
          <li><strong className="font-medium text-gray-700 dark:text-gray-200">Duplicate detection</strong> runs on create and bulk import; blocking rejects the row with HTTP 409 when enabled.</li>
          <li><strong className="font-medium text-gray-700 dark:text-gray-200">Dormant leads</strong> and <strong className="font-medium text-gray-700 dark:text-gray-200">intake capacity</strong> add badges on the inquiry list when those sections are enabled.</li>
          <li><strong className="font-medium text-gray-700 dark:text-gray-200">Reminders, scheduled export, SLA, and profile hygiene</strong> are stored for your processes; automated email/cron dispatch is not started by this UI alone (configure jobs or integrations separately).</li>
        </ul>
      </div>

      <FeatureSection
        icon={Target}
        title="Lead scoring"
        description="Score inquiries from profile fields, follow-up state, urgency, and repeat contact. Applied on the server when records are saved."
        enabled={cfg.leadScoring.enabled}
        onToggle={v => set('leadScoring', { enabled: v })}
      >
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">Weights (sum caps visually at {totalWeight} points before the 100 ceiling)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-1">
          {(Object.entries(w) as [keyof typeof w, number][]).map(([key, val]) => (
            <Row key={key} label={{
              hasEmail: 'Has email', hasPhone: 'Has phone', hasKcseGrade: 'Has KCSE grade',
              followedUp: 'Follow-up logged', highIntakeUrgency: 'Hot status', repeatContact: 'Repeat phone match',
            }[key]}>
              <input type="number" min={0} max={100} value={val} className={inputCls}
                onChange={e => set('leadScoring', { weights: { ...w, [key]: Number(e.target.value) } })} />
            </Row>
          ))}
        </div>
      </FeatureSection>

      <FeatureSection
        icon={Bell}
        title="Auto follow-up reminders"
        description="Stored preferences for reminder cadence and channels. Wire these to your notification worker or CRM automations."
        enabled={cfg.autoReminders.enabled}
        onToggle={v => set('autoReminders', { enabled: v })}
      >
        <Row label="First reminder after" hint="Days since inquiry with no follow-up">
          <div className="flex items-center gap-1">
            <input type="number" min={1} max={30} value={cfg.autoReminders.firstReminderDays} className={inputCls}
              onChange={e => set('autoReminders', { firstReminderDays: Number(e.target.value) })} />
            <span className="text-xs text-gray-500">days</span>
          </div>
        </Row>
        <Row label="Repeat every" hint="If still no follow-up">
          <div className="flex items-center gap-1">
            <input type="number" min={1} max={30} value={cfg.autoReminders.repeatIntervalDays} className={inputCls}
              onChange={e => set('autoReminders', { repeatIntervalDays: Number(e.target.value) })} />
            <span className="text-xs text-gray-500">days</span>
          </div>
        </Row>
        <Row label="Max reminders per inquiry">
          <input type="number" min={1} max={20} value={cfg.autoReminders.maxReminders} className={inputCls}
            onChange={e => set('autoReminders', { maxReminders: Number(e.target.value) })} />
        </Row>
        <div className="pt-1">
          <p className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">Channels</p>
          <div className="flex gap-4 flex-wrap">
            {(['email', 'sms', 'whatsapp'] as const).map(ch => (
              <label key={ch} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={cfg.autoReminders.channels[ch]}
                  onChange={e => setNested('autoReminders', 'channels', { [ch]: e.target.checked })}
                  className="rounded" />
                {ch.charAt(0).toUpperCase() + ch.slice(1)}
              </label>
            ))}
          </div>
        </div>
      </FeatureSection>

      <FeatureSection
        icon={Moon}
        title="Dormant lead detection"
        description="Flags inquiries with no updates past the threshold. Shown as a Dormant badge on the inquiry list."
        enabled={cfg.dormantLeads.enabled}
        onToggle={v => set('dormantLeads', { enabled: v })}
      >
        <Row label="Mark as dormant after" hint="Days since last update">
          <div className="flex items-center gap-1">
            <input type="number" min={3} max={90} value={cfg.dormantLeads.thresholdDays} className={inputCls}
              onChange={e => set('dormantLeads', { thresholdDays: Number(e.target.value) })} />
            <span className="text-xs text-gray-500">days</span>
          </div>
        </Row>
        <Row label="Alert admins and senior staff">
          <Toggle checked={cfg.dormantLeads.alertAdmins} onChange={v => set('dormantLeads', { alertAdmins: v })} />
        </Row>
        <Row label="Auto-tag as cold (stored preference)">
          <Toggle checked={cfg.dormantLeads.autoTagAsCold} onChange={v => set('dormantLeads', { autoTagAsCold: v })} />
        </Row>
      </FeatureSection>

      <FeatureSection
        icon={Copy}
        title="Duplicate detection"
        description="Evaluated on create and CSV bulk import. Normalised phone matching matches quick-check behaviour."
        enabled={cfg.duplicateDetection.enabled}
        onToggle={v => set('duplicateDetection', { enabled: v })}
      >
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">Match on</p>
        <div className="flex gap-4 flex-wrap">
          {(['matchPhone', 'matchEmail', 'matchName'] as const).map(field => (
            <label key={field} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={cfg.duplicateDetection[field]}
                onChange={e => set('duplicateDetection', { [field]: e.target.checked })}
                className="rounded" />
              {{ matchPhone: 'Phone', matchEmail: 'Email', matchName: 'Full name' }[field]}
            </label>
          ))}
        </div>
        <Row label="Block submission on duplicate" hint="Return error instead of allowing the create">
          <Toggle checked={cfg.duplicateDetection.blockOnDuplicate} onChange={v => set('duplicateDetection', { blockOnDuplicate: v })} />
        </Row>
      </FeatureSection>

      <FeatureSection
        icon={GraduationCap}
        title="Intake capacity tracking"
        description="Compares active inquiries per programme name to seat counts on the Program catalogue. Shows a Capacity badge near capacity."
        enabled={cfg.intakeCapacity.enabled}
        onToggle={v => set('intakeCapacity', { enabled: v })}
      >
        <Row label="Warn at capacity" hint="Percentage of seats filled">
          <div className="flex items-center gap-1">
            <input type="number" min={50} max={100} value={cfg.intakeCapacity.warnAtPercent} className={inputCls}
              onChange={e => set('intakeCapacity', { warnAtPercent: Number(e.target.value) })} />
            <span className="text-xs text-gray-500">%</span>
          </div>
        </Row>
        <Row label="Lock programme when full" hint="Use with admissions workflow; enforcement may be added per form entry.">
          <Toggle checked={cfg.intakeCapacity.lockOnFull} onChange={v => set('intakeCapacity', { lockOnFull: v })} />
        </Row>
      </FeatureSection>

      <FeatureSection
        icon={FileSpreadsheet}
        title="Scheduled report export"
        description="Stored schedule and recipients for reporting jobs. Connect a worker to read this config from the API if you automate CSV or dashboards."
        enabled={cfg.exportSchedule.enabled}
        onToggle={v => set('exportSchedule', { enabled: v })}
      >
        <Row label="Frequency">
          <select value={cfg.exportSchedule.frequency}
            onChange={e => set('exportSchedule', { frequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Row>
        {cfg.exportSchedule.frequency === 'weekly' && (
          <Row label="Day of week">
            <select value={cfg.exportSchedule.dayOfWeek}
              onChange={e => set('exportSchedule', { dayOfWeek: Number(e.target.value) })}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </Row>
        )}
        <Row label="Recipients" hint="Comma-separated email addresses">
          <input type="text" value={cfg.exportSchedule.recipients} placeholder="admin@school.ac.ke"
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded w-full min-w-[12rem] max-w-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            onChange={e => set('exportSchedule', { recipients: e.target.value })} />
        </Row>
      </FeatureSection>

      <FeatureSection
        icon={Clock}
        title="First-response SLA"
        description="Target hours for first officer response. Stored for dashboards and future alerting."
        enabled={cfg.responseSla.enabled}
        onToggle={v => set('responseSla', { enabled: v })}
      >
        <Row label="Target hours">
          <input type="number" min={1} max={168} value={cfg.responseSla.targetHours} className={inputCls}
            onChange={e => set('responseSla', { targetHours: Number(e.target.value) })} />
        </Row>
      </FeatureSection>

      <FeatureSection
        icon={ClipboardCheck}
        title="Profile hygiene"
        description="How aggressively to surface incomplete profiles in reminders (used together with the inquiry completeness summary)."
        enabled={cfg.profileHygiene.enabled}
        onToggle={v => set('profileHygiene', { enabled: v })}
      >
        <Row label="Nudge interval" hint="Hours between in-app completeness prompts (where wired)">
          <input type="number" min={6} max={168} value={cfg.profileHygiene.nudgeIncompleteHours} className={inputCls}
            onChange={e => set('profileHygiene', { nudgeIncompleteHours: Number(e.target.value) })} />
        </Row>
      </FeatureSection>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 transition bg-primary hover:opacity-95"
        >
          {saving ? 'Saving…' : 'Save smart features'}
        </button>
      </div>
    </div>
  )
}
