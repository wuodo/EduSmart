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
    { label: 'Total', value: total, color: 'bg-primary text-white' },
    { label: 'Pending', value: pending, color: 'bg-yellow-500 text-white' },
    { label: 'Completed', value: completed, color: 'bg-green-500 text-white' },
    { label: 'Rescheduled', value: rescheduled, color: 'bg-blue-500 text-white' },
    { label: 'Cancelled', value: cancelled, color: 'bg-gray-500 text-white' },
    { label: 'Overdue', value: overdue, color: 'bg-amber-600 text-white' },
  ];

  // --- Performance Analytics ---
  const [analytics, setAnalytics] = useState<any>(null);
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
      {analytics && (
        <div className="bg-white shadow-sm ring-1 ring-blue-100 p-4 mb-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-primary mb-3">
            Performance Analytics{' '}
            {analytics?.staff ? (
              <span className="text-gray-500 font-medium normal-case tracking-normal">({analytics.staff})</span>
            ) : null}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Card 1: Key Metrics */}
            <div className="bg-gray-50 ring-1 ring-gray-200 p-0 overflow-hidden flex flex-col">
              <div className="font-semibold text-white px-4 py-2 border-b border-gray-200 bg-teal-600">Key Metrics</div>
              <table className="w-full text-sm border border-gray-200">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-4 font-medium text-gray-600 border-r border-gray-200">Total Leads</td>
                    <td className="py-2 px-4 text-primary font-bold">{analytics.totalLeads}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-4 font-medium text-gray-600 border-r border-gray-200">Conversions</td>
                    <td className="py-2 px-4 text-green-600 font-bold">{analytics.conversions}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium text-gray-600 border-r border-gray-200">Overdue Followups</td>
                    <td className="py-2 px-4 text-amber-600 font-bold">{analytics.overdueFollowups}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Card 2: Conversion Rates & Response */}
            <div className="bg-gray-50 ring-1 ring-gray-200 p-0 overflow-hidden flex flex-col">
              <div className="font-semibold text-white px-4 py-2 border-b border-gray-200 bg-teal-600">Conversion & Response</div>
              <table className="w-full text-sm border border-gray-200">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-4 font-medium text-gray-600 border-r border-gray-200">Conv. Rate (&lt;24h)</td>
                    <td className="py-2 px-4 text-green-700 font-semibold">{analytics.conversionRate24h !== null ? `${Math.round(analytics.conversionRate24h * 100)}%` : 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 px-4 font-medium text-gray-600 border-r border-gray-200">Conv. Rate (&gt;24h)</td>
                    <td className="py-2 px-4 text-yellow-600 font-semibold">{analytics.conversionRateAfter24h !== null ? `${Math.round(analytics.conversionRateAfter24h * 100)}%` : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium text-gray-600 border-r border-gray-200">Avg. Response Time</td>
                    <td className="py-2 px-4 text-blue-700 font-semibold">{typeof analytics.avgResponseTimeHrs === 'number' && !isNaN(analytics.avgResponseTimeHrs) ? `${analytics.avgResponseTimeHrs.toFixed(1)} hrs` : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Card 3: Channel Effectiveness */}
            <div className="bg-gray-50 ring-1 ring-gray-200 p-0 overflow-hidden flex flex-col">
              <div className="font-semibold text-white px-4 py-2 border-b border-gray-200 bg-teal-600">Channel Effectiveness</div>
              <table className="w-full text-xs border border-gray-200">
                <thead>
                  <tr className="bg-teal-600">
                    <th className="py-1 px-2 text-left font-medium text-white border-r border-teal-700">Channel</th>
                    <th className="py-1 px-2 text-left font-medium text-white">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(analytics.channelEffectiveness || {}).map(([type, rate]: any) => (
                    <tr key={type} className="border-b border-gray-100">
                      <td className="py-1 px-2 capitalize text-gray-800 border-r border-gray-200">{type}</td>
                      <td className="py-1 px-2 text-green-700">{Math.round(rate * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {analytics.conversionRate24h !== null && (
            <div className="bg-blue-50 border border-blue-100 p-3 mt-2 text-blue-900 text-sm">
              <span className="font-semibold text-green-700">Insight:</span> You convert {Math.round(analytics.conversionRate24h * 100)}% of leads when you follow up within 24 hours.
            </div>
          )}
        </div>
      )}
      {/* Cards first, table label after for better mobile flow */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4 mb-3 sm:mb-6">
        {cards.map(card => (
          <div key={card.label} className={`shadow-sm ring-1 ring-black/5 p-2 sm:p-3 flex flex-col items-center ${card.color}`}>
            <div className="text-base sm:text-2xl font-bold">{card.value}</div>
            <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wider mt-1 text-center">{card.label}</div>
          </div>
        ))}
      </div>
      <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-primary">Follow-up Table</div>
    </>
  );
} 