import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// Helper functions
const getUserId = (req: Request) => {
  const email = (req as any).user?.email as string;
  if (!email) return null;
  return email;
};

const getUserRole = (req: Request) => {
  return String((req as any).user?.role || '');
};

// Get or create direct chat room between two users
export const getOrCreateDirectChat = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    const { participantEmail } = req.body;

    if (!currentUserEmail || !participantEmail) {
      return res.status(400).json({ error: 'Both user emails are required' });
    }

    if (currentUserEmail === participantEmail) {
      return res.status(400).json({ error: 'Cannot create chat with yourself' });
    }

    // Get user IDs (tenant-scoped)
    const tenantId = (req as any).tenant?.id;
    const [currentUser, participant] = await Promise.all([
      prisma.user.findFirst({ where: { tenantId, email: { equals: currentUserEmail, mode: 'insensitive' } } }),
      prisma.user.findFirst({ where: { tenantId, email: { equals: participantEmail, mode: 'insensitive' } } })
    ]);

    if (!currentUser || !participant) {
      return res.status(404).json({ error: 'One or both users not found' });
    }

    // Check if direct chat already exists
    const existingChat = await prisma.chatRoom.findFirst({
      where: {
        type: 'direct',
        participants: {
          every: {
            userId: {
              in: [currentUser.id, participant.id]
            }
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, email: true, name: true, role: true }
            }
          }
        },
        messages: {
          include: {
            sender: {
              select: { id: true, email: true, name: true }
            },
            tags: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (existingChat) {
      return res.json({ chatRoom: existingChat });
    }

    // Create new direct chat
    const newChat = await prisma.chatRoom.create({
      data: {
        type: 'direct',
        participants: {
          create: [
            { userId: currentUser.id },
            { userId: participant.id }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, email: true, name: true, role: true }
            }
          }
        },
        messages: {
          include: {
            sender: {
              select: { id: true, email: true, name: true }
            },
            tags: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    return res.json({ chatRoom: newChat });
  } catch (error) {
    console.error('Error creating/getting direct chat:', error);
    return res.status(500).json({ error: 'Failed to create/get chat room' });
  }
};

// Get all chat rooms for current user
export const getUserChats = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    if (!currentUserEmail) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const tenantId = (req as any).tenant?.id;
    const currentUser = await prisma.user.findFirst({
      where: { tenantId, email: { equals: currentUserEmail, mode: 'insensitive' } }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const chatRooms = await prisma.chatRoom.findMany({
      where: {
        participants: {
          some: {
            userId: currentUser.id
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, email: true, name: true, role: true }
            }
          }
        },
        messages: {
          include: {
            sender: {
              select: { id: true, email: true, name: true }
            },
            tags: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Format chat rooms to show other participants' names
    const formattedChats = chatRooms.map(chat => {
      const otherParticipants = chat.participants
        .filter(p => p.userId !== currentUser.id)
        .map(p => p.user);

      return {
        ...chat,
        otherParticipants,
        lastMessage: chat.messages[0] || null
      };
    });

    return res.json({ chatRooms: formattedChats });
  } catch (error) {
    console.error('Error getting user chats:', error);
    return res.status(500).json({ error: 'Failed to get chat rooms' });
  }
};

// Ensure an admissions officers group exists and return it (officers only)
export const getOrCreateOfficersGroup = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    if (!currentUserEmail) return res.status(401).json({ error: 'User not authenticated' });

    const tenantId = (req as any).tenant?.id;
    const currentUser = await prisma.user.findFirst({ where: { tenantId, email: { equals: currentUserEmail, mode: 'insensitive' } } });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });
    if (currentUser.role !== 'admissions_officer') {
      return res.status(403).json({ error: 'Only admissions officers can access this group' });
    }

    // Find existing group
    let group = await prisma.chatRoom.findFirst({
      where: { type: 'group', name: 'Group Chat' },
      include: { participants: true }
    });

    // Create if missing
    if (!group) {
      // Get all officers
      const officers = await prisma.user.findMany({ where: { role: 'admissions_officer', approved: true, tenantId } });
      group = await prisma.chatRoom.create({
        data: {
          type: 'group',
          name: 'Group Chat',
          participants: {
            create: officers.map(o => ({ userId: o.id }))
          }
        },
        include: { participants: true }
      });
    } else {
      // Ensure all current officers are participants
      const officers = await prisma.user.findMany({ where: { role: 'admissions_officer', approved: true, tenantId } });
      const existingIds = new Set(group.participants.map(p => p.userId));
      const toAdd = officers.filter(o => !existingIds.has(o.id));
      if (toAdd.length > 0) {
        await prisma.chatParticipant.createMany({ data: toAdd.map(o => ({ userId: o.id, chatRoomId: group!.id })) });
      }
    }

    // Return with populated participants (for display)
    const hydrated = await prisma.chatRoom.findUnique({
      where: { id: group.id },
      include: {
        participants: { include: { user: { select: { id: true, email: true, name: true, role: true } } } },
        messages: {
          include: { sender: { select: { id: true, email: true, name: true } }, tags: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    return res.json({ chatRoom: hydrated });
  } catch (error) {
    console.error('Error creating/getting officers group:', error);
    return res.status(500).json({ error: 'Failed to create/get officers group' });
  }
};

// Create a new group chat consisting only of admissions officers (approved)
export const createGroupChat = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    if (!currentUserEmail) return res.status(401).json({ error: 'User not authenticated' });

    const { name } = req.body as { name?: string };
    const groupName = (name && name.trim()) || 'Group Chat';

    const tenantId = (req as any).tenant?.id;
    const creator = await prisma.user.findFirst({ where: { tenantId, email: { equals: currentUserEmail, mode: 'insensitive' } } });
    if (!creator) return res.status(404).json({ error: 'User not found' });

    // Allow creator to be any role, but members must be admissions_officer
    const officers = await prisma.user.findMany({ where: { role: 'admissions_officer', approved: true, tenantId } });
    if (officers.length === 0) return res.status(400).json({ error: 'No admissions officers available' });

    const room = await prisma.chatRoom.create({
      data: {
        type: 'group',
        name: groupName,
        participants: { create: officers.map(o => ({ userId: o.id })) }
      },
      include: {
        participants: { include: { user: { select: { id: true, email: true, name: true, role: true } } } },
        messages: { take: 0 }
      }
    });

    return res.json({ chatRoom: room });
  } catch (error) {
    console.error('Error creating group chat:', error);
    return res.status(500).json({ error: 'Failed to create group chat' });
  }
};

// Clear all group chats (admin/senior only)
export const clearAllGroupChats = async (req: Request, res: Response) => {
  try {
    const role = getUserRole(req);
    if (!(role === 'admin' || role === 'senior_staff')) {
      return res.status(403).json({ error: 'Only admins or senior staff can clear groups' });
    }

    // Find all group room IDs
    const groups = await prisma.chatRoom.findMany({ where: { type: 'group' }, select: { id: true } });
    const ids = groups.map(g => g.id);
    if (ids.length === 0) return res.json({ success: true, cleared: 0 });

    await prisma.messageTag.deleteMany({ where: { message: { chatRoomId: { in: ids } } } });
    await prisma.message.deleteMany({ where: { chatRoomId: { in: ids } } });
    await prisma.chatParticipant.deleteMany({ where: { chatRoomId: { in: ids } } });
    const result = await prisma.chatRoom.deleteMany({ where: { id: { in: ids } } });

    return res.json({ success: true, cleared: result.count });
  } catch (error) {
    console.error('Error clearing group chats:', error);
    return res.status(500).json({ error: 'Failed to clear group chats' });
  }
};

// Get chat room messages
export const getChatMessages = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    const { chatRoomId } = req.params;

    if (!currentUserEmail) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const tenantId = (req as any).tenant?.id;
    const currentUser = await prisma.user.findFirst({
      where: { tenantId, email: { equals: currentUserEmail, mode: 'insensitive' } }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is participant in this chat
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: parseInt(chatRoomId),
          userId: currentUser.id
        }
      }
    });

    if (!participant) {
      return res.status(403).json({ error: 'Not a participant in this chat' });
    }

    const messages = await prisma.message.findMany({
      where: {
        chatRoomId: parseInt(chatRoomId)
      },
      include: {
        sender: {
          select: { id: true, email: true, name: true }
        },
        tags: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Update last read time
    await prisma.chatParticipant.update({
      where: {
        chatRoomId_userId: {
          chatRoomId: parseInt(chatRoomId),
          userId: currentUser.id
        }
      },
      data: { lastReadAt: new Date() }
    });

    return res.json({ messages });
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return res.status(500).json({ error: 'Failed to get messages' });
  }
};

// Send message
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    // chatRoomId comes from the URL param /rooms/:chatRoomId/messages
    const { chatRoomId } = req.params as { chatRoomId: string };
    const { content, messageType = 'text', metadata, tags } = req.body;

    if (!currentUserEmail) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const tenantId = (req as any).tenant?.id;
    const currentUser = await prisma.user.findFirst({
      where: { tenantId, email: { equals: currentUserEmail, mode: 'insensitive' } }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is participant in this chat
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatRoomId_userId: {
          chatRoomId: parseInt(chatRoomId),
          userId: currentUser.id
        }
      }
    });

    if (!participant) {
      return res.status(403).json({ error: 'Not a participant in this chat' });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        chatRoomId: parseInt(chatRoomId),
        senderId: currentUser.id,
        content,
        messageType,
        metadata: metadata || {},
        readBy: { [currentUser.id]: new Date().toISOString() }
      },
      include: {
        sender: {
          select: { id: true, email: true, name: true }
        },
        tags: true
      }
    });

    // Create tags if provided
    if (tags && Array.isArray(tags)) {
      const tagPromises = tags.map(tag => 
        prisma.messageTag.create({
          data: {
            messageId: message.id,
            type: tag.type,
            targetId: tag.targetId,
            targetName: tag.targetName
          }
        })
      );
      await Promise.all(tagPromises);
    }

    // Update chat room's updatedAt
    await prisma.chatRoom.update({
      where: { id: parseInt(chatRoomId) },
      data: { updatedAt: new Date() }
    });

    // Get message with tags
    const messageWithTags = await prisma.message.findUnique({
      where: { id: message.id },
      include: {
        sender: {
          select: { id: true, email: true, name: true }
        },
        tags: true
      }
    });

    return res.json({ message: messageWithTags });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};

// Mark message as read
export const markMessageRead = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    const { messageId } = req.params;

    if (!currentUserEmail) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const tenantId = (req as any).tenant?.id;
    const currentUser = await prisma.user.findFirst({ where: { tenantId, email: { equals: currentUserEmail, mode: 'insensitive' } } });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Update readBy field
    const readBy = message.readBy as Record<string, string> || {};
    readBy[currentUser.id] = new Date().toISOString();

    await prisma.message.update({
      where: { id: parseInt(messageId) },
      data: { readBy }
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    return res.status(500).json({ error: 'Failed to mark message as read' });
  }
};

// Get unread mentions for current user based on participant lastReadAt
export const getMentions = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    if (!currentUserEmail) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const tenantId = (req as any).tenant?.id;
    const currentUser = await prisma.user.findFirst({ where: { tenantId, email: { equals: currentUserEmail, mode: 'insensitive' } } });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    // Find all participants for this user
    const participants = await prisma.chatParticipant.findMany({
      where: { userId: currentUser.id },
      select: { chatRoomId: true, lastReadAt: true }
    });

    if (participants.length === 0) return res.json({ mentions: [] });

    // Build map of chatRoomId -> lastReadAt
    const lastReadMap = new Map<number, Date | null>();
    participants.forEach(p => lastReadMap.set(p.chatRoomId, p.lastReadAt));

    // Get all message tags mentioning this user in those rooms
    const tags = await prisma.messageTag.findMany({
      where: {
        type: 'user',
        targetId: String(currentUser.id)
      },
      include: {
        message: {
          include: {
            sender: { select: { id: true, email: true, name: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter by lastReadAt per room
    const mentions = tags.filter(tag => {
      const msg: any = tag.message as any;
      const lr = lastReadMap.get(msg.chatRoomId);
      if (!lr) return true;
      return new Date(msg.createdAt) > lr;
    }).map(tag => ({
      id: tag.id,
      chatRoomId: (tag.message as any).chatRoomId,
      messageId: tag.messageId,
      createdAt: tag.createdAt,
      from: (tag.message as any).sender,
      preview: (tag.message as any).content,
      targetName: tag.targetName
    }));

    return res.json({ mentions });
  } catch (error) {
    console.error('Error getting mentions:', error);
    return res.status(500).json({ error: 'Failed to get mentions' });
  }
};

// Get a single message by id (with minimal relations)
export const getMessageById = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const id = parseInt(messageId);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid message id' });

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, email: true, name: true } },
        tags: true
      }
    });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    return res.json({ message });
  } catch (error) {
    console.error('Error getting message by id:', error);
    return res.status(500).json({ error: 'Failed to get message' });
  }
};

