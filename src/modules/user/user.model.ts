import mongoose, { Schema, Types, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  avatar: string;
  permissionOverrides: [];
  isEmailVerified: boolean;
  roles: Types.ObjectId[];
  isActive: boolean;
  deleted: boolean;
  deletedAt: Date | null;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const permissionOverrideSchema = new Schema(
  {
    permission: {
      type: Types.ObjectId,
      ref: 'Permission',
      required: true,
    },
    effect: {
      type: String,
      enum: ['ALLOW', 'DENY'],
      required: true,
    },
  },
  {
    _id: false,
  }
);

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
    permissionOverrides: {
      type: [permissionOverrideSchema],
      default: [],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    roles: [
      {
        type: Types.ObjectId,
        ref: 'Role',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({
  deleted: 1,
  isActive: 1,
});

const UserModel = mongoose.model<IUser>('User', userSchema, 'Users');
export default UserModel;
