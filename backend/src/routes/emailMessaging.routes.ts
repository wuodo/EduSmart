import express from 'express';
import { addMessage, getMessages, markAsRead, getUnreadCount } from '../utils/emailMessageStore';
import { sendTenantEmail } from '../utils/tenantEmailService';
import prisma from '../lib/prisma';

const router = express.Router();

router.post('/send', async (req, res) => {
  try {
    const { to, subject, body, html, inquiryId, reference, attachmentUrl } = req.body || {};
    const tenantId = (req as any).tenantId as number | undefined;
    if (!to || !subject || !body) { res.status(400).json({ error: 'to, subject, body required' }); return; }

    const sent = await sendTenantEmail(to, subject, body, html, tenantId);

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
      attachmentUrl,
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
