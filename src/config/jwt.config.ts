import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import 'dotenv/config';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "FATAL ERROR: JWT Secret variables are not fully defined in environment variables."
  );
}

interface UserPayload {
  _id: any;
  email: string;
}

export interface AccessTokenPayload extends JwtPayload {
  id: string;
  email: string;
  jti: string;
  sessionId?: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  id: string;
  email: string;
  sessionId?: string;
}

// Tạo accessToken và jti
export const generateAccessToken =(
  user: UserPayload,
  sessionId?: string
): { accessToken: string; jti: string }=> {
  const jti = crypto.randomUUID();
  const payload: AccessTokenPayload = {
    id: String(user._id),
    email: user.email,
    jti,
    ...(sessionId ? { sessionId: sessionId } : {}),
  };
  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: "15m" });
  return { accessToken, jti };
};

//xác thực accessToken 
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, JWT_ACCESS_SECRET) as AccessTokenPayload;
};

// decode accessToken 
export const decodeAccessToken = (token: string): AccessTokenPayload | null => {
  try {
    return jwt.decode(token) as AccessTokenPayload;
  } catch {
    return null;
  }
};

// Tạo refreshToken 
export const generateRefreshToken = (
  user: UserPayload,
  sessionId?: string
): string => {
  const payload: RefreshTokenPayload = {
    id: String(user._id),
    email: user.email,
    ...(sessionId ? { sessionId: sessionId } : {}),
  };
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
};


//xác thực refreshToken
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
};


// Decode refreshToken
export const decodeRefreshToken = (token: string): RefreshTokenPayload | null => {
  try {
    return jwt.decode(token) as RefreshTokenPayload;
  } catch {
    return null;
  }
};

