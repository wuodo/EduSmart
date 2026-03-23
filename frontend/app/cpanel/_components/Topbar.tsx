"use client";
import { usePathname } from 'next/navigation';
import React from 'react';

export default function Topbar() {
  const pathname = usePathname();
  const parts = (pathname || '').split('/').filter(Boolean).slice(1);
  const crumbs = ['Cpanel', ...parts.map(p => p[0]?.toUpperCase() + p.slice(1))];
  const [initials, setInitials] = React.useState('SA');

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const cookie = document.cookie;
    const m = cookie.match(/(?:^|; )email=([^;]+)/);
    const email = m ? decodeURIComponent(m[1]) : '';
    if (email) {
      const name = email.split('@')[0] || '';
      const init = name.slice(0, 2).toUpperCase();
      if (init) setInitials(init);
    }
  }, []);

  return (
    <div className="sticky top-0 z-10">
      <div className="bg-topbar px-4 md:px-8 py-2 text-white shadow">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-medium truncate">
            {crumbs.join(' / ')}
          </div>
          <div className="flex items-center gap-3">
            <button aria-label="Notifications" title="Notifications" className="p-2 rounded hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 006 14h12a1 1 0 00.707-1.707L18 11.586V8a6 6 0 00-6-6z"/><path d="M8 16a4 4 0 008 0H8z"/></svg>
            </button>
            <div className="relative group flex items-center gap-2">
              <a href="/cpanel/profile" className="w-8 h-8 rounded-full bg-white text-teal-700 flex items-center justify-center font-semibold" id="cpanel-avatar">
                {initials}
              </a>
              <div className="absolute right-0 top-10 hidden group-hover:block bg-white text-gray-900 rounded border border-gray-200 min-w-[160px] shadow-lg">
                <a href="/cpanel/profile" className="block px-4 py-2 hover:bg-gray-50">Profile</a>
                <button onClick={()=>{ 
                  // Clear all authentication cookies
                  document.cookie = 'isAuthenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                  document.cookie = 'role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                  document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                  document.cookie = 'email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                  document.cookie = 'tenant=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                  // Redirect to cpanel login
                  location.href='/cpanel';
                }} className="w-full text-left px-4 py-2 hover:bg-gray-50">Logout</button>
              </div>
              <button onClick={()=>{ 
                // Clear all authentication cookies
                document.cookie = 'isAuthenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                document.cookie = 'role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                document.cookie = 'email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                document.cookie = 'tenant=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                // Redirect to cpanel login
                location.href='/cpanel';
              }} title="Logout" className="p-2 rounded hover:bg-white/10" aria-label="Logout">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 3a1 1 0 011 1v4a1 1 0 11-2 0V5H7a1 1 0 00-1 1v12a1 1 0 001 1h2v-3a1 1 0 112 0v4a1 1 0 01-1 1H7a3 3 0 01-3-3V6a3 3 0 013-3h3z"/><path d="M15.293 7.293a1 1 0 011.414 0L21 11.586a1 1 0 010 1.414l-4.293 4.293a1 1 0 01-1.414-1.414L17.586 13H11a1 1 0 110-2h6.586l-2.293-2.293a1 1 0 010-1.414z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


