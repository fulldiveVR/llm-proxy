import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { IConfig } from '../infrastructure';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly config: IConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      this.logger.warn('Missing authorization header');
      throw new UnauthorizedException('Authorization header is required');
    }

    // Extract API key from Authorization header
    // Support both "Bearer <token>" and direct API key formats
    let providedApiKey: string;
    
    if (authHeader.startsWith('Bearer ')) {
      providedApiKey = authHeader.substring(7);
    } else {
      providedApiKey = authHeader;
    }

    // Get the expected API key from configuration
    const expectedApiKey = this.config.get<string>('auth.apiKey');

    if (!expectedApiKey) {
      this.logger.error('AUTH_API_KEY environment variable is not configured');
      throw new UnauthorizedException('Authentication is not properly configured');
    }

    if (providedApiKey !== expectedApiKey) {
      this.logger.warn('Invalid API key provided');
      throw new UnauthorizedException('Invalid API key');
    }

    this.logger.debug('Authentication successful');
    return true;
  }
}