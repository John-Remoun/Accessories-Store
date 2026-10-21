import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.config';

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  branchId?: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign(payload, env.jwt.accessSecret, options);
}

export function generateRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign(payload, env.jwt.refreshSecret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.accessSecret, {
    algorithms: ['HS256'],
  }) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.refreshSecret, {
    algorithms: ['HS256'],
  }) as JwtPayload;
}
