import { Request, Response } from 'express';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import archiver from 'archiver';

// ---------------------------------------------------------------------------
// Static assets cached once at module load — eliminates per-request disk I/O
// and prevents duplicate large binary allocations on every PDF generation.
// ---------------------------------------------------------------------------
let _bgBytes: Buffer | null = null;
let _stampBytes: Buffer | null = null;
let _staticPdfBytes: Buffer | null = null;

function getBgBytes(): Buffer {
  if (!_bgBytes) {
    const p = path.join(__dirname, '../../assets/admission-letter-bg.png');
    if (!fs.existsSync(p)) throw new Error(`Background image not found at: ${p}`);
    _bgBytes = fs.readFileSync(p);
  }
  return _bgBytes;
}

function getStampBytes(): Buffer {
  if (!_stampBytes) {
    const p = path.join(__dirname, '../../assets/stamp.png');
    if (!fs.existsSync(p)) throw new Error(`Stamp image not found at: ${p}`);
    _stampBytes = fs.readFileSync(p);
  }
  return _stampBytes;
}

function getStaticPdfBytes(): Buffer {
  if (!_staticPdfBytes) {
    const p = path.join(__dirname, '../../assets/admission-letter-static.pdf');
    if (!fs.existsSync(p)) throw new Error(`Static PDF not found at: ${p}`);
    _staticPdfBytes = fs.readFileSync(p);
  }
  return _staticPdfBytes;
}

// Cache the PARSED PDFDocument (not just raw bytes). PDFDocument.load() re-parses the
// entire document tree on every call — costs 500ms–1s. The cached object is read-only:
// pdfDoc.copyPages(staticDoc, ...) reads but never mutates the source document.
let _staticPdfDoc: import('pdf-lib').PDFDocument | null = null;
async function getStaticPdfDoc(): Promise<import('pdf-lib').PDFDocument> {
  if (!_staticPdfDoc) {
    _staticPdfDoc = await PDFDocument.load(getStaticPdfBytes());
  }
  return _staticPdfDoc;
}

// Helper to read user identity from authenticated session context
function getUserEmailHeader(req: Request): string {
  return String((req as any).user?.email || '').trim();
}

async function getStaffInitialsForUser(email: string): Promise<string> {
  try {
    if (!email) return 'XX';
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    const name = (user?.name || '').trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    const local = email.split('@')[0];
    const letters = local.replace(/[^a-z]/gi, '').toUpperCase();
    return (letters.slice(0, 2) || 'XX');
  } catch {
    return 'XX';
  }
}

// Helper function to get month initial
const getMonthInitial = (date: Date): string => {
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  return months[date.getMonth()];
};

// Helper function to get month name
const getMonthName = (date: Date): string => {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return months[date.getMonth()];
};

// Helper to map intake period to its initial per business rule
function getIntakeInitial(intakePeriod: string | null | undefined): string {
  const value = String(intakePeriod || '').trim().toLowerCase();
  if (value === 'january' || value === 'march') return 'J';
  if (value === 'may' || value === 'july') return 'M';
  if (value === 'september') return 'S';
  if (value === 'november') return 'N';
  // Fallback to first character uppercase or 'X'
  return (value[0] ? value[0].toUpperCase() : 'X');
}

function resolveLetterTemplateId(
  templateId: string | null | undefined
): 'default' | 'short' | 'detailed' {
  const explicit = String(templateId || 'auto').trim().toLowerCase();
  if (explicit === 'default' || explicit === 'short' || explicit === 'detailed') return explicit;
  // Product requirement: keep generated letter body consistent across manual/CSV flows.
  // When template is auto (or unknown), always use the detailed template.
  return 'detailed';
}

// ---------------------------------------------------------------------------
// PDF cache — eliminates repeated generation for preview → download → share
// Key: `${tenantId}:${inquiryId|name}:${admissionDate}:${resolvedTemplate}`
// Ceiling: 50 entries × ~1 MB. TTL: 30 minutes.
// ---------------------------------------------------------------------------
const _pdfCache = new Map<string, { buffer: Buffer; ts: number }>();
const PDF_CACHE_TTL_MS = 30 * 60 * 1000;
const PDF_CACHE_MAX = 50;

