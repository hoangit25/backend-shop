import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/appError';

/**
 * Middleware kiểm tra Role của người dùng
 * Super Admin luôn có toàn quyền bypass
 */
export const requireRoles = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return next(
        AppError.Unauthorized('Yêu cầu đăng nhập để truy cập', 'UNAUTHORIZED')
      );
    }

    const roles: any[] = user.roles || [];
    const roleSlugs = roles.map((r: any) =>
      typeof r === 'string' ? r.toLowerCase() : (r.slug || r.name || '').toLowerCase()
    );

    // Super Admin luôn có tất cả các quyền
    if (roleSlugs.includes('super-admin')) {
      return next();
    }

    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    const hasRole = roleSlugs.some((r) => normalizedAllowed.includes(r));

    if (!hasRole) {
      return next(
        AppError.Forbidden(
          'Bạn không có quyền thực hiện hành động này',
          'FORBIDDEN_ROLE'
        )
      );
    }

    next();
  };
};

/**
 * Middleware kiểm tra Permission chi tiết
 * Admin và Super-Admin tự động có TẤT CẢ các quyền (Tạo, Sửa, Xóa, Xem)
 */
export const requirePermissions = (...requiredPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return next(
        AppError.Unauthorized('Yêu cầu đăng nhập để truy cập', 'UNAUTHORIZED')
      );
    }

    const roles: any[] = user.roles || [];
    const roleSlugs = roles.map((r: any) =>
      typeof r === 'string' ? r.toLowerCase() : (r.slug || r.name || '').toLowerCase()
    );

    // Admin và Super-Admin có TẤT CẢ các quyền (Create, Read, Update, Delete)
    if (roleSlugs.includes('super-admin') || roleSlugs.includes('admin')) {
      return next();
    }

    // Thu thập toàn bộ permission codes từ các roles của user
    const userPermissionCodes = new Set<string>();
    for (const r of roles) {
      if (r && Array.isArray(r.permissions)) {
        for (const p of r.permissions) {
          if (p && typeof p === 'object' && p.code) {
            userPermissionCodes.add(p.code.toLowerCase());
          }
        }
      }
    }

    // Áp dụng permissionOverrides của user
    const overrides: any[] = user.permissionOverrides || [];
    for (const ov of overrides) {
      const code = ov.permission?.code || ov.permission;
      if (code && typeof code === 'string') {
        const lower = code.toLowerCase();
        if (ov.effect === 'ALLOW') {
          userPermissionCodes.add(lower);
        } else if (ov.effect === 'DENY') {
          userPermissionCodes.delete(lower);
        }
      }
    }

    // Kiểm tra xem user có đủ permission không
    const hasAll = requiredPermissions.every((perm) =>
      userPermissionCodes.has(perm.toLowerCase())
    );

    if (!hasAll) {
      return next(
        AppError.Forbidden(
          `Bạn cần quyền [${requiredPermissions.join(', ')}] để thực hiện hành động này`,
          'FORBIDDEN_PERMISSION'
        )
      );
    }

    next();
  };
};
