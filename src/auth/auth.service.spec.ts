import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const originalEnvironment = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    sessionSecret: process.env.GOOGLE_SESSION_SECRET,
    allowedEmails: process.env.GOOGLE_ALLOWED_EMAILS,
  };
  let service: AuthService;
  let verifyIdToken: jest.SpyInstance;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_SESSION_SECRET = 'test-session-signing-secret';
    process.env.GOOGLE_ALLOWED_EMAILS = 'swaroopch06@gmail.com,ramdas2758@gmail.com';
    service = new AuthService();
    verifyIdToken = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnvironment.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalEnvironment.clientId;
    if (originalEnvironment.sessionSecret === undefined) delete process.env.GOOGLE_SESSION_SECRET;
    else process.env.GOOGLE_SESSION_SECRET = originalEnvironment.sessionSecret;
    if (originalEnvironment.allowedEmails === undefined) delete process.env.GOOGLE_ALLOWED_EMAILS;
    else process.env.GOOGLE_ALLOWED_EMAILS = originalEnvironment.allowedEmails;
  });

  function mockVerifiedGooglePayload(payload: {
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  }) {
    verifyIdToken.mockResolvedValue({
      getPayload: () => payload,
    } as Awaited<ReturnType<OAuth2Client['verifyIdToken']>>);
  }

  it('creates a session for a verified allowlisted Google account', async () => {
    mockVerifiedGooglePayload({
      email: 'SwaroopCH06@gmail.com',
      email_verified: true,
      name: 'Swaroop Chavan',
      picture: 'https://example.com/profile.jpg',
    });

    const result = await service.signIn('google-id-token');
    const cookie = `${service.sessionCookieName}=${encodeURIComponent(result.token)}`;

    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'google-id-token', audience: 'google-client-id' });
    expect(result.user).toEqual({
      email: 'swaroopch06@gmail.com',
      name: 'Swaroop Chavan',
      picture: 'https://example.com/profile.jpg',
    });
    expect(service.getUserFromCookie(cookie)).toEqual(result.user);

    service.signOut(cookie);
    expect(service.getUserFromCookie(cookie)).toBeNull();
  });

  it('rejects a Google account that is not allowlisted', async () => {
    mockVerifiedGooglePayload({ email: 'someone@example.com', email_verified: true });

    await expect(service.signIn('google-id-token')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an account whose email Google has not verified', async () => {
    mockVerifiedGooglePayload({ email: 'swaroopch06@gmail.com', email_verified: false });

    await expect(service.signIn('google-id-token')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid Google credentials', async () => {
    verifyIdToken.mockRejectedValue(new Error('Invalid token'));

    await expect(service.signIn('invalid-token')).rejects.toThrow(UnauthorizedException);
  });

  it('requires a Google OAuth client ID before attempting verification', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const unconfiguredService = new AuthService();

    await expect(unconfiguredService.signIn('google-id-token')).rejects.toThrow(ServiceUnavailableException);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
