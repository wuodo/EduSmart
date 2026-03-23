import { redirect } from 'next/navigation';

export default function TenantRoot({ params }: { params: { tenant: string } }) {
  redirect(`/${params.tenant}/login`);
}