function getCachedPdf(key: string): Buffer | null {
  const entry = _pdfCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > PDF_CACHE_TTL_MS) { _pdfCache.delete(key); return null; }
  return entry.buffer;
}

function setCachedPdf(key: string, buffer: Buffer): void {
  if (_pdfCache.size >= PDF_CACHE_MAX) {
    const oldest = [..._pdfCache.entries()].reduce((a, b) => a[1].ts < b[1].ts ? a : b);
    _pdfCache.delete(oldest[0]);
  }
  _pdfCache.set(key, { buffer, ts: Date.now() });
}

async function dbGetNextIntakeCounter(initial: string): Promise<number> {
  const { getNextIntakeInitialCounter } = await import('../utils/letterCounters');
  return getNextIntakeInitialCounter(initial);
}

async function dbGetNextLetterNum(userEmail: string): Promise<string> {
  const { getNextLetterNumber } = await import('../utils/letterCounters');
  const num = await getNextLetterNumber(userEmail);
  return num.toString().padStart(4, '0');
}

async function dbGetNextSequentialNum(): Promise<string> {
  const { getNextTenantLetterCounter } = await import('../utils/letterCounters');
  const num = await getNextTenantLetterCounter(0);
  return num.toString().padStart(4, '0');
}

// Helper function to validate date format (DD/MM/YYYY)
const isValidDateFormat = (dateStr: string): boolean => {
  const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
  if (!regex.test(dateStr)) return false;

  const [day, month, year] = dateStr.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  
  return date.getDate() === day && 
         date.getMonth() === month - 1 && 
         date.getFullYear() === year;
};

// Helper function to format date for stamp
const formatStampDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

async function getNextLetterNumberForUser(userEmail: string): Promise<string> {
  return dbGetNextLetterNum(userEmail);
}

async function getSequentialNumber(): Promise<string> {
  return dbGetNextSequentialNum();
}

