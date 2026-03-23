import nodemailer from 'nodemailer'

function hasSmtpConfig(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function getTransport() {
  if (!hasSmtpConfig()) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@edusmart.local'
  const transport = getTransport()
  if (!transport) return false
  await transport.sendMail({ from, to, subject, text, html: html || text })
  return true
}

export async function sendOtpCodeEmail(email: string, code: string): Promise<boolean> {
  const subject = 'Your EduSmart verification code'
  const text = `Your verification code is ${code}. It expires in 10 minutes. If this was not you, ignore this message.`
  const html = `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p><p>If this was not you, ignore this message.</p>`
  return sendEmail(email, subject, text, html)
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  const subject = 'Reset your EduSmart password'
  const text = `Use this link to reset your password: ${resetUrl}\nThis link expires in 30 minutes.`
  const html = `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 30 minutes.</p>`
  return sendEmail(email, subject, text, html)
}

