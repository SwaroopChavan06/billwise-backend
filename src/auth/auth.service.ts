import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export interface AuthenticatedUser {
  email: string;
  name: string;
  picture: string;
}

interface SessionPayload {
  id: string;
  expiresAt: number;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly allowedEmails = new Set(
    (process.env.GOOGLE_ALLOWED_EMAILS ?? 'swaroopch06@gmail.com,ramdas2758@gmail.com')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  private readonly sessionSecret = this.getSessionSecret();
  private readonly activeSessions = new Map<string, number>();
  readonly sessionCookieName = 'billwise_session';
  readonly sessionMaxAgeMs = 8 * 60 * 60 * 1000;

  async signIn(credential: string): Promise<{ token: string; user: AuthenticatedUser }> {
    if (!this.clientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured. Set GOOGLE_CLIENT_ID on the API.');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google credential is invalid or expired');
    }

    if (!payload) throw new UnauthorizedException('Google credential does not contain a user profile');
    const email = payload?.email?.trim().toLowerCase();
    if (!email || payload.email_verified !== true || !this.allowedEmails.has(email)) {
      throw new UnauthorizedException('This Google account is not authorized to use Billwise');
    }

    const user: AuthenticatedUser = {
      email,
      name: payload.name?.trim() || email,
      picture: payload.picture ?? '',
    };
    const expiresAt = Date.now() + this.sessionMaxAgeMs;
    const id = randomUUID();
    this.activeSessions.set(id, expiresAt);
    const token = this.signSession({ id, expiresAt, user });
    return { token, user };
  }

  getUserFromCookie(cookieHeader?: string): AuthenticatedUser | null {
    const session = this.readSession(this.getCookieValue(cookieHeader));
    return session?.user ?? null;
  }

  signOut(cookieHeader?: string): void {
    const session = this.readSession(this.getCookieValue(cookieHeader));
    if (session) this.activeSessions.delete(session.id);
  }

  getCookieOptions() {
    const secure = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' as const : 'lax' as const,
      path: '/',
      maxAge: this.sessionMaxAgeMs,
    };
  }

  private getSessionSecret(): string {
    const configuredSecret = process.env.GOOGLE_SESSION_SECRET ?? process.env.JWT_SECRET;
    if (configuredSecret) return configuredSecret;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Set GOOGLE_SESSION_SECRET or JWT_SECRET before starting the API in production');
    }
    return randomBytes(32).toString('hex');
  }

  private signSession(payload: SessionPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.createSignature(encodedPayload).toString('base64url');
    return `${encodedPayload}.${signature}`;
  }

  private readSession(token?: string): SessionPayload | null {
    if (!token) return null;
    const [encodedPayload, encodedSignature, ...extra] = token.split('.');
    if (!encodedPayload || !encodedSignature || extra.length > 0) return null;

    let signature: Buffer;
    let payload: SessionPayload;
    try {
      signature = Buffer.from(encodedSignature, 'base64url');
      const expectedSignature = this.createSignature(encodedPayload);
      if (signature.length !== expectedSignature.length || !timingSafeEqual(signature, expectedSignature)) {
        return null;
      }
      const parsed: unknown = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      if (!this.isSessionPayload(parsed)) return null;
      payload = parsed;
    } catch {
      return null;
    }

    const activeExpiry = this.activeSessions.get(payload.id);
    if (!activeExpiry || activeExpiry !== payload.expiresAt || payload.expiresAt <= Date.now()) {
      this.activeSessions.delete(payload.id);
      return null;
    }
    return payload;
  }

  private createSignature(payload: string): Buffer {
    return createHmac('sha256', this.sessionSecret).update(payload).digest();
  }

  private getCookieValue(cookieHeader?: string): string | undefined {
    const cookie = cookieHeader?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${this.sessionCookieName}=`));
    if (!cookie) return undefined;
    try {
      return decodeURIComponent(cookie.slice(this.sessionCookieName.length + 1));
    } catch {
      return undefined;
    }
  }

  private isSessionPayload(value: unknown): value is SessionPayload {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Partial<SessionPayload>;
    return typeof payload.id === 'string' &&
      typeof payload.expiresAt === 'number' &&
      !!payload.user &&
      typeof payload.user.email === 'string' &&
      typeof payload.user.name === 'string' &&
      typeof payload.user.picture === 'string';
  }
}
