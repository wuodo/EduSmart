'use client'

import { InquirySource } from '@/types/inquiry'
import { KENYA_COUNTIES } from '@/data/kenyaCounties'

const inquirySources: { value: string; label: string }[] = [
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'referral', label: 'Referral' },
  { value: 'radio', label: 'Radio' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook_ad', label: 'Facebook Ad' },
  { value: 'website', label: 'Website' },
  { value: 'agent', label: 'Agent' },
  { value: 'event', label: 'Event' },
  { value: 'email', label: 'Email' },
  { value: 'google_search', label: 'Google Search' },
  { value: 'tiktok', label: 'Tiktok' },
  { value: 'linkedin', label: 'Linkedin' },
  { value: 'youtube', label: 'Youtube' },
  { value: 'other', label: 'Other' },
]

const grades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E']
const intakePeriods = ['January', 'March', 'May', 'July', 'September', 'November']
const genders = ['male', 'female', 'other']

export default function InquiryFilters({
  status,
  setStatus,
  source,
  setSource,
  search,
  setSearch,
  county,
  setCounty,
  program,
  setProgram,
  programOptions,
  kcseGrade,
  setKcseGrade,
  intake,
  setIntake,
  gender,
  setGender,
  paymentStatus,
  setPaymentStatus,
  isAdmin,
  owner,
  setOwner,
  owners,
  onClear,
}: {
  status?: string;
  setStatus?: (s: string) => void;
  source: string;
  setSource: (s: string) => void;
  search: string;
  setSearch: (s: string) => void;
  county: string;
  setCounty: (s: string) => void;
  program: string;
  setProgram: (s: string) => void;
  programOptions?: string[];
  kcseGrade: string;
  setKcseGrade: (s: string) => void;
  intake: string;
  setIntake: (s: string) => void;
  gender: string;
  setGender: (s: string) => void;
  paymentStatus: string;
  setPaymentStatus: (s: string) => void;
  isAdmin?: boolean;
  owner?: string;
  setOwner?: (s: string) => void;
  owners?: { label: string; value: string }[];
  onClear: () => void;
}) {
  const inputClass =
    'w-full min-w-0 px-2 py-1.5 text-[13px] border border-neutral-light rounded-md bg-white/90 ' +
    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40'
  const selectClass = inputClass
  const buttonClass = 'px-3 py-1.5 rounded-md bg-teal-600 text-white hover:bg-teal-700 text-[13px] font-semibold'

  const controlClass = `${selectClass} flex-1 min-w-[110px]`

  return (
    <div className="w-full">
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
        <input
          type="text"
          placeholder="Search inquiries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} flex-[1.6] min-w-[170px]`}
        />
        {setStatus && (
          <select
            value={status || ''}
            onChange={(e) => setStatus(e.target.value)}
            className={controlClass}
          >
            <option value="">All Status</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
        )}
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className={controlClass}
        >
          <option value="">All Sources</option>
          {inquirySources.map(src => (
            <option key={src.value} value={src.value}>{src.label}</option>
          ))}
        </select>
        {isAdmin && owners && setOwner && (
          <select
            value={owner || ''}
            onChange={(e) => setOwner(e.target.value)}
            className={controlClass}
            title="Owner"
          >
            <option value="">All Owners</option>
            {owners.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        <select
          value={county}
          onChange={(e) => setCounty(e.target.value)}
          className={controlClass}
        >
          <option value="">All Counties</option>
          {Object.keys(KENYA_COUNTIES).map(c => (
            <option key={c} value={c}>{c.replace('_',' ')}</option>
          ))}
        </select>
        <select value={program} onChange={(e) => setProgram(e.target.value)} className={controlClass}>
          <option value="">All Programs</option>
          {(programOptions || []).map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={kcseGrade}
          onChange={(e) => setKcseGrade(e.target.value)}
          className={controlClass}
        >
          <option value="">All KCSE Grades</option>
          {grades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select
          value={intake}
          onChange={(e) => setIntake(e.target.value)}
          className={controlClass}
        >
          <option value="">All Intakes</option>
          {intakePeriods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className={controlClass}
        >
          <option value="">All Genders</option>
          {genders.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className={controlClass}
        >
          <option value="">All Payments</option>
          <option value="Paid">Paid</option>
          <option value="Not Paid">Not Paid</option>
        </select>
        <button type="button" onClick={onClear} className={`${buttonClass} shrink-0 whitespace-nowrap`}>
          Clear
        </button>
      </div>
    </div>
  )
} 