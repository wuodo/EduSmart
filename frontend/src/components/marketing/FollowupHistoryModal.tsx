import { useMemo } from 'react';
import { format } from 'date-fns';
import { Followup } from '@/types/followup';

interface Props {
  inquiryId: string;
  allFollowups: Followup[];
  onClose: () => void;
}

function getSuggestion(history: Followup[]) {
  if (!history.length) return 'No follow-up history.';
  const last = history[history.length - 1];
  if (last.status === 'completed') return 'No further action needed.';
  if (last.status === 'cancelled') return 'Follow-up was cancelled. Review if needed.';
  if (last.status === 'rescheduled') return 'Reschedule or complete the follow-up soon.';
  if (last.status === 'pending') return 'Action required: Complete or reschedule follow-up.';
  return 'Review follow-up status.';
}

function downloadCSV(history: Followup[]) {
  const header = ['Date', 'Type', 'Status', 'Notes'];
  const rows = history.map(f => [
    format(new Date(f.scheduledFor), 'PPpp'),
    f.type, f.status, f.notes || '',
  ]);
  const csv = [header, ...rows].map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'followup-history.csv'; a.click();
  window.URL.revokeObjectURL(url);
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500', rescheduled: 'bg-sky-500', completed: 'bg-emerald-500', cancelled: 'bg-gray-500',
};

export default function FollowupHistoryModal({ inquiryId, allFollowups, onClose }: Props) {
  const history = useMemo(() =>
    allFollowups.filter(f => f.inquiryId === inquiryId).sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()),
    [allFollowups, inquiryId]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-800">Follow-up History</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {history.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">No follow-up history</div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                {history.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[f.status]}`}></div>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">{format(new Date(f.scheduledFor), 'd MMM')}</span>
                    <span className="text-[9px] text-gray-400 capitalize">{f.status}</span>
                    {i < history.length - 1 && <span className="text-gray-300 text-[10px] mx-1">→</span>}
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Assigned</th>
                      <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((f, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-xs">{format(new Date(f.scheduledFor), 'MMM d, yyyy HH:mm')}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs capitalize">{f.type}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium ${f.status === 'completed' ? 'bg-green-100 text-green-700' : f.status === 'pending' ? 'bg-amber-100 text-amber-700' : f.status === 'rescheduled' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{f.status}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{f.assignedTo ? f.assignedTo.split('@')[0] : '-'}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px] truncate">{f.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between text-xs">
          <span className="text-gray-500"><strong>System:</strong> {getSuggestion(history)}</span>
          <div className="flex gap-2">
            <button onClick={() => downloadCSV(history)} className="px-3 py-1.5 bg-teal-600 text-white text-xs font-medium hover:bg-teal-700">Download CSV</button>
            <button onClick={onClose} className="px-3 py-1.5 border text-xs hover:bg-gray-50">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
