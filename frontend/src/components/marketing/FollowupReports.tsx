import { useState } from 'react';
import { format } from 'date-fns';
import { Followup } from '@/types/followup';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  followups: Followup[];
}

type ReportType = 'summary' | 'detailed' | 'performance';
type DateRange = {
  start: Date;
  end: Date;
};

export default function FollowupReports({ followups }: Props) {
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    end: new Date()
  });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const generateReport = () => {
    let filteredData = followups.filter(f => {
      const followupDate = new Date(f.scheduledFor);
      return followupDate >= dateRange.start && followupDate <= dateRange.end;
    });

    if (statusFilter.length) {
      filteredData = filteredData.filter(f => statusFilter.includes(f.status));
    }

    if (typeFilter.length) {
      filteredData = filteredData.filter(f => typeFilter.includes(f.type));
    }

    switch (reportType) {
      case 'summary':
        return generateSummaryReport(filteredData);
      case 'detailed':
        return generateDetailedReport(filteredData);
      case 'performance':
        return generatePerformanceReport(filteredData);
      default:
        return generateSummaryReport(filteredData);
    }
  };

  const generateSummaryReport = (data: Followup[]) => {
    const statusCounts = data.reduce((acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeCounts = data.reduce((acc, f) => {
      acc[f.type] = (acc[f.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalFollowups: data.length,
      statusBreakdown: statusCounts,
      typeBreakdown: typeCounts,
      dateRange: {
        start: format(dateRange.start, 'PP'),
        end: format(dateRange.end, 'PP')
      }
    };
  };

  const generateDetailedReport = (data: Followup[]) => {
    return data.map(f => ({
      scheduledFor: format(new Date(f.scheduledFor), 'PPpp'),
      type: f.type,
      status: f.status,
      assignedTo: f.assignedTo,
      notes: f.notes,
      createdBy: f.createdBy,
      createdAt: format(new Date(f.createdAt), 'PPpp'),
      updatedAt: format(new Date(f.updatedAt), 'PPpp')
    }));
  };

  const generatePerformanceReport = (data: Followup[]) => {
    const staffPerformance = data.reduce((acc, f) => {
      if (!acc[f.assignedTo]) {
        acc[f.assignedTo] = {
          total: 0,
          completed: 0,
          pending: 0,
          rescheduled: 0,
          cancelled: 0
        };
      }
      acc[f.assignedTo].total++;
      acc[f.assignedTo][f.status]++;
      return acc;
    }, {} as Record<string, any>);

    return {
      staffPerformance,
      dateRange: {
        start: format(dateRange.start, 'PP'),
        end: format(dateRange.end, 'PP')
      }
    };
  };

  const exportToExcel = (data: any) => {
    let rows: any[] = [];
    let header: string[] = [];
    if (isSummary) {
      header = ['Metric', 'Value'];
      rows = [
        ['Total Follow-ups', data.totalFollowups],
        ...Object.entries(data.statusBreakdown).map(([k, v]) => [`Status: ${k}`, v]),
        ...Object.entries(data.typeBreakdown).map(([k, v]) => [`Type: ${k}`, v]),
        ['Date Range', `${data.dateRange.start} - ${data.dateRange.end}`],
      ];
    } else if (isDetailed && Array.isArray(data)) {
      header = Object.keys(data[0] || {});
      rows = data.map((row: any) => header.map(key => row[key]));
    } else if (isPerformance && data.staffPerformance) {
      header = ['Staff', 'Total', 'Completed', 'Pending', 'Rescheduled', 'Cancelled'];
      rows = Object.entries(data.staffPerformance).map(([staff, perf]: any) => [
        staff, perf.total, perf.completed, perf.pending, perf.rescheduled, perf.cancelled
      ]);
    }
    const csv = [header, ...rows].map(r => r.map((x: unknown) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `followup-report-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = (data: any) => {
    const doc = new jsPDF();
    if (isSummary) {
      doc.setFontSize(16);
      doc.text('Follow-up Summary Report', 14, 18);
      autoTable(doc, {
        startY: 28,
        head: [['Metric', 'Value']],
        body: [
          ['Total Follow-ups', data.totalFollowups],
          ...Object.entries(data.statusBreakdown).map(([k, v]) => [`Status: ${k}`, v]),
          ...Object.entries(data.typeBreakdown).map(([k, v]) => [`Type: ${k}`, v]),
          ['Date Range', `${data.dateRange.start} - ${data.dateRange.end}`],
        ],
      });
    } else if (isDetailed && Array.isArray(data)) {
      doc.setFontSize(16);
      doc.text('Follow-up Detailed Report', 14, 18);
      const header = Object.keys(data[0] || {});
      const rows = data.map((row: any) => header.map(key => row[key]));
      autoTable(doc, {
        startY: 28,
        head: [header],
        body: rows,
      });
    } else if (isPerformance && data.staffPerformance) {
      doc.setFontSize(16);
      doc.text('Follow-up Performance Report', 14, 18);
      const header = ['Staff', 'Total', 'Completed', 'Pending', 'Rescheduled', 'Cancelled'];
      const rows = Object.entries(data.staffPerformance).map(([staff, perf]: any) => [
        staff, perf.total, perf.completed, perf.pending, perf.rescheduled, perf.cancelled
      ]);
      autoTable(doc, {
        startY: 28,
        head: [header],
        body: rows,
      });
    }
    doc.save(`followup-report-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const report = generateReport();
  const isSummary = reportType === 'summary' && !Array.isArray(report) && 'totalFollowups' in report;
  const isDetailed = reportType === 'detailed' && Array.isArray(report);
  const isPerformance = reportType === 'performance' && !Array.isArray(report) && 'staffPerformance' in report;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-primary mb-4">Follow-up Reports</h2>
      {/* Filters */}
      <div className="bg-neutral-light/40 rounded-lg p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-dark mb-1">Report Type</label>
          <select
            className="w-full rounded-md border border-neutral-light p-2"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
          >
            <option value="summary">Summary Report</option>
            <option value="detailed">Detailed Report</option>
            <option value="performance">Performance Report</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-dark mb-1">Start Date</label>
          <input
            type="date"
            className="w-full rounded-md border border-neutral-light p-2"
            value={format(dateRange.start, 'yyyy-MM-dd')}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-dark mb-1">End Date</label>
          <input
            type="date"
            className="w-full rounded-md border border-neutral-light p-2"
            value={format(dateRange.end, 'yyyy-MM-dd')}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-dark mb-1">Status</label>
          <select
            className="w-full rounded-md border border-neutral-light p-2"
            value={statusFilter[0] || ''}
            onChange={e => setStatusFilter(e.target.value ? [e.target.value] : [])}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-dark mb-1">Type</label>
          <select
            className="w-full rounded-md border border-neutral-light p-2"
            value={typeFilter[0] || ''}
            onChange={e => setTypeFilter(e.target.value ? [e.target.value] : [])}
          >
            <option value="">All Types</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="visit">Visit</option>
          </select>
        </div>
      </div>

      {/* Report Preview */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Report Preview</h3>
        {isSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-primary text-white rounded-lg p-4 flex flex-col items-center">
              <div className="text-3xl font-bold">{report.totalFollowups}</div>
              <div className="text-sm mt-1">Total Follow-ups</div>
              <div className="text-xs mt-2 text-white/80">{report.dateRange.start} - {report.dateRange.end}</div>
            </div>
            <div className="bg-green-100 text-green-800 rounded-lg p-4">
              <div className="font-semibold mb-2">Status Breakdown</div>
              {Object.entries(report.statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <span className="capitalize">{status}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
            <div className="bg-blue-100 text-blue-800 rounded-lg p-4">
              <div className="font-semibold mb-2">Type Breakdown</div>
              {Object.entries(report.typeBreakdown).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="capitalize">{type}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {isDetailed && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-light bg-white rounded-lg">
              <thead className="bg-neutral-light/30">
                <tr>
                  {Object.keys(report[0] || {}).map((key) => (
                    <th key={key} className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-light">
                {report.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-4 py-2 whitespace-nowrap text-sm">{val as string}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isPerformance && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-light bg-white rounded-lg">
              <thead className="bg-neutral-light/30">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Staff</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Total</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Completed</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Pending</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Rescheduled</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Cancelled</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-light">
                {Object.entries(report.staffPerformance).map(([staff, perf]: any) => (
                  <tr key={staff}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold">{staff}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{perf.total}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{perf.completed}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{perf.pending}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{perf.rescheduled}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{perf.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Export Buttons */}
      <div className="flex justify-end gap-4 mt-6">
        <button
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          onClick={() => exportToExcel(report)}
        >
          Export to Excel
        </button>
        <button
          className="px-4 py-2 bg-neutral-dark text-white rounded-md hover:bg-neutral-dark/90"
          onClick={() => exportToPDF(report)}
        >
          Export to PDF
        </button>
      </div>
    </div>
  );
} 