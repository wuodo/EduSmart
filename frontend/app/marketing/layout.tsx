import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionsProvider } from './settings/PermissionsContext';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </PermissionsProvider>
  );
} 