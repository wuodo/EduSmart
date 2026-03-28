import crypto from 'crypto'
import type { TenantCrmWebhook } from './tenantCrmSettings'

function sign(secret: string, body: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

export async function dispatchTenantWebhooks(
  hooks: TenantCrmWebhook[] | undefined,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!hooks?.length) return
  const bodyStr = JSON.stringify({ event, payload, ts: new Date().toISOString() })
  for (const h of hooks) {
    if (!h.active || !h.url || !h.events?.includes(event)) continue
    try {
      const sig = sign(h.secret || 'changeme', bodyStr)
      await fetch(h.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Edusmart-Signature': sig,
          'X-Edusmart-Event': event,
        },
        body: bodyStr,
      }).catch(() => {})
    } catch {
      /* non-fatal */
    }
  }
}
