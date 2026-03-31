import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { transformDates } from '../utils/date-formatter';

/**
 * Interceptor global que transforma todas las fechas en las respuestas
 * al formato boliviano: HH:mm - dd/MM/yyyy
 */
@Injectable()
export class DateFormatterInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => transformDates(data)));
  }
}
