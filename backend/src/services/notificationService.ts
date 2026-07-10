import prisma from '../lib/prisma';
import { sendEmail, hasSmtpConfig } from '../utils/email';

export type NotificationPriority = 'info' | 'warning' | 'critical';
export type NotificationChannel = 'in_app' | 'email';

export interface StaffNotification {
  userId: number;
  email: string;
  name: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  link?: string;
}

const inAppStore: StaffNotification[] = [];
const MAX_INAPP = 500;

export function pushInAppNotification(n: StaffNotification) {
  inAppStore.push(n);
  if (inAppStore.length > MAX_INAPP) inAppStore.splice(0, inAppStore.length - MAX_INAPP);
}

export function getInAppNotifications(limit = 50): StaffNotification[] {
  return inAppStore.slice(-limit).reverse();
}

export function clearInAppNotifications() {
  inAppStore.length = 0;
}

export async function notifyStaff(
  notification: StaffNotification,
  channels: NotificationChannel[] = ['in_app'],
) {
  if (channels.includes('in_app')) {
    pushInAppNotification(notification);
  }
  if (channels.includes('email') && hasSmtpConfig()) {
    const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#0f766e">${notification.title}</h2>
      <p>${notification.body}</p>
      ${notification.link ? `<p><a href="${notification.link}" style="display:inline-block;padding:10px 20px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px">View Details</a></p>` : ''}
      <hr style="margin-top:24px;border:none;border-top:1px solid #e5e7eb"/>
      <p style="color:#6b7280;font-size:12px">EduSmart CRM - Automated Notification</p>
    </div>`;
    await sendEmail(notification.email, notification.title, notification.body, html);
  }
}
