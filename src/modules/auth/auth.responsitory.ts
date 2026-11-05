import { BaseRepository } from '../../common/base-responsitory';
import UserModel, { IUser } from '../user/user.model';

export class AuthRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  async findByEmail(email: string) {
    return this.findOne({ email, deleted: false });
  }


  async findByResetOtp(email: string, hashedOtp: string) {
    return this.findOne({
      email,
      passwordResetOtp: hashedOtp,
      passwordResetExpires: { $gt: new Date() },
      deleted: false,
      isActive: true,
    });
  }

  async findByResetToken(email: string, hashedToken: string) {
    return this.findOne({
      email,
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
      deleted: false,
      isActive: true,
    });
  }

  async findByIdActive(id: string) {
    return this.findOne({ _id: id, deleted: false });
  }

  async createNewUser(userData: any) {
    return this.create({
      fullName: userData.fullName,
      email: userData.email,
      password: userData.password,
      phone: userData.phone || '',
      avatar: userData.avatar || '',
      isActive: true,
      deleted: false,
    });
  }
}

export const authRepository = new AuthRepository();
export const UserRepository = authRepository;
