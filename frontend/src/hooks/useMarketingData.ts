import { useState, useEffect } from 'react';
import { Inquiry } from '@/types/inquiry';
import { Followup } from '@/types/followup';
import { WEB_API } from '@/utils/api';

function userHeaders() {
  if (typeof window === 'undefined') return {} as any;
  const tenant = (() => { try { const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } })() || localStorage.getItem('tenant') || '';
  return (tenant ? { 'x-tenant': tenant } : {}) as Record<string, string>;
}

export function useMarketingData() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [hasRetriedInquiries, setHasRetriedInquiries] = useState(false);

  const upsertInquiry = (inquiry: Inquiry) => {
    setInquiries(prev => {
      const id = (inquiry as any)?.id;
      if (id === undefined || id === null) return [inquiry, ...prev];
      const idStr = String(id);
      const without = prev.filter(i => String((i as any)?.id) !== idStr);
      return [inquiry, ...without];
    });
  };

  // Fetch inquiries from backend
  const refreshInquiries = async (owner?: string) => {
    setLoading(true);
    try {
      const url = owner ? `${WEB_API}/inquiries?owner=${encodeURIComponent(owner)}` : `${WEB_API}/inquiries`;
      const res = await fetch(url, { cache: 'no-store', headers: userHeaders(), credentials: 'include' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Error fetching inquiries HTTP', res.status, text.slice(0, 200));
        // Keep existing data on transient backend/proxy errors to avoid blank pages
        // (prevents "table becomes empty until user navigates away/back")
        return;
      }
      const data = await res.json().catch(() => []);
      setInquiries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching inquiries:', err);
      // Keep existing data on transient errors
    } finally {
      setLoading(false);
    }
  };

  // Fetch follow-ups from backend
  const refreshFollowups = async (owner?: string) => {
    setFollowupLoading(true);
    try {
      const url = owner ? `${WEB_API}/followups?owner=${encodeURIComponent(owner)}` : `${WEB_API}/followups`;
      const res = await fetch(url, { headers: userHeaders(), credentials: 'include' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Error fetching followups HTTP', res.status, text.slice(0, 200));
        // Keep existing data on transient backend/proxy errors
        return;
      }
      const data = await res.json().catch(() => []);
      setFollowups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching followups:', err);
      // Keep existing data on transient errors
    } finally {
      setFollowupLoading(false);
    }
  };

  useEffect(() => {
    refreshInquiries();
    refreshFollowups();
  }, []);

  // Safety net: if the first load returns no inquiries (often due to
  // cookies/tenant/session not being ready yet), automatically retry once
  // instead of forcing the user to leave and come back.
  useEffect(() => {
    if (!loading && inquiries.length === 0 && !hasRetriedInquiries) {
      setHasRetriedInquiries(true);
      refreshInquiries();
    }
  }, [loading, inquiries.length, hasRetriedInquiries]);

  return {
    inquiries,
    followups,
    loading,
    followupLoading,
    refreshInquiries,
    refreshFollowups,
    upsertInquiry,
  };
} 