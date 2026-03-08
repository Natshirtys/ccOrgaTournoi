import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { AuthConfig, AuthUser } from './types.js';

function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const authUserSchema = z.object({
  email: z.string().email(),
  role: z.literal('admin'),
});

export class AuthService {
  constructor(private readonly config: AuthConfig) {}

  login(email: string, password: string): string | null {
    if (
      !safeCompare(email, this.config.adminEmail) ||
      !safeCompare(password, this.config.adminPassword)
    ) {
      return null;
    }

    const payload: AuthUser = { email, role: 'admin' };
    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.tokenExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  verifyToken(token: string): AuthUser | null {
    try {
      const raw = jwt.verify(token, this.config.jwtSecret);
      const result = authUserSchema.safeParse(raw);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }
}
