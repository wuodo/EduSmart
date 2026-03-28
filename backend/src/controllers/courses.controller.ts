import { Request, Response } from 'express';
import prisma from '../lib/prisma';

function getTenantId(req: Request): number | null {
  const t = (req as any).tenantId || (req as any).tenant?.id;
  return t ? Number(t) : null;
}

export const getAllCourses = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const where = tenantId ? { tenantId } : {};
    const programs = await prisma.program.findMany({ where, orderBy: [{ level: 'asc' }, { name: 'asc' }] });
    return res.json(programs);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch programs' });
  }
};

export const createCourse = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { name, code, category, duration, level, description, intake, seats } = req.body;
    if (!name || !level) {
      return res.status(400).json({ message: 'name and level are required' });
    }
    const program = await prisma.program.create({
      data: {
        name: String(name).trim(),
        code: code ? String(code).trim() : null,
        level: String(level).trim(),
        category: category ? String(category).trim() : null,
        duration: duration ? String(duration).trim() : null,
        description: description ? String(description).trim() : null,
        intake: intake ? String(intake).trim() : null,
        seats: seats ? Number(seats) : null,
        tenantId: tenantId ?? undefined,
      },
    });
    return res.status(201).json(program);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to create program' });
  }
};

export const updateCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const existing = await prisma.program.findUnique({ where: { id: Number(id) } });
    if (!existing) return res.status(404).json({ message: 'Program not found' });
    if (tenantId && existing.tenantId && existing.tenantId !== tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { name, code, category, duration, level, description, intake, seats, isActive } = req.body;
    const updated = await prisma.program.update({
      where: { id: Number(id) },
      data: {
        name: name ? String(name).trim() : undefined,
        code: code !== undefined ? String(code).trim() : undefined,
        level: level ? String(level).trim() : undefined,
        category: category !== undefined ? String(category).trim() : undefined,
        duration: duration !== undefined ? String(duration).trim() : undefined,
        description: description !== undefined ? String(description).trim() : undefined,
        intake: intake !== undefined ? String(intake).trim() : undefined,
        seats: seats !== undefined ? (seats === '' || seats === null ? null : Number(seats)) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to update program' });
  }
};

export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const existing = await prisma.program.findUnique({ where: { id: Number(id) } });
    if (!existing) return res.status(404).json({ message: 'Program not found' });
    if (tenantId && existing.tenantId && existing.tenantId !== tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await prisma.program.delete({ where: { id: Number(id) } });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to delete program' });
  }
};

// Returns distinct programOfInterest values from inquiries — useful for seeding the programs list
export const getSuggestedPrograms = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const where: any = { programOfInterest: { not: null } };
    if (tenantId) where.tenantId = tenantId;
    const rows = await prisma.inquiry.findMany({ select: { programOfInterest: true }, where, distinct: ['programOfInterest'] });
    const names = rows.map(r => r.programOfInterest).filter(Boolean).sort() as string[];
    return res.json(names);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch suggestions' });
  }
};

// Bulk-seed programs from the existing programOfInterest values in inquiries
export const seedFromInquiries = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const where: any = { programOfInterest: { not: null } };
    if (tenantId) where.tenantId = tenantId;
    const rows = await prisma.inquiry.findMany({ select: { programOfInterest: true }, where, distinct: ['programOfInterest'] });
    const names = rows.map(r => r.programOfInterest).filter(Boolean) as string[];
    let created = 0;
    for (const name of names) {
      const exists = await prisma.program.findFirst({ where: { name, tenantId: tenantId ?? undefined } });
      if (!exists) {
        await prisma.program.create({ data: { name, level: 'Certificate', tenantId: tenantId ?? undefined } });
        created++;
      }
    }
    return res.json({ seeded: created, total: names.length });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to seed programs' });
  }
};
