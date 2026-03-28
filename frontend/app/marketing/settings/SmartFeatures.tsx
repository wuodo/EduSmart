'use client'
import { useEffect, useState } from 'react'

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
}

const DEFAULTS: SmartConfig = {
  leadScoring: {
    enabled: true,
    weights: { hasEmail: 10, hasPhone: 10, hasKcseGrade: 15, followedUp: 20, highIntakeUrgency: 25, repeatContact: 20 }
  },
  autoReminders: {
    enabled: true, firstReminderDays: 2, repeatIntervalDays: 5, maxReminders: 4,
    channels: { email: true, sms: false, whatsapp: false }
  },
  dormantLeads: { enabled: true, thresholdDays: 14, alertAdmins: true, autoTagAsCold: true },
  duplicateDetection: { enabled: true, matchPhone: true, matchEmail: true, matchName: false, blockOnDuplicate: false },
  intakeCapacity: { enabled: false, warnAtPercent: 80, lockOnFull: false },
  exportSchedule: { enabled: false, frequency: 'weekly', dayOfWeek: 1, recipients: '' }
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

function FeatureSection({ title, icon, description, enabled, onToggle, children }: {
  title: string; icon: string; description: string; enabled: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode
}) {
  return (
    <div className={`border rounded-lg overflow-hidden mb-4 transition-all ${enabled ? 'border-teal-200 bg-teal-50/30' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-2xl mt-0.5 flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            </div>
            <Toggle checked={enabled} onChange={onToggle} />
          </div>
        </div>
      </div>
      {enabled && children && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-white/60">
          {children}
        </div>
      )}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

const inputCls = 'px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 w-20 text-right'

export default function SmartFeatures() {
  const [cfg, setCfg] = useState<SmartConfig>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/marketing/settings/smart')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.smartConfig) setCfg({ ...DEFAULTS, ...d.smartConfig }) })
      .catch(() => {
        try {
          const ls = localStorage.getItem('smartFeaturesConfig')
          if (ls) setCfg({ ...DEFAULTS, ...JSON.parse(ls) })
        } catch {}
      })
  }, [])

  const set = <K extends keyof SmartConfig>(section: K, patch: Partial<SmartConfig[K]>) =>
    setCfg(prev => ({ ...prev, [section]: { ...prev[section], ...patch } }))

  const setNested = <K extends keyof SmartConfig, NK extends keyof SmartConfig[K]>(
    section: K, subsection: NK, patch: Partial<SmartConfig[K][NK]>
  ) => setCfg(prev => ({
    ...prev,
    [section]: { ...prev[section], [subsection]: { ...(prev[section][subsection] as object), ...(patch as object) } }
  }))

  const save = async () => {
    setSaving(true); setError('')
    try {
      localStorage.setItem('smartFeaturesConfig', JSON.stringify(cfg))
      const res = await fetch('/api/marketing/settings/smart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smartConfig: cfg })
      })
      if (!res.ok) throw new Error('Backend save failed — settings kept locally')
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      localStorage.setItem('smartFeaturesConfig', JSON.stringify(cfg))
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      setError(e instanceof Error ? e.message : 'Saved locally only')
    } finally { setSaving(false) }
  }

  const w = cfg.leadScoring.weights
  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0)

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-1">Other Smart Features</h2>
      <p className="text-sm text-gray-500 mb-5">Configure AI-assisted lead scoring, automatic reminders, duplicate detection, and more.</p>

      {/* Lead Scoring */}
      <FeatureSection
        icon="🎯" title="Lead Scoring"
        description="Auto-score every inquiry based on profile completeness and engagement. Scores appear in the inquiry list."
        enabled={cfg.leadScoring.enabled}
        onToggle={v => set('leadScoring', { enabled: v })}
      >
        <p className="text-[11px] text-gray-400 mb-2">Score weights (total = {totalWeight} pts max)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          {(Object.entries(w) as [keyof typeof w, number][]).map(([key, val]) => (
            <Row key={key} label={{
              hasEmail: 'Has Email', hasPhone: 'Has Phone', hasKcseGrade: 'Has KCSE Grade',
              followedUp: 'Followed Up', highIntakeUrgency: 'High Intake Urgency', repeatContact: 'Repeat Contact'
            }[key]}>
              <input type="number" min={0} max={100} value={val} className={inputCls}
                onChange={e => set('leadScoring', { weights: { ...w, [key]: Number(e.target.value) } })} />
            </Row>
          ))}
        </div>
      </FeatureSection>

      {/* Auto Reminders */}
      <FeatureSection
        icon="🔔" title="Auto Follow-Up Reminders"
        description="Automatically nudge officers to follow up on inquiries that haven't been contacted recently."
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
          <p className="text-[11px] font-medium text-gray-600 mb-1">Channels</p>
          <div className="flex gap-4">
            {(['email', 'sms', 'whatsapp'] as const).map(ch => (
              <label key={ch} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                <input type="checkbox" checked={cfg.autoReminders.channels[ch]}
                  onChange={e => setNested('autoReminders', 'channels', { [ch]: e.target.checked })}
                  className="rounded" />
                {ch.charAt(0).toUpperCase() + ch.slice(1)}
              </label>
            ))}
          </div>
        </div>
      </FeatureSection>

      {/* Dormant Leads */}
      <FeatureSection
        icon="😴" title="Dormant Lead Detection"
        description="Flag inquiries with no activity for an extended period so nothing slips through the cracks."
        enabled={cfg.dormantLeads.enabled}
        onToggle={v => set('dormantLeads', { enabled: v })}
      >
        <Row label="Mark as dormant after" hint="Days with no follow-up or update">
          <div className="flex items-center gap-1">
            <input type="number" min={3} max={90} value={cfg.dormantLeads.thresholdDays} className={inputCls}
              onChange={e => set('dormantLeads', { thresholdDays: Number(e.target.value) })} />
            <span className="text-xs text-gray-500">days</span>
          </div>
        </Row>
        <Row label="Alert admins & senior staff">
          <Toggle checked={cfg.dormantLeads.alertAdmins} onChange={v => set('dormantLeads', { alertAdmins: v })} />
        </Row>
        <Row label="Auto-tag lead as Cold">
          <Toggle checked={cfg.dormantLeads.autoTagAsCold} onChange={v => set('dormantLeads', { autoTagAsCold: v })} />
        </Row>
      </FeatureSection>

      {/* Duplicate Detection */}
      <FeatureSection
        icon="🔍" title="Duplicate Detection"
        description="Detect and warn about duplicate inquiries before they are saved, reducing data redundancy."
        enabled={cfg.duplicateDetection.enabled}
        onToggle={v => set('duplicateDetection', { enabled: v })}
      >
        <p className="text-[11px] text-gray-400 mb-1">Match on:</p>
        <div className="flex gap-4 flex-wrap">
          {(['matchPhone', 'matchEmail', 'matchName'] as const).map(field => (
            <label key={field} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={cfg.duplicateDetection[field]}
                onChange={e => set('duplicateDetection', { [field]: e.target.checked })}
                className="rounded" />
              {{ matchPhone: 'Phone', matchEmail: 'Email', matchName: 'Full Name' }[field]}
            </label>
          ))}
        </div>
        <Row label="Block submission on duplicate" hint="Show error instead of warning">
          <Toggle checked={cfg.duplicateDetection.blockOnDuplicate} onChange={v => set('duplicateDetection', { blockOnDuplicate: v })} />
        </Row>
      </FeatureSection>

      {/* Intake Capacity */}
      <FeatureSection
        icon="🎓" title="Intake Capacity Tracking"
        description="Track enrolment against programme seat limits. Warn officers when a programme is nearing capacity."
        enabled={cfg.intakeCapacity.enabled}
        onToggle={v => set('intakeCapacity', { enabled: v })}
      >
        <Row label="Warn at capacity %" hint="Show warning banner when seats fill to this %">
          <div className="flex items-center gap-1">
            <input type="number" min={50} max={100} value={cfg.intakeCapacity.warnAtPercent} className={inputCls}
              onChange={e => set('intakeCapacity', { warnAtPercent: Number(e.target.value) })} />
            <span className="text-xs text-gray-500">%</span>
          </div>
        </Row>
        <Row label="Lock programme when full" hint="Prevent new inquiries for that programme">
          <Toggle checked={cfg.intakeCapacity.lockOnFull} onChange={v => set('intakeCapacity', { lockOnFull: v })} />
        </Row>
      </FeatureSection>

      {/* Export Schedule */}
      <FeatureSection
        icon="📊" title="Scheduled Report Export"
        description="Automatically generate and email inquiry & follow-up summary reports on a regular schedule."
        enabled={cfg.exportSchedule.enabled}
        onToggle={v => set('exportSchedule', { enabled: v })}
      >
        <Row label="Frequency">
          <select value={cfg.exportSchedule.frequency}
            onChange={e => set('exportSchedule', { frequency: e.target.value as any })}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Row>
        {cfg.exportSchedule.frequency === 'weekly' && (
          <Row label="Day of week">
            <select value={cfg.exportSchedule.dayOfWeek}
              onChange={e => set('exportSchedule', { dayOfWeek: Number(e.target.value) })}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </Row>
        )}
        <Row label="Recipients" hint="Comma-separated email addresses">
          <input type="text" value={cfg.exportSchedule.recipients} placeholder="admin@school.ac.ke"
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 w-52"
            onChange={e => set('exportSchedule', { recipients: e.target.value })} />
        </Row>
      </FeatureSection>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 text-sm font-semibold rounded text-white disabled:opacity-50 transition"
          style={{ backgroundColor: 'var(--brand-primary, #0d9488)' }}
        >
          {saving ? 'Saving…' : 'Save Smart Features'}
        </button>
        {saved && <span className="text-green-600 text-sm">✓ Saved</span>}
        {error && <span className="text-amber-600 text-xs">{error}</span>}
      </div>
    </div>
  )
}