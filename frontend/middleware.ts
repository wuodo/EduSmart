import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.get('isAuthenticated')?.value === 'true';
  const isLoginPage = request.nextUrl.pathname === '/login';
  const isCpanelLoginPage = request.nextUrl.pathname === '/cpanel';
  const isRootPage = request.nextUrl.pathname === '/';
  const isForgotPage = request.nextUrl.pathname === '/forgot-password';
  const isResetPage = request.nextUrl.pathname === '/reset-password';
  const path = request.nextUrl.pathname;

  // Drop legacy "/marketing" module prefix (keep bookmarks working).
  // Some pages still only exist under /marketing/* (no top-level route); do not rewrite those
  // or they match app/[tenant] (e.g. /campaigns -> tenant "campaigns" -> /campaigns/login -> wrong screen).
  const keepMarketingPrefix =
    path === '/marketing/campaigns' ||
    path.startsWith('/marketing/campaigns/') ||
    path === '/marketing/chat' ||
    path.startsWith('/marketing/chat/');
  if ((path === '/marketing' || path.startsWith('/marketing/')) && !keepMarketingPrefix) {
    const nextPath = path === '/marketing' ? '/inquiries' : path.replace(/^\/marketing/, '');
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  // Allow access to cpanel login page without authentication
  if (isCpanelLoginPage) {
    return NextResponse.next();
  }

  // Allow access to root page (tenant login) without authentication
  if (isRootPage) {
    return NextResponse.next();
  }

  // Allow forgot/reset password without authentication
  if (isForgotPage || isResetPage) {
    return NextResponse.next();
  }

  // Protect cpanel routes (except login page)
  if (path.startsWith('/cpanel/') && !isAuthenticated) {
    return NextResponse.redirect(new URL('/cpanel', request.url));
  }

  // If not authenticated and not on public pages, redirect to root (user login)
  if (!isAuthenticated && !isLoginPage && !isRootPage && !isForgotPage && !isResetPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If authenticated and on login page, redirect to app.
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If visiting root "/" and authenticated, redirect to app.
  if (isAuthenticated && isRootPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Gate admin-only pages using backend session role (not client role cookie)
  const adminOnlyPaths = ['/dashboard/branding'];
  if (isAuthenticated && adminOnlyPaths.some(p => path.startsWith(p))) {
    try {
      const meUrl = new URL('/api/proxy/users/me', request.url);
      const meRes = await fetch(meUrl.toString(), {
        cache: 'no-store',
        headers: { cookie: request.headers.get('cookie') || '' },
      });
      const me = await meRes.json().catch(() => null);
      const role = String(me?.role || '').toLowerCase();
      if (!meRes.ok || role !== 'admin') {
        return NextResponse.redirect(new URL('/inquiries', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/inquiries', request.url));
    }
  }

  // If tenant is suspended, force logout + redirect to login.
  // The check is cached in a short-lived cookie (tenantOk=1, TTL 2 min) so it fires
  // at most once per 2 minutes instead of on every single page navigation.
  const shouldCheckTenant = isAuthenticated && !isLoginPage && !isRootPage && !path.startsWith('/cpanel');
  if (shouldCheckTenant) {
    const alreadyVerified = request.cookies.get('tenantOk')?.value === '1';
    if (!alreadyVerified) {
      try {
        const url = new URL('/api/proxy/tenants/me', request.url);
        const res = await fetch(url.toString(), {
          cache: 'no-store',
          headers: { cookie: request.headers.get('cookie') || '' },
        });
        const data = await res.json().catch(() => null);
        const isActive = data?.tenant?.isActive;

        if (!res.ok || data?.success === false || isActive === false) {
          const r = NextResponse.redirect(new URL('/', request.url));
          r.cookies.delete('isAuthenticated');
          r.cookies.delete('role');
          r.cookies.delete('tenantOk');
          return r;
        }
        // Cache the positive result — avoids a backend call on every page for 2 minutes
        const next = NextResponse.next();
        next.cookies.set('tenantOk', '1', {
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 120, // 2 minutes
        });
        return next;
      } catch {
        // If check fails, don't block the user.
      }
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder and images
     * - api routes (to avoid intercepting POST /api/auth/login and others)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|images).*)',
  ],
};
