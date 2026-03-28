'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import Papa from 'papaparse'
import { ArrowDownTrayIcon, DocumentIcon, TrashIcon, EyeIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'
import { API_BASE_URL, WEB_API } from '@/utils/api';
import { FaWhatsapp } from 'react-icons/fa'
import { HiOutlineMail } from 'react-icons/hi'
import * as Popover from '@radix-ui/react-popover'

// Base URL for direct backend calls when needed
const PDF_API = API_BASE_URL;
const ArrowDownTrayIconAny: any = ArrowDownTrayIcon;
const DocumentIconAny: any = DocumentIcon;
const TrashIconAny: any = TrashIcon;
const EyeIconAny: any = EyeIcon;
const MoreIconAny: any = EllipsisVerticalIcon;
const FaWhatsappAny: any = FaWhatsapp;
const MailIconAny: any = HiOutlineMail;

function userHeaders() {
  if (typeof window === 'undefined') return {} as any;
  const tenant = (() => { try { const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } })() || localStorage.getItem('tenant') || '';
  return (tenant ? { 'x-tenant': tenant } : {}) as Record<string, string>;
}

interface Props {
  inquiries: any[]
  onRefresh: () => void
}

const getCourseDuration = (course: string, type: string) => {
  if (type.toLowerCase() === 'diploma') {
    if (
      course.toLowerCase().includes('information technology') ||
      course.toLowerCase().includes('health records and it')
    ) {
      return '3 Years';
    }
    return '2 Years';
  }
  if (type.toLowerCase() === 'certificate') return '1 Year';
  if (type.toLowerCase() === 'artisan') return '6 Months';
  return '';
};

const statusColors: Record<string, string> = {
  'Not Generated': 'bg-gray-200 text-gray-700',
  'Generated': 'bg-blue-100 text-blue-800',
  'Downloaded': 'bg-green-100 text-green-800',
  'Sent': 'bg-yellow-100 text-yellow-800',
  'Acknowledged': 'bg-green-200 text-green-900',
};

function buildAdmissionLetterShareMessage(inquiry: any, admissionDate: string) {
  const name = inquiry.fullName || inquiry.name || 'Student';
  const prog = inquiry.programOfInterest || 'your programme';
  const refLine = inquiry.letterReferenceNumber ? `\nReference No: ${inquiry.letterReferenceNumber}` : '';
  return (
    `Dear ${name},\n\n` +
    `Congratulations. We are pleased to inform you that your admission letter for ${prog} is ready (PDF attached where supported).\n\n` +
    `Admission date: ${admissionDate}${refLine}\n\n` +
    `Please visit our admissions office or contact us if you need the original hard copy.\n\n` +
    `Best regards,\nAdmissions Office`
  );
}

function inquiryWhatsAppChannel(inquiry: any) {
  const pref = String(inquiry.preferredContactMethod || '').toLowerCase();
  const src = String(inquiry.source || '').toLowerCase();
  return pref === 'whatsapp' || src === 'whatsapp';
}

function hasWhatsAppCapablePhone(phone: string) {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length >= 9;
}

export default function AdmissionLetterList({ inquiries, onRefresh }: Props) {
  const router = useRouter();
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [approvals, setApprovals] = useState<Record<string, boolean>>({})
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ls = String(localStorage.getItem('userRole') || '').toLowerCase()
      if (ls) {
        setUserRole(ls)
      } else {
        try {
          const m = document.cookie.match(/(?:^|; )role=([^;]+)/)
          const c = m ? decodeURIComponent(m[1]) : ''
          setUserRole(String(c || '').toLowerCase())
        } catch {
          setUserRole('')
        }
      }
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const email = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : ''
        if (!email) return
        const res = await fetch(`${WEB_API}/approvals?officerEmail=${encodeURIComponent(email)}`)
        const data = await res.json()
        if (Array.isArray(data?.approvals)) {
          const m: Record<string, boolean> = {}
          for (const a of data.approvals) {
            if (a?.module === 'admission_letters' && a?.status === 'approved') {
              m[String(a.itemId)] = true
            }
          }
          setApprovals(m)
        }
      } catch {}
    }
    load()
  }, [])
  const [loading, setLoading] = useState(false)
  const [admissionDate, setAdmissionDate] = useState('')
  const [editForm, setEditForm] = useState<any>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const isAdmissionsOfficer = userRole === 'admissions_officer'
  const isAdminLike = userRole === 'admin' || userRole === 'senior_staff' || userRole === 'super_admin'

  const [templateId, setTemplateId] = useState<string>('auto')
  const templates = [
    { id: 'auto', label: 'Auto (by program)' },
    { id: 'default', label: 'Standard' },
    { id: 'short', label: 'Short' },
    { id: 'detailed', label: 'Detailed' },
  ]

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const closePreview = () => {
    setPreviewOpen(false)
    setPreviewTitle('')
    setPreviewError(null)
    setPreviewLoading(false)
    if (previewUrl) {
      try { window.URL.revokeObjectURL(previewUrl) } catch {}
    }
    setPreviewUrl(null)
  }

  // Set default admission date to 1 month from now when component mounts
  useEffect(() => {
    const defaultDate = new Date()
    defaultDate.setMonth(defaultDate.getMonth() + 1)
    setAdmissionDate(format(defaultDate, 'dd/MM/yyyy'))
  }, [])

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(inquiries.map(i => i._id || i.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleBulkDownload = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one student.')
      return
    }
    setLoading(true)
    try {
      // Prepare selected inquiries with required fields
      const selected = inquiries.filter(i => selectedIds.includes(i._id || i.id)).map(i => {
        let type = ''
        if (i.programOfInterest?.toLowerCase().includes('diploma')) type = 'diploma'
        else if (i.programOfInterest?.toLowerCase().includes('certificate')) type = 'certificate'
        else if (i.programOfInterest?.toLowerCase().includes('artisan')) type = 'artisan'
        return {
          inquiryId: i._id || i.id,
          name: i.fullName,
          phone: i.phone,
          course: i.programOfInterest,
          duration: getCourseDuration(i.programOfInterest || '', type),
        }
      })
      const res = await fetch(`${WEB_API}/admission-letters/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify({
          inquiries: selected,
          admissionDate,
          staffInitials: 'WL',
          templateId,
        }),
      }).catch((fetchErr) => {
        console.error("Fallback fetch error (bulk-generate):", fetchErr);
        throw fetchErr; // re-throw so the outer catch block sees it
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.details || 'Failed to generate ZIP')
      }
      const blob = await res.blob()
      saveAs(blob, 'admission-letters.zip')
      // Optionally update statuses in UI
      setSelectedIds([])
      onRefresh()
    } catch (err) {
      console.error("Bulk download fetch error:", err);
      alert(`Failed to generate ZIP: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const updateOneLetterStatus = async (id: string, letterStatus: string) => {
    const res = await fetch(`${WEB_API}/inquiries/${encodeURIComponent(id)}/letter-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...userHeaders() },
      body: JSON.stringify({ letterStatus }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      try {
        const data: any = text ? JSON.parse(text) : {}
        throw new Error(data?.message || data?.error || `Failed (${res.status})`)
      } catch {
        throw new Error((text && text.slice(0, 200)) || `Failed (${res.status})`)
      }
    }
  }

  const handleBulkStatusUpdate = async (letterStatus: string) => {
    if (selectedIds.length === 0) {
      alert('Please select at least one student.')
      return
    }
    setLoading(true)
    try {
      await Promise.all(selectedIds.map(id => updateOneLetterStatus(String(id), letterStatus)))
      setSelectedIds([])
      onRefresh()
    } catch (e) {
      alert(`Failed to update status: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateLetter = async (inquiry: any) => {
    setLoading(true);
    try {
      let type = '';
      if (inquiry.programOfInterest?.toLowerCase().includes('diploma')) type = 'diploma';
      else if (inquiry.programOfInterest?.toLowerCase().includes('certificate')) type = 'certificate';
      else if (inquiry.programOfInterest?.toLowerCase().includes('artisan')) type = 'artisan';
      const duration = getCourseDuration(inquiry.programOfInterest || '', type);
      const res = await fetch(`${WEB_API}/admission-letters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify({
          // Prefer numeric SQL id; fall back to legacy _id if needed
          inquiryId: inquiry.id || inquiry._id,
          name: inquiry.fullName,
          phone: inquiry.phone,
          course: inquiry.programOfInterest,
          duration,
          admissionDate,
          templateId,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const message =
          errorData?.details ||
          errorData?.message ||
          errorData?.error ||
          `Failed to generate admission letter (status ${res.status})`;
        throw new Error(message);
      }
      await onRefresh();
      alert('Admission letter generated successfully.');
    } catch (err) {
      console.error('Generate fetch error:', err);
      alert(`Failed to generate admission letter: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLetter = async (inquiry: any) => {
    setLoading(true);
    try {
      let type = '';
      if (inquiry.programOfInterest?.toLowerCase().includes('diploma')) type = 'diploma';
      else if (inquiry.programOfInterest?.toLowerCase().includes('certificate')) type = 'certificate';
      else if (inquiry.programOfInterest?.toLowerCase().includes('artisan')) type = 'artisan';
      const duration = getCourseDuration(inquiry.programOfInterest || '', type);
      const res = await fetch(`${WEB_API}/admission-letters/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify({
          inquiryId: inquiry.id || inquiry._id,
          name: inquiry.fullName,
          phone: inquiry.phone,
          course: inquiry.programOfInterest,
          duration,
          admissionDate,
          staffInitials: 'WL',
          templateId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.details || data?.message || data?.error || `Failed (${res.status})`);
      }
      // Backend now streams binary PDF — no base64 decode needed
      const blob = await res.blob();
      const filename =
        res.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1]
        ?? `admission-letter-${inquiry.fullName.replace(/\s+/g, '-')}.pdf`;
      saveAs(blob, filename);
      fetch(`${WEB_API}/inquiries/${inquiry._id || inquiry.id}/letter-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify({ letterStatus: 'Downloaded' }),
      }).catch(() => {});
      onRefresh();
    } catch (err) {
      console.error('Download fetch error:', err);
      alert(`Failed to generate admission letter: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewLetter = async (inquiry: any) => {
    setPreviewOpen(true)
    setPreviewTitle(`Admission Letter Preview - ${inquiry.fullName || inquiry.name || ''}`)
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      let type = ''
      if (inquiry.programOfInterest?.toLowerCase().includes('diploma')) type = 'diploma'
      else if (inquiry.programOfInterest?.toLowerCase().includes('certificate')) type = 'certificate'
      else if (inquiry.programOfInterest?.toLowerCase().includes('artisan')) type = 'artisan'
      const duration = getCourseDuration(inquiry.programOfInterest || '', type)
      const res = await fetch(`${WEB_API}/admission-letters/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify({
          inquiryId: inquiry.id || inquiry._id,
          name: inquiry.fullName,
          phone: inquiry.phone,
          course: inquiry.programOfInterest,
          duration,
          admissionDate,
          staffInitials: 'WL',
          templateId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.details || data?.message || data?.error || `Failed (${res.status})`)
      }
      // Backend streams binary PDF — create object URL directly from blob
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      if (previewUrl) {
        try { window.URL.revokeObjectURL(previewUrl) } catch {}
      }
      setPreviewUrl(url)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Failed to generate preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleEdit = (inquiry: any) => {
    setEditForm({ ...inquiry });
    setSelectedInquiry(inquiry);
    setShowEditModal(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSave = async () => {
    // TODO: Implement API call to update inquiry
    setShowEditModal(false);
    onRefresh();
  };

  const handleDelete = (inquiry: any) => {
    setSelectedInquiry(inquiry);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    // TODO: Implement API call to delete inquiry
    setShowDeleteConfirm(false);
    onRefresh();
  };

  // Abbreviation logic for course names
  function abbreviateProgram(name: string) {
    const ignore = ['in', 'of', 'and', 'for', 'to', 'the', 'with', 'on', 'at', 'by'];
    return name
      .split(' ')
      .filter(word => word && !ignore.includes(word.toLowerCase()))
      .map(word => word[0].toUpperCase())
      .join('');
  }

  // Truncate helpers for compact display
  function truncateEmail(email?: string) {
    if (!email) return ''
    const [local, domainFull = ''] = email.split('@')
    const domain = domainFull.split('.')[0] || ''
    const localPart = local.slice(0, 6)
    const domainPart = domain.slice(0, 2)
    return `${localPart}${local.length > 6 ? '...' : ''}@${domainPart}${domain.length > 2 ? '...' : ''}`
  }

  function truncatePhone(phone?: string) {
    if (!phone) return ''
    const clean = String(phone)
    return clean.length > 4 ? `${clean.slice(0, 4)}...` : clean
  }

  const handleExport = () => {
    const data = inquiries.map(i => ({
      'Student Name': i.fullName,
      'Course': abbreviateProgram(i.programOfInterest || ''),
      'Phone': i.phone,
      'Letter Reference Number': i.letterReferenceNumber || i.referenceNumber || 'N/A',
      'Serial Number': i.letterSerialNumber || i.serialNumber || 'N/A',
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'admission-letters-export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Admission Date Input */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <label htmlFor="admissionDate" className="block text-[12px] font-semibold text-gray-700 mb-1">
            Admission Date
          </label>
          <input
            type="text"
            id="admissionDate"
            value={admissionDate}
            onChange={(e) => setAdmissionDate(e.target.value)}
            placeholder="DD/MM/YYYY"
            className="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 text-[13px]"
          />
        </div>

        <div className="min-w-[220px]">
          <label className="block text-[12px] font-semibold text-gray-700 mb-1">Template</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 text-[13px]"
            value={templateId}
            onChange={e => setTemplateId(e.target.value)}
          >
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <button
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-600 text-white shadow hover:bg-emerald-700 disabled:opacity-50 text-sm"
          onClick={handleBulkDownload}
          disabled={loading || selectedIds.length === 0}
        >
          <ArrowDownTrayIconAny className="h-4 w-4" />
          <span>{loading ? 'Generating…' : 'Bulk ZIP'}</span>
        </button>
        <button
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-sky-600 text-white shadow hover:bg-sky-700 text-sm"
          onClick={handleExport}
        >
          <ArrowDownTrayIconAny className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
        <button
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-amber-600 text-white shadow hover:bg-amber-700 disabled:opacity-50 text-sm"
          onClick={() => handleBulkStatusUpdate('Sent')}
          disabled={loading || selectedIds.length === 0}
          title="Mark selected as Sent"
        >
          <span>Mark Sent</span>
        </button>
        <button
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-green-700 text-white shadow hover:bg-green-800 disabled:opacity-50 text-sm"
          onClick={() => handleBulkStatusUpdate('Acknowledged')}
          disabled={loading || selectedIds.length === 0}
          title="Mark selected as Acknowledged"
        >
          <span>Mark Acknowledged</span>
        </button>
        <button
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-teal-700 text-white shadow hover:bg-teal-800 text-sm"
          onClick={() => {
            setSelectedIds([])
            onRefresh()
          }}
          title="Refresh list"
        >
          <span>Refresh</span>
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="min-w-full border-separate border-spacing-0 text-[13px]">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="whitespace-nowrap align-middle border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">
                <input
                  type="checkbox"
                  checked={selectedIds.length === inquiries.length && inquiries.length > 0}
                  onChange={handleSelectAll}
                  className="form-checkbox h-4 w-4 text-primary align-middle"
                />
              </th>
              <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm py-2 pl-3 pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 sm:pl-4 lg:pl-6">
                #
              </th>
              <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">
                Student Name
              </th>
              <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 hidden md:table-cell">
                Course
              </th>
              <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 hidden lg:table-cell">
                Email
              </th>
              <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 hidden md:table-cell">
                Phone
              </th>
              <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">
                Status
              </th>
              <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm py-2 pl-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 sm:pr-4 lg:pr-6 w-[220px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {inquiries.map((inquiry, index) => {
              const status = inquiry.letterStatus || 'Not Generated';
              const isChecked = selectedIds.includes(inquiry._id || inquiry.id);
              return (
                <tr key={inquiry._id || inquiry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="whitespace-nowrap align-middle border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleSelectOne(inquiry._id || inquiry.id)}
                      className="form-checkbox h-4 w-4 text-primary align-middle"
                    />
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 py-1.5 pl-3 pr-2 text-[13px] text-gray-700 sm:pl-4 lg:pl-6">
                    {index + 1}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] font-medium text-gray-800">
                    {inquiry.fullName || inquiry.name}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 hidden md:table-cell" title={inquiry.programOfInterest}>
                    {abbreviateProgram(inquiry.programOfInterest || '')}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 hidden lg:table-cell" title={inquiry.email}>
                    {truncateEmail(inquiry.email)}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 hidden md:table-cell" title={inquiry.phone}>
                    {truncatePhone(inquiry.phone)}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[status] || statusColors['Not Generated']}`}>
                      {status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 py-1.5 pl-2 pr-3 text-right text-[13px] font-medium sm:pr-4 lg:pr-6">
                    <div className="inline-flex flex-nowrap items-center justify-end gap-1">
                      {/* Preview */}
                      <button
                        onClick={() => handlePreviewLetter(inquiry)}
                        className="p-1 text-slate-700 hover:text-slate-900"
                        title="Preview"
                      >
                        <EyeIconAny className="h-4 w-4" />
                      </button>
                      {/* Download */}
                      <button
                        onClick={() => handleDownloadLetter(inquiry)}
                        className="p-1 text-emerald-600 hover:text-emerald-800"
                        title="Download Admission Letter"
                      >
                        <ArrowDownTrayIconAny className="h-4 w-4" />
                      </button>

                      {/* More menu */}
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button className="p-1 text-gray-700 hover:text-gray-900" title="More">
                            <MoreIconAny className="h-4 w-4" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content sideOffset={6} align="end" className="z-50 w-72 rounded-md border border-gray-200 bg-white shadow-lg p-2 text-left">
                            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 px-2 py-1">Actions</div>
                            <div className="px-2 py-1">
                              <button className="w-full text-left px-2 py-1.5 text-[12px] border border-gray-200 hover:bg-gray-50" onClick={() => handleGenerateLetter(inquiry)}>
                                Generate / Update ref
                              </button>
                            </div>
                            <div className="px-2 py-1">
                              <button className="w-full text-left px-2 py-1.5 text-[12px] border border-amber-200 text-amber-800 hover:bg-amber-50" onClick={async () => { await updateOneLetterStatus(String(inquiry._id || inquiry.id), 'Sent'); onRefresh(); }}>
                                Mark as Sent
                              </button>
                            </div>
                            <div className="px-2 py-1">
                              <button className="w-full text-left px-2 py-1.5 text-[12px] border border-green-200 text-green-800 hover:bg-green-50" onClick={async () => { await updateOneLetterStatus(String(inquiry._id || inquiry.id), 'Acknowledged'); onRefresh(); }}>
                                Mark as Acknowledged
                              </button>
                            </div>
                            <div className="px-2 py-1">
                              <a
                                href={`https://wa.me/${String(inquiry.phone || '').replace(/\D/g,'').replace(/^0/, '254')}?text=${encodeURIComponent(
                                  buildAdmissionLetterShareMessage(inquiry, admissionDate)
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full inline-flex items-center gap-2 px-2 py-1.5 text-[12px] border border-green-200 text-green-800 hover:bg-green-50"
                              >
                                <FaWhatsappAny className="h-4 w-4" /> Send via WhatsApp
                              </a>
                            </div>
                            <div className="px-2 py-1">
                              <button
                                className="w-full text-left inline-flex items-center gap-2 px-2 py-1.5 text-[12px] border border-green-300 text-green-900 hover:bg-green-50 disabled:opacity-50"
                                onClick={async () => {
                                  if (!navigator.canShare) { alert('PDF sharing is not supported on this browser. Please download and share manually.'); return; }
                                  try {
                                    let type = '';
                                    if (inquiry.programOfInterest?.toLowerCase().includes('diploma')) type = 'diploma';
                                    else if (inquiry.programOfInterest?.toLowerCase().includes('certificate')) type = 'certificate';
                                    else if (inquiry.programOfInterest?.toLowerCase().includes('artisan')) type = 'artisan';
                                    const duration = getCourseDuration(inquiry.programOfInterest || '', type);
                                    const res = await fetch(`${WEB_API}/admission-letters/generate`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', ...userHeaders() },
                                      body: JSON.stringify({ inquiryId: inquiry.id || inquiry._id, name: inquiry.fullName, phone: inquiry.phone, course: inquiry.programOfInterest, duration, admissionDate, staffInitials: 'WL', templateId }),
                                    });
                                    if (!res.ok) { alert('Failed to generate PDF for sharing.'); return; }
                                    // Backend streams binary PDF — read blob directly, no base64 decode
                                    const blob = await res.blob();
                                    const file = new File([blob], `admission-letter-${inquiry.fullName?.replace(/\s+/g,'-')}.pdf`, { type: 'application/pdf' });
                                    const shareText = buildAdmissionLetterShareMessage(inquiry, admissionDate);
                                    if (navigator.canShare({ files: [file] })) {
                                      await navigator.share({
                                        files: [file],
                                        title: 'Admission Letter',
                                        text: shareText,
                                      });
                                      // Web Share API does not reveal which app the user picked; after a successful
                                      // share we open the inquiry inbox when the lead has a dialable number (typical WhatsApp flow).
                                      if (hasWhatsAppCapablePhone(inquiry.phone)) {
                                        const extra = inquiryWhatsAppChannel(inquiry) ? '&fromAdmissionShare=1' : '';
                                        router.push(`/inquiries?openInquiry=${encodeURIComponent(String(inquiry.id || inquiry._id))}${extra}`);
                                      }
                                    } else {
                                      alert('PDF file sharing is not supported on this device. Please use the download option instead.');
                                    }
                                  } catch (e: any) {
                                    if (e?.name !== 'AbortError') alert('Failed to share PDF: ' + (e?.message || 'Unknown error'));
                                  }
                                }}
                              >
                                <FaWhatsappAny className="h-4 w-4" /> Share PDF (Web Share)
                              </button>
                            </div>
                            <div className="px-2 py-1">
                              <a
                                href={`mailto:${inquiry.email}?subject=Your Admission Letter&body=${encodeURIComponent(
                                  `Hello ${inquiry.fullName},\n\nCongratulations! Your admission letter is ready. Your admission date is ${admissionDate}.\n\nPlease contact us for more details.\n\nBest regards,\nAdmissions Office`
                                )}`}
                                className="w-full inline-flex items-center gap-2 px-2 py-1.5 text-[12px] border border-sky-200 text-sky-800 hover:bg-sky-50"
                              >
                                <MailIconAny className="h-4 w-4" /> Send via Email
                              </a>
                            </div>
                            <div className="px-2 py-1">
                              <button
                                onClick={() => {
                                  setSelectedInquiry(inquiry);
                                  setShowDeleteConfirm(true);
                                }}
                                className={`w-full text-left px-2 py-1.5 text-[12px] border ${
                                  (!isAdmissionsOfficer || approvals[String(inquiry.id)] || approvals[String(inquiry._id)])
                                    ? 'border-rose-200 text-rose-800 hover:bg-rose-50'
                                    : 'border-gray-200 text-gray-400'
                                }`}
                              >
                                Delete
                              </button>
                            </div>
                            <Popover.Arrow className="fill-white" />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {inquiries.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No admission letters found.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-gray-200 text-gray-600 rounded-full hover:bg-teal-500 hover:text-white transition-colors"
              onClick={() => setShowEditModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-primary mb-4">Edit Inquiry</h2>
            <div className="space-y-3">
              <input type="text" name="fullName" value={editForm.fullName || selectedInquiry?.fullName || ''} onChange={handleEditChange} placeholder="Full Name" className="w-full px-3 py-2 border rounded" />
              <input type="text" name="programOfInterest" value={editForm.programOfInterest || selectedInquiry?.programOfInterest || ''} onChange={handleEditChange} placeholder="Course" className="w-full px-3 py-2 border rounded" />
              <input type="text" name="email" value={editForm.email || selectedInquiry?.email || ''} onChange={handleEditChange} placeholder="Email" className="w-full px-3 py-2 border rounded" />
              <input type="text" name="phone" value={editForm.phone || selectedInquiry?.phone || ''} onChange={handleEditChange} placeholder="Phone" className="w-full px-3 py-2 border rounded" />
              <input type="text" name="duration" value={editForm.duration || selectedInquiry?.duration || ''} onChange={handleEditChange} placeholder="Duration" className="w-full px-3 py-2 border rounded" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="px-4 py-2 bg-primary text-white rounded" onClick={handleEditSave}>Save</button>
              <button className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded" onClick={() => setShowEditModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation / Permission */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <h2 className="text-lg font-bold mb-2">Delete Admission Letter</h2>
            <p className="text-sm text-gray-700 mb-3">Admins and Senior Staff can delete directly. Admissions Officers must request permission.</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea className="border rounded w-full px-3 py-2 mb-4" rows={3} value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="Provide a short reason" />
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded" onClick={() => { setShowDeleteConfirm(false); setDeleteReason('') }}>Close</button>
              <button
                className={`px-4 py-2 rounded ${(!isAdmissionsOfficer || approvals[String(selectedInquiry?._id || selectedInquiry?.id)]) ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-gray-400 text-white'}`}
                onClick={async () => {
                  const hasApproval = approvals[String(selectedInquiry?._id || selectedInquiry?.id)]
                  if (!isAdmissionsOfficer || hasApproval) {
                    await confirmDelete()
                    return
                  }
                  try {
                    await fetch(`${WEB_API}/delete-requests`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ module: 'admission_letters', itemId: selectedInquiry?._id || selectedInquiry?.id, reason: deleteReason || undefined })
                    })
                    setShowDeleteConfirm(false)
                    setDeleteReason('')
                    alert('Delete permission request sent to Admins/Senior Staff.')
                  } catch (e) {
                    alert('Failed to send request')
                  }
                }}
              >
                {(() => {
                  const hasApproval = approvals[String(selectedInquiry?._id || selectedInquiry?.id)]
                  return (!isAdmissionsOfficer || hasApproval) ? 'Delete' : 'Request Delete Permission'
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white shadow-lg w-[min(1000px,95vw)] h-[min(700px,92vh)] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <div className="font-semibold text-sm">{previewTitle || 'Admission Letter Preview'}</div>
              <button className="px-3 py-1 border border-gray-200 hover:bg-gray-50 text-sm" onClick={closePreview}>
                Close
              </button>
            </div>
            <div className="flex-1 bg-gray-50">
              {previewLoading ? (
                <div className="p-4 text-sm text-gray-600">Generating preview...</div>
              ) : previewError ? (
                <div className="p-4 text-sm text-rose-700">{previewError}</div>
              ) : previewUrl ? (
                <iframe title="Admission Letter Preview" src={previewUrl} className="w-full h-full" />
              ) : (
                <div className="p-4 text-sm text-gray-600">No preview available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 