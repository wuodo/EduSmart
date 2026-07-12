"use client";
import { useEffect, useState } from 'react';

type StaffMember = {
  id: number; name: string; email: string; role: string;
  totalInquiries: number; hotLeads: number; pendingFollowups: number;
  overdueFollowups: number; completedFollowups: number; conversions: number;
  conversionRate: number; followupRate: number; score: number;
};

export default function AccountabilityPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [briefing, setBriefing] = useState<any>(null);

  useEffect(() => {
    fetch('/api/proxy/accountability/staff-performance').then(r => r.json()).then(d => d.success && setStaff(d.staff)).catch(() => {});
    fetch('/api/proxy/briefing').then(r => r.json()).then(d => { if (d.briefing) setBriefing(d.briefing); }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Accountability</h1>

      {briefing && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border p-4"><div className="text-2xl font-bold text-teal-600">{briefing.hotLeads}</div><div className="text-xs text-gray-500 mt-1">Hot Leads</div></div>
          <div className="bg-white border p-4"><div className="text-2xl font-bold text-amber-600">{briefing.overdueFollowups}</div><div className="text-xs text-gray-500 mt-1">Overdue</div></div>
          <div className="bg-white border p-4"><div className="text-2xl font-bold text-blue-600">{briefing.newToday}</div><div className="text-xs text-gray-500 mt-1">New Today</div></div>
          <div className="bg-white border p-4"><div className="text-2xl font-bold text-green-600">{briefing.conversionRate}%</div><div className="text-xs text-gray-500 mt-1">Conversion</div></div>
          <div className="bg-white border p-4"><div className="text-2xl font-bold text-purple-600">{briefing.score}</div><div className="text-xs text-gray-500 mt-1">Focus Score</div></div>
        </div>
      )}

      <div className="bg-white border overflow-x-auto">
        <div className="px-4 py-3 font-semibold text-gray-700 border-b text-sm">Team Performance</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Staff</th>
              <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Inquiries</th>
              <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Hot</th>
              <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Pending</th>
              <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Overdue</th>
              <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Completed</th>
              <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Conv%</th>
              <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Score</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium">{s.name}<div className="text-xs text-gray-400">{s.role}</div></td>
                <td className="px-4 py-2.5 text-center">{s.totalInquiries}</td>
                <td className="px-4 py-2.5 text-center text-amber-600 font-medium">{s.hotLeads}</td>
                <td className="px-4 py-2.5 text-center">{s.pendingFollowups}</td>
                <td className="px-4 py-2.5 text-center text-red-600 font-medium">{s.overdueFollowups}</td>
                <td className="px-4 py-2.5 text-center">{s.completedFollowups}</td>
                <td className="px-4 py-2.5 text-center font-medium">{s.conversionRate}%</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.score >= 100 ? 'bg-green-100 text-green-700' : s.score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{s.score}</span>
                </td>
              </tr>
            ))}
            {staff.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No data yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
