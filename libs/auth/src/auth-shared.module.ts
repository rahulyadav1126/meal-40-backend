import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy.js';
import { JwtAuthGuard, RolesGuard } from './guards.js';

@Global()
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [PassportModule, JwtStrategy, JwtAuthGuard, RolesGuard],
})
export class AuthSharedModule {}
