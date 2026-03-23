import express from 'express';
import { 
  getOrCreateDirectChat, 
  getUserChats, 
  getChatMessages, 
  sendMessage, 
  markMessageRead, 
  getChatUsers, 
  searchInquiriesForTag,
  getMentions,
  getMessageById,
  deleteMessageById,
  getOrCreateOfficersGroup,
  deleteOrLeaveChatRoom,
  createGroupChat,
  clearAllGroupChats
} from '../controllers/chat.controller';
import prisma from '../lib/prisma';

function safeJson(res: express.Response, body: any) {
  if (res.headersSent) return;
  res.json(body);
}

const router = express.Router();

// Chat room operations
router.post('/direct', getOrCreateDirectChat);
router.get('/rooms', getUserChats);
router.get('/group/officers', getOrCreateOfficersGroup);
router.post('/group', createGroupChat);
router.delete('/group', clearAllGroupChats);
router.get('/users', getChatUsers);
router.get('/mentions', getMentions);

// Message operations
router.get('/rooms/:chatRoomId/messages', getChatMessages);
router.post('/rooms/:chatRoomId/messages', sendMessage);
router.put('/messages/:messageId/read', markMessageRead);
router.get('/messages/:messageId', getMessageById);
router.delete('/messages/:messageId', deleteMessageById);
router.delete('/rooms/:chatRoomId', deleteOrLeaveChatRoom);

// Search operations
router.get('/search/inquiries', searchInquiriesForTag);

// Unread counts for a user (mentions + unread direct/group messages)
router.get('/unread-count', async (req, res) => {
  try {
    const email = String(req.query.user || '').trim().toLowerCase();
    if (!email) return safeJson(res, { count: 0 });

    const tenantId = (req as any).tenant?.id;
    const user = await prisma.user.findFirst({
      where: { tenantId, email: { equals: email, mode: 'insensitive' } },
      select: { id: true }
    });
    if (!user) return safeJson(res, { count: 0 });

    const participants = await prisma.chatParticipant.findMany({
      where: { userId: user.id },
      select: { chatRoomId: true, lastReadAt: true }
    });
    if (participants.length === 0) return safeJson(res, { count: 0 });

    const unreadCounts = await Promise.all(
      participants.map(async (p) => {
        const where: any = {
          chatRoomId: p.chatRoomId,
          senderId: { not: user.id },
        };
        if (p.lastReadAt) {
          where.createdAt = { gt: p.lastReadAt };
        }
        return prisma.message.count({ where }).catch(() => 0);
      })
    );
    const unreadMessages = unreadCounts.reduce((a, b) => a + b, 0);

    const mentions = await prisma.messageTag.count({
      where: { type: 'user', targetId: String(user.id) }
    }).catch(() => 0);

    return safeJson(res, { count: unreadMessages + mentions });
  } catch (e) {
    return safeJson(res, { count: 0 });
  }
});

// Mark all as read for a user (simplified)
router.post('/mark-read', async (_req, res) => {
  try {
    const req = _req as any;
    const email = String(req.body?.user || '').trim().toLowerCase();
    if (!email) return safeJson(res, { success: false });

    const tenantId = req.tenant?.id;
    const user = await prisma.user.findFirst({
      where: { tenantId, email: { equals: email, mode: 'insensitive' } },
      select: { id: true }
    });
    if (!user) return safeJson(res, { success: false });

    await prisma.chatParticipant.updateMany({
      where: { userId: user.id },
      data: { lastReadAt: new Date() }
    });

    return safeJson(res, { success: true });
  } catch {
    return safeJson(res, { success: false });
  }
});

export default router;
