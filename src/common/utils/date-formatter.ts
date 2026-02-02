import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/La_Paz';
const DATE_FORMAT = "HH:mm - dd/MM/yyyy";

/**
 * Formatea una fecha al formato boliviano: HH:mm - dd/MM/yyyy
 * @param date - Fecha a formatear
 * @returns String con formato "21:59 - 01/02/2026"
 */
export function formatBolivianDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const zonedDate = toZonedTime(dateObj, TIMEZONE);
  return format(zonedDate, DATE_FORMAT);
}

/**
 * Transforma recursivamente todas las fechas en un objeto
 * @param obj - Objeto a transformar
 * @returns Objeto con fechas formateadas
 */
export function transformDates<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return formatBolivianDate(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformDates(item)) as T;
  }

  if (typeof obj === 'object') {
    const transformed: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        transformed[key] = transformDates((obj as Record<string, unknown>)[key]);
      }
    }
    return transformed as T;
  }

  return obj;
}
