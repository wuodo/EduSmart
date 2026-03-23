import { useMemo } from 'react';
import { format } from 'date-fns';
import { Followup } from '@/types/followup';
import {
  modalOverlayClass,
  modalPanelClass,
  modalHeaderClass,
  modalTitleClass,
  modalCloseButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/styles/modalForm'

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
  const header = ['Scheduled For', 'Type', 'Status', 'Assigned To', 'Notes', 'Created By', 'Created At', 'Updated At'];
  const rows = history.map(f => [
    format(new Date(f.scheduledFor), 'PPpp'),
    f.type,
    f.status,
    f.assignedTo,
    f.notes || '',
    f.createdBy,
    format(new Date(f.createdAt), 'PPpp'),
    format(new Date(f.updatedAt), 'PPpp'),
  ]);
  const csv = [header, ...rows].map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'followup-history.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function FollowupHistoryModal({ inquiryId, allFollowups, onClose }: Props) {
  const history = useMemo(() =>
    allFollowups.filter(f => f.inquiryId === inquiryId).sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()),
    [allFollowups, inquiryId]
  );

  // For the horizontal timeline
  const statusColors = {
    pending: 'bg-amber-500',
    rescheduled: 'bg-sky-500',
    completed: 'bg-emerald-500',
    cancelled: 'bg-gray-500',
  };

  return (
    <div className={modalOverlayClass}>
      <div className={`${modalPanelClass} max-w-3xl w-[90vw]`}>
        <div className={modalHeaderClass}>
          <h2 className={modalTitleClass}>Follow-up History</h2>
          <button onClick={onClose} className={modalCloseButtonClass} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mb-4 overflow-x-auto">
          <div className="flex items-center space-x-8 min-w-[400px]" style={{ paddingBottom: 24 }}>
            {history.map((f, i) => (
              <div key={i} className="flex flex-col items-center min-w-[80px]">
                <div className="flex items-center">
                  <div className={`w-5 h-5 rounded-full border-2 border-white shadow ${statusColors[f.status]}`}></div>
                  {i < history.length - 1 && (
                    <div className="h-1 w-12 bg-neutral-300 mx-1" />
                  )}
                </div>
                <div className="text-xs mt-2 text-neutral-dark whitespace-nowrap">{format(new Date(f.scheduledFor), 'MMM d, yyyy')}</div>
                <div className="text-xs mt-1 font-semibold capitalize text-neutral-700">{f.status}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto mb-4">
          <table className="min-w-full divide-y divide-neutral-light">
            <thead className="bg-neutral-light/30">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Scheduled For</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Assigned To</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Notes</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Created By</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Created At</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-dark uppercase tracking-wider">Updated At</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-light">
              {history.map((f, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{format(new Date(f.scheduledFor), 'PPpp')}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{f.type}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{f.status}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{f.assignedTo}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{f.notes}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{f.createdBy}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{format(new Date(f.createdAt), 'PPpp')}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm">{format(new Date(f.updatedAt), 'PPpp')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mb-4">
          <strong>System Suggestion:</strong> {getSuggestion(history)}
        </div>
        <div className="flex justify-end gap-4">
          <button
            className={primaryButtonClass}
            onClick={() => downloadCSV(history)}
          >
            Download as Excel
          </button>
          <button
            className={secondaryButtonClass}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 