import express from 'express';
import { getComments, createComment, editComment, deleteComment } from '../controllers/followupComment.controller';

const router = express.Router();

router.get('/:followupId/comments', getComments);
router.post('/:followupId/comments', createComment);
router.put('/:followupId/comments/:commentId', editComment);
router.delete('/:followupId/comments/:commentId', deleteComment);

export default router; 