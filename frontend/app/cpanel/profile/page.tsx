"use client";
import React from 'react';

function getCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export default function ProfilePage() {
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState('');
  const [tenant, setTenant] = React.useState('');

  React.useEffect(() => {
    setEmail(getCookie('email'));
    setRole(getCookie('role'));
    setTenant(getCookie('tenant'));
  }, []);

  const initials = (email || 'user').split('@')[0].slice(0,2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-btnblue text-white flex items-center justify-center text-lg font-semibold">{initials}</div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
          <p className="text-sm text-gray-600">Manage your cPanel account</p>
        </div>
      </div>

      <div className="bg-white rounded border border-gray-200 p-4">
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Email</div>
            <div className="text-gray-900">{email || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">Role</div>
            <div className="text-gray-900">{role || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">Tenant</div>
            <div className="text-gray-900">{tenant || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}




