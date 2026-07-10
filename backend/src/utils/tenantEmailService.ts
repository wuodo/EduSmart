import nodemailer from 'nodemailer'
import prisma from '../lib/prisma'
import { mergeTenantCrmSettings, validateSmtpConfig } from './tenantCrmSettings'

function getGlobalTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

export async function getTransportForTenant(tenantId?: number | null) {
  if (!tenantId) return getGlobalTransport()
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return getGlobalTransport()
    const settings = mergeTenantCrmSettings(tenant.crmSettings)
    const smtp = validateSmtpConfig(settings.smtpConfig)
    if (!smtp) return getGlobalTransport()
    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    })
  } catch {
    return getGlobalTransport()
  }
}

export async function sendTenantEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
  tenantId?: number | null,
): Promise<boolean> {
  const transport = await getTransportForTenant(tenantId)
  if (!transport) return false

  const resolvedFrom = await (async () => {
    if (!tenantId) return process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@edusmart.local'
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { crmSettings: true } })
    if (!tenant) return process.env.SMTP_FROM || 'no-reply@edusmart.local'
    const settings = mergeTenantCrmSettings(tenant.crmSettings)
    const smtp = validateSmtpConfig(settings.smtpConfig)
    return smtp?.from || smtp?.user || process.env.SMTP_FROM || 'no-reply@edusmart.local'
  })()

  await transport.sendMail({ from: resolvedFrom, to, subject, text, html: html || text })
  return true
}
