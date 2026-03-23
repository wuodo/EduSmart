export type FollowupType = 'call' | 'email' | 'sms' | 'whatsapp' | 'meeting';
export type FollowupStatus = 'pending' | 'completed' | 'rescheduled' | 'cancelled';

export interface Followup {
  id: string;
  inquiryId: string;
  inquiryName: string;
  type: FollowupType;
  scheduledFor: Date;
  status: FollowupStatus;
  assignedTo: string;
  notes?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  paymentStatus?: 'Paid' | 'Not Paid';
  paymentCode?: string;
  paymentDate?: string;
}

export interface FollowupFormData {
  inquiryId: string;
  type: FollowupType;
  scheduledFor: Date;
  assignedTo: string;
  notes?: string;
  paymentStatus?: 'Paid' | 'Not Paid';
  paymentCode?: string;
  paymentDate?: string;
} 