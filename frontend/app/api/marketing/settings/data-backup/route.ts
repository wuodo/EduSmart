import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000'

function filename(prefix: string) {
	const ts = new Date().toISOString().replace(/[:.]/g, '-')
	return `${prefix}-${ts}.json`
}

function forwardHeaders(req: NextRequest) {
	const h: Record<string, string> = {}
	const cookie = req.headers.get('cookie')
	const tenant = req.headers.get('x-tenant')
	if (tenant) h['x-tenant'] = tenant
	if (cookie) h['cookie'] = cookie
	return h
}

async function fetchJson(path: string, headers: Record<string,string>) {
	const res = await fetch(`${BACKEND}${path}`, { headers, cache: 'no-store' })
	if (!res.ok) throw new Error(`Failed: ${path}`)
	return res.json()
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url)
		const type = (searchParams.get('type') || '').toLowerCase()

		const headers = forwardHeaders(req)

		if (type === 'system') {
			const [inquiries, followups, students, programs, auditLogs, users] = await Promise.all([
				fetchJson('/api/inquiries', headers).catch(() => []),
				fetchJson('/api/followups', headers).catch(() => []),
				fetchJson('/api/students', headers).catch(() => []),
				fetchJson('/api/programs', headers).catch(() => []),
				fetchJson('/api/audit-logs?page=1&limit=1000', headers).catch(() => ({ logs: [] })),
				fetchJson('/api/users', headers).catch(() => [])
			])
			const payload = {
				meta: { generatedAt: new Date().toISOString() },
				inquiries,
				followups,
				students,
				programs,
				auditLogs,
				users
			}
			const body = JSON.stringify(payload, null, 2)
			return new NextResponse(body, {
				status: 200,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Content-Disposition': `attachment; filename="${filename('system-backup')}"`
				}
			})
		}

		let path = ''
		switch (type) {
			case 'inquiries': path = '/api/inquiries'; break
			case 'followups': path = '/api/followups'; break
			case 'students': path = '/api/students'; break
			case 'programs': path = '/api/programs'; break
			case 'audit-logs': path = '/api/audit-logs?page=1&limit=1000'; break
			case 'users': path = '/api/users'; break
			case 'admission-letters': path = '/api/admission-letters'; break
			case 'registrations': path = '/api/registrations'; break
			default:
				return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
		}

		const res = await fetch(`${BACKEND}${path}`, { headers, cache: 'no-store' })
		if (!res.ok) {
			return NextResponse.json({ error: `Failed to export ${type}` }, { status: res.status })
		}
		const data = await res.json()
		const body = JSON.stringify(data, null, 2)

		return new NextResponse(body, {
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename(type || 'export')}"`
			}
		})
	} catch (e) {
		return NextResponse.json({ error: 'Export error' }, { status: 500 })
	}
}

export async function POST(req: NextRequest) {
	// Import/restore
	try {
		const { searchParams } = new URL(req.url)
		const type = (searchParams.get('type') || '').toLowerCase()
		const headers = forwardHeaders(req)
		const body = await req.text()
		let path = ''
		switch (type) {
			case 'inquiries': path = '/api/import/inquiries'; break
			case 'followups': path = '/api/import/followups'; break
			case 'students': path = '/api/import/students'; break
			case 'programs': path = '/api/import/programs'; break
			case 'users': path = '/api/import/users'; break
			case 'admission-letters': path = '/api/import/admission-letters'; break
			case 'registrations': path = '/api/import/registrations'; break
			case 'system': path = '/api/import/system'; break
			default:
				return NextResponse.json({ error: 'Unknown import type' }, { status: 400 })
		}
		const res = await fetch(`${BACKEND}${path}`, {
			method: 'POST',
			headers: { ...headers, 'Content-Type': 'application/json' },
			body
		})
		if (!res.ok) {
			return NextResponse.json({ error: `Failed to import ${type}` }, { status: res.status })
		}
		const result = await res.json()
		return NextResponse.json({ success: true, result })
	} catch (e) {
		return NextResponse.json({ error: 'Import error' }, { status: 500 })
	}
}
