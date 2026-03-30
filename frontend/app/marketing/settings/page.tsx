import { Suspense } from 'react'
import MarketingSettingsClient from './MarketingSettingsClient'

export default function MarketingSettingsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading settings…</div>}>
      <MarketingSettingsClient />
    </Suspense>
  )
}