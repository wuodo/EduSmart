import prisma from '../lib/prisma';

/**
 * Returns a nurturing recommendation for a given inquiry based on follow-up history.
 * - Cold/unresponsive: No completed follow-up in 7+ days, or multiple pending/overdue follow-ups.
 * - Returns a string recommendation or null if not needed.
 */
export async function getNurturingRecommendation(inquiryId: number, tenantId?: number): Promise<string | null> {
  // Get all followups for this inquiry, latest first
  const followups = await prisma.followup.findMany({
    where: { inquiryId, ...(tenantId ? { tenantId } : {}) },
    orderBy: { scheduledFor: 'desc' },
  });
  if (!followups.length) {
    return 'No follow-ups yet. Consider sending a welcome message or introductory email.';
  }
  const now = new Date();
  const lastFollowup = followups[0];
  // If last follow-up is not completed and is overdue by 7+ days
  if (
    lastFollowup.status !== 'completed' &&
    new Date(lastFollowup.scheduledFor) < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  ) {
    return 'This lead has not responded in over a week. Consider sending a check-in email or inviting them to an upcoming event.';
  }
  // If there are 2+ pending follow-ups in the past 14 days
  const pendingCount = followups.filter(f => f.status === 'pending' && new Date(f.scheduledFor) < now).length;
  if (pendingCount >= 2) {
    return 'Multiple follow-ups have been missed. Try a different approach: offer a discount, share a testimonial, or invite to a webinar.';
  }
  // If last follow-up note or inquiry sentiment is negative/neutral (optional: add more logic)
  // ...
  return null;
}

/**
 * Predicts the likely outcome of a follow-up and suggests an action.
 * Returns { outcome: string, action: string }
 */
export async function predictFollowupOutcome(inquiryId: number, tenantId?: number): Promise<{ outcome: string, action: string }> {
  // Get inquiry and followups
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, ...(tenantId ? { tenantId } : {}) },
    include: { followups: true },
  });
  if (!inquiry) return { outcome: 'Unknown', action: 'No data available' };
  const score = inquiry.score || 0;
  const sentiment = inquiry.sentiment || 'neutral';
  const paymentStatus = inquiry.paymentStatus || 'Not Paid';
  const followups = inquiry.followups || [];
  const followupCount = followups.length;
  const lastFollowup = followups.length ? followups[followups.length - 1] : null;
  const notes = lastFollowup?.notes || '';
  const inquiryNotes = inquiry.notes || '';

  // Negative/drop-off keywords
  const negativePattern = /not interested|no longer|unsubscribe|drop off|lost interest|not proceeding|not ready|not now|not joining|not enrolling|not registering|not available|not reachable|no reply|unreachable|did not reply|missed call|not responding|declined|rejected|not picking|wrong number|do not call|stop|remove|never|no|disconnected|not valid|not a lead|not a prospect/i;
  // Positive/ready keywords
  const positivePattern = /ready|interested|proceed|proceeding|register|enroll|joining|excited|keen|yes|will pay|will join|will enroll|to pay|to register|to enroll|to join|will pay on|agreed|confirmed|positive|good|ok|okay|approved|accepted|coming|attending|visit|appointment|scheduled|to call back|call back|callback|follow up|follow-up|to follow up|to be contacted|waiting|pending|in progress|almost|close|50%|halfway|considering|thinking|maybe|possible|likely|potential|hopeful|promising|to decide|to confirm|to check|to update|to revert|to respond|to reply|to get back|to feedback|to finalize|to complete|to finish|to submit|to send|to provide|to share|to receive|to collect|to process|to pay deposit|deposit|advance|installment|down payment/i;
  // Neutral/undecided keywords
  const neutralPattern = /send flyer|need more details|need info|need information|need brochure|send brochure|send info|send details|send more|clarify|explain|question|query|doubt|uncertain|not sure|maybe|pending|waiting|to decide|to confirm|to check|to update|to revert|to respond|to reply|to get back|to feedback|to finalize|to complete|to finish|to submit|to send|to provide|to share|to receive|to collect|to process/i;

  if (paymentStatus === 'Paid') {
    return { outcome: 'Converted', action: 'Send welcome message' };
  }
  if ((score > 60 && sentiment === 'positive' && followupCount < 3) || positivePattern.test(notes) || positivePattern.test(inquiryNotes)) {
    return { outcome: 'Likely to convert', action: 'Send payment reminder' };
  }
  if (neutralPattern.test(notes) || neutralPattern.test(inquiryNotes)) {
    return { outcome: '50% near conversion', action: 'Send more details or follow up with call' };
  }
  if (sentiment === 'negative' || negativePattern.test(notes) || negativePattern.test(inquiryNotes)) {
    return { outcome: 'At risk of drop-off', action: 'Offer discount or escalate to senior staff' };
  }
  if (followupCount > 4) {
    return { outcome: 'Low conversion likelihood', action: 'Send final offer or archive' };
  }
  return { outcome: 'Undecided', action: 'Send more information or invite to event' };
} 