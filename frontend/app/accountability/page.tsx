"use client";
import { useEffect, useState, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];
const PERIODS = [{ k: 'week', l: '7 Days' }, { k: 'month', l: '30 Days' }, { k: 'quarter', l: '90 Days' }];

type StaffMember = {
  id: number; name: string; email: string; role: string;
  totalInquiries: number; hotLeads: number; pendingFollowups: number;
  overdueFollowups: number; completedFollowups: number; conversions: number;
  conversionRate: number; followupRate: number; score: number;
};

type SeriesPoint = { date: string; score: number; inquiries: number; conversions: number };
type Series = { email: string; name: string; points: SeriesPoint[] };

export default function AccountabilityPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [period, setPeriod] = useState('week');
  const [staffFilter, setStaffFilter] = useState('');
  const [briefing, setBriefing] = useState<any>(null);
  const [tab, setTab] = useState<'overview' | 'trends'>('overview');

  const fetchTrend = useCallback(() => {
    const params = new URLSearchParams({ period: period });
    if (staffFilter) params.set('staff', staffFilter);
    fetch(`/api/proxy/accountability/performance-trend?${params}`).then(r => r.json()).then(d => {
      if (d.success) setSeries(d.series);
    }).catch(() => {});
  }, [period, staffFilter]);

  useEffect(() => {
    fetch('/api/proxy/accountability/staff-performance').then(r => r.json()).then(d => d.success && setStaff(d.staff)).catch(() => {});
    fetch('/api/proxy/briefing').then(r => r.json()).then(d => { if (d.briefing) setBriefing(d.briefing); }).catch(() => {});
  }, []);

  useEffect(() => { fetchTrend(); }, [fetchTrend]);

  const trendChart = {
    labels: series[0]?.points.map(p => p.date.slice(5)) || [],
    datasets: series.map((s, i) => ({
      label: s.name,
      data: s.points.map(p => p.score),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '20',
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      borderWidth: 2,
    })),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Accountability</h1>

      <div className="flex gap-1 bg-gray-100 p-0.5 w-fit">
        <button onClick={() => setTab('overview')} className={`px-4 py-1.5 text-xs font-medium ${tab === 'overview' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Overview</button>
        <button onClick={() => setTab('trends')} className={`px-4 py-1.5 text-xs font-medium ${tab === 'trends' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Performance Trends</button>
      </div>

      {tab === 'overview' && (
        <>
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
                      <span className={`px-2 py-0.5 text-xs font-medium ${s.score >= 100 ? 'bg-green-100 text-green-700' : s.score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{s.score}</span>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No data yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'trends' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-gray-100 rounded p-0.5">
              {PERIODS.map(p => (
                <button key={p.k} onClick={() => setPeriod(p.k)} className={`px-3 py-1 text-xs rounded font-medium ${period === p.k ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{p.l}</button>
              ))}
            </div>
            <div className="relative">
              <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)} className="border rounded px-2 py-1.5 text-xs">
                <option value="">All staff</option>
                {staff.map(s => <option key={s.id} value={s.email}>{s.name}</option>)}
              </select>
            </div>
            <span className="text-xs text-gray-400">Each line = staff member. Score combines conversion rate minus overdue penalties.</span>
          </div>

          <div className="bg-white border p-4">
            {series.length > 0 ? (
              <Line
                data={trendChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } } },
                  },
                }}
                height={300}
              />
            ) : (
              <div className="text-center py-12 text-gray-400 text-sm">No performance data for this period</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
