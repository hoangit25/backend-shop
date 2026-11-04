import { Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import { AuthService, authService, ClientContext } from './auth.service';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function getClientContext(req: Request): ClientContext {
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || 'Unknown';
  const userAgent = (req.headers['user-agent'] as string) || 'Unknown';
  const currentToken = (req as any).token || req.headers.authorization?.split(' ')[1];
  return { ipAddress, userAgent, currentToken };
}

export class AuthController {
  constructor(private service: AuthService = authService) {}

  registerUser = asyncHandler(async (req: Request, res: Response) => {
    const context = getClientContext(req);
    const user = await this.service.register(req.body, context);
    return ApiResponse.created(res, user, 'User registered successfully');
  });

  loginUser = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const context = getClientContext(req);
    const result = await this.service.login(email, password, context);

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return ApiResponse.success(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
      },
      'Login successful'
    );
  });

  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return ApiResponse.message(
        res,
        'Refresh token is missing. Please log in again.',
        401
      );
    }

    const context = getClientContext(req);
    const result = await this.service.verifyRefreshToken(token, context);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    return ApiResponse.success(
      res,
      {
        accessToken: result.accessToken,
      },
      'Tokens refreshed successfully'
    );
  });
}

//   logoutUser = asyncHandler(async (req: Request, res: Response) => {
//     const logoutContext = (req as any).logoutContext || {};
//     const userId = logoutContext.userId || (req as any).user?._id;
//     const sessionId = logoutContext.sessionId || (req as any).sessionId;
//     const jti = logoutContext.jti || (req as any).jti;
//     const currentToken = logoutContext.currentAccessToken || (req as any).token || req.headers.authorization?.split(' ')[1];
//     const refreshToken = logoutContext.refreshToken || req.cookies?.refreshToken || req.body?.refreshToken;

//     const context = getClientContext(req);

//     const result = await this.service.logout(
//       {
//         userId: userId ? String(userId) : undefined,
//         sessionId,
//         jti,
//         currentToken,
//         refreshToken,
//       },
//       context
//     );

//     res.clearCookie('refreshToken', {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'strict',
//     });

//     return ApiResponse.success(res, result, 'Logged out successfully');
//   });

//   logoutAll = asyncHandler(async (req: Request, res: Response) => {
//     const logoutContext = (req as any).logoutContext || {};
//     const userId = logoutContext.userId || (req as any).user?._id;
//     const currentToken = logoutContext.currentAccessToken || (req as any).token || req.headers.authorization?.split(' ')[1];
//     const context = getClientContext(req);

//     if (!userId) {
//       return ApiResponse.message(res, 'User identity could not be verified', 401);
//     }

//     const result = await this.service.logoutAllDevices(String(userId), currentToken, context);

//     res.clearCookie('refreshToken', {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'strict',
//     });

//     return ApiResponse.success(res, result, 'Logged out from all devices successfully');
//   });

//   getSessions = asyncHandler(async (req: Request, res: Response) => {
//     const userId = (req as any).user?._id;
//     const sessions = await this.service.getUserSessions(String(userId));
//     return ApiResponse.success(res, sessions, 'Active sessions retrieved successfully');
//   });

//   revokeSession = asyncHandler(async (req: Request, res: Response) => {
//     const userId = (req as any).user?._id;
//     const sessionId = String(req.params.sessionId);
//     const context = getClientContext(req);

//     const result = await this.service.revokeSession(String(userId), sessionId, context);
//     return ApiResponse.success(res, result, 'Session revoked successfully');
//   });

//   revokeAllOtherSessions = asyncHandler(async (req: Request, res: Response) => {
//     const userId = (req as any).user?._id;
//     const currentRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
//     const currentSessionId = (req as any).sessionId;
//     const context = getClientContext(req);

//     const result = await this.service.revokeAllOtherSessions(
//       String(userId),
//       currentRefreshToken,
//       currentSessionId,
//       context
//     );
//     return ApiResponse.success(res, result, 'Other sessions revoked successfully');
//   });

//   getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
//     const userId = (req as any).user?._id;
//     const limit = parseInt(req.query.limit as string, 10) || 50;
//     const logs = await this.service.getAuditLogs(String(userId), limit);
//     return ApiResponse.success(res, logs, 'Security audit logs retrieved successfully');
//   });
// }

export const authController = new AuthController();
// export const registerUser = authController.registerUser;
// export const loginUser = authController.loginUser;
// export const refreshToken = authController.refreshToken;
// export const logoutUser = authController.logoutUser;
// export const logoutAll = authController.logoutAll;
// export const getSessions = authController.getSessions;
// export const revokeSession = authController.revokeSession;
// export const revokeAllOtherSessions = authController.revokeAllOtherSessions;
// export const getAuditLogs = authController.getAuditLogs;
