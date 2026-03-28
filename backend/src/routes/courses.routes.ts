import { Router } from 'express';
import * as coursesController from '../controllers/courses.controller';
import { rbacGuard } from '../middleware/rbac';

const router = Router();

router.get('/', coursesController.getAllCourses);
router.get('/suggest', coursesController.getSuggestedPrograms);
router.post('/seed', rbacGuard('settings'), coursesController.seedFromInquiries);
router.post('/', rbacGuard('settings'), coursesController.createCourse);
router.put('/:id', rbacGuard('settings'), coursesController.updateCourse);
router.delete('/:id', rbacGuard('settings'), coursesController.deleteCourse);

export default router;
