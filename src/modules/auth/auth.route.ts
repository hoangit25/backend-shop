import { Router } from 'express';
import {authController} from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import * as authSchemaZod from './auth.schema';

const router = Router();

// Public auth endpoints
router.post('/register', validate(authSchemaZod.registerSchema), authController.registerUser);
router.post('/login', validate(authSchemaZod.loginSchema), authController.loginUser);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', validate(authSchemaZod.forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-otp', validate(authSchemaZod.verifyOtpSchema), authController.verifyOtp);
router.post('/reset-password', validate(authSchemaZod.resetPasswordSchema), authController.resetPassword);


// // Logout endpoints (hỗ trợ xác minh Access Token HOẶC Refresh Token)
// router.post('/logout', verifyAuthForLogout, authController.logoutUser);
// router.post('/logout-all', verifyAuthForLogout, authController.logoutAll);

// // Protected auth & session management endpoints
// router.get('/sessions', verifyToken, authController.getSessions);
// router.delete('/sessions/other', verifyToken, authController.revokeAllOtherSessions);
// router.delete('/sessions/:sessionId', verifyToken, authController.revokeSession);
// router.get('/audit-logs', verifyToken, authController.getAuditLogs);

export const authRouter = router;
