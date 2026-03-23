import { useMemo } from 'react';
import { Followup } from '@/types/followup';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
  followups: Followup[];
}

function getAverageTimeToCompletion(followups: Followup[]) {
  const completed = followups.filter(f => f.status === 'completed' && f.completedAt);
  if (!completed.length) return 0;
  const totalMs = completed.reduce((sum, f) => sum + (new Date(f.completedAt!).getTime() - new Date(f.scheduledFor).getTime()), 0);
  return totalMs / completed.length / (1000 * 60 * 60 * 24); // days
}

export default function FollowupAnalytics({ followups }: Props) {
  const total = followups.length;
  const completed = followups.filter(f => f.status === 'completed').length;
  const successRate = total ? Math.round((completed / total) * 100) : 0;
  const avgCompletion = getAverageTimeToCompletion(followups);

  // Most common follow-up types
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    followups.forEach(f => {
      counts[f.type] = (counts[f.type] || 0) + 1;
    });
    return counts;
  }, [followups]);

  // Staff performance
  const staffPerf = useMemo(() => {
    const perf: Record<string, { total: number; completed: number; totalTime: number } > = {};
    followups.forEach(f => {
      if (!perf[f.assignedTo]) perf[f.assignedTo] = { total: 0, completed: 0, totalTime: 0 };
      perf[f.assignedTo].total++;
      if (f.status === 'completed' && f.completedAt) {
        perf[f.assignedTo].completed++;
        perf[f.assignedTo].totalTime += (new Date(f.completedAt).getTime() - new Date(f.scheduledFor).getTime());
      }
    });
    return perf;
  }, [followups]);

  const typeChartData = {
    labels: Object.keys(typeCounts),
    datasets: [
      {
        label: 'Follow-ups',
        data: Object.values(typeCounts),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
      },
    ],
  };

  const chartOptions = {
    responsive: false,
    animation: { duration: 0 },
    plugins: { legend: { display: false } },
    maintainAspectRatio: false,
    height: 180,
    width: 400,
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-primary mb-6">Follow-up Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-primary text-white rounded-lg p-6 flex flex-col items-center">
          <div className="text-4xl font-bold">{successRate}%</div>
          <div className="text-sm mt-2">Success Rate</div>
        </div>
        <div className="bg-blue-100 text-blue-800 rounded-lg p-6 flex flex-col items-center">
          <div className="text-3xl font-bold">{avgCompletion ? avgCompletion.toFixed(1) : '-'} days</div>
          <div className="text-sm mt-2">Avg. Time to Completion</div>
        </div>
        <div className="bg-emerald-100 text-emerald-800 rounded-lg p-6 flex flex-col items-center">
          <div className="text-3xl font-bold">{Object.keys(typeCounts).length}</div>
          <div className="text-sm mt-2">Follow-up Types</div>
        </div>
      </div>
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Most Common Follow-up Types</h3>
        <div className="bg-white rounded-lg p-4 shadow" style={{ width: 400, height: 180 }}>
          <Bar data={typeChartData} options={chartOptions} width={400} height={180} />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">Staff Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-light bg-white rounded-lg">
            <thead className="bg-neutral-light/30">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Staff</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Total</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Completed</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Avg. Completion Time (days)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-light">
              {Object.entries(staffPerf).map(([staff, perf]) => (
                <tr key={staff}>
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold">{staff}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{perf.total}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{perf.completed}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{perf.completed ? (perf.totalTime / perf.completed / (1000*60*60*24)).toFixed(1) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 