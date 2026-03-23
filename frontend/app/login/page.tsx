import { redirect } from 'next/navigation';

/** Tenant app login lives at /. (Cpanel is at /cpanel only.) */
export default function Page() {
  redirect('/');
}