// Delete a message (only by sender or admin/senior)
export const deleteMessageById = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    if (!currentUserEmail) return res.status(401).json({ error: 'User not authenticated' });
    const { messageId } = req.params;
    const id = parseInt(messageId);
    const tenantId = (req as any).tenant?.id;
    const user = await prisma.user.findFirst({ where: { tenantId, email: { equals: currentUserEmail, mode: 'insensitive' } } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    const canDelete = msg.senderId === user.id || user.role === 'admin' || user.role === 'senior_staff';
    if (!canDelete) return res.status(403).json({ error: 'Forbidden' });

    await prisma.messageTag.deleteMany({ where: { messageId: id } });
    await prisma.message.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
};

// Delete or leave a chat room
export const deleteOrLeaveChatRoom = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    if (!currentUserEmail) return res.status(401).json({ error: 'User not authenticated' });
    const { chatRoomId } = req.params as { chatRoomId: string };
    const roomId = parseInt(chatRoomId);

    const tenantId = (req as any).tenant?.id;
    const user = await prisma.user.findFirst({ where: { tenantId, email: { equals: currentUserEmail, mode: 'insensitive' } } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Chat not found' });

    const participant = await prisma.chatParticipant.findUnique({
      where: { chatRoomId_userId: { chatRoomId: roomId, userId: user.id } }
    });
    if (!participant) return res.status(403).json({ error: 'Not a participant' });

    if (room.type === 'group') {
      // Leave the group
      await prisma.chatParticipant.delete({ where: { chatRoomId_userId: { chatRoomId: roomId, userId: user.id } } });
      // Clean up empty group
      const remaining = await prisma.chatParticipant.count({ where: { chatRoomId: roomId } });
      if (remaining === 0) {
        await prisma.messageTag.deleteMany({ where: { message: { chatRoomId: roomId } } });
        await prisma.message.deleteMany({ where: { chatRoomId: roomId } });
        await prisma.chatRoom.delete({ where: { id: roomId } });
      }
      return res.json({ success: true, action: 'left' });
    }

    // Direct chat: delete entire room and its content
    await prisma.messageTag.deleteMany({ where: { message: { chatRoomId: roomId } } });
    await prisma.message.deleteMany({ where: { chatRoomId: roomId } });
    await prisma.chatParticipant.deleteMany({ where: { chatRoomId: roomId } });
    await prisma.chatRoom.delete({ where: { id: roomId } });
    return res.json({ success: true, action: 'deleted' });
  } catch (error) {
    console.error('Error deleting/leaving chat:', error);
    return res.status(500).json({ error: 'Failed to delete/leave chat' });
  }
};

// Get all users for chat
export const getChatUsers = async (req: Request, res: Response) => {
  try {
    const currentUserEmail = getUserId(req);
    if (!currentUserEmail) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const users = await prisma.user.findMany({
      where: {
        email: { not: currentUserEmail },
        approved: true,
        tenantId: (req as any).tenant?.id
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      },
      orderBy: { name: 'asc' }
    });

    return res.json({ users });
  } catch (error) {
    console.error('Error getting chat users:', error);
    return res.status(500).json({ error: 'Failed to get users' });
  }
};

// Search inquiries for tagging
export const searchInquiriesForTag = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const inquiries = await prisma.inquiry.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } }
        ],
        tenantId: (req as any).tenant?.id
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        programOfInterest: true
      },
      take: 10
    });

    return res.json({ inquiries });
  } catch (error) {
    console.error('Error searching inquiries:', error);
    return res.status(500).json({ error: 'Failed to search inquiries' });
  }
};
