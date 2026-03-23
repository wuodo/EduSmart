import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionsProvider } from '../marketing/settings/PermissionsContext'

export default function RegistrationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </PermissionsProvider>
  )
}
