import { Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import RoleModel from './role.model';
import PermissionModel from './permission.model';

export class RoleController {
  getRoles = asyncHandler(async (_req: Request, res: Response) => {
    const roles = await RoleModel.find({ deleted: false, isActive: true })
      .populate('permissions')
      .sort({ createdAt: 1 });
    return ApiResponse.success(res, roles, 'Roles retrieved successfully');
  });

  getPermissions = asyncHandler(async (_req: Request, res: Response) => {
    const permissions = await PermissionModel.find({ deleted: false, isActive: true })
      .sort({ module: 1, name: 1 });
    return ApiResponse.success(res, permissions, 'Permissions retrieved successfully');
  });
}

export const roleController = new RoleController();
