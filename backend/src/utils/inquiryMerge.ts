import prisma from '../lib/prisma'

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p.map(String) : []
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  return []
}

export async function mergeInquiriesIntoTarget(
  sourceId: number,
  targetId: number,
  tenantId: number,
): Promise<{ ok: true; targetId: number }> {
  if (sourceId === targetId) throw new Error('Cannot merge an inquiry into itself')
  const [src, tgt] = await Promise.all([
    prisma.inquiry.findFirst({ where: { id: sourceId, tenantId }, include: { detail: true } }),
    prisma.inquiry.findFirst({ where: { id: targetId, tenantId }, include: { detail: true } }),
  ])
  if (!src || !tgt) throw new Error('Inquiry not found')

  const mergedNotes = [tgt.notes, src.notes].filter(Boolean).join('\n---\n')
  const mergedTags = [...new Set([...parseTags(tgt.leadTags), ...parseTags(src.leadTags)])]

  await prisma.$transaction(async (tx) => {
    await tx.followup.updateMany({
      where: { inquiryId: sourceId, tenantId },
      data: { inquiryId: targetId, inquiryName: tgt.fullName },
    })
    await tx.task.updateMany({
      where: { inquiryId: sourceId, tenantId },
      data: { inquiryId: targetId },
    })
    await tx.inquiry.update({
      where: { id: targetId, tenantId },
      data: {
        notes: mergedNotes || tgt.notes,
        leadTags: mergedTags,
        consentSms: tgt.consentSms ?? src.consentSms,
        consentEmail: tgt.consentEmail ?? src.consentEmail,
        consentWhatsapp: tgt.consentWhatsapp ?? src.consentWhatsapp,
      },
    })
    await tx.inquiry.delete({ where: { id: sourceId, tenantId } })
  })

  return { ok: true, targetId }
}
