import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const providedKey = request.headers['x-admin-key'];
    const adminKey = process.env.ADMIN_KEY;

    if (!adminKey || providedKey !== adminKey) {
      throw new UnauthorizedException('Invalid admin key');
    }

    return true;
  }
}
