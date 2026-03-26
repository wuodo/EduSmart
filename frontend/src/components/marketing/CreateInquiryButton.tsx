'use client'

import { useState, useEffect, useRef } from 'react'
import { WEB_API } from '@/utils/api'
import {
  InquiryFormData,
  InquiryStatus,
  InquirySource,
  Gender,
  StudyMode,
  IntakePeriod,
  ContactMethod,
  LeadTag,
} from '@/types/inquiry'
import { KENYA_COUNTIES } from '@/data/kenyaCounties'

const kenyaCounties = KENYA_COUNTIES

const programGroups = [
  {
    label: 'Diploma Courses',
    options: [
      'Diploma in Perioperative Theatre Technology',
      'Diploma in Community Health and Development',
      'Diploma in HIV/AIDS Management',
      'Diploma in Mortuary Science',
      'Diploma in Optometry Technology',
      'Diploma in Orthopedics and Trauma Medicine',
      'Diploma in Assistant Community Health Officer',
      'Diploma in Biotechnology',
      'Diploma in Medical Engineering',
      'Diploma in Science Laboratory Technology',
      'Diploma in Counselling Psychology',
      'Diploma in Health Records & Information Technology',
      'Diploma in Human Nutrition and Dietetics',
      'Diploma in Social Work and Community Development',
      'Diploma in Information Technology',
      'Diploma in Dental Technology',
      'Diploma in Herbal Medicine',
    ],
  },
  {
    label: 'Certificate Courses',
    options: [
      'Certificate in Perioperative Theatre Technology',
      'Certificate in Community Health and Development',
      'Certificate in HIV/AIDS Management',
      'Certificate in Mortuary Science',
      'Certificate in Orthopedics and Trauma Medicine',
      'Certificate in Health Service Support',
      'Certificate in Applied Biology',
      'Certificate in Medical Engineering',
      'Certificate in Science Laboratory Technology',
      'Certificate in Counselling Psychology',
      'Certificate in Health Records & Information Technology',
      'Certificate in Human Nutrition and Dietetics',
      'Certificate in Social Work and Community Development',
      'Certificate in Information Technology',
    ],
  },
  {
    label: 'Artisan Courses',
    options: [
      'Artisan in Community Health and Development',
      'Artisan in Health Service Support',
    ],
  },
]

const intakePeriods: IntakePeriod[] = ['January', 'March', 'May', 'July', 'September', 'November']
const studyModes: StudyMode[] = ['full-time', 'part-time', 'online']
const genders: Gender[] = ['male', 'female', 'other']
const contactMethods: ContactMethod[] = ['phone', 'sms', 'email', 'whatsapp']
const leadTags: LeadTag[] = ['hot', 'warm', 'cold', 'scholarship-seeker', 'graduate']
const inquirySources: { value: InquirySource; label: string }[] = [
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
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'Youtube' },
  { value: 'other', label: 'Other' },
]

const kcseGrades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'];

const initialForm: InquiryFormData = {
  fullName: '',
  phone: '',
  email: '',
  gender: '',
    programOfInterest: '',
  intakePeriod: 'January',
  studyMode: 'full-time',
  source: 'walk-in',
  agentOrReferralName: '',
  preferredContactMethod: 'phone',
  bestTimeToContact: '',
  leadTags: [],
    notes: '',
  status: 'hot',
    assignedTo: '',
  documents: [],
  kcseGrade: '',
  county: '',
  town: '',
  idOrPassport: '',
}

function validate(form: InquiryFormData) {
  const errors: Record<string, string> = {}
  if (!form.fullName.trim()) errors.fullName = 'Full Name is required.'
  if (!form.phone.trim()) errors.phone = 'Phone Number is required.'
  else if (!/^\+?\d{7,15}$/.test(form.phone.trim())) errors.phone = 'Invalid phone number.'
  if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Invalid email address.'
  if (!form.programOfInterest) errors.programOfInterest = 'Program of Interest is required.'
  if (!form.intakePeriod) errors.intakePeriod = 'Intake Period is required.'
  if (!form.studyMode) errors.studyMode = 'Study Mode is required.'
  if (!form.source) errors.source = 'Source of Inquiry is required.'
  if (!form.preferredContactMethod) errors.preferredContactMethod = 'Preferred Contact Method is required.'
  if (!form.kcseGrade) errors.kcseGrade = 'KCSE Grade is required.'
  if (!form.county) errors.county = 'County is required.'
  if (!form.town) errors.town = 'Town is required.'
  return errors
}

