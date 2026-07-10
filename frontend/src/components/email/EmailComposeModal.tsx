"use client";
import { useState } from 'react';
import { X, Send, Paperclip, Loader } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  to: string;
  inquiryName: string;
  inquiryId?: number;
  admissionDate?: string;
  reference?: string;
  course?: string;
};

export default function EmailComposeModal({ open, onClose, to, inquiryName, inquiryId, admissionDate, reference, course }: Props) {
  const [subject, setSubject] = useState(`Admission Letter - ${inquiryName}`);
  const [body, setBody] = useState(
    `Dear ${inquiryName},\n\nCongratulations! Your admission letter is ready.\n\nAdmission Date: ${admissionDate || 'As discussed'}\nReference: ${reference || ''}\n\nPlease contact us if you have any questions.\n\nBest regards,\nAdmissions Office`
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSend = async () => {
    setSending(true); setError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch('/api/proxy/email/send', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          body,
          html: body.replace(/\n/g, '<br>'),
          inquiryId,
          reference,
          admissionDate,
          course,
          fullName: inquiryName,
        }),
      });
      clearTimeout(timeoutId);
      const d = await res.json();
      if (d.success && d.sent) {
        setSent(true);
        setTimeout(() => onClose(), 1500);
      } else {
        setError(d.error || 'SMTP not configured for this tenant');
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      setError(e.name === 'AbortError' ? 'Request timed out after 30s — check SMTP settings' : e.message || 'Network error');
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-800">Send Admission Letter via Email</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </div>
        {sent ? (
          <div className="p-8 text-center text-green-600 font-medium">✓ Email sent successfully! Admission letter PDF attached.</div>
        ) : (
          <>
            <div className="px-4 py-3 space-y-3 flex-1 overflow-y-auto">
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">To</label>
                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={to} readOnly />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Subject</label>
                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Message <span className="text-gray-400">(admission letter PDF attached automatically)</span></label>
                <textarea className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none" rows={8} value={body} onChange={e => setBody(e.target.value)} />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                <Paperclip size={14} /> Attach extra file
                <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" className="hidden" />
              </label>
              <button onClick={handleSend} disabled={sending} className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                {sending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
