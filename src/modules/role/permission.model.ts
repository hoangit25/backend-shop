import mongoose, { Schema, Document } from 'mongoose';

export interface IPermission extends Document {
  name: string;
  code: string;
  module: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    module: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const PermissionModel = mongoose.model<IPermission>(
  'Permission',
  permissionSchema,
  'permissions'
);
export default PermissionModel;