const DRAFT_KEY = 'inquiry_form_draft'

interface DuplicateInfo {
  fullName: string
  programOfInterest?: string | null
  createdAt: string
  createdBy?: string | null
}

export default function CreateInquiryButton({
  addInquiry,
  initialData,
  onSubmit,
  isEdit = false,
  loading = false,
  onClose,
}: {
  addInquiry?: (data: InquiryFormData) => void;
  initialData?: InquiryFormData;
  onSubmit?: (data: InquiryFormData) => Promise<void>;
  isEdit?: boolean;
  loading?: boolean;
  onClose?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState<InquiryFormData>(initialData || initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateInfo | null>(null)
  const phoneCheckRef = useRef<string>('')

  const checkPhoneDuplicate = async (phone: string) => {
    const trimmed = phone.trim()
    if (!trimmed || isEdit) return
    if (phoneCheckRef.current === trimmed) return
    phoneCheckRef.current = trimmed
    try {
      const headers: Record<string, string> = {}
      if (typeof window !== 'undefined') {
        const t = localStorage.getItem('tenant') || ''
        if (t) headers['x-tenant'] = t
      }
      const res = await fetch(`${WEB_API}/inquiries/check-phone?phone=${encodeURIComponent(trimmed)}`, {
        credentials: 'include',
        headers,
      })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (data?.exists && data?.inquiry) {
        setDuplicateWarning(data.inquiry)
      } else {
        setDuplicateWarning(null)
      }
    } catch {
      // non-blocking
    }
  }

  // Auto-save draft (only for create mode)
  useEffect(() => {
    if (!isEdit && isOpen) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
    }
  }, [formData, isOpen, isEdit])

  // Load draft on open (only for create mode)
  useEffect(() => {
    if (isEdit) {
      setFormData(initialData || initialForm)
      setErrors({})
    } else if (isOpen) {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) setFormData(JSON.parse(draft))
    } else {
      setFormData(initialForm)
      setErrors({})
    }
  }, [isOpen, isEdit, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (duplicateWarning) return
    const v = validate(formData)
    setErrors(v)
    if (Object.keys(v).length === 0) {
      const payload = {
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        gender: formData.gender,
        programOfInterest: formData.programOfInterest,
        intakePeriod: formData.intakePeriod,
        studyMode: formData.studyMode,
        source: formData.source,
        agentOrReferralName: formData.agentOrReferralName,
        preferredContactMethod: formData.preferredContactMethod,
        bestTimeToContact: formData.bestTimeToContact,
        leadTags: formData.leadTags,
        notes: formData.notes,
        status: formData.status,
        assignedTo: formData.assignedTo,
        kcseGrade: formData.kcseGrade,
        detail: {
          county: formData.county,
          town: formData.town,
          idOrPassport: formData.idOrPassport || undefined,
        },
      }
      if (isEdit && onSubmit) {
        await onSubmit(formData)
        if (onClose) onClose()
      } else if (addInquiry) {
        // Delegate to parent for POST
        await addInquiry({ ...formData, documents: [] })
        localStorage.removeItem(DRAFT_KEY)
        setIsOpen(false)
      }
    }
  }

  const handleClear = () => {
    setFormData(initialForm)
    setErrors({})
    if (!isEdit) localStorage.removeItem(DRAFT_KEY)
  }

  // All programs flattened for dropdown
  const allPrograms = programGroups.flatMap(group => group.options);

  // County/town derived options
  const townOptions = formData.county && kenyaCounties[formData.county as keyof typeof kenyaCounties] ? kenyaCounties[formData.county as keyof typeof kenyaCounties] : []

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-emerald-200 text-emerald-950 text-[13px] font-bold rounded-md hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300"
      >
        Create Inquiry
      </button>

      {(isEdit ? true : isOpen) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
          <div className="bg-white p-3 w-full max-w-2xl overflow-y-auto max-h-[95vh] shadow-xl border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-base font-semibold text-gray-800">Create New Inquiry</h3>
              <button
                onClick={() => (onClose ? onClose() : setIsOpen(false))}
                className="text-gray-400 hover:text-teal-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-2">
              {/* Personal Information */}
              <div className="bg-gray-50/60 p-2 border border-gray-200">
                <h4 className="font-semibold text-[#00a396] text-xs uppercase tracking-wide mb-2">Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Full Name *</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                    {errors.fullName && <p className="text-rose-500 text-xs mt-0.5">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Phone Number *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => { setFormData({ ...formData, phone: e.target.value }); setDuplicateWarning(null); phoneCheckRef.current = '' }}
                      onBlur={e => checkPhoneDuplicate(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                    {errors.phone && <p className="text-rose-500 text-xs mt-0.5">{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                    {errors.email && <p className="text-rose-500 text-xs mt-0.5">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value as Gender })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="">Select</option>
                      {genders.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">ID/Passport Number</label>
                    <input
                      type="text"
                      value={formData.idOrPassport || ''}
                      onChange={e => setFormData({ ...formData, idOrPassport: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">County *</label>
                    <select
                      value={formData.county}
                      onChange={e => setFormData({ ...formData, county: e.target.value, town: '' })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      required
                    >
                      <option value="">Select county</option>
                      {Object.keys(kenyaCounties).map(c => (
                        <option key={c} value={c}>{c.replace('_',' ')}</option>
                      ))}
                    </select>
                    {errors.county && <p className="text-rose-500 text-xs mt-0.5">{errors.county}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Town *</label>
                    <select
                      value={formData.town}
                      onChange={e => setFormData({ ...formData, town: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      required
                      disabled={!formData.county}
                    >
                      <option value="">{formData.county ? 'Select town' : 'Select county first'}</option>
                      {townOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {errors.town && <p className="text-rose-500 text-xs mt-0.5">{errors.town}</p>}
                  </div>
                </div>
              </div>

              {/* Program Interest */}
              <div className="bg-gray-50/60 p-2 border border-gray-200">
                <h4 className="font-semibold text-[#00a396] text-xs uppercase tracking-wide mb-2">Program Interest</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Program of Interest *</label>
                    <select
                      value={formData.programOfInterest}
                      onChange={e => setFormData({ ...formData, programOfInterest: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      required
                    >
                      <option value="">Select a program</option>
                      {programGroups.map(group => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {errors.programOfInterest && <p className="text-rose-500 text-xs mt-0.5">{errors.programOfInterest}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">KCSE Grade *</label>
                    <select
                      value={formData.kcseGrade}
                      onChange={e => setFormData({ ...formData, kcseGrade: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      required
                    >
                      <option value="">Select grade</option>
                      {kcseGrades.map(grade => (
                        <option key={grade} value={grade}>{grade}</option>
                      ))}
                    </select>
                    {errors.kcseGrade && <p className="text-rose-500 text-xs mt-0.5">{errors.kcseGrade}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Intake Period *</label>
                    <select
                      value={formData.intakePeriod}
                      onChange={e => setFormData({ ...formData, intakePeriod: e.target.value as IntakePeriod })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      required
                    >
                      {intakePeriods.map(ip => <option key={ip} value={ip}>{ip.charAt(0).toUpperCase() + ip.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Study Mode *</label>
                    <select
                      value={formData.studyMode}
                      onChange={e => setFormData({ ...formData, studyMode: e.target.value as StudyMode })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      required
                    >
                      {studyModes.map(sm => <option key={sm} value={sm}>{sm.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Lead Source Information */}
              <div className="bg-gray-50/60 p-2 border border-gray-200">
                <h4 className="font-semibold text-[#00a396] text-xs uppercase tracking-wide mb-2">Lead Source Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Source of Inquiry *</label>
                    <select
                      value={formData.source}
                      onChange={e => setFormData({ ...formData, source: e.target.value as InquirySource })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      required
                    >
                      {inquirySources.map(src => <option key={src.value} value={src.value}>{src.label}</option>)}
                    </select>
                    {errors.source && <p className="text-rose-500 text-xs mt-0.5">{errors.source}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Agent/Referral Name</label>
                    <input
                      type="text"
                      value={formData.agentOrReferralName}
                      onChange={e => setFormData({ ...formData, agentOrReferralName: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Follow-Up Preference */}
              <div className="bg-gray-50/60 p-2 border border-gray-200">
                <h4 className="font-semibold text-[#00a396] text-xs uppercase tracking-wide mb-2">Follow-Up Preference</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Preferred Contact Method *</label>
                    <select
                      value={formData.preferredContactMethod}
                      onChange={e => setFormData({ ...formData, preferredContactMethod: e.target.value as ContactMethod })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      required
                    >
                      {contactMethods.map(cm => <option key={cm} value={cm}>{cm.charAt(0).toUpperCase() + cm.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Best Time to Contact</label>
                    <input
                      type="text"
                      placeholder="e.g. Morning, Afternoon, 2-4pm"
                      value={formData.bestTimeToContact}
                      onChange={e => setFormData({ ...formData, bestTimeToContact: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Lead Tag Multi-select */}
              <div className="bg-gray-50/60 p-2 border border-gray-200">
                <h4 className="font-semibold text-[#00a396] text-xs uppercase tracking-wide mb-1">Lead Tag(s)</h4>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {leadTags.map(tag => (
                    <label key={tag} className="flex items-center gap-1 text-xs font-medium bg-white px-2 py-1 border border-gray-300 hover:border-teal-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.leadTags.includes(tag)}
                        onChange={e => {
                          if (e.target.checked) {
                            setFormData({ ...formData, leadTags: [...formData.leadTags, tag] })
                          } else {
                            setFormData({ ...formData, leadTags: formData.leadTags.filter(t => t !== tag) })
                          }
                        }}
                        className="w-3 h-3 text-teal-600 focus:ring-teal-500 border-gray-300"
                      />
                      <span>{tag.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-gray-50/60 p-2 border border-gray-200">
                <h4 className="font-semibold text-[#00a396] text-xs uppercase tracking-wide mb-1">Initial Comments/Notes</h4>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  rows={2}
                />
              </div>

              {/* Duplicate Phone Warning */}
              {duplicateWarning && (
                <div className="border border-amber-300 bg-amber-50 rounded p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-amber-800 mb-1">⚠️ Duplicate Phone Number Detected</p>
                      <p className="text-amber-700">This phone number already exists in the system:</p>
                      <ul className="mt-1 ml-3 text-amber-800 space-y-0.5 text-xs">
                        <li><span className="font-semibold">Name:</span> {duplicateWarning.fullName}</li>
                        <li><span className="font-semibold">Course:</span> {duplicateWarning.programOfInterest || 'N/A'}</li>
                        <li><span className="font-semibold">Added by:</span> {duplicateWarning.createdBy || 'Unknown'}</li>
                        <li><span className="font-semibold">Added on:</span> {new Date(duplicateWarning.createdAt).toLocaleDateString()}</li>
                      </ul>
                      <p className="mt-1.5 text-xs text-amber-700">This inquiry will not be saved. Please verify the phone number.</p>
                    </div>
                    <button type="button" onClick={() => setDuplicateWarning(null)} className="text-amber-500 hover:text-amber-700 text-lg leading-none mt-0.5">×</button>
                  </div>
                </div>
              )}

              {/* Submit & Clear Buttons */}
              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 hover:border-teal-500 hover:text-teal-700 transition-colors"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-sm bg-teal-600 text-white hover:bg-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
} 