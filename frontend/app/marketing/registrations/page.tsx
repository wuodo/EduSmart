'use client';

import RegistrationsList from '@/components/marketing/RegistrationsList';
import { useMarketingData } from '@/hooks/useMarketingData';
import { useEffect, useMemo, useState } from 'react';
import { WEB_API } from '@/utils/api';
import { usePermissions } from '../settings/PermissionsContext'

export default function RegistrationsPage() {
  const { inquiries, loading, refreshInquiries } = useMarketingData();
  const perms = usePermissions()
  const canView = perms?.canView?.('registrations') ?? true

  const [owner, setOwner] = useState('');
  const [owners, setOwners] = useState<{ label: string; value: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const role = typeof window !== 'undefined' ? (localStorage.getItem('userRole') || '').toLowerCase() : ''
    const admin = role === 'admin' || role === 'senior_staff'
    setIsAdmin(admin)
    if (admin) {
      fetch(`${WEB_API}/users`, { cache: 'no-store' })
        .then(r => r.json())
        .then((users: any[]) => {
          const list = users
            .filter(u => (u.role === 'admissions_officer' || u.role === 'senior_staff' || u.role === 'admin'))
            .map(u => ({ label: (u.name && String(u.name).trim()) ? String(u.name) : String(u.email), value: String(u.email) }))
          setOwners(list)
        })
        .catch(() => setOwners([]))
    }
  }, [])

  useEffect(() => {
    if (isAdmin) refreshInquiries(owner || undefined)
  }, [owner, isAdmin])

  // Only show inquiries with paymentStatus === 'Paid'
  const paidRegistrations = useMemo(() =>
    inquiries
      .filter(i => i.paymentStatus === 'Paid')
      .map(i => ({
        id: i.id,
        fullName: i.fullName,
        phone: i.phone,
        programOfInterest: i.programOfInterest,
        paymentCode: i.paymentCode,
        paymentDate: i.paymentDate,
      })),
    [inquiries]
  );

  const selectedOwnerLabel = owner ? (owners.find(o => o.value === owner)?.label || owner) : 'All Users';

  return (
    <div className="p-4 sm:p-6">
      {!canView ? (
        <div className="flex items-center justify-center min-h-[60vh] text-center">
          <div>
            <h2 className="text-2xl font-bold mb-2">WELCOME TO EDUSMART</h2>
            <p className="text-gray-500">Your current role does not have access to this section.</p>
          </div>
        </div>
      ) : (
        <>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading registrations...</div>
          ) : (
            <RegistrationsList
              registrations={paidRegistrations}
              inquiries={inquiries}
              ownerLabel={selectedOwnerLabel}
              showOwnerFilter={isAdmin}
              owners={owners}
              ownerValue={owner}
              onOwnerChange={setOwner}
            />
          )}
        </>
      )}
    </div>
  );
} 