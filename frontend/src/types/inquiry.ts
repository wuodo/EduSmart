export type InquiryStatus = 'hot' | 'warm' | 'cold' | 'scholarship-seeker' | 'graduate';
export type InquirySource =
  | 'walk-in'
  | 'social_media'
  | 'referral'
  | 'radio'
  | 'whatsapp'
  | 'facebook_ad'
  | 'website'
  | 'agent'
  | 'event'
  | 'email'
  | 'google_search'
  | 'tiktok'
  | 'linkedin'
  | 'instagram'
  | 'youtube'
  | 'other';

export type Gender = 'male' | 'female' | 'other' | '';
export type StudyMode = 'full-time' | 'part-time' | 'online';
export type IntakePeriod = 'January' | 'March' | 'May' | 'July' | 'September' | 'November';
export type ContactMethod = 'phone' | 'sms' | 'email' | 'whatsapp';
export type LeadTag = 'hot' | 'warm' | 'cold' | 'scholarship-seeker' | 'graduate';

export interface InquiryDetail {
  idOrPassport?: string;
  county: string;
  town: string;
}

export interface Inquiry {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  gender?: Gender;
  programOfInterest: string;
  intakePeriod: IntakePeriod;
  studyMode: StudyMode;
  source: InquirySource;
  agentOrReferralName?: string;
  preferredContactMethod: ContactMethod;
  bestTimeToContact?: string;
  leadTags: LeadTag[];
  notes?: string;
  status: InquiryStatus;
  letterStatus?: string;
  assignedTo: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  documents?: string[];
  paymentStatus?: 'Paid' | 'Not Paid';
  paymentCode?: string;
  paymentDate?: string;
  // New fields
  kcseGrade: string;
  detail?: InquiryDetail;
  // Smart/analytics fields used in UI
  score?: number;
  recommendation?: string;
  sentiment?: 'positive' | 'negative' | 'neutral' | string;
  firstResponseAt?: string | Date | null;
  nextFollowupAt?: string | Date | null;
  consentSms?: boolean | null
  consentEmail?: boolean | null
  consentWhatsapp?: boolean | null
  /** Enriched on list API when Smart Features are enabled */
  smartMeta?: {
    dormant?: boolean;
    intakeFillPercent?: number;
    intakeWarning?: boolean;
  };
}

export interface InquiryFormData {
  fullName: string;
  phone: string;
  email?: string;
  gender?: Gender;
  programOfInterest: string;
  intakePeriod: IntakePeriod;
  studyMode: StudyMode;
  source: InquirySource;
  agentOrReferralName?: string;
  preferredContactMethod: ContactMethod;
  bestTimeToContact?: string;
  leadTags: LeadTag[];
  notes?: string;
  status: InquiryStatus;
  assignedTo: string;
  documents?: File[];
  // New required/optional fields on form
  kcseGrade: string; // required
  county: string; // required
  town: string; // required
  idOrPassport?: string; // optional
  consentSms?: boolean
  consentEmail?: boolean
  consentWhatsapp?: boolean
} 