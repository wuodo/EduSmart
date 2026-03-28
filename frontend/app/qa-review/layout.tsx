import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionsProvider } from '../marketing/settings/PermissionsContext'

export default function QaReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </PermissionsProvider>
  )
}
