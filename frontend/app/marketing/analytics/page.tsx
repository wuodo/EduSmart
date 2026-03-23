"use client"

import React, { useEffect, useState, ComponentType } from "react";
import {
  BarChart as ReBarChart, Bar as ReBar, XAxis as ReXAxis, YAxis as ReYAxis, Tooltip as ReTooltip, ResponsiveContainer as ReResponsiveContainer, PieChart as RePieChart, Pie as RePie, Cell as ReCell, Legend as ReLegend
} from "recharts";
import { FaUserFriends, FaClipboardCheck, FaMoneyBillWave, FaFire } from "react-icons/fa";
import { MdDateRange, MdSource, MdWarning, MdPieChart } from "react-icons/md";
import DatePicker from "react-date-picker";
import 'react-date-picker/dist/DatePicker.css';
import { useRef } from "react";
import { WEB_API } from "@/utils/api";

const API = WEB_API;

export default function AnalyticsPage() {
  const [funnel, setFunnel] = useState<any>(null);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [sourceEffect, setSourceEffect] = useState<any[]>([]);
  const [dropoff, setDropoff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [skeleton, setSkeleton] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [owner, setOwner] = useState<string>('');
  const [owners, setOwners] = useState<{ label: string; value: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  function userHeaders() {
    return {} as Record<string, string>;
  }

  // Check if user is admin and fetch users for owner filter
  useEffect(() => {
    const userRole = localStorage.getItem('userRole')
    
    if (userRole === 'admin' || userRole === 'senior_staff') {
      setIsAdmin(true)
      // Fetch users for owner filter
      fetch('/api/proxy/users')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const ownerOptions = data.users.map((user: any) => ({
              label: user.name || user.email,
              value: user.email
            }))
            setOwners(ownerOptions)
          }
        })
        .catch(err => console.error('Failed to fetch users:', err))
    }
  }, [])

  // Theme toggle logic
  useEffect(() => {
    // On mount, check localStorage or system preference
    const stored = localStorage.getItem("theme");
    if (stored) {
      setDarkMode(stored === "dark");
      document.documentElement.classList.toggle("dark", stored === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDarkMode(prefersDark);
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  }, []);

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  useEffect(() => {
    setSkeleton(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSkeleton(false), 1000);
  }, [loading]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // Add date range to API calls if selected
      const params = dateRange[0] && dateRange[1]
        ? `?start=${dateRange[0].toISOString()}&end=${dateRange[1].toISOString()}`
        : '';
      
      // Add owner filter if selected
      const ownerParam = owner ? `&owner=${owner}` : '';
      const finalParams = params + ownerParam;
      
      const [funnelRes, overdueRes, sourceRes, dropoffRes] = await Promise.all([
        fetch(`${API}/inquiries/analytics/funnel${finalParams}`, { headers: userHeaders() }).then(r => r.json()),
        fetch(`${API}/inquiries/analytics/overdue-followups${finalParams}`, { headers: userHeaders() }).then(r => r.json()),
        fetch(`${API}/inquiries/analytics/source-effectiveness${finalParams}`, { headers: userHeaders() }).then(r => r.json()),
        fetch(`${API}/inquiries/analytics/dropoff${finalParams}`, { headers: userHeaders() }).then(r => r.json()),
      ]);
      setFunnel(funnelRes);
      setOverdue(overdueRes);
      setSourceEffect(sourceRes);
      setDropoff(dropoffRes);
      setLoading(false);
    }
    fetchData();
    // eslint-disable-next-line
  }, [dateRange, owner]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // Add owner filter if selected
      const ownerParam = owner ? `?owner=${owner}` : '';
      const res = await fetch(`${API}/inquiries/analytics/overview${ownerParam}`, { headers: userHeaders() });
      const data = await res.json();
      setAnalytics(data);
      setLoading(false);
    }
    fetchData();
  }, [owner]);

  // Update COLORS array to use strong, vibrant colors for better chart visibility
  const COLORS = [
    '#1E88E5', // strong blue
    '#43A047', // strong green
    '#FBC02D', // strong yellow
    '#E53935', // strong red
    '#8E24AA', // strong purple
    '#00ACC1', // strong teal
    '#F4511E', // strong orange
    '#3949AB', // strong indigo
  ];
  // Chart theme colors
  const chartAxis = darkMode ? "#F3F4F6" : "#22223B";
  const chartBg = darkMode ? "#232837" : "#fff";
  const chartTooltip = darkMode ? { background: "#232837", color: "#F3F4F6", borderColor: "#2D3344" } : { background: "#fff", color: "#22223B", borderColor: "#e5e7eb" };

  return (
    <div className="min-h-screen py-8 px-4 md:px-8 bg-gray-100 dark:bg-[#181C23] text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            {MdPieChart && React.createElement(MdPieChart as any, { className: "text-primary" })} Analytics Dashboard
          </h1>
        </div>
        
        {/* Owner Filter - Only show for admins */}
        {isAdmin && owners.length > 0 && (
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by User
            </label>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500/50 dark:focus:ring-yellow-500/30 focus:border-yellow-500 dark:focus:border-yellow-400"
            >
              <option value="">All Users</option>
              {owners.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-[#232837] rounded px-2 py-1 border border-gray-200 dark:border-gray-700">
            {MdDateRange && React.createElement(MdDateRange as any, { className: "text-primary" })}
            <DatePicker
              onChange={value => setDateRange([value as Date, null])}
              value={dateRange[0]}
              clearIcon={null}
              calendarIcon={null}
              format="y-MM-dd"
              className="date-picker-input"
            />
          </div>
          <button
            onClick={toggleTheme}
            className="rounded px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#232837] text-gray-800 dark:text-gray-100 shadow hover:bg-gray-50 dark:hover:bg-[#232837] transition"
            title="Toggle light/dark mode"
          >
            {darkMode ? "Dark" : "Light"} Mode
          </button>
        </div>
      </div>
      {loading || skeleton ? (
        <div className="text-center py-12 text-lg text-gray-500 dark:text-gray-400 animate-pulse">
          <div className="flex flex-col items-center gap-4">
            <div className="w-1/2 h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
            <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
            <div className="w-full h-64 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="mt-4">Loading analytics...</div>
        </div>
      ) : (
        <>
          {/* Funnel Summary Cards */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
            <SummaryCard label="Total Inquiries" value={analytics?.funnel?.totalInquiries} Icon={FaUserFriends} bg="bg-blue-50 dark:bg-blue-900/30" />
            <SummaryCard label="With Follow-up" value={analytics?.funnel?.withFollowup} Icon={FaClipboardCheck} bg="bg-yellow-50 dark:bg-yellow-900/30" />
            <SummaryCard label="Paid" value={analytics?.funnel?.paid} Icon={FaMoneyBillWave} bg="bg-green-50 dark:bg-green-900/30" />
            <SummaryCard label="Overdue Follow-ups" value={analytics?.overdueFollowups} Icon={MdWarning} bg="bg-rose-50 dark:bg-rose-900/30" />
            <SummaryCard label="Hot Leads" value={analytics?.hotLeads?.count} Icon={FaFire} bg="bg-pink-50 dark:bg-pink-900/30" />
          </div>

          {/* Follow-up Effectiveness, Gender Breakdown, and Follow-up Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="rounded-lg shadow p-6 bg-white dark:bg-[#232837] border border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="rounded-t-md bg-teal-600 dark:bg-teal-500 px-4 py-2 mb-4">
                <h2 className="text-lg font-semibold text-white">Follow-up Effectiveness</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50/80 dark:bg-[#232837]">
                    <tr>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 border-b border-gray-200 dark:border-gray-700 text-left">Metric</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 border-b border-gray-200 dark:border-gray-700 text-left">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700">Avg. follow-ups before payment</td>
                      <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700 font-bold">{analytics?.followupEffectiveness?.avgFollowupsBeforePayment?.toFixed(2) ?? '-'}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700">% with at least one follow-up</td>
                      <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700 font-bold">{analytics?.followupEffectiveness?.percentWithFollowup?.toFixed(1) ?? '-'}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-lg shadow p-4 md:p-6 bg-white dark:bg-[#232837] border border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="rounded-t-md bg-teal-600 dark:bg-teal-500 px-4 py-2 mb-4">
                <h2 className="text-base md:text-lg font-semibold text-white">Gender Breakdown</h2>
              </div>
              {React.createElement(
                RePieChart as any,
                { width: 280, height: 220 },
                React.createElement(
                  RePie as any,
                  {
                    data: analytics?.genderBreakdown || [],
                    dataKey: (d: any) => d._count?._all ?? 0,
                    nameKey: "gender",
                    cx: "50%",
                    cy: "50%",
                    outerRadius: 60,
                    labelLine: false,
                    paddingAngle: 3,
                    // No label prop
                  },
                  ...(analytics?.genderBreakdown || []).map((entry: any, index: number) =>
                    React.createElement(ReCell as any, { key: `cell-gender-${index}`, fill: COLORS[index % COLORS.length] })
                  )
                ),
                React.createElement(ReTooltip as any, {}),
                React.createElement(ReLegend as any, { iconSize: 12, wrapperStyle: { fontSize: 12 } })
              )}
            </div>
            <div className="rounded-lg shadow p-4 md:p-6 bg-white dark:bg-[#232837] border border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="rounded-t-md bg-teal-600 dark:bg-teal-500 px-4 py-2 mb-4">
                <h2 className="text-base md:text-lg font-semibold text-white">Follow-up Status</h2>
              </div>
              <div className="flex justify-center">
                {React.createElement(
                  RePieChart as any,
                  { width: 280, height: 220 },
                  React.createElement(
                    RePie as any,
                    {
                      data: analytics?.followupStatus || [],
                      dataKey: (d: any) => d._count?._all ?? 0,
                      nameKey: "status",
                      cx: "50%",
                      cy: "50%",
                      outerRadius: 60,
                      labelLine: false,
                      paddingAngle: 3,
                      // No label prop
                    },
                    ...(analytics?.followupStatus || []).map((entry: any, index: number) =>
                      React.createElement(ReCell as any, { key: `cell-status-${index}`, fill: COLORS[index % COLORS.length] })
                    )
                  ),
                  React.createElement(ReTooltip as any, {}),
                  React.createElement(ReLegend as any, { iconSize: 12, wrapperStyle: { fontSize: 12 } })
                )}
              </div>
            </div>
            <div className="rounded-lg shadow p-4 md:p-6 bg-white dark:bg-[#232837] border border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="rounded-t-md bg-teal-600 dark:bg-teal-500 px-4 py-2 mb-4">
                <h2 className="text-base md:text-lg font-semibold text-white">Source Effectiveness</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50/80 dark:bg-[#232837]">
                    <tr>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 border-b border-gray-200 dark:border-gray-700 text-left">Source</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 border-b border-gray-200 dark:border-gray-700 text-left">Inquiries</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 border-b border-gray-200 dark:border-gray-700 text-left">Paid</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 border-b border-gray-200 dark:border-gray-700 text-left">Conversion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sourceEffect || []).slice(0, 3).map((s: any, i: number) => (
                      <tr key={s.source || i} className={i % 2 === 0 ? "bg-white dark:bg-[#232837]" : "bg-gray-50 dark:bg-[#181C23]"}>
                        <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700">{s.source || <span className="italic text-gray-400">Unknown</span>}</td>
                        <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700">{s.total}</td>
                        <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700">{s.paid}</td>
                        <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700">{s.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-xs text-gray-400 mt-2">Top 3 sources</div>
              </div>
            </div>
          </div>

          {/* Source Effectiveness */}
          <Section title={<><span>{MdSource && React.createElement(MdSource as any, { className: "text-primary" })}</span> Source Effectiveness</>}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <table className="min-w-full text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50/80 dark:bg-[#232837]">
                    <tr>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 border-b border-gray-200 dark:border-gray-700">Source</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 border-b border-gray-200 dark:border-gray-700">Inquiries</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 border-b border-gray-200 dark:border-gray-700">Paid</th>
                      <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 border-b border-gray-200 dark:border-gray-700">Conversion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceEffect.map((s, i) => (
                      <tr key={s.source || i} className={i % 2 === 0 ? "bg-white dark:bg-[#232837] hover:bg-blue-50 dark:hover:bg-blue-900/20" : "bg-gray-50 dark:bg-[#181C23] hover:bg-blue-50 dark:hover:bg-blue-900/20"}>
                        <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700">{s.source || <span className="italic text-gray-400">Unknown</span>}</td>
                        <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700">{s.total}</td>
                        <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700">{s.paid}</td>
                        <td className="px-3 py-2 text-[13px] border-b border-gray-100 dark:border-gray-700">{s.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="h-56 md:h-64">
                {/* Chart remains unchanged, but you can add tooltips if needed */}
                {React.createElement(
                  ReResponsiveContainer as any,
                  { width: "100%", height: "100%" },
                  React.createElement(
                    ReBarChart as any,
                    { data: sourceEffect, margin: { top: 10, right: 10, left: 0, bottom: 0 }, style: { background: chartBg } },
                    React.createElement(ReXAxis as any, { dataKey: "source", tick: { fill: chartAxis }, tickFormatter: (v: any) => v || 'Unknown', axisLine: { stroke: chartAxis }, tickLine: { stroke: chartAxis } }),
                    React.createElement(ReYAxis as any, { allowDecimals: false, tick: { fill: chartAxis }, axisLine: { stroke: chartAxis }, tickLine: { stroke: chartAxis } }),
                    React.createElement(ReTooltip as any, { contentStyle: chartTooltip }),
                    React.createElement(ReLegend as any, { wrapperStyle: { color: chartAxis } }),
                    React.createElement(ReBar as any, { dataKey: "total", fill: "#8884d8", name: "Inquiries" }),
                    React.createElement(ReBar as any, { dataKey: "paid", fill: "#82ca9d", name: "Paid" })
                  )
                )}
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, Icon, bg }: { label: string; value: any; Icon: any; bg: string }) {
  return (
    <div className={`rounded-lg p-2 md:p-4 shadow text-center flex flex-col items-center gap-1 md:gap-2 ${bg}`}>
      <div className="hidden md:flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 mb-1 md:mb-2 text-2xl">
        {Icon && React.createElement(Icon, { className: "" })}
      </div>
      <div className="text-base md:text-2xl font-bold">{value ?? '-'}</div>
      <div className="text-xs md:text-sm mt-0 md:mt-1 opacity-80">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg shadow p-6 mt-6 bg-white dark:bg-[#232837] border-t-4 border-primary border-opacity-30 dark:border-opacity-50 text-gray-900 dark:text-gray-100">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">{title}</h2>
      {children}
    </div>
  );
} 