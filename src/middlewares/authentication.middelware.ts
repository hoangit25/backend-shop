import { Request, Response, NextFunction } from 'express';
import * as jwtConfig from '../config/jwt.config';
import UserModel from '../modules/user/user.model';
import SessionModel from '../modules/auth/model/session.model';
import { AppError } from '../common/appError';

export const verifyToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.Unauthorized(
        'Access token is missing or invalid format',
        'MISSING_TOKEN'
      );
    }

    const accessToken = authHeader.split(' ')[1];
    const decoded = jwtConfig.verifyAccessToken(accessToken);

    // 1. Kiểm tra JTI trong Blacklist
    // if (decoded.jti) {
    //   const isBlacklisted = await BlacklistedTokenModel.exists({ jti: decoded.jti });
    //   if (isBlacklisted) {
    //     throw AppError.Unauthorized(
    //       'Token has been revoked. Please log in again.',
    //       'TOKEN_REVOKED'
    //     );
    //   }
    // }

    // 2. Kiểm tra Session có bị thu hồi (isRevoked) không
    if (decoded.sessionId) {
      const session = await SessionModel.findById(decoded.sessionId);
      if (!session || session.isRevoked) {
        throw AppError.Unauthorized(
          'Session has been revoked. Please log in again.',
          'SESSION_REVOKED'
        );
      }
    }

    // 3. Kiểm tra User
    const user = await UserModel.findOne({
      _id: decoded.id,
      deleted: false,
    });

    if (!user) {
      throw AppError.Unauthorized(
        'User not found or has been deleted',
        'USER_NOT_FOUND'
      );
    }

    if (user.isActive === false) {
      throw AppError.Unauthorized(
        'User account is suspended',
        'ACCOUNT_SUSPENDED'
      );
    }

    (req as any).user = user;
    (req as any).accessToken = accessToken;
    (req as any).jti = decoded.jti;
    (req as any).sessionId = decoded.sessionId;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : error);
  }
};

/**
 * Middleware xác minh Access Token HOẶC Refresh Token để phục vụ logout linh hoạt
 */
// export const verifyAuthForLogout = async (
//   req: Request,
//   _res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const authHeader = req.headers.authorization;
//     const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

//     let userId: string | undefined;
//     let sessionId: string | undefined;
//     let jti: string | undefined;
//     let currentAccessToken: string | undefined;

//     // 1. Kiểm tra Access Token nếu có
//     if (authHeader && authHeader.startsWith('Bearer ')) {
//       currentAccessToken = authHeader.split(' ')[1];
//       try {
//         const decodedAccess = jwtConfig.verifyAccessToken(currentAccessToken);
//         userId = decodedAccess.id;
//         sessionId = decodedAccess.sessionId;
//         jti = decodedAccess.jti;
//       } catch {
//         // Nếu Access Token đã hết hạn, vẫn decode an toàn để lấy jti, sessionId và id
//         const decodedAccess = jwtConfig.decodeAccessToken(currentAccessToken);
//         if (decodedAccess) {
//           userId = decodedAccess.id;
//           sessionId = decodedAccess.sessionId;
//           jti = decodedAccess.jti;
//         }
//       }
//     }

//     // 2. Kiểm tra Refresh Token nếu chưa có đủ thông tin hoặc cần xác định Session
//     if (refreshToken) {
//       try {
//         const decodedRefresh = jwtConfig.verifyRefreshToken(refreshToken);
//         if (!userId) userId = decodedRefresh.id;
//         if (!sessionId) sessionId = decodedRefresh.sessionId;
//       } catch {
//         const decodedRefresh = jwtConfig.decodeRefreshToken(refreshToken);
//         if (decodedRefresh) {
//           if (!userId) userId = decodedRefresh.id;
//           if (!sessionId) sessionId = decodedRefresh.sessionId;
//         }
//       }
//     }

//     // 3. Nếu không xác định được danh tính từ cả hai token
//     if (!userId && !sessionId && !refreshToken) {
//       throw AppError.Unauthorized(
//         'Access token or refresh token is required for logout',
//         'MISSING_LOGOUT_CREDENTIALS'
//       );
//     }

//     // Gán thông tin tìm được vào request
//     (req as any).logoutContext = {
//       userId,
//       sessionId,
//       jti,
//       currentAccessToken,
//       refreshToken,
//     };

//     next();
//   } catch (error) {
//     next(error instanceof AppError ? error : error);
//   }
// };

