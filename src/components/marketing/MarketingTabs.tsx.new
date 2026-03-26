import { useState, useEffect } from 'react';

// Inline the Inquiry type definition
type Inquiry = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  createdAt: Date;
};

type Followup = {
  id: string;
  status: string;
  type: string;
  notes: string;
  createdAt: Date;
};

export default function MarketingTabs() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [followupStatus, setFollowupStatus] = useState('');
  const [followupType, setFollowupType] = useState('');
  const [followupSearch, setFollowupSearch] = useState('');

  // Example: fetch inquiries on mount (replace with your actual fetch logic)
  useEffect(() => {
    // fetch('...').then(...)
    setInquiries([]); // placeholder
    setFollowups([]); // placeholder
  }, []);

  // Defensive: always use arrays for filtering
  let safeInquiries: Inquiry[] = [];
  if (Array.isArray(inquiries)) {
    safeInquiries = inquiries;
  } else if (inquiries && typeof inquiries === 'object' && Array.isArray((inquiries as any).data)) {
    safeInquiries = (inquiries as any).data;
  }

  let safeFollowups: Followup[] = [];
  if (Array.isArray(followups)) {
    safeFollowups = followups;
  } else if (followups && typeof followups === 'object' && Array.isArray((followups as any).data)) {
    safeFollowups = (followups as any).data;
  }

  // Filter inquiries based on status, source, and search
  const filteredInquiries = safeInquiries.filter(inquiry => {
    console.log('Filtering inquiry:', inquiry); // Debug log
    const matchesStatus = !status || inquiry.status === status;
    const matchesSource = !source || inquiry.source === source;
    const matchesSearch = !search || (
      inquiry.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      inquiry.email?.toLowerCase().includes(search.toLowerCase()) ||
      inquiry.phone?.toLowerCase().includes(search.toLowerCase())
    );
    return matchesStatus && matchesSource && matchesSearch;
  });

  // Filter followups based on status, type, and search
  const filteredFollowups = safeFollowups.filter(fu => {
    const matchesStatus = !followupStatus || fu.status === followupStatus;
    const matchesType = !followupType || fu.type === followupType;
    const searchLower = followupSearch.toLowerCase();
    const matchesSearch = !followupSearch || 
      fu.notes?.toLowerCase().includes(searchLower);
    return matchesStatus && matchesType && matchesSearch;
  });

  // ...rest of your component rendering logic
  return null;
} 