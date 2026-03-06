import jwt from 'jsonwebtoken';
import { AuthConfig, AuthUser } from './types.js';

export class AuthService {
  constructor(private readonly config: AuthConfig) {}

  login(email: string, password: string): string | null {
    if (
      email !== this.config.adminEmail ||
      password !== this.config.adminPassword
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
      const payload = jwt.verify(token, this.config.jwtSecret) as AuthUser;
      return payload;
    } catch {
      return null;
    }
  }
}