export const generateAdmissionLetter = async (req: Request, res: Response) => {
  try {
    const { inquiryId, admissionDate, templateId } = req.body;

    if (!admissionDate || !isValidDateFormat(admissionDate)) {
      return res.status(400).json({
        error: 'Invalid admission date format',
        message: 'Admission date must be in DD/MM/YYYY format (e.g., 05/09/2025)'
      });
    }
    if (!inquiryId) {
      return res.status(400).json({ error: 'inquiryId is required' });
    }

    const numericInquiryId = parseInt(String(inquiryId), 10);
    if (!numericInquiryId || Number.isNaN(numericInquiryId)) {
      return res.status(400).json({ error: 'Invalid inquiryId', details: `Expected numeric id, got ${inquiryId}` });
    }
    const tenantId = (req as any).tenant?.id;

    const userEmail = getUserEmailHeader(req);
    const staffInitials = await getStaffInitialsForUser(userEmail);
    const letterNumber = await getNextLetterNumberForUser(userEmail);

    let inquiryRecord: any = null;
    let intakeInitial = 'X';
    try {
      inquiryRecord = await prisma.inquiry.findFirst({ where: { id: numericInquiryId, tenantId } });
      intakeInitial = getIntakeInitial(inquiryRecord?.intakePeriod as any);
    } catch (e) {
      console.warn('Could not fetch inquiry for intake initial:', e);
    }

    const intakeSeq = await dbGetNextIntakeCounter(intakeInitial);
    const currentDate = new Date();
    const monthName = getMonthName(currentDate);
    const day = currentDate.getDate();
    const serialNumber = `${staffInitials}/L${letterNumber}/${monthName}${day}/${intakeInitial}${intakeSeq}`;
    const monthInitial = getMonthInitial(currentDate);
    const year = currentDate.getFullYear().toString().slice(-2);
    const sequentialNumber = await getSequentialNumber();
    const referenceCode = `JFCM/REG/${monthInitial}${sequentialNumber}/${year}`;

    // Best-effort status update; don't fail the whole request if the record
    // is missing (e.g. legacy or cross-tenant data).
    try {
      await prisma.inquiry.update({
        where: { id: numericInquiryId, tenantId } as any,
        data: {
          letterStatus: 'Generated',
          letterReferenceNumber: referenceCode,
          letterSerialNumber: serialNumber
        }
      });
    } catch (e: any) {
      // Prisma P2025 = record to update not found. Log and continue.
      if ((e as any).code === 'P2025') {
        console.warn('Inquiry not found when updating letter status', {
          inquiryId: numericInquiryId,
          tenantId
        });
      } else {
        console.warn('Error updating inquiry letter status:', e);
      }
    }

    // Auto-send letter via email if tenant has feature enabled
    try {
      const { mergeTenantCrmSettings } = await import('../utils/tenantCrmSettings');
      const tenantRow = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { crmSettings: true } });
      const tSettings = mergeTenantCrmSettings(tenantRow?.crmSettings);
      if (tSettings.featureToggles?.autoSendLetters !== false && inquiryRecord?.email) {
        const { sendTenantEmail } = await import('../utils/tenantEmailService');
        const letterResult = await generateAdmissionLetterBuffer({
          name: inquiryRecord.fullName, phone: inquiryRecord.phone,
          course: req.body.course || inquiryRecord?.programOfInterest || '', duration: req.body.duration, admissionDate,
          staffInitials, intakeSegment: `${intakeInitial}${intakeSeq}`, letterNumber, templateId,
        });
        await sendTenantEmail(
          inquiryRecord.email,
          `Your Admission Letter - ${inquiryRecord.fullName}`,
          `Dear ${inquiryRecord.fullName},\n\nYour admission letter is ready. Reference: ${referenceCode}\n\nPlease find your admission letter attached.\n\nBest regards,\nAdmissions Office`,
          `<p>Dear ${inquiryRecord.fullName},</p><p>Your admission letter is ready.</p><p>Reference: <strong>${referenceCode}</strong></p><p>Please find your admission letter attached.</p><p>Best regards,<br/>Admissions Office</p>`,
          tenantId,
          [{ filename: `admission-letter-${inquiryRecord.fullName.replace(/\s+/g, '-')}.pdf`, content: letterResult.buffer, contentType: 'application/pdf' }]
        );
      }
    } catch (e: any) { console.warn('[auto-send] Failed:', e.message); }

    if (res.headersSent) return;
    return res.json({ success: true, referenceCode, serialNumber, templateId: templateId || 'auto' });
    } catch (err) {
    console.error('Error generating admission letter:', err);
    if (res.headersSent) return;
    return res.status(500).json({
      error: 'Failed to generate admission letter',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
};

// Download admission letter as PDF — streams binary PDF directly (eliminates base64 overhead).
// Checks in-process buffer cache first; generates only on cache miss.
// Cache key: tenant:inquiryId:admissionDate:templateId — covers preview/download/share pattern.
export const downloadAdmissionLetter = async (req: Request, res: Response) => {
  try {
    const { inquiryId, name, phone, course, duration, admissionDate, templateId } = req.body;

    if (!admissionDate || !isValidDateFormat(admissionDate)) {
      return res.status(400).json({
        error: 'Invalid admission date format',
        message: 'Admission date must be in DD/MM/YYYY format (e.g., 05/09/2025)'
      });
    }
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone are required' });
    }

    const tenantId = (req as any).tenant?.id;
    const userEmail = getUserEmailHeader(req);
    const resolvedTemplate = resolveLetterTemplateId(templateId);
    const filename = `admission-letter-${String(name).replace(/\s+/g, '-')}.pdf`;

    // Cache check — skip all DB + generation work on hit
    const cacheKey = `${tenantId ?? 0}:${inquiryId ?? name}:${admissionDate}:${resolvedTemplate}`;
    const cached = getCachedPdf(cacheKey);
    if (cached) {
      if (res.headersSent) return;
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.set('X-Cache', 'HIT');
      return res.send(cached);
    }

    // Cache MISS — fetch inquiry + user in parallel to minimise DB round trips
    const numericId = inquiryId ? parseInt(String(inquiryId), 10) : NaN;
    const [staffInitials, inquiryRecord] = await Promise.all([
      getStaffInitialsForUser(userEmail),
      !Number.isNaN(numericId)
        ? prisma.inquiry.findFirst({ where: { id: numericId, tenantId } })
        : Promise.resolve(null),
    ]);

    const intakeInitial = getIntakeInitial((inquiryRecord?.intakePeriod as any) ?? undefined);
    const effectiveCourse = String(course || (inquiryRecord?.programOfInterest ?? '') || '').trim();
    const letterNumber = await getNextLetterNumberForUser(userEmail);
    const intakeSeq = await dbGetNextIntakeCounter(intakeInitial);
    const intakeSegment = `${intakeInitial}${intakeSeq}`;

    const { buffer, referenceCode, serialNumber } = await generateAdmissionLetterBuffer({
      name, phone,
      course: effectiveCourse,
      duration, admissionDate,
      staffInitials, intakeSegment, letterNumber, templateId,
    });

    // Store in cache — next preview/download/share within 30 min is instant
    setCachedPdf(cacheKey, buffer);

    // Persist metadata to DB — fire-and-forget so the download is not blocked by DB latency
    if (!Number.isNaN(numericId)) {
      prisma.inquiry.update({
        where: { id: numericId, tenantId } as any,
        data: { letterStatus: 'Generated', letterReferenceNumber: referenceCode, letterSerialNumber: serialNumber },
      }).catch((e: any) => {
        if (e?.code !== 'P2025') console.warn('[admission-letter] DB update failed:', e?.message);
      });
    }

    if (res.headersSent) return;
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('X-Cache', 'MISS');
    res.set('X-Reference-Code', referenceCode);
    res.set('X-Serial-Number', serialNumber);
    return res.send(buffer);
  } catch (err) {
    if (res.headersSent) return;
    return res.status(500).json({
      error: 'Failed to generate admission letter',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
};

// Helper to generate a single admission letter PDF and return {buffer, filename, referenceCode, serialNumber}
async function generateAdmissionLetterBuffer({ name, phone, course, duration, admissionDate, staffInitials, intakeSegment, letterNumber, templateId }: any) {
  // Validate admission date
  if (!admissionDate || !isValidDateFormat(admissionDate)) {
    throw new Error('Invalid admission date format');
  }
  // Generate serial number components
  const currentDate = new Date();
  const monthName = getMonthName(currentDate);
  const day = currentDate.getDate();
  const serialNumber = `${staffInitials}/L${letterNumber}/${monthName}${day}/${intakeSegment || 'X1'}`;
  const monthInitial = getMonthInitial(currentDate);
  const year = currentDate.getFullYear().toString().slice(-2);
  const sequentialNumber = await getSequentialNumber();
  const referenceCode = `JFCM/REG/${monthInitial}${sequentialNumber}/${year}`;
  const bgBytes = getBgBytes();
  const stampBytes = getStampBytes();
  // Create a new PDF with A4 size
  const pdfDoc = await PDFDocument.create();
  const a4Width = 595.28;
  const a4Height = 841.89;
  const page1 = pdfDoc.addPage([a4Width, a4Height]);
  // Load fonts
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const serialFont = await pdfDoc.embedFont(StandardFonts.Courier);
  const mmToPoints = (mm: number) => mm * 2.83465;
  // Embed the background image
  const bgImage = await pdfDoc.embedPng(bgBytes);
  page1.drawImage(bgImage, { x: 0, y: 0, width: a4Width, height: a4Height });
  // Embed the stamp image
  const stampImage = await pdfDoc.embedPng(stampBytes);
  const stampWidth = 100;
  const stampHeight = 100;
  const stampX = a4Width - mmToPoints(88) - stampWidth;
  const stampY = a4Height - mmToPoints(250);
  page1.drawImage(stampImage, { x: stampX, y: stampY, width: stampWidth, height: stampHeight });
  // Add date to stamp
  const stampDateText = formatStampDate(currentDate);
  const stampDateWidth = boldFont.widthOfTextAtSize(stampDateText, 10);
  page1.drawText(stampDateText, {
    x: stampX + (stampWidth - stampDateWidth) / 2,
    y: stampY + stampHeight / 2 - mmToPoints(2.5),
    size: 10,
    font: boldFont,
    color: rgb(0, 0.125, 0.922)
  });
  // Calculate positions
  const serialTopMargin = mmToPoints(17);
  const serialRightMargin = mmToPoints(28);
  const referenceTopMargin = mmToPoints(66);
  const contentMargin = mmToPoints(21.6);
  const rightMargin = a4Width - contentMargin;
  const titleTopMargin = mmToPoints(110);
  const bodyTopMargin = mmToPoints(120);
  const bodyWidth = a4Width - (2 * contentMargin);
  // Draw serial number
  const serialNumberWidth = serialFont.widthOfTextAtSize(serialNumber, 10);
  page1.drawText(serialNumber, {
    x: a4Width - serialRightMargin - serialNumberWidth,
    y: a4Height - serialTopMargin,
    size: 10,
    font: serialFont,
    color: rgb(0, 0, 0)
  });
  // Draw header fields
  const lineHeight = 20;
  let currentY = a4Height - referenceTopMargin;
  page1.drawText(`Our Ref: ${referenceCode}`, {
    x: contentMargin,
    y: currentY,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0)
  });
  currentY -= lineHeight;
  page1.drawText('Your Ref: ……………………………', {
    x: contentMargin,
    y: currentY,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0)
  });
  currentY -= lineHeight * 1.5;
  page1.drawText(name, {
    x: contentMargin,
    y: currentY,
    size: 12,
    font: boldFont,
    color: rgb(0.157, 0.475, 0.714)
  });
  currentY -= lineHeight;
  page1.drawText(phone, {
    x: contentMargin,
    y: currentY,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0)
  });
  currentY -= lineHeight;
  page1.drawText(`Dear ${name.split(' ')[0]},`, {
    x: contentMargin,
    y: currentY,
    size: 12,
    font: regularFont,
    color: rgb(0, 0, 0)
  });
  // Date (right-aligned and bold)
  const formattedCurrentDate = formatStampDate(currentDate);
  const dateWidth = boldFont.widthOfTextAtSize(formattedCurrentDate, 12);
  page1.drawText(formattedCurrentDate, {
    x: rightMargin - dateWidth,
    y: a4Height - referenceTopMargin,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0)
  });
  // Add title
  const title = "RE: OFFER OF ADMISSION";
  const titleWidth = boldFont.widthOfTextAtSize(title, 14);
  page1.drawText(title, {
    x: contentMargin,
    y: a4Height - titleTopMargin,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0)
  });
  const underlineY = a4Height - titleTopMargin - 2;
  page1.drawLine({
    start: { x: contentMargin, y: underlineY },
    end: { x: contentMargin + titleWidth, y: underlineY },
    thickness: 1,
    color: rgb(0, 0, 0)
  });
  // Body text
  const resolvedTemplate = resolveLetterTemplateId(templateId);

  const paragraphs =
    resolvedTemplate === 'short'
      ? [
          `Congratulations! You have been offered admission to JFC Munene College of Health Sciences for ${course}. Please report on ${admissionDate} between 8:00a.m and 5:00p.m.`,
          `This program will take a duration of ${duration} and includes industrial attachment. Kindly come with all required documents and personal effects.`,
        ]
      : resolvedTemplate === 'detailed'
        ? [
            'JFC Munene College of health sciences is a premier middle level college registered with the Ministry of Education and Technical Vocational Education and Training Authority (TVETA) Registration number TVETA/PRIVATE/TVC/0090/2021, Nutritionists & Dieticians Institute (KNDI) registration number KNDI/ACCR/IL/084. We are offering Diploma, Certificate, Craft and Artisan Level Programs. Our programs are examined by Kenya National Examination Council (KNEC) and Technical Vocational Education and Training-Curriculum Development Assessment and Certification Council (TVET-CDACC) under the Ministry of Education.',
            `On behalf of the Admission Selection Committee, it is my great pleasure to offer you admission to JFC Munene College of Health Sciences ${course} at our Thika campus. Your acceptance reflects the admissions committee's evaluation of your interest and your ability to benefit from this program. This is an intensive program that will take a duration of ${duration} and three months of industrial attachment. You are therefore expected to report on ${admissionDate} between 8:00a.m and 5:00p.m.`,
            'We offer state of the art accommodation for all our students at a cost of ksh 22,750 per term and this is inclusive of meals and bed. Students are expected to report with their beddings and personal effects. Attached to this letter are admission requirements and medical report that must be filled at an NHIF accredited Hospital, to be submitted during the admission day.'
          ]
        : [
            `On behalf of the Admission Selection Committee, it is my great pleasure to offer you admission to JFC Munene College of Health Sciences ${course} at our Thika campus.`,
            `This is an intensive program that will take a duration of ${duration}. You are expected to report on ${admissionDate} between 8:00a.m and 5:00p.m.`,
            'Please come with all required documents indicated in the attached admission requirements.'
          ];
  const fontSize = 12;
  const lineSpacing = 1.2;
  let y = a4Height - bodyTopMargin;
  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let x = contentMargin;
    let line = '';
    let isBold = false;
    for (const word of words) {
      const shouldBeBold = word.includes(course) || word.includes(duration) || word.includes(admissionDate);
      const testLine = line + word + ' ';
      const testWidth = (shouldBeBold ? boldFont : regularFont).widthOfTextAtSize(testLine, fontSize);
      if (testWidth > bodyWidth && line !== '') {
        page1.drawText(line, {
          x,
          y,
          size: fontSize,
          font: isBold ? boldFont : regularFont,
          color: rgb(0, 0, 0)
        });
        line = word + ' ';
        y -= fontSize * lineSpacing;
        isBold = shouldBeBold;
      } else {
        line = testLine;
        isBold = shouldBeBold;
      }
    }
    if (line) {
      page1.drawText(line, {
        x,
        y,
        size: fontSize,
        font: isBold ? boldFont : regularFont,
        color: rgb(0, 0, 0)
      });
      y -= fontSize * lineSpacing * 2;
    }
  }
  // Draw closing signature block
  y -= fontSize * lineSpacing;
  page1.drawText('Yours faithfully,', { x: contentMargin, y, size: fontSize, font: regularFont, color: rgb(0, 0, 0) });
  y -= fontSize * lineSpacing * 3.5;
  page1.drawRectangle({ x: contentMargin, y: y - 4, width: 200, height: 36, color: rgb(1, 1, 1) });
  page1.drawText('James Chiaga', { x: contentMargin, y: y + 14, size: 12, font: boldFont, color: rgb(0, 0, 0) });
  page1.drawText('Principal', { x: contentMargin, y: y, size: 11, font: regularFont, color: rgb(0, 0, 0) });
  const staticDoc = await getStaticPdfDoc();
  const copiedPages = await pdfDoc.copyPages(staticDoc, staticDoc.getPageIndices());
  copiedPages.forEach((p) => pdfDoc.addPage(p));
  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  return {
    buffer: Buffer.from(pdfBytes),
    filename: `admission-letter-${name.replace(/\s+/g, '-')}.pdf`,
    referenceCode,
    serialNumber
  };
}

