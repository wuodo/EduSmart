import { z } from 'zod';

export const STATUS_LIFECYCLE = [
  'new', 'contacted', 'qualified', 'proposal', 'negotiated', 'won', 'lost',
] as const;

export const VALID_TRANSITIONS: Record<string, string[]> = {
  '': ['new'],
  'new': ['contacted', 'lost'],
  'contacted': ['qualified', 'lost'],
  'qualified': ['proposal', 'lost'],
  'proposal': ['negotiated', 'lost'],
  'negotiated': ['won', 'lost'],
  'won': [],
  'lost': [],
  'Pending': ['new', 'contacted', 'lost'],
  'hot': ['contacted', 'qualified', 'proposal', 'negotiated', 'won', 'lost'],
  'warm': ['contacted', 'qualified', 'lost'],
  'cold': ['lost'],
};

export const createInquirySchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
  phone: z.string().regex(/^\+?\d{7,15}$/, 'Invalid phone number'),
  email: z.string().email('Invalid email').optional().nullable().default(null),
  gender: z.string().optional().nullable(),
  programOfInterest: z.string().optional().nullable(),
  intakePeriod: z.string().optional().nullable(),
  studyMode: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  agentOrReferralName: z.string().optional().nullable(),
  preferredContactMethod: z.string().optional().nullable(),
  bestTimeToContact: z.string().optional().nullable(),
  leadTags: z.any().optional().nullable(),
  notes: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiated', 'won', 'lost']).optional().default('new'),
  kcseGrade: z.string().optional().nullable(),
  county: z.string().optional().nullable(),
  town: z.string().optional().nullable(),
  idOrPassport: z.string().optional().nullable(),
  consentSms: z.boolean().optional().nullable(),
  consentEmail: z.boolean().optional().nullable(),
  consentWhatsapp: z.boolean().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
});

export const updateInquirySchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  phone: z.string().regex(/^\+?\d{7,15}$/).optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  gender: z.string().optional().nullable(),
  programOfInterest: z.string().optional().nullable(),
  intakePeriod: z.string().optional().nullable(),
  studyMode: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  agentOrReferralName: z.string().optional().nullable(),
  preferredContactMethod: z.string().optional().nullable(),
  bestTimeToContact: z.string().optional().nullable(),
  leadTags: z.any().optional().nullable(),
  notes: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  status: z.string().optional(),
  kcseGrade: z.string().optional().nullable(),
  county: z.string().optional().nullable(),
  town: z.string().optional().nullable(),
  idOrPassport: z.string().optional().nullable(),
  consentSms: z.boolean().optional().nullable(),
  consentEmail: z.boolean().optional().nullable(),
  consentWhatsapp: z.boolean().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  paymentStatus: z.string().optional(),
  paymentCode: z.string().optional().nullable(),
  letterStatus: z.string().optional(),
});

const ALLOWED_FIELDS = [
  'fullName', 'phone', 'email', 'gender', 'programOfInterest', 'intakePeriod',
  'studyMode', 'source', 'agentOrReferralName', 'preferredContactMethod',
  'bestTimeToContact', 'leadTags', 'notes', 'message', 'status', 'kcseGrade',
  'county', 'town', 'idOrPassport', 'consentSms', 'consentEmail', 'consentWhatsapp',
  'assignedTo', 'paymentStatus', 'paymentCode', 'letterStatus',
];

export function whitelistUpdatePayload(body: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) payload[key] = body[key];
  }
  return payload;
}

export function validateStatusTransition(oldStatus: string | null | undefined, newStatus: string | null | undefined): string | null {
  const from = (oldStatus || '').toLowerCase().trim();
  const to = (newStatus || '').toLowerCase().trim();
  if (!from && !to) return null;
  if (!from) return null;
  if (from === to) return null;
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return `Unknown current status "${oldStatus}"`;
  if (allowed.includes(to)) return null;
  return `Cannot transition from "${oldStatus}" to "${newStatus}". Allowed: ${(allowed.length ? allowed.join(', ') : 'none (terminal status)')}`;
}
