import { Router } from 'express';
import { roleController } from './role.controller';

const router = Router();

router.get('/', roleController.getRoles);
router.get('/permissions', roleController.getPermissions);

export const adminRoleRouter = router;