export const bulkGenerateAdmissionLetters = async (req: Request, res: Response) => {
  try {
    const { inquiries, admissionDate, templateId } = req.body;
    if (!Array.isArray(inquiries) || inquiries.length === 0) {
      return res.status(400).json({ error: 'No inquiries provided' });
    }
    if (inquiries.length > 20) {
      return res.status(400).json({ error: 'Bulk limit is 20 letters per request to prevent memory exhaustion' });
    }
    if (!admissionDate || !isValidDateFormat(admissionDate)) {
      return res.status(400).json({ error: 'Invalid admission date format', message: 'Admission date must be in DD/MM/YYYY format (e.g., 05/09/2025)' });
    }
    const tenantId = (req as any).tenant?.id;
    const userEmail = getUserEmailHeader(req);
    const staffInitials = await getStaffInitialsForUser(userEmail);

    // Phase 1: Fetch all inquiry records in parallel (one DB round trip per inquiry, concurrent)
    const inquiryRecords = await Promise.all(
      inquiries.map(inq =>
        inq.inquiryId
          ? prisma.inquiry.findFirst({ where: { id: parseInt(String(inq.inquiryId), 10), tenantId } }).catch(() => null)
          : Promise.resolve(null)
      )
    );

    // Phase 2: Pre-compute counters — DB-backed, race-condition-free
    const prepared: Array<{ inq: any; intakeSegment: string; letterNumber: string }> = [];
    for (let i = 0; i < inquiries.length; i++) {
      const intakeInitial = getIntakeInitial((inquiryRecords[i]?.intakePeriod as any) ?? undefined);
      const seq = await dbGetNextIntakeCounter(intakeInitial);
      const intakeSegment = `${intakeInitial}${seq}`;
      const letterNumber = await getNextLetterNumberForUser(userEmail);
      prepared.push({ inq: inquiries[i], intakeSegment, letterNumber });
    }

    // Phase 3: Generate PDFs in parallel batches of 5 (CPU-bound work parallelised)
    const CONCURRENCY = 5;
    const results: Array<{ buffer: Buffer; filename: string; referenceCode: string; serialNumber: string; inq: any }> = [];
    for (let i = 0; i < prepared.length; i += CONCURRENCY) {
      const batch = prepared.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(({ inq, intakeSegment, letterNumber }) =>
          generateAdmissionLetterBuffer({ ...inq, admissionDate, staffInitials, intakeSegment, letterNumber, templateId })
            .then(r => ({ ...r, inq }))
        )
      );
      results.push(...batchResults);
    }

    // Phase 4: Stream all buffers into ZIP (compression 6: good ratio, minimal CPU vs level 9)
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="admission-letters.zip"');
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);
    for (const { buffer, filename } of results) {
      archive.append(buffer, { name: filename });
    }
    await archive.finalize();

    // Fire-and-forget DB updates after response has been sent
    Promise.all(
      results.map(({ referenceCode, serialNumber, inq }) =>
        inq.inquiryId
          ? prisma.inquiry.update({
              where: { id: parseInt(String(inq.inquiryId), 10), tenantId } as any,
              data: { letterStatus: 'Generated', letterReferenceNumber: referenceCode, letterSerialNumber: serialNumber },
            }).catch(() => {})
          : Promise.resolve()
      )
    ).catch(() => {});

    return;
  } catch (err) {
    console.error('Error in bulkGenerateAdmissionLetters:', err);
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Failed to generate bulk admission letters', details: err instanceof Error ? err.message : 'Unknown error' });
  }
};

// Stats endpoint: returns total and per-intake initial counts
export const getAdmissionLetterStats = async (_req: Request, res: Response) => {
  try {
    const pathCounts = path.join(__dirname, '../../data/intake-initial-count.json');
    let counts: Record<string, number> = {};
    if (fs.existsSync(pathCounts)) {
      counts = JSON.parse(fs.readFileSync(pathCounts, 'utf8'));
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return res.json({ total, counts });
  } catch (e) {
    return res.json({ total: 0, counts: {} });
  }
}; 