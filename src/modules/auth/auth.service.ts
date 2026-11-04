import mongoose, { Types } from 'mongoose';
import crypto from 'node:crypto';
import * as jwtConfig from '../../config/jwt.config';
import { AppError } from '../../common/appError';
import { AuthRepository, authRepository } from './auth.responsitory';
import SessionModel from './model/session.model';
import {AuditLogService } from'./log/auth.log.service'

export interface ClientContext {
  ipAddress?: string;
  userAgent?: string;
  currentToken?: string;
}

export interface LogoutParams {
  userId?: string;
  sessionId?: string;
  jti?: string;
  currentToken?: string;
  refreshToken?: string;
}
// hash refreshToken 
export const hashRefreshToken = (token: string): string => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

function parseDeviceName(userAgent: string = ''): string {
  if (!userAgent || userAgent === 'Unknown') return 'Unknown Device';
  
  let browser = 'Browser';
  if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';

  let os = 'Unknown OS';
  if (userAgent.includes('Win')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}

function userObjectId(id?: string | Types.ObjectId) {
  if (!id) return undefined;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return undefined;
  }
}

export class AuthService {
  constructor(private repository: AuthRepository = authRepository) {}

  async register(userData: any, context?: ClientContext) {
    const { email, password, fullName } = userData;
    if (!email || !password || !fullName) {
      throw AppError.BadRequest('Missing required registration fields', 'MISSING_FIELDS');
    }

    const existingUser = await this.repository.findByEmail(email);
    if (existingUser) {
      throw AppError.Conflict('Email is already registered', 'EMAIL_REGISTERED');
    }

    const newUser = await this.repository.createNewUser(userData);

    await AuditLogService.record({
      userId: newUser._id,
      email: newUser.email,
      action: 'REGISTER_SUCCESS',
      status: 'SUCCESS',
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    const userObj = newUser.toObject();
    delete (userObj as any).password;
    return userObj;
  }

  async login(email: string, password: string, context?: ClientContext) {
    if (!email || !password) {
      throw AppError.BadRequest('Email and password are required', 'MISSING_CREDENTIALS');
    }

    const user = await this.repository.findByEmail(email);
    if (!user) {
      await AuditLogService.record({
        email,
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        details: { reason: 'User not found' },
      });
      throw AppError.Unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      await AuditLogService.record({
        userId: user.id,
        email,
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        details: { reason: 'Account suspended' },
      });
      throw AppError.Forbidden('Your account has been suspended', 'ACCOUNT_SUSPENDED');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await AuditLogService.record({
        userId: user.id,
        email,
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        details: { reason: 'Invalid password' },
      });
      throw AppError.Unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    
    const deviceName = parseDeviceName(context?.userAgent);
    const userAgent = context?.userAgent || 'Unknown';
    const ipAddress = context?.ipAddress || 'Unknown';
    // 1. Kiểm tra xem đã có session đang hoạt động của cùng user trên thiết bị này chưa (trùng userId và deviceName hoặc userAgent)
    let session = await SessionModel.findOne({
      userId: user.id,
      isRevoked: false,
      $or: [
        { deviceName:deviceName },
        { userAgent:userAgent },
      ],
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days TTL

    let accessToken: string;
    let refreshToken: string;
    let jti: string;

    if (!session) {
      // Chưa có session trên thiết bị này -> Khởi tạo session mới trong Database
      const sessionId = new mongoose.Types.ObjectId();
      const sessionIdStr = sessionId.toString();

      const generated = jwtConfig.generateAccessToken(user, sessionIdStr);
      accessToken = generated.accessToken;
      jti = generated.jti;
      refreshToken = jwtConfig.generateRefreshToken(user, sessionIdStr);
      const refreshTokenHashed = hashRefreshToken(refreshToken)

      session = await SessionModel.create({
        _id: sessionId,
        userId: user._id,
        refreshToken: refreshTokenHashed,
        ipAddress,
        userAgent,
        deviceName,
        isRevoked: false,
        expiresAt,
      });
    } else {
      // Đã có session trên thiết bị này -> Cập nhật session với token mới
      const sessionIdStr = session._id.toString();

      const generated = jwtConfig.generateAccessToken(user, sessionIdStr);
      accessToken = generated.accessToken;
      jti = generated.jti;
      refreshToken = jwtConfig.generateRefreshToken(user, sessionIdStr);
      const refreshTokenHashed = hashRefreshToken(refreshToken);

      session.refreshToken = refreshTokenHashed;
      session.ipAddress = ipAddress;
      session.userAgent = userAgent;
      session.deviceName = deviceName;
      session.expiresAt = expiresAt;
      await session.save();
    }

    // 3. Ghi Audit Log thành công
    await AuditLogService.record({
      userId: user._id,
      email: user.email,
      action: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
      details: { sessionId: session._id, deviceName: session.deviceName, jti },
    });

    const userObj = user.toObject();
    delete (userObj as any).password;

    return {
      user: userObj,
      accessToken,
      refreshToken,
      sessionId: session._id,
    };
  
    
  }

  async verifyRefreshToken(refreshToken: string, context?: ClientContext) {
    if (!refreshToken) {
      throw AppError.BadRequest('Refresh token is required', 'MISSING_REFRESH_TOKEN');
    }

    let decoded: any;
    try {
      decoded = jwtConfig.verifyRefreshToken(refreshToken);
    } catch {
      await AuditLogService.record({
        action: 'REFRESH_TOKEN_FAILED',
        status: 'FAILED',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        details: { reason: 'JWT signature verification failed or token expired' },
      });
      throw AppError.Unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }
    const refreshTokenHashed = hashRefreshToken(refreshToken);
    // Tìm session theo sessionId trong token hoặc theo refreshToken chuỗi
    const session = await SessionModel.findOne({
      $or: [
        { refreshToken : refreshTokenHashed },
        ...(decoded.sessionId ? [{ _id: decoded.sessionId }] : []),
      ],
    });

    if (!session) {
      await AuditLogService.record({
        userId: userObjectId(decoded.id),
        action: 'REFRESH_TOKEN_FAILED',
        status: 'WARNING',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        details: { reason: 'Session not found or expired' },
      });
      throw AppError.Unauthorized('Session has expired or does not exist. Please log in again.', 'SESSION_NOT_FOUND');
    }

    // Kiểm tra session đã bị thu hồi (isRevoked = true)
    if (session.isRevoked) {
      await AuditLogService.record({
        userId: userObjectId(decoded.id),
        action: 'REFRESH_TOKEN_FAILED',
        status: 'WARNING',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        details: { sessionId: session._id, reason: 'Session has been revoked' },
      });
      throw AppError.Unauthorized(
        'Session has been revoked. Please log in again.',
        'SESSION_REVOKED'
      );
    }

    // Phòng chống Token Reuse: Nếu refreshToken gửi lên khác với refreshToken hiện tại của session
    if (session.refreshToken !== refreshTokenHashed) {
      session.isRevoked = true;
      await session.save();

      await AuditLogService.record({
        userId: userObjectId(decoded.id),
        action: 'REFRESH_TOKEN_FAILED',
        status: 'WARNING',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        details: { sessionId: session._id, reason: 'Token reuse detected, session revoked immediately' },
      });

      throw AppError.Forbidden(
        'Security Alert: Old refresh token reuse detected. Session has been revoked. Please log in again.',
        'TOKEN_REUSE'
      );
    }

    const user = await this.repository.findByIdActive(decoded.id);
    if (!user || !user.isActive) {
      session.isRevoked = true;
      await session.save();
      throw AppError.Forbidden('User account is suspended or unavailable', 'ACCOUNT_SUSPENDED');
    }

    // Xoay vòng cặp Token (Token Rotation) gắn liền với sessionId của session này
    const { accessToken: newAccessToken } = jwtConfig.generateAccessToken(user, session._id.toString());
    const newRefreshToken = jwtConfig.generateRefreshToken(user, session._id.toString());
    const newRefreshTokenHashed = hashRefreshToken(newRefreshToken)
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    session.refreshToken = newRefreshTokenHashed;
    session.ipAddress = context?.ipAddress || session.ipAddress;
    session.userAgent = context?.userAgent || session.userAgent;
    session.expiresAt = newExpiresAt;
    await session.save();

    await AuditLogService.record({
      userId: user._id,
      email: user.email,
      action: 'REFRESH_TOKEN_SUCCESS',
      status: 'SUCCESS',
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      details: { sessionId: session._id },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionId: session._id,
    };
  }
}
  /**
   * Quy trình Logout chuẩn 6 bước:
   * 1. Xác minh Access Token hoặc Refresh Token hợp lệ (đã làm ở middleware hoặc phân tích tại đây).
   * 2. Xác định đúng sessionId.
   * 3. Đặt session.isRevoked = true.
   * 4. Đưa jti của Access Token hiện tại vào blacklist.
   * 5. Ghi audit log.
   * 6. Trả về kết quả để controller xóa cookie/token khỏi client.
   */
//   async logout(
//     target: string | LogoutParams,
//     refreshTokenOrContext?: string | ClientContext,
//     optionalContext?: ClientContext
//   ) {
//     let userId: string | undefined;
//     let sessionId: string | undefined;
//     let jti: string | undefined;
//     let currentToken: string | undefined;
//     let refreshToken: string | undefined;
//     let context: ClientContext | undefined;

//     if (typeof target === 'string') {
//       userId = target;
//       refreshToken = typeof refreshTokenOrContext === 'string' ? refreshTokenOrContext : undefined;
//       context = typeof refreshTokenOrContext === 'object' ? (refreshTokenOrContext as ClientContext) : optionalContext;
//     } else {
//       userId = target.userId;
//       sessionId = target.sessionId;
//       jti = target.jti;
//       currentToken = target.currentToken;
//       refreshToken = target.refreshToken;
//       context = refreshTokenOrContext as ClientContext;
//     }

//     // 1. Phân tích thêm thông tin từ Access Token nếu chưa có
//     if (currentToken && (!jti || !sessionId || !userId)) {
//       const decodedAccess = jwtConfig.decodeAccessToken(currentToken);
//       if (decodedAccess) {
//         if (!jti) jti = decodedAccess.jti;
//         if (!sessionId) sessionId = decodedAccess.sessionId;
//         if (!userId) userId = decodedAccess.id;
//       }
//     }

//     // 1b. Phân tích thêm thông tin từ Refresh Token nếu chưa có
//     if (refreshToken && (!sessionId || !userId)) {
//       const decodedRefresh = jwtConfig.decodeRefreshToken(refreshToken);
//       if (decodedRefresh) {
//         if (!sessionId) sessionId = decodedRefresh.sessionId;
//         if (!userId) userId = decodedRefresh.id;
//       }
//     }

//     // 2. Xác định đúng sessionId trong Database
//     let session = null;
//     if (sessionId) {
//       session = await SessionModel.findById(sessionId);
//     }
//     if (!session && refreshToken) {
//       session = await SessionModel.findOne({ refreshToken });
//     }

//     // 3. Đặt session.isRevoked = true
//     if (session) {
//       sessionId = session._id.toString();
//       userId = userId || session.userId.toString();
//       session.isRevoked = true;
//       await session.save();
//     } else if (sessionId) {
//       await SessionModel.updateOne({ _id: sessionId }, { $set: { isRevoked: true } });
//     }

//     // 4. Đưa jti của Access Token hiện tại vào Blacklist (nếu có jti)
//     if (jti) {
//       let expDate = new Date(Date.now() + 15 * 60 * 1000);
//       if (currentToken) {
//         const decoded = jwtConfig.decodeAccessToken(currentToken);
//         if (decoded?.exp) {
//           expDate = new Date(decoded.exp * 1000);
//         }
//       }

//       await BlacklistedTokenModel.create({
//         jti,
//         userId: userObjectId(userId),
//         sessionId: userObjectId(sessionId),
//         reason: 'LOGOUT',
//         expiresAt: expDate,
//       }).catch(() => {}); // Bỏ qua nếu đã blacklist trước đó
//     }

//     // 5. Ghi Audit Log
//     await AuditLogService.record({
//       userId: userObjectId(userId),
//       action: 'LOGOUT',
//       status: 'SUCCESS',
//       ipAddress: context?.ipAddress,
//       userAgent: context?.userAgent,
//       details: {
//         sessionId: session?._id || sessionId || 'UNKNOWN_SESSION',
//         deviceName: session?.deviceName || parseDeviceName(context?.userAgent),
//         jti: jti || 'NONE',
//       },
//     });

//     return {
//       message: 'Logged out successfully',
//       sessionId: session?._id || sessionId,
//     };
//   }

//   /**
//    * C. Logout tất cả thiết bị
//    * Đặt isRevoked = true cho mọi session đang hoạt động của người dùng.
//    * Các Access Token và Refresh Token gắn với các session đó sẽ bị từ chối ở những lần request/refresh tiếp theo.
//    */
//   async logoutAllDevices(userId: string, currentToken?: string, context?: ClientContext) {
//     if (!userId) {
//       throw AppError.Unauthorized('User not identified', 'UNAUTHORIZED');
//     }

//     // 1. Đặt isRevoked = true cho mọi session đang hoạt động của người dùng
//     const result = await SessionModel.updateMany(
//       { userId, isRevoked: false },
//       { $set: { isRevoked: true } }
//     );

//     // 2. Blacklist Access Token hiện tại nếu có
//     if (currentToken) {
//       const decoded = jwtConfig.decodeAccessToken(currentToken);
//       if (decoded?.jti) {
//         const expDate = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 15 * 60 * 1000);
//         await BlacklistedTokenModel.create({
//           jti: decoded.jti,
//           userId: userObjectId(userId),
//           reason: 'LOGOUT_ALL',
//           expiresAt: expDate,
//         }).catch(() => {});
//       }
//     }

//     // 3. Ghi Audit Log
//     await AuditLogService.record({
//       userId: userObjectId(userId),
//       action: 'LOGOUT_ALL',
//       status: 'SUCCESS',
//       ipAddress: context?.ipAddress,
//       userAgent: context?.userAgent,
//       details: {
//         revokedSessionCount: result.modifiedCount,
//       },
//     });

//     return {
//       message: `All ${result.modifiedCount} active session(s) have been revoked successfully`,
//       revokedCount: result.modifiedCount,
//     };
//   }

//   async getUserSessions(userId: string) {
//     return SessionModel.find({ userId, isRevoked: false })
//       .select('_id ipAddress userAgent deviceName createdAt updatedAt')
//       .sort({ updatedAt: -1 })
//       .lean();
//   }

//   async revokeSession(userId: string, sessionId: string, context?: ClientContext) {
//     const session = await SessionModel.findOne({ _id: sessionId, userId });
//     if (!session) {
//       throw AppError.NotFound('Session not found', 'SESSION_NOT_FOUND');
//     }

//     session.isRevoked = true;
//     await session.save();

//     await AuditLogService.record({
//       userId: userObjectId(userId),
//       action: 'SESSION_REVOKED',
//       status: 'SUCCESS',
//       ipAddress: context?.ipAddress,
//       userAgent: context?.userAgent,
//       details: { revokedSessionId: sessionId, deviceName: session.deviceName },
//     });

//     return { message: 'Session revoked successfully' };
//   }

//   async revokeAllOtherSessions(userId: string, currentRefreshToken?: string, currentSessionId?: string, context?: ClientContext) {
//     const query: any = { userId, isRevoked: false };
//     if (currentSessionId) {
//       query._id = { $ne: currentSessionId };
//     } else if (currentRefreshToken) {
//       query.refreshToken = { $ne: currentRefreshToken };
//     }

//     const result = await SessionModel.updateMany(query, { $set: { isRevoked: true } });

//     await AuditLogService.record({
//       userId: userObjectId(userId),
//       action: 'ALL_OTHER_SESSIONS_REVOKED',
//       status: 'SUCCESS',
//       ipAddress: context?.ipAddress,
//       userAgent: context?.userAgent,
//       details: { revokedCount: result.modifiedCount },
//     });

//     return { message: `Revoked ${result.modifiedCount} other active sessions` };
//   }

//   async getAuditLogs(userId: string, limit = 50) {
//     return AuditLogService.getUserLogs(userId, limit);
//   }
// }

export const authService = new AuthService();
