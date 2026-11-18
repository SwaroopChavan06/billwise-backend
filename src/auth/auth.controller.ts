import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('session')
  session(@Req() request: Request) {
    return { user: this.authService.getUserFromCookie(request.headers.cookie) };
  }

  @Post('google')
  async signIn(
    @Body() body: { credential?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.signIn(body.credential ?? '');
    response.cookie(this.authService.sessionCookieName, result.token, this.authService.getCookieOptions());
    return { user: result.user };
  }

  @Post('logout')
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authService.signOut(request.headers.cookie);
    response.clearCookie(this.authService.sessionCookieName, this.authService.getCookieOptions());
    return { success: true };
  }
}
