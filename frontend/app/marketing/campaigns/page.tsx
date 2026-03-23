'use client'

import { usePermissions } from '../settings/PermissionsContext'

export default function CampaignsPage() {
  const perms = usePermissions()
  const canView = perms?.canView?.('campaigns') ?? true
  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">WELCOME TO EDUSMART</h2>
          <p className="text-gray-500">Your current role does not have access to this section.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Campaigns</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-text-heading">Campaigns</h2>
          <p className="mt-2 text-neutral-dark">Campaign management coming soon...</p>
        </div>
      </div>
    </div>
  )
} 