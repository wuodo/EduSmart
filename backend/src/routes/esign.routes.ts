import express from 'express';
import prisma from '../lib/prisma';
import { mergeTenantCrmSettings } from '../utils/tenantCrmSettings';

const router = express.Router();

router.get('/letter/:reference', async (req, res) => {
  try {
    const ref = req.params.reference;
    const inquiry = await prisma.inquiry.findFirst({
      where: { OR: [{ letterReferenceNumber: ref }, { letterSerialNumber: ref }] },
      include: { tenant: { select: { name: true, crmSettings: true, primaryColor: true } }, detail: true },
    });
    if (!inquiry) { res.status(404).json({ error: 'Letter not found' }); return; }

    const settings = mergeTenantCrmSettings(inquiry.tenant?.crmSettings);
    const esignEnabled = settings.featureToggles?.enableESignature;

    res.json({
      success: true,
      letter: {
        id: inquiry.id, fullName: inquiry.fullName,
        referenceNumber: inquiry.letterReferenceNumber,
        serialNumber: inquiry.letterSerialNumber,
        status: inquiry.letterStatus,
        programOfInterest: inquiry.programOfInterest,
        createdAt: inquiry.createdAt,
        signedAt: inquiry.paymentDate,
      },
      tenant: { name: inquiry.tenant?.name, primaryColor: inquiry.tenant?.primaryColor },
      esignEnabled,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/letter/:reference/sign', async (req, res) => {
  try {
    const ref = req.params.reference;
    const { fullName } = req.body || {};

    const inquiry = await prisma.inquiry.findFirst({
      where: { OR: [{ letterReferenceNumber: ref }, { letterSerialNumber: ref }] },
      include: { tenant: { select: { crmSettings: true } } },
    });
    if (!inquiry) { res.status(404).json({ error: 'Letter not found' }); return; }

    const settings = mergeTenantCrmSettings(inquiry.tenant?.crmSettings);
    if (!settings.featureToggles?.enableESignature) { res.status(403).json({ error: 'E-signature disabled' }); return; }
    if (inquiry.letterStatus === 'Signed') { res.status(400).json({ error: 'Already signed' }); return; }

    await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: { letterStatus: 'Signed', notes: inquiry.notes ? `${inquiry.notes}\n[Signed by ${fullName || inquiry.fullName} on ${new Date().toISOString()}]` : `[Signed by ${fullName || inquiry.fullName} on ${new Date().toISOString()}]` },
    });

    res.json({ success: true, message: 'Letter signed successfully' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/letter/:reference/status', async (req, res) => {
  try {
    const ref = req.params.reference;
    const inquiry = await prisma.inquiry.findFirst({
      where: { OR: [{ letterReferenceNumber: ref }, { letterSerialNumber: ref }] },
      select: { id: true, fullName: true, letterStatus: true, letterReferenceNumber: true, letterSerialNumber: true, updatedAt: true },
    });
    if (!inquiry) { res.status(404).json({ error: 'Letter not found' }); return; }
    res.json({ success: true, status: inquiry.letterStatus, updatedAt: inquiry.updatedAt });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
