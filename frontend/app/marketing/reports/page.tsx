'use client'

import MarketingReports from './MarketingReports'
import { usePermissions } from '../settings/PermissionsContext'

export default function MarketingReportsPage() {
  const perms = usePermissions()
  const canView = perms?.canView?.('reports') ?? true
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
  return <MarketingReports />
} 