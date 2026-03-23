import { Request, Response } from 'express'
import prisma from '../lib/prisma'

/** Program model was removed. Return distinct programOfInterest from inquiries as fallback. */

export const getAllPrograms = async (_req: Request, res: Response) => {
  try {
    const inquiries = await prisma.inquiry.findMany({ select: { programOfInterest: true }, where: { programOfInterest: { not: null } } })
    const programs = [...new Set(inquiries.map((i) => i.programOfInterest).filter(Boolean))].map((name, idx) => ({ id: idx + 1, name }))
    return res.json(programs)
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching programs', error: error instanceof Error ? error.message : String(error) })
  }
}

export const createProgram = async (_req: Request, res: Response) => {
  return res.status(410).json({ message: 'Program model removed. Add programs via inquiry programOfInterest.' })
}

export const updateProgram = async (_req: Request, res: Response) => {
  return res.status(410).json({ message: 'Program model removed.' })
}

export const deleteProgram = async (_req: Request, res: Response) => {
  return res.status(410).json({ message: 'Program model removed.' })
} 