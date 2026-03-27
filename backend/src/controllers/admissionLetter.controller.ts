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
// Counter caches — each file is read once (lazy) then held in-process.
// Writes are deferred via setImmediate so they never block the request path.
// ---------------------------------------------------------------------------
const _intakeCounts: Record<string, number> = {};
let _intakeCountsLoaded = false;
const _intakeCountPath = path.join(__dirname, '../../data/intake-initial-count.json');

const _userLetterCounts: Record<string, number> = {};
let _userLetterCountsLoaded = false;
const _userLetterCountPath = path.join(__dirname, '../../data/letter-count-by-user.json');

let _seqCount = 0;
let _seqCountLoaded = false;
const _seqCountPath = path.join(__dirname, '../../data/letter-count.json');

function _loadJsonSync<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { /* ignore */ }
  return fallback;
}

function _saveJsonAsync(filePath: string, data: unknown) {
  setImmediate(() => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
    } catch { /* non-critical */ }
  });
}

function getNextIntakeInitialCounter(initial: string): number {
  if (!_intakeCountsLoaded) {
    const loaded = _loadJsonSync<Record<string, number>>(_intakeCountPath, {});
    Object.assign(_intakeCounts, loaded);
    _intakeCountsLoaded = true;
  }
  const next = (_intakeCounts[initial] || 0) + 1;
  _intakeCounts[initial] = next;
  _saveJsonAsync(_intakeCountPath, _intakeCounts);
  return next;
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

function getNextLetterNumberForUser(userEmail: string): string {
  if (!_userLetterCountsLoaded) {
    const loaded = _loadJsonSync<Record<string, number>>(_userLetterCountPath, {});
    Object.assign(_userLetterCounts, loaded);
    _userLetterCountsLoaded = true;
  }
  const key = (userEmail || 'unknown').toLowerCase();
  const next = (_userLetterCounts[key] || 0) + 1;
  _userLetterCounts[key] = next;
  _saveJsonAsync(_userLetterCountPath, _userLetterCounts);
  return next.toString().padStart(4, '0');
}

function getSequentialNumber(): string {
  if (!_seqCountLoaded) {
    const data = _loadJsonSync<{ count: number }>(_seqCountPath, { count: 0 });
    _seqCount = data.count || 0;
    _seqCountLoaded = true;
  }
  _seqCount += 1;
  _saveJsonAsync(_seqCountPath, { count: _seqCount });
  return _seqCount.toString().padStart(4, '0');
};

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
    const letterNumber = getNextLetterNumberForUser(userEmail);

    let intakeInitial = 'X';
    try {
      const inquiryRecord = await prisma.inquiry.findFirst({ where: { id: numericInquiryId, tenantId } });
      intakeInitial = getIntakeInitial(inquiryRecord?.intakePeriod as any);
    } catch (e) {
      console.warn('Could not fetch inquiry for intake initial:', e);
    }

    const intakeSeq = getNextIntakeInitialCounter(intakeInitial);
    const currentDate = new Date();
    const monthName = getMonthName(currentDate);
    const day = currentDate.getDate();
    const serialNumber = `${staffInitials}/L${letterNumber}/${monthName}${day}/${intakeInitial}${intakeSeq}`;
    const monthInitial = getMonthInitial(currentDate);
    const year = currentDate.getFullYear().toString().slice(-2);
    const sequentialNumber = getSequentialNumber();
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

// Download admission letter as PDF
export const downloadAdmissionLetter = async (req: Request, res: Response) => {
  try {
    console.log('Starting PDF generation...');
    const { inquiryId, name, phone, course, duration, admissionDate, templateId } = req.body;

    if (!admissionDate || !isValidDateFormat(admissionDate)) {
      return res.status(400).json({
        error: 'Invalid admission date format',
        message: 'Admission date must be in DD/MM/YYYY format (e.g., 05/09/2025)'
      });
    }

    const userEmail = getUserEmailHeader(req);
    const staffInitials = await getStaffInitialsForUser(userEmail);
    const letterNumber = getNextLetterNumberForUser(userEmail);

    const tenantId = (req as any).tenant?.id;

    let intakeInitial = 'X';
    let effectiveCourse = String(course || '').trim();
    if (inquiryId) {
      try {
        const inquiryRecord = await prisma.inquiry.findFirst({ where: { id: parseInt(inquiryId), tenantId } });
        intakeInitial = getIntakeInitial(inquiryRecord?.intakePeriod as any);
        if (!effectiveCourse && inquiryRecord?.programOfInterest) {
          effectiveCourse = String(inquiryRecord.programOfInterest);
        }
      } catch (e) {
        console.warn('Could not fetch inquiry for intake initial:', e);
      }
    }

    const intakeSeq = getNextIntakeInitialCounter(intakeInitial);
    const currentDate = new Date();
    const monthName = getMonthName(currentDate);
    const dayNum = currentDate.getDate();
    const serialNumber = `${staffInitials}/L${letterNumber}/${monthName}${dayNum}/${intakeInitial}${intakeSeq}`;
    const monthInitial = getMonthInitial(currentDate);
    const year = currentDate.getFullYear().toString().slice(-2);
    const sequentialNumber = getSequentialNumber();
    const referenceCode = `JFCM/REG/${monthInitial}${sequentialNumber}/${year}`;

    // Save serial/reference to DB so CSV export shows correct values
    if (inquiryId) {
      try {
        await prisma.inquiry.update({
          where: { id: parseInt(String(inquiryId)), tenantId } as any,
          data: { letterStatus: 'Generated', letterReferenceNumber: referenceCode, letterSerialNumber: serialNumber }
        });
      } catch (e: any) {
        if ((e as any).code !== 'P2025') console.warn('Error updating letter status on download:', e);
      }
    }

    const bgBytes = getBgBytes();
    const stampBytes = getStampBytes();

    const pdfDoc = await PDFDocument.create();
    const a4Width = 595.28;
    const a4Height = 841.89;
    const page1 = pdfDoc.addPage([a4Width, a4Height]);

    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const serialFont = await pdfDoc.embedFont(StandardFonts.Courier);

    const mmToPoints = (mm: number) => mm * 2.83465;

    const bgImage = await pdfDoc.embedPng(bgBytes);
    page1.drawImage(bgImage, { x: 0, y: 0, width: a4Width, height: a4Height });

    const stampImage = await pdfDoc.embedPng(stampBytes);
    const stampWidth = 100;
    const stampHeight = 100;
    const stampX = a4Width - mmToPoints(88) - stampWidth;
    const stampY = a4Height - mmToPoints(250);
    page1.drawImage(stampImage, { x: stampX, y: stampY, width: stampWidth, height: stampHeight });

    const stampDateText = formatStampDate(currentDate);
    const stampDateWidth = boldFont.widthOfTextAtSize(stampDateText, 10);
    page1.drawText(stampDateText, {
      x: stampX + (stampWidth - stampDateWidth) / 2,
      y: stampY + stampHeight / 2 - mmToPoints(2.5),
      size: 10, font: boldFont, color: rgb(0, 0.125, 0.922)
    });

    const serialTopMargin = mmToPoints(17);
    const serialRightMargin = mmToPoints(28);
    const referenceTopMargin = mmToPoints(66);
    const contentMargin = mmToPoints(21.6);
    const rightMargin = a4Width - contentMargin;
    const titleTopMargin = mmToPoints(110);
    const bodyTopMargin = mmToPoints(120);
    const bodyWidth = a4Width - (2 * contentMargin);

    const serialNumberWidth = serialFont.widthOfTextAtSize(serialNumber, 10);
    page1.drawText(serialNumber, {
      x: a4Width - serialRightMargin - serialNumberWidth,
      y: a4Height - serialTopMargin,
      size: 10, font: serialFont, color: rgb(0, 0, 0)
    });

    const lineHeight = 20;
    let currentY = a4Height - referenceTopMargin;

    page1.drawText(`Our Ref: ${referenceCode}`, { x: contentMargin, y: currentY, size: 12, font: regularFont, color: rgb(0, 0, 0) });
    currentY -= lineHeight;
    page1.drawText('Your Ref: ……………………………', { x: contentMargin, y: currentY, size: 12, font: regularFont, color: rgb(0, 0, 0) });
    currentY -= lineHeight * 1.5;
    page1.drawText(name, { x: contentMargin, y: currentY, size: 12, font: boldFont, color: rgb(0.157, 0.475, 0.714) });
    currentY -= lineHeight;
    page1.drawText(phone, { x: contentMargin, y: currentY, size: 12, font: regularFont, color: rgb(0, 0, 0) });
    currentY -= lineHeight;
    page1.drawText(`Dear ${name.split(' ')[0]},`, { x: contentMargin, y: currentY, size: 12, font: regularFont, color: rgb(0, 0, 0) });

    const formattedCurrentDate = formatStampDate(currentDate);
    const dateWidth = boldFont.widthOfTextAtSize(formattedCurrentDate, 12);
    page1.drawText(formattedCurrentDate, { x: rightMargin - dateWidth, y: a4Height - referenceTopMargin, size: 12, font: boldFont, color: rgb(0, 0, 0) });

    const title = "RE: OFFER OF ADMISSION";
    const titleWidth = boldFont.widthOfTextAtSize(title, 14);
    page1.drawText(title, { x: contentMargin, y: a4Height - titleTopMargin, size: 14, font: boldFont, color: rgb(0, 0, 0) });

    const underlineY = a4Height - titleTopMargin - 2;
    page1.drawLine({ start: { x: contentMargin, y: underlineY }, end: { x: contentMargin + titleWidth, y: underlineY }, thickness: 1, color: rgb(0, 0, 0) });

    const resolvedTemplate = resolveLetterTemplateId(templateId);

    const paragraphs =
      resolvedTemplate === 'short'
        ? [
            `Congratulations! You have been offered admission to JFC Munene College of Health Sciences for ${effectiveCourse || course}. Please report on ${admissionDate} between 8:00a.m and 5:00p.m.`,
            `This program will take a duration of ${duration} and includes industrial attachment. Kindly come with all required documents and personal effects.`,
          ]
        : resolvedTemplate === 'detailed'
          ? [
              'JFC Munene College of health sciences is a premier middle level college registered with the Ministry of Education and Technical Vocational Education and Training Authority (TVETA) Registration number TVETA/PRIVATE/TVC/0090/2021, Nutritionists & Dieticians Institute (KNDI) registration number KNDI/ACCR/IL/084. We are offering Diploma, Certificate, Craft and Artisan Level Programs. Our programs are examined by Kenya National Examination Council (KNEC) and Technical Vocational Education and Training-Curriculum Development Assessment and Certification Council (TVET-CDACC) under the Ministry of Education.',
              `On behalf of the Admission Selection Committee, it is my great pleasure to offer you admission to JFC Munene College of Health Sciences ${effectiveCourse || course} at our Thika campus. Your acceptance reflects the admissions committee's evaluation of your interest and your ability to benefit from this program. This is an intensive program that will take a duration of ${duration} and three months of industrial attachment. You are therefore expected to report on ${admissionDate} between 8:00a.m and 5:00p.m.`,
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
          page1.drawText(line, { x, y, size: fontSize, font: isBold ? boldFont : regularFont, color: rgb(0, 0, 0) });
          line = word + ' ';
          y -= fontSize * lineSpacing;
          isBold = shouldBeBold;
        } else {
          line = testLine;
          isBold = shouldBeBold;
        }
      }

      if (line) {
        page1.drawText(line, { x, y, size: fontSize, font: isBold ? boldFont : regularFont, color: rgb(0, 0, 0) });
        y -= fontSize * lineSpacing * 2;
      }
    }

    // Draw closing signature block
    y -= fontSize * lineSpacing;
    page1.drawText('Yours faithfully,', { x: contentMargin, y, size: fontSize, font: regularFont, color: rgb(0, 0, 0) });
    y -= fontSize * lineSpacing * 3.5;
    // Cover old principal name in background with white rectangle, then draw new name
    page1.drawRectangle({ x: contentMargin, y: y - 4, width: 200, height: 36, color: rgb(1, 1, 1) });
    page1.drawText('James Chiaga', { x: contentMargin, y: y + 14, size: 12, font: boldFont, color: rgb(0, 0, 0) });
    page1.drawText('Principal', { x: contentMargin, y: y, size: 11, font: regularFont, color: rgb(0, 0, 0) });

    const staticDoc = await PDFDocument.load(getStaticPdfBytes());
    const copiedPages = await pdfDoc.copyPages(staticDoc, staticDoc.getPageIndices());
    copiedPages.forEach((p) => pdfDoc.addPage(p));

    const pdfBytes = await pdfDoc.save();
    const filename = `admission-letter-${name.replace(/\s+/g, '-')}.pdf`;
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    if (res.headersSent) return;
    return res.json({ success: true, filename, pdf: pdfBase64, referenceCode, serialNumber, templateId: resolvedTemplate });
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
  const sequentialNumber = getSequentialNumber();
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
  const staticDoc = await PDFDocument.load(getStaticPdfBytes());
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

    // Prepare ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="admission-letters.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Resolve staff initials and per-user counter context
    const userEmail = getUserEmailHeader(req);
    const staffInitials = await getStaffInitialsForUser(userEmail);

    // For each inquiry, generate PDF and append to ZIP
    for (const inquiry of inquiries) {
      let intakeInitial = 'X';
      if (inquiry.inquiryId) {
        try {
          const record = await prisma.inquiry.findFirst({ where: { id: parseInt(inquiry.inquiryId), tenantId } });
          intakeInitial = getIntakeInitial(record?.intakePeriod as any);
        } catch {}
      }
      // Get next sequence for this intake initial and build segment like S11
      const seq = getNextIntakeInitialCounter(intakeInitial);
      const intakeSegment = `${intakeInitial}${seq}`;
      // Per-user letter number
      const perUserLetterNumber = getNextLetterNumberForUser(userEmail);
      const { buffer, filename, referenceCode, serialNumber } = await generateAdmissionLetterBuffer({ ...inquiry, admissionDate, staffInitials, intakeSegment, letterNumber: perUserLetterNumber, templateId });
      archive.append(buffer, { name: filename });
      // Optionally update letterStatus in DB here
      if (inquiry.inquiryId) {
        try { await prisma.inquiry.update({
          where: { id: parseInt(inquiry.inquiryId), tenantId } as any,
          data: {
          letterStatus: 'Generated',
          letterReferenceNumber: referenceCode,
          letterSerialNumber: serialNumber
          }
        }); } catch {}
      }
    }
    await archive.finalize();
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