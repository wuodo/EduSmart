import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { WEB_API } from '@/utils/api';
import {
  modalOverlayClass,
  modalPanelClass,
  modalHeaderClass,
  modalTitleClass,
  modalCloseButtonClass,
  inputClass,
  textareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/styles/modalForm'

function userHeaders() {
  if (typeof window === 'undefined') return {} as any;
  const tenant = (() => { try { const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } })() || localStorage.getItem('tenant') || '';
  return (tenant ? { 'x-tenant': tenant } : {}) as Record<string, string>;
}

interface Comment {
  _id: string;
  author: string;
  message: string;
  createdAt: string;
}

interface Props {
  followupId: string;
  onClose: () => void;
}

export default function FollowupCommentsModal({ followupId, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMsg, setNewMsg] = useState('');
  const [author, setAuthor] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState('');

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${WEB_API}/followup-comments/${followupId}/comments`, { headers: userHeaders(), credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || String(res.status));
      setComments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch comments', e);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComments(); }, [followupId]);

  const handleAdd = async () => {
    if (!author || !newMsg) return;
    const res = await fetch(`${WEB_API}/followup-comments/${followupId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeaders() },
      credentials: 'include',
      body: JSON.stringify({ author, message: newMsg }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('Failed to add comment: ' + (data?.error || data?.message || res.status));
      return;
    }
    setNewMsg('');
    fetchComments();
  };

  const handleEdit = async (id: string) => {
    const res = await fetch(`${WEB_API}/followup-comments/${followupId}/comments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...userHeaders() },
      credentials: 'include',
      body: JSON.stringify({ message: editMsg }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('Failed to update comment: ' + (data?.error || data?.message || res.status));
      return;
    }
    setEditingId(null);
    setEditMsg('');
    fetchComments();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`${WEB_API}/followup-comments/${followupId}/comments/${id}`, { method: 'DELETE', headers: userHeaders(), credentials: 'include' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('Failed to delete comment: ' + (data?.error || data?.message || res.status));
      return;
    }
    fetchComments();
  };

  return (
    <div className={modalOverlayClass}>
      <div className={`${modalPanelClass} max-w-lg`}>
        <div className={modalHeaderClass}>
          <h2 className={modalTitleClass}>Follow-up Comments</h2>
          <button onClick={onClose} className={modalCloseButtonClass} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mb-4 max-h-64 overflow-y-auto space-y-4">
          {loading ? (
            <div>Loading...</div>
          ) : comments.length === 0 ? (
            <div className="text-neutral-500">No comments yet.</div>
          ) : (
            comments.map((c) => (
              <div key={c._id} className="border rounded p-2 flex flex-col bg-neutral-light/40">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-primary">{c.author}</span>
                  <span className="text-xs text-neutral-500">{format(new Date(c.createdAt), 'PPpp')}</span>
                </div>
                {editingId === c._id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      className={textareaClass}
                      value={editMsg}
                      onChange={e => setEditMsg(e.target.value)}
                    />
                    <div className="flex gap-2 mt-1">
                      <button className={primaryButtonClass} onClick={() => handleEdit(c._id)}>Save</button>
                      <button className={secondaryButtonClass} onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm whitespace-pre-wrap mb-1">{c.message}</div>
                    <div className="flex gap-2 text-xs">
                      <button className="text-blue-600 hover:underline" onClick={() => { setEditingId(c._id); setEditMsg(c.message); }}>Edit</button>
                      <button className="text-rose-500 hover:underline" onClick={() => handleDelete(c._id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="border-t pt-4 mt-4">
          <h3 className="text-base font-semibold mb-2">Add Comment</h3>
          <input
            className={`${inputClass} mb-2`}
            placeholder="Your name"
            value={author}
            onChange={e => setAuthor(e.target.value)}
          />
          <textarea
            className={`${textareaClass} mb-2`}
            placeholder="Type your comment..."
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button className={primaryButtonClass} onClick={handleAdd} disabled={!author || !newMsg}>Add Comment</button>
            <button className={secondaryButtonClass} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
} 