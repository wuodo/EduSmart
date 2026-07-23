import { Followup } from '@/types/followup';
import { useEffect, useState } from 'react';
import { WEB_API } from '@/utils/api';

function userHeaders() {
  if (typeof window === 'undefined') return {} as any;
  const tenant = (() => { try { const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } })() || localStorage.getItem('tenant') || '';
  return (tenant ? { 'x-tenant': tenant } : {}) as Record<string, string>;
}

interface Props {
  followups: Followup[];
  staffEmail?: string;
  tenantWide?: boolean;
}

export default function FollowupStatsCards({ followups, staffEmail, tenantWide }: Props) {
  const now = new Date();
  const total = followups.length;
  const pending = followups.filter(f => f.status === 'pending').length;
  const completed = followups.filter(f => f.status === 'completed').length;
  const rescheduled = followups.filter(f => f.status === 'rescheduled').length;
  const cancelled = followups.filter(f => f.status === 'cancelled').length;
  const overdue = followups.filter(f => (f.status === 'pending' || f.status === 'rescheduled') && new Date(f.scheduledFor) < now).length;

  const cards = [
    { label: 'Total', value: total, color: 'bg-[#0D9488] text-white' },
    { label: 'Pending', value: pending, color: 'bg-yellow-500 text-white' },
    { label: 'Completed', value: completed, color: 'bg-green-500 text-white' },
    { label: 'Rescheduled', value: rescheduled, color: 'bg-blue-500 text-white' },
    { label: 'Cancelled', value: cancelled, color: 'bg-gray-500 text-white' },
    { label: 'Overdue', value: overdue, color: 'bg-amber-600 text-white' },
  ];

  // --- Performance Analytics ---
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const staff =
          (tenantWide ? '' : staffEmail) ||
          (() => {
            if (typeof window === 'undefined') return '';
            return localStorage.getItem('userEmail') || localStorage.getItem('userName') || '';
          })() ||
          '';
        const qs = staff ? `?staff=${encodeURIComponent(staff)}` : '';
        const res = await fetch(`${WEB_API}/followups/performance-analytics${qs}`, { headers: userHeaders(), credentials: 'include' });
        const data = await res.json();
        setAnalytics(data);
      } catch {
        setAnalytics(null);
      }
    }
    fetchAnalytics();
  }, [staffEmail]);

  return (
    <>
      {/* Compact summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-2 mb-2">
        {cards.map(card => (
          <div key={card.label} className={`shadow-sm ring-1 ring-black/5 px-2 py-1.5 sm:px-3 sm:py-2 flex flex-col items-center ${card.color}`}>
            <div className="text-sm sm:text-lg font-bold">{card.value}</div>
            <div className="text-[9px] sm:text-[11px] font-medium uppercase tracking-wider text-center leading-tight">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Collapsible Performance Analytics */}
      {analytics && (
        <div className="bg-white shadow-sm ring-1 ring-gray-200 mb-2">
          <button
            onClick={() => setShowAnalytics(s => !s)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-gray-700 hover:bg-gray-50"
          >
            <span className="text-[10px]">{showAnalytics ? '▾' : '▸'}</span>
            Performance Analytics
            {analytics?.staff && (
              <span className="text-gray-400 font-medium normal-case tracking-normal">({analytics.staff})</span>
            )}
          </button>
          {showAnalytics && (
            <div className="px-3 pb-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Card 1: Key Metrics */}
                <div className="bg-gray-50 ring-1 ring-gray-200 overflow-hidden flex flex-col">
                  <div className="font-semibold text-white px-3 py-1.5 text-[12px] bg-teal-600">Key Metrics</div>
                  <table className="w-full text-[12px]">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-1.5 px-3 font-medium text-gray-600 border-r border-gray-200">Total Leads</td>
                        <td className="py-1.5 px-3 text-primary font-bold">{analytics.totalLeads}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-1.5 px-3 font-medium text-gray-600 border-r border-gray-200">Conversions</td>
                        <td className="py-1.5 px-3 text-green-600 font-bold">{analytics.conversions}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-medium text-gray-600 border-r border-gray-200">Overdue Followups</td>
                        <td className="py-1.5 px-3 text-amber-600 font-bold">{analytics.overdueFollowups}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Card 2: Conversion Rates & Response */}
                <div className="bg-gray-50 ring-1 ring-gray-200 overflow-hidden flex flex-col">
                  <div className="font-semibold text-white px-3 py-1.5 text-[12px] bg-blue-600">Conversion & Response</div>
                  <table className="w-full text-[12px]">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-1.5 px-3 font-medium text-gray-600 border-r border-gray-200">Conv. Rate (&lt;24h)</td>
                        <td className="py-1.5 px-3 text-green-700 font-semibold">{analytics.conversionRate24h !== null ? `${Math.round(analytics.conversionRate24h * 100)}%` : 'N/A'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-1.5 px-3 font-medium text-gray-600 border-r border-gray-200">Conv. Rate (&gt;24h)</td>
                        <td className="py-1.5 px-3 text-yellow-600 font-semibold">{analytics.conversionRateAfter24h !== null ? `${Math.round(analytics.conversionRateAfter24h * 100)}%` : 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-medium text-gray-600 border-r border-gray-200">Avg. Response Time</td>
                        <td className="py-1.5 px-3 text-blue-700 font-semibold">{typeof analytics.avgResponseTimeHrs === 'number' && !isNaN(analytics.avgResponseTimeHrs) ? `${analytics.avgResponseTimeHrs.toFixed(1)} hrs` : 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Card 3: Channel Effectiveness */}
                <div className="bg-gray-50 ring-1 ring-gray-200 overflow-hidden flex flex-col">
                  <div className="font-semibold text-white px-3 py-1.5 text-[12px] bg-purple-600">Channel Effectiveness</div>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-purple-600">
                        <th className="py-1 px-3 text-left font-medium text-white border-r border-purple-700">Channel</th>
                        <th className="py-1 px-3 text-left font-medium text-white">Conversion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(analytics.channelEffectiveness || {}).map(([type, rate]: any) => (
                        <tr key={type} className="border-b border-gray-100">
                          <td className="py-1 px-3 capitalize text-gray-800 border-r border-gray-200">{type}</td>
                          <td className="py-1 px-3 text-green-700">{Math.round(rate * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {analytics.conversionRate24h !== null && (
                <div className="bg-blue-50 border border-blue-100 px-3 py-2 mt-2 text-blue-900 text-[12px]">
                  <span className="font-semibold text-green-700">Insight:</span> You convert {Math.round(analytics.conversionRate24h * 100)}% of leads when you follow up within 24 hours.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
} 