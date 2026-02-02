// Auth Module
export { AuthModule } from './auth.module';
export { AuthService } from './auth.service';
export { AuthController } from './auth.controller';

// DTOs
export { LoginDto } from './dto/login.dto';

// Strategies
export { LocalStrategy } from './strategies/local.strategy';
export { JwtStrategy } from './strategies/jwt.strategy';

// Guards
export { RolesGuard } from './guards/roles.guard';

// Decorators
export { CurrentUser } from './decorators/current-user.decorator';
export { Roles } from './decorators/roles.decorator';

// Types
export type { JwtPayload, Usuario } from './auth.service';
