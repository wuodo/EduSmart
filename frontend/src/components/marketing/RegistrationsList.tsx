import React, { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EyeIcon, TrashIcon, DocumentArrowDownIcon, BellIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { ArrowUpRightIcon } from '@heroicons/react/24/outline'; // For WhatsApp/share
import { FaWhatsapp } from 'react-icons/fa';
import { WEB_API } from '../../utils/api';
import {
  modalOverlayClass,
  modalPanelClass,
  modalHeaderClass,
  modalTitleClass,
  modalCloseButtonClass,
  textareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/styles/modalForm'

const EyeIconAny: any = EyeIcon;
const TrashIconAny: any = TrashIcon;
const DocumentArrowDownIconAny: any = DocumentArrowDownIcon;
const BellIconAny: any = BellIcon;
const ClipboardDocumentCheckIconAny: any = ClipboardDocumentCheckIcon;
const FaWhatsappAny: any = FaWhatsapp;

function userHeaders() {
  if (typeof window === 'undefined') return {} as any;
  const tenant = (() => { try { const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } })() || localStorage.getItem('tenant') || '';
  return (tenant ? { 'x-tenant': tenant } : {}) as Record<string, string>;
}

// TypeScript declaration for jsPDF autoTable
// (kept for compatibility, but we now call autoTable(doc, ...) directly)
// declare module 'jspdf' {
//   interface jsPDF {
//     autoTable: (options: any) => jsPDF;
//   }
// }

interface Registration {
  id: string;
  fullName: string;
  phone: string;
  programOfInterest: string;
  intake?: string;
  paymentCode?: string;
  paymentDate?: string;
}

interface Inquiry {
  id: string;
  intakePeriod: string;
  // ...other fields
}

interface RegistrationsListProps {
  registrations: Registration[];
  inquiries: Inquiry[];
  ownerLabel?: string;
  // Optional owner filter props (to show filter between summary and table)
  showOwnerFilter?: boolean;
  owners?: { label: string; value: string }[];
  ownerValue?: string;
  onOwnerChange?: (val: string) => void;
}

export default function RegistrationsList({ registrations, inquiries, ownerLabel, showOwnerFilter, owners = [], ownerValue = '', onOwnerChange }: RegistrationsListProps) {
  const [userRole, setUserRole] = useState<string>('');
  const [viewReg, setViewReg] = useState<Registration | null>(null);
  const [reminderStatus, setReminderStatus] = useState<Record<string, { lastSent: string | null, status: string, lastResponse?: string | null, sentiment?: string | null }>>({});
  const [logModal, setLogModal] = useState<{ open: boolean, reg: Registration | null }>({ open: false, reg: null });
  const [responseText, setResponseText] = useState('');
  const [logging, setLogging] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<{ status: string; sentiment: string }>({ status: '', sentiment: '' });
  const [showAllColumns, setShowAllColumns] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const m = document.cookie.match(/(?:^|; )role=([^;]+)/);
        const c = m ? decodeURIComponent(m[1]) : '';
        setUserRole(String(c || localStorage.getItem('userRole') || '').toLowerCase());
      } catch {
        setUserRole(String(localStorage.getItem('userRole') || '').toLowerCase());
      }
    }
  }, []);

  const isAdmissionsOfficer = userRole === 'admissions_officer';

  const QUICK_RESPONSES: { id: string; label: string; text: string }[] = [
    { id: 'confirmed', label: 'Confirmed', text: 'Yes confirmed. I will report.' },
    { id: 'postponed', label: 'Postponed', text: 'I will postpone for now. I will update you with a new date.' },
    { id: 'not_coming', label: 'Not coming', text: 'No, I will not be coming / joining.' },
    { id: 'needs_info', label: 'Needs info', text: 'I need more information (fees, requirements, timetable) before I confirm.' },
  ];

  // Fetch reminder status from backend
  useEffect(() => {
    async function fetchReminders() {
      const statusObj: Record<string, { lastSent: string | null, status: string, lastResponse?: string | null, sentiment?: string | null }> = {};
      for (const r of registrations) {
        try {
          const res = await fetch(`${WEB_API}/inquiries/${r.id}/reminder`, { headers: { ...userHeaders() } });
          if (res.ok) {
            const data = await res.json();
            statusObj[r.id] = {
              lastSent: data.lastReminderSent || null,
              status: data.reminderStatus || 'Pending',
              lastResponse: data.lastReminderResponse || null,
              sentiment: data.engagementSentiment || null,
            };
          } else {
            statusObj[r.id] = { lastSent: null, status: 'Pending' };
          }
        } catch {
          statusObj[r.id] = { lastSent: null, status: 'Pending' };
        }
      }
      setReminderStatus(statusObj);
    }
    fetchReminders();
  }, [registrations]);

  // Summary calculations
  const total = registrations.length;
  const filteredRegistrations = registrations.filter(r => {
    const reminder = reminderStatus[r.id] || { lastSent: null, status: 'Pending', lastResponse: null, sentiment: null };
    const matchesStatus = !filters.status || String(reminder.status || '').toLowerCase() === filters.status.toLowerCase();
    const matchesSentiment = !filters.sentiment || String(reminder.sentiment || '').toLowerCase() === filters.sentiment.toLowerCase();
    return matchesStatus && matchesSentiment;
  });

  const allSelected = selectedIds.length > 0 && selectedIds.length === filteredRegistrations.length;
  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(filteredRegistrations.map(r => r.id));
    else setSelectedIds([]);
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const updateReminderFor = async (id: string, patch: { lastReminderSent?: string; reminderStatus?: string }) => {
    await fetch(`${WEB_API}/inquiries/${id}/reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeaders() },
      body: JSON.stringify(patch),
    });
  };

  const bulkMarkReminderSent = async () => {
    if (selectedIds.length === 0) {
      alert('Select at least one registration.');
      return;
    }
    const nowIso = new Date().toISOString();
    for (const id of selectedIds) {
      try {
        await updateReminderFor(id, { lastReminderSent: nowIso, reminderStatus: 'Reminder Sent' });
      } catch {}
    }
    setReminderStatus(prev => {
      const next = { ...prev };
      for (const id of selectedIds) {
        next[id] = { ...(next[id] || { lastSent: null, status: 'Pending' }), lastSent: nowIso, status: 'Reminder Sent' };
      }
      return next;
    });
    alert('Marked reminder sent for selected.');
  };

  const bulkOpenWhatsappReminders = async () => {
    if (selectedIds.length === 0) {
      alert('Select at least one registration.');
      return;
    }
    if (!window.confirm(`Open WhatsApp reminders for ${selectedIds.length} people? This will open multiple tabs/windows.`)) return;
    for (const id of selectedIds) {
      const reg = registrations.find(r => r.id === id);
      if (!reg) continue;
      const msg = `Hi ${reg.fullName}, we’re excited to welcome you to ${reg.programOfInterest}! Please reply to confirm you’re still planning to join us, or let us know if you have any questions.`;
      window.open(`https://wa.me/${reg.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(msg)}`);
      try {
        await updateReminderFor(id, { lastReminderSent: new Date().toISOString(), reminderStatus: 'Reminder Sent' });
      } catch {}
    }
    // Refresh reminders after bulk
    setSelectedIds([]);
  };
  const byProgram: Record<string, number> = {};
  registrations.forEach(r => {
    byProgram[r.programOfInterest] = (byProgram[r.programOfInterest] || 0) + 1;
  });

  // Abbreviation logic for course names
  function abbreviateProgram(name: string) {
    const ignore = ['in', 'of', 'and', 'for', 'to', 'the', 'with', 'on', 'at', 'by'];
    return name
      .split(' ')
      .filter(word => word && !ignore.includes(word.toLowerCase()))
      .map(word => word[0].toUpperCase())
      .join('');
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this registration?')) {
      // Call your delete API or update state here
      // Example: onDelete(id)
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const titleOwner = ownerLabel ? ` : ${ownerLabel}` : '';
    doc.text(`Registrations List${titleOwner}`, 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [[
        '#', 'Full Name', 'Phone', 'Program', 'Intake', 'Mpesa Code', 'Payment Date'
      ]],
      body: registrations.map((reg, idx) => {
        const inquiry = inquiries.find(i => i.id === reg.id);
        const intake = inquiry ? inquiry.intakePeriod : '';
        return [
          idx + 1,
          reg.fullName,
          reg.phone,
          reg.programOfInterest,
          intake,
          reg.paymentCode || '',
          reg.paymentDate ? new Date(reg.paymentDate).toLocaleDateString() : ''
        ];
      }),
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [34, 197, 94] }, // green
    });
    doc.save(`registrations-list${ownerLabel ? `-${ownerLabel.replace(/\s+/g,'_')}` : ''}.pdf`);
  };

  return (
    <div className="overflow-x-auto">
      {/* Title */}
      <div className="mb-1 text-base sm:text-lg font-bold text-primary">Registered Prospects</div>
      {/* Summary Bar */}
      <div className="mb-2 px-3 sm:px-4 py-2 bg-green-50 border border-green-200 rounded text-xs">
        {/* Mobile stacked */}
        <div className="block md:hidden space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-primary">{total}</span>
          </div>
          <div>
            <div className="font-semibold mb-1">By Program</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Object.entries(byProgram).map(([prog, count]) => (
                <span key={prog} className="shrink-0 px-2 py-0.5 rounded-full bg-white border border-green-200 text-[11px]" title={prog}>
                  {abbreviateProgram(prog)}: <span className="font-semibold text-primary">{count}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs"
            >
              {React.createElement(DocumentArrowDownIconAny, { className: 'h-4 w-4' })}
              <span className="ml-1">Pdf</span>
            </button>
          </div>
        </div>
        {/* Desktop inline */}
        <div className="hidden md:flex justify-between items-center">
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded text-xs flex flex-wrap gap-x-6 gap-y-1 items-center">
            <span className="font-semibold">Total:</span> {total}
            <span className="font-semibold">By Program:</span> {Object.entries(byProgram).map(([prog, count]) => (
              <span key={prog} className="mr-2" title={prog}>{abbreviateProgram(prog)}: <span className="font-semibold text-primary">{count}</span></span>
            ))}
          </div>
          <button
            onClick={handleDownloadPDF}
            className="ml-4 px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-semibold flex items-center gap-2"
          >
            {React.createElement(DocumentArrowDownIconAny, { className: 'h-5 w-5' })}
            Pdf
          </button>
        </div>
      </div>

      {/* Owner filter right below summary bar */}
      {showOwnerFilter && owners.length > 0 && (
        <div className="mt-2 mb-2 rounded-md bg-yellow-50 border border-yellow-300 px-2 py-2 inline-flex items-center gap-2">
          <span className="text-xs font-semibold text-yellow-800">Owner</span>
          <select
            className="px-3 py-1 border border-yellow-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            value={ownerValue}
            onChange={e => onOwnerChange && onOwnerChange(e.target.value)}
          >
            <option value="">All Owners</option>
            {owners.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Bulk actions + filters */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-[12px]"
            disabled={selectedIds.length === 0}
            onClick={bulkMarkReminderSent}
            title="Update reminder status for selected"
          >
            Mark reminder sent ({selectedIds.length})
          </button>
          <button
            type="button"
            className="px-3 py-1.5 border border-green-200 text-green-800 bg-green-50 hover:bg-green-100 text-[12px]"
            disabled={selectedIds.length === 0}
            onClick={bulkOpenWhatsappReminders}
            title="Open WhatsApp reminders for selected"
          >
            WhatsApp reminders ({selectedIds.length})
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="px-2 py-1.5 border border-gray-200 bg-white text-[12px]"
            value={filters.status}
            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
            title="Filter by reminder status"
          >
            <option value="">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Reminder Sent">Reminder Sent</option>
          </select>
          <select
            className="px-2 py-1.5 border border-gray-200 bg-white text-[12px]"
            value={filters.sentiment}
            onChange={e => setFilters(prev => ({ ...prev, sentiment: e.target.value }))}
            title="Filter by sentiment"
          >
            <option value="">All sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
      </div>

      <div className="flow-root">
        <div className="-ml-2 -mr-4 sm:-mx-6 lg:-mx-8">{/* left margin for breathing room */}
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            {filteredRegistrations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No paid registrations found.
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showAllColumns} onChange={e => setShowAllColumns(e.target.checked)} className="rounded" />
                  View all columns
                </label>
              </div>
              <table className="min-w-full border-separate border-spacing-0 text-[13px]">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={e => toggleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm py-2 pl-3 pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 sm:pl-4 lg:pl-6">#</th>
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">Full Name</th>
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">Phone</th>
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 hidden md:table-cell">Program</th>
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 hidden md:table-cell">Intake</th>
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 hidden lg:table-cell">Mpesa Code</th>
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 hidden lg:table-cell">Payment Date</th>
                    <th scope="col" className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 ${showAllColumns ? 'table-cell' : 'hidden'}`}>Last Reminder</th>
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">Status</th>
                    <th scope="col" className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 ${showAllColumns ? 'table-cell' : 'hidden'}`}>Last Response</th>
                    <th scope="col" className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 ${showAllColumns ? 'table-cell' : 'hidden'}`}>Sentiment</th>
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredRegistrations.map((reg, idx) => {
                    const inquiry = inquiries.find(i => i.id === reg.id);
                    const intake = inquiry ? inquiry.intakePeriod : '';
                    const reminder = reminderStatus[reg.id] || { lastSent: null, status: 'Pending', lastResponse: null, sentiment: null };
                    const sentimentColor = reminder.sentiment === 'positive' ? 'text-emerald-700' : reminder.sentiment === 'negative' ? 'text-amber-700 font-bold' : reminder.sentiment === 'neutral' ? 'text-yellow-700 font-bold' : '';
                    return (
                      <React.Fragment key={reg.id || idx}>
                      <tr className={
                        (reminder.sentiment === 'negative' || reminder.sentiment === 'neutral') ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }>
                        <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5">
                          <input type="checkbox" checked={selectedIds.includes(reg.id)} onChange={() => toggleSelectOne(reg.id)} />
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 py-1.5 pl-3 pr-2 text-[13px] text-gray-700 sm:pl-4 lg:pl-6">
                          <button className="mr-1 xl:hidden text-gray-400" title="Expand" onClick={() => setExpanded(prev => ({ ...prev, [reg.id]: !prev[reg.id] }))}>{expanded[reg.id] ? '▾' : '▸'}</button>
                          {idx + 1}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] font-medium text-gray-800">{reg.fullName}</td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">{reg.phone}</td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 hidden md:table-cell" title={reg.programOfInterest}>{abbreviateProgram(reg.programOfInterest)}</td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 hidden md:table-cell">{intake}</td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 hidden lg:table-cell">{reg.paymentCode}</td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 hidden lg:table-cell">{reg.paymentDate ? new Date(reg.paymentDate).toLocaleDateString() : ''}</td>
                        <td className={`whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 ${showAllColumns ? 'table-cell' : 'hidden'}`}>{reminder.lastSent ? new Date(reminder.lastSent).toLocaleDateString() : 'Never'}</td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">{reminder.status}</td>
                        <td className={`whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 ${showAllColumns ? 'table-cell' : 'hidden'}`}>{reminder.lastResponse || '-'}</td>
                        <td className={`whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] ${showAllColumns ? 'table-cell' : 'hidden'} ${sentimentColor}`}>{reminder.sentiment ? reminder.sentiment.charAt(0).toUpperCase() + reminder.sentiment.slice(1) : '-'}</td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 flex gap-2">
                          {/* View */}
                          <button onClick={() => setViewReg(reg)} title="View" className="p-1 rounded hover:bg-blue-100 text-blue-600">
                            {React.createElement(EyeIconAny, { className: 'h-5 w-5' })}
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => !isAdmissionsOfficer && handleDelete(reg.id)}
                            title={isAdmissionsOfficer ? 'Contact an Admin to delete this record' : 'Delete'}
                            disabled={isAdmissionsOfficer}
                            className={`p-1 rounded ${isAdmissionsOfficer ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-rose-100 text-rose-500'}`}
                          >
                            {React.createElement(TrashIconAny, { className: 'h-5 w-5' })}
                          </button>
                          {/* WhatsApp quick chat */}
                          <a href={`https://wa.me/${reg.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Hello ${reg.fullName},`)}`} target="_blank" rel="noopener noreferrer" title="Chat on WhatsApp" className="p-1 rounded hover:bg-green-100 text-green-600">
                            {React.createElement(FaWhatsappAny, { className: 'h-5 w-5' })}
                          </a>
                          {/* Send reminder - icon */}
                          <button
                            onClick={async () => {
                              const msg = `Hi ${reg.fullName}, we’re excited to welcome you to ${reg.programOfInterest} this ${reg.intake || ''}! Please reply to confirm you’re still planning to join us, or let us know if you have any questions.`;
                              window.open(`https://wa.me/${reg.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(msg)}`);
                              await fetch(`${WEB_API}/inquiries/${reg.id}/reminder`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...userHeaders() },
                                body: JSON.stringify({
                                  lastReminderSent: new Date().toISOString(),
                                  reminderStatus: 'Reminder Sent',
                                }),
                              });
                              setReminderStatus(prev => ({ ...prev, [reg.id]: { lastSent: new Date().toISOString(), status: 'Reminder Sent' } }));
                            }}
                            className="p-1 rounded hover:bg-blue-100 text-blue-600"
                            title="Send Reminder"
                          >
                            {React.createElement(BellIconAny, { className: 'h-5 w-5' })}
                          </button>
                          {/* Log response - icon */}
                          <button onClick={() => { setLogModal({ open: true, reg }); setResponseText(''); }} className="p-1 rounded hover:bg-emerald-100 text-emerald-600" title="Log Response">
                            {React.createElement(ClipboardDocumentCheckIconAny, { className: 'h-5 w-5' })}
                          </button>
                        </td>
                      </tr>
                      {expanded[reg.id] && (
                        <tr className="xl:hidden bg-gray-50/50">
                          <td colSpan={12} className="px-4 py-2 text-xs text-gray-600 border-b border-gray-100">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
                              <span className="md:hidden"><strong>Program:</strong> {abbreviateProgram(reg.programOfInterest)}</span>
                              <span className="md:hidden"><strong>Intake:</strong> {intake}</span>
                              <span className="lg:hidden"><strong>Mpesa:</strong> {reg.paymentCode}</span>
                              <span className="lg:hidden"><strong>Pay Date:</strong> {reg.paymentDate ? new Date(reg.paymentDate).toLocaleDateString() : '-'}</span>
                              <span><strong>Reminder:</strong> {reminder.lastSent ? new Date(reminder.lastSent).toLocaleDateString() : 'Never'}</span>
                              <span><strong>Response:</strong> {reminder.lastResponse || '-'}</span>
                              <span><strong>Sentiment:</strong> {reminder.sentiment ? reminder.sentiment.charAt(0).toUpperCase() + reminder.sentiment.slice(1) : '-'}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {/* View Modal */}
      {viewReg && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-md`}>
            <div className={modalHeaderClass}>
              <h2 className={modalTitleClass}>Registration Details</h2>
              <button className={modalCloseButtonClass} onClick={() => setViewReg(null)} aria-label="Close">✕</button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="font-semibold p-2">Full Name</td><td className="p-2">{viewReg.fullName}</td></tr>
                <tr><td className="font-semibold p-2">Phone</td><td className="p-2">{viewReg.phone}</td></tr>
                <tr><td className="font-semibold p-2">Program</td><td className="p-2">{viewReg.programOfInterest}</td></tr>
                <tr><td className="font-semibold p-2">Intake</td><td className="p-2">{viewReg.intake}</td></tr>
                <tr><td className="font-semibold p-2">Mpesa Code</td><td className="p-2">{viewReg.paymentCode}</td></tr>
                <tr><td className="font-semibold p-2">Payment Date</td><td className="p-2">{viewReg.paymentDate ? new Date(viewReg.paymentDate).toLocaleDateString() : ''}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Log Response Modal */}
      {logModal.open && logModal.reg && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-md`}>
            <div className={modalHeaderClass}>
              <h2 className={modalTitleClass}>Log Response</h2>
              <button className={modalCloseButtonClass} onClick={() => setLogModal({ open: false, reg: null })} aria-label="Close">✕</button>
            </div>
            <div className="text-sm text-gray-700 mb-3">For: <span className="font-semibold">{logModal.reg.fullName}</span></div>
            <div className="mb-2 flex flex-wrap gap-2">
              {QUICK_RESPONSES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className="px-2 py-1 text-[12px] border border-gray-200 bg-white hover:bg-gray-50"
                  onClick={() => setResponseText(t.text)}
                  title="Use template"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea className={`${textareaClass} mb-4`} rows={4} value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Paste or type the response from the lead..." />
            <div className="flex justify-end gap-2">
              <button className={secondaryButtonClass} onClick={() => setLogModal({ open: false, reg: null })} disabled={logging}>Cancel</button>
              <button className={primaryButtonClass} disabled={logging || !responseText.trim()} onClick={async () => {
                setLogging(true);
                try {
                  const res = await fetch(`${WEB_API}/inquiries/${logModal.reg!.id}/reminder/response`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...userHeaders() },
                    body: JSON.stringify({ responseText })
                  });
                  const raw = await res.text().catch(() => '');
                  if (!res.ok) {
                    // If the backend wrote but responded badly, users were seeing an error even though refresh shows saved.
                    // We surface the error but still allow closing; user can verify after refresh.
                    alert(raw ? `Failed to log response: ${raw}` : 'Failed to log response');
                    return;
                  }
                  let sentiment: string | null = null;
                  try {
                    const data = raw ? JSON.parse(raw) : null;
                    sentiment = data?.sentiment || null;
                  } catch {
                    // Backend might return empty/invalid JSON even after saving; treat as success.
                    sentiment = null;
                  }
                  setReminderStatus(prev => ({
                    ...prev,
                    [logModal.reg!.id]: { ...prev[logModal.reg!.id], lastResponse: responseText, sentiment: sentiment || prev[logModal.reg!.id]?.sentiment || null }
                  }));
                  setLogModal({ open: false, reg: null });
                } catch (e) {
                  alert(`Failed to log response: ${e instanceof Error ? e.message : 'Unknown error'}`);
                } finally {
                  setLogging(false);
                }
              }}>{logging ? 'Logging...' : 'Log Response'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 