import { Router } from 'express';
import { userController } from './user.controller';
import { requirePermissions } from '../../middlewares/authorization.middleware';

const router = Router();

// Thống kê người dùng
router.get('/stats', userController.getStats);

// Danh sách người dùng
router.get('/', requirePermissions('user:view'), userController.getUsers);

// Chi tiết người dùng
router.get('/:id', requirePermissions('user:view'), userController.getUserById);

// Tạo mới người dùng (Admin tạo & cấp quyền)
router.post('/', requirePermissions('user:create'), userController.createUser);

// Cập nhật người dùng (Đổi vai trò, cấp quyền, sửa thông tin, khóa tài khoản)
router.put('/:id', requirePermissions('user:update'), userController.updateUser);

// Xóa người dùng
router.delete('/:id', requirePermissions('user:delete'), userController.deleteUser);

export const adminUserRouter = router;
