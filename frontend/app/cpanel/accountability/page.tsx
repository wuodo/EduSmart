"use client";
import { useEffect, useState } from 'react';

type StaffMember = {
  id: number; name: string; email: string; role: string;
  totalInquiries: number; hotLeads: number; pendingFollowups: number;
  overdueFollowups: number; completedFollowups: number; conversions: number;
  conversionRate: number; followupRate: number; score: number;
};

type SlaData = {
  slaComplianceRate: number; breachedCount: number; totalNew: number;
  respondedWithin24h: number;
  breaches: { id: number; fullName: string; email: string; createdAt: string; assignedTo: string; status: string; score: number }[];
};

type Escalation = {
  id: number; type: string; assignedTo: string; scheduledFor: string;
  inquiryName: string; inquiryId: number;
};

export default function AccountabilityPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [sla, setSla] = useState<SlaData | null>(null);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [tab, setTab] = useState<'overview' | 'staff' | 'sla' | 'escalations'>('overview');

  useEffect(() => {
    fetch('/api/proxy/accountability/staff-performance').then(r => r.json()).then(d => d.success && setStaff(d.staff)).catch(() => {});
    fetch('/api/proxy/accountability/sla-summary').then(r => r.json()).then(d => d.success && setSla(d.sla)).catch(() => {});
    fetch('/api/proxy/accountability/escalations').then(r => r.json()).then(d => d.success && setEscalations(d.escalations.criticalOverdue)).catch(() => {});
  }, []);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'staff', label: 'Staff Performance' },
    { key: 'sla', label: 'SLA Compliance' },
    { key: 'escalations', label: 'Escalations' },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Staff Accountability</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${tab === t.key ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-6">
            <div className="text-3xl font-bold text-teal-600">{sla?.slaComplianceRate ?? '—'}%</div>
            <div className="text-sm text-gray-500 mt-1">SLA Compliance (24h)</div>
          </div>
          <div className="bg-white rounded-xl border p-6">
            <div className="text-3xl font-bold text-red-600">{sla?.breachedCount ?? '—'}</div>
            <div className="text-sm text-gray-500 mt-1">SLA Breaches</div>
          </div>
          <div className="bg-white rounded-xl border p-6">
            <div className="text-3xl font-bold text-amber-600">{escalations.length}</div>
            <div className="text-sm text-gray-500 mt-1">Critical Overdue Follow-ups</div>
          </div>
          {staff.slice(0, 3).map((s, i) => (
            <div key={s.id} className="bg-white rounded-xl border p-6 col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-700' : 'bg-teal-500'}`}>{i + 1}</span>
                <span className="font-semibold text-sm">{s.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>Score: <strong>{s.score}</strong></div>
                <div>Hot: <strong>{s.hotLeads}</strong></div>
                <div>Conversion: <strong>{s.conversionRate}%</strong></div>
                <div>Overdue: <strong className="text-red-600">{s.overdueFollowups}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'staff' && (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Staff</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Role</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Inquiries</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Hot</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Pending</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Overdue</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Completed</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Conv%</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">F/U%</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Score</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.role}</td>
                  <td className="px-4 py-3 text-center">{s.totalInquiries}</td>
                  <td className="px-4 py-3 text-center text-amber-600 font-medium">{s.hotLeads}</td>
                  <td className="px-4 py-3 text-center">{s.pendingFollowups}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-medium">{s.overdueFollowups}</td>
                  <td className="px-4 py-3 text-center">{s.completedFollowups}</td>
                  <td className="px-4 py-3 text-center font-medium">{s.conversionRate}%</td>
                  <td className="px-4 py-3 text-center">{s.followupRate}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${s.score >= 100 ? 'bg-green-100 text-green-700' : s.score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{s.score}</span>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No staff data yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sla' && sla && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="text-2xl font-bold text-teal-600">{sla.slaComplianceRate}%</div>
              <div className="text-xs text-gray-500 mt-1">Compliance Rate</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-2xl font-bold text-red-600">{sla.breachedCount}</div>
              <div className="text-xs text-gray-500 mt-1">Breaches</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-2xl font-bold">{sla.totalNew}</div>
              <div className="text-xs text-gray-500 mt-1">New Inquiries (24h)</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-2xl font-bold text-green-600">{sla.respondedWithin24h}</div>
              <div className="text-xs text-gray-500 mt-1">Responded within 24h</div>
            </div>
          </div>
          {sla.breaches.length > 0 && (
            <div className="bg-white rounded-xl border overflow-x-auto">
              <div className="px-4 py-3 font-semibold text-gray-700 border-b">SLA Breaches (no response in 24h+)</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Name</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Email</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Created</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Assigned</th>
                    <th className="text-center px-4 py-2 font-semibold text-gray-600">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sla.breaches.map(i => (
                    <tr key={i.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium">{i.fullName}</td>
                      <td className="px-4 py-2 text-gray-600">{i.email}</td>
                      <td className="px-4 py-2 text-gray-600">{new Date(i.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-gray-600">{i.assignedTo || 'Unassigned'}</td>
                      <td className="px-4 py-2 text-center">{i.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'escalations' && (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <div className="px-4 py-3 font-semibold text-gray-700 border-b">Critical Overdue Follow-ups (48h+)</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Inquiry</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Assigned To</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {escalations.map(e => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{e.inquiryName} (#{e.inquiryId})</td>
                  <td className="px-4 py-2 text-gray-600">{e.type}</td>
                  <td className="px-4 py-2 text-gray-600">{e.assignedTo || '—'}</td>
                  <td className="px-4 py-2 text-red-600">{new Date(e.scheduledFor).toLocaleDateString()}</td>
                </tr>
              ))}
              {escalations.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No escalations</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
