import { NextRequest, NextResponse } from 'next/server'

function resolveBackendBase() {
	// Prefer explicit server-only backend URL, fall back to public URL if needed
	let base =
		process.env.BACKEND_API_URL ||
		process.env.NEXT_PUBLIC_API_URL ||
		'http://localhost:5000'

	// Guardrail: proxy must not point to the Next dev server
	if (base.includes('localhost:3000') || base.endsWith(':3000')) {
		base = 'http://localhost:5000'
	}
	// Normalize: strip trailing slash
	base = base.replace(/\/+$/, '')
	// Normalize: if someone configured ".../api", strip it (we add /api below)
	base = base.replace(/\/api$/, '')
	return base
}

// Resolve per-request in case env changes during dev
function backendBase() {
	return resolveBackendBase()
}

function forwardHeaders(req: NextRequest) {
	const h: Record<string, string> = {}
	const auth = req.headers.get('authorization')
	const cookie = req.headers.get('cookie')
	let tenant = req.headers.get('x-tenant') || ''
	if (!tenant) {
		const cookieTenant = req.cookies.get('tenant')?.value
		if (cookieTenant) tenant = cookieTenant
	}
	if (auth) h['authorization'] = auth
	if (tenant) h['x-tenant'] = tenant
	if (cookie) h['cookie'] = cookie
	return h
}

const DEFAULT_BRANDING = { success: true, branding: { primaryColor: '#0d9488', secondaryColor: '#14b8a6', accentColor: '#5eead4' } }

function resolvePath(req: NextRequest, params?: { rest?: string[] }) {
	// Prefer deriving from URL to avoid catch-all param edge cases
	const raw = new URL(req.url).pathname || ''
	const prefix = '/api/proxy/'
	if (raw.startsWith(prefix)) {
		return raw.slice(prefix.length)
	}
	// Fallback to params
	return (params?.rest || []).join('/')
}

export async function GET(req: NextRequest, { params }: { params: { rest: string[] } }) {
	const path = resolvePath(req, params)
	const search = req.nextUrl.search || ''
	const BACKEND = backendBase()
	const base = path.startsWith('assets/') ? `${BACKEND}/` : `${BACKEND}/api/`
	let res: Response
	try {
		res = await fetch(`${base}${path}${search}`, { cache: 'no-store', headers: forwardHeaders(req) })
		// Fallback for tenants/me/branding when backend returns 404 (e.g. backend down or no tenant)
		if (!res.ok && path === 'tenants/me/branding') {
			return NextResponse.json(DEFAULT_BRANDING, { status: 200 })
		}
	} catch (_err) {
		if (path === 'tenants/me/branding') {
			return NextResponse.json(DEFAULT_BRANDING, { status: 200 })
		}
		return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 })
	}
	const arrayBuffer = await res.arrayBuffer()
	const contentType = res.headers.get('content-type') || 'application/octet-stream'
	const contentDisposition = res.headers.get('content-disposition') || undefined
	const response = new NextResponse(arrayBuffer, {
		status: res.status,
		headers: {
			'Content-Type': contentType,
			...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {})
		}
	})
	// Forward Set-Cookie headers for session persistence
	const setCookie = res.headers.get('set-cookie')
	if (setCookie) response.headers.set('set-cookie', setCookie)
	return response
}

export async function POST(req: NextRequest, { params }: { params: { rest: string[] } }) {
	const path = resolvePath(req, params)
	const body = await req.arrayBuffer()
	const BACKEND = backendBase()
	const base = path.startsWith('assets/') ? `${BACKEND}/` : `${BACKEND}/api/`
	try {
		const res = await fetch(`${base}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': req.headers.get('content-type') || 'application/json', ...forwardHeaders(req) },
			body
		})
		const arrayBuffer = await res.arrayBuffer()
		const contentType = res.headers.get('content-type') || 'application/json'
		const contentDisposition = res.headers.get('content-disposition') || undefined
		const response = new NextResponse(arrayBuffer, {
			status: res.status,
			headers: {
				'Content-Type': contentType,
				...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {})
			}
		})
		const setCookie = res.headers.get('set-cookie')
		if (setCookie) response.headers.set('set-cookie', setCookie)
		return response
	} catch {
		return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 })
	}
}

export async function PUT(req: NextRequest, { params }: { params: { rest: string[] } }) {
	const path = resolvePath(req, params)
	const body = await req.arrayBuffer()
	const BACKEND = backendBase()
	const base = path.startsWith('assets/') ? `${BACKEND}/` : `${BACKEND}/api/`
	try {
		const res = await fetch(`${base}${path}`, {
			method: 'PUT',
			headers: { 'Content-Type': req.headers.get('content-type') || 'application/json', ...forwardHeaders(req) },
			body
		})
		const arrayBuffer = await res.arrayBuffer()
		const contentType = res.headers.get('content-type') || 'application/json'
		const contentDisposition = res.headers.get('content-disposition') || undefined
		const response = new NextResponse(arrayBuffer, {
			status: res.status,
			headers: {
				'Content-Type': contentType,
				...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {})
			}
		})
		const setCookie = res.headers.get('set-cookie')
		if (setCookie) response.headers.set('set-cookie', setCookie)
		return response
	} catch {
		return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 })
	}
}

export async function PATCH(req: NextRequest, { params }: { params: { rest: string[] } }) {
	const path = resolvePath(req, params)
	const body = await req.arrayBuffer()
	const BACKEND = backendBase()
	const base = path.startsWith('assets/') ? `${BACKEND}/` : `${BACKEND}/api/`
	try {
		const res = await fetch(`${base}${path}`, {
			method: 'PATCH',
			headers: { 'Content-Type': req.headers.get('content-type') || 'application/json', ...forwardHeaders(req) },
			body
		})
		const arrayBuffer = await res.arrayBuffer()
		const contentType = res.headers.get('content-type') || 'application/json'
		const response = new NextResponse(arrayBuffer, {
			status: res.status,
			headers: { 'Content-Type': contentType }
		})
		const setCookie = res.headers.get('set-cookie')
		if (setCookie) response.headers.set('set-cookie', setCookie)
		return response
	} catch {
		return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 })
	}
}

export async function DELETE(req: NextRequest, { params }: { params: { rest: string[] } }) {
	const path = resolvePath(req, params)
	const search = req.nextUrl.search || ''
	const BACKEND = backendBase()
	const base = path.startsWith('assets/') ? `${BACKEND}/` : `${BACKEND}/api/`
	try {
		const res = await fetch(`${base}${path}${search}`, { method: 'DELETE', headers: forwardHeaders(req) })
		const arrayBuffer = await res.arrayBuffer()
		const contentType = res.headers.get('content-type') || 'application/json'
		const response = new NextResponse(arrayBuffer, {
			status: res.status,
			headers: { 'Content-Type': contentType }
		})
		const setCookie = res.headers.get('set-cookie')
		if (setCookie) response.headers.set('set-cookie', setCookie)
		return response
	} catch {
		return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 })
	}
} 