import express from 'express';
import { addMessage, getMessages, markAsRead, getUnreadCount } from '../utils/emailMessageStore';
import { sendTenantEmail } from '../utils/tenantEmailService';
import prisma from '../lib/prisma';

const router = express.Router();

async function generateAdmissionLetterPdf(name: string, course: string, admissionDate: string, reference?: string): Promise<Buffer> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: 0, width, height: 120, color: rgb(0.05, 0.46, 0.53) });
  page.drawText('ADMISSION LETTER', { x: 50, y: height - 80, size: 28, font, color: rgb(1, 1, 1) });

  page.drawText('Date: ' + new Date().toLocaleDateString(), { x: 50, y: height - 160, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('Ref: ' + (reference || 'N/A'), { x: 450, y: height - 160, size: 10, font, color: rgb(0.3, 0.3, 0.3) });

  const lines = [
    '',
    `Dear ${name},`,
    '',
    'We are pleased to inform you that you have been offered admission to the following programme:',
    '',
    `  Course: ${course || 'Not specified'}`,
    `  Admission Date: ${admissionDate}`,
    '',
    'Please report to the admissions office on the above date with the following documents:',
    '  - National ID / Passport',
    '  - KCSE Result Slip / Transcript',
    '  - 2 Passport-size photographs',
    '',
    'Congratulations and welcome aboard!',
    '',
    'Yours sincerely,',
    'Admissions Office',
  ];

  let y = height - 210;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
    y -= line ? 18 : 10;
  }

  page.drawRectangle({ x: 0, y: 0, width, height: 30, color: rgb(0.05, 0.46, 0.53) });
  page.drawText('EduSmart CRM - Admission Letter', { x: 50, y: 8, size: 9, font, color: rgb(1, 1, 1) });

  return Buffer.from(await doc.save());
}

router.post('/send', async (req, res) => {
  try {
    const { to, subject, body, html, inquiryId, reference, admissionDate, course } = req.body || {};
    const tenantId = (req as any).tenantId as number | undefined;
    if (!to || !subject || !body) { res.status(400).json({ error: 'to, subject, body required' }); return; }

    let attachments: { filename: string; content: Buffer; contentType: string }[] = [];

    if (inquiryId || req.body.fullName) {
      const name = req.body.fullName || (await prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { fullName: true } }))?.fullName || 'Student';
      const pdfBuffer = await generateAdmissionLetterPdf(name, course || '', admissionDate || new Date().toLocaleDateString(), reference);
      attachments.push({ filename: `admission-letter-${name.replace(/\s+/g, '-')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' });
    }

    const sent = await sendTenantEmail(to, subject, body, html, tenantId, attachments);

    const msg = addMessage({
      tenantId: tenantId ?? null,
      inquiryId,
      direction: 'outgoing',
      from: '',
      to,
      subject,
      body,
      html,
      status: sent ? 'sent' : 'failed',
      reference,
    });

    res.json({ success: true, sent, message: msg });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/list', (req, res) => {
  const tenantId = (req as any).tenantId as number | undefined;
  const inquiryId = req.query.inquiryId ? Number(req.query.inquiryId) : undefined;
  res.json({ success: true, messages: getMessages(tenantId, inquiryId) });
});

router.get('/unread', (req, res) => {
  const tenantId = (req as any).tenantId as number | undefined;
  res.json({ success: true, count: getUnreadCount(tenantId) });
});

router.put('/:id/read', (req, res) => {
  markAsRead(req.params.id);
  res.json({ success: true });
});

router.post('/inbound', async (req, res) => {
  try {
    const { from, to, subject, text, html } = req.body || {};
    const tenant = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
    addMessage({
      tenantId: tenant?.id ?? null,
      direction: 'incoming',
      from: from || req.body.sender || req.body.from_address || 'unknown',
      to: to || req.body.recipient || '',
      subject: subject || req.body.subject || '(No subject)',
      body: text || req.body.plain || req.body.stripped_text || '',
      html: html || req.body.stripped_html || '',
      status: 'received',
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
