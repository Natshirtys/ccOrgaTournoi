export interface AuthUser {
  email: string;
  role: 'admin';
}

export interface AuthConfig {
  jwtSecret: string;
  adminEmail: string;
  adminPassword: string;
  tokenExpiresIn: string;
}

// Extension du type Request Express pour y attacher l'utilisateur authentifié
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
