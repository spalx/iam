import { httpLogger, kafkaLogger, logger } from '@spalx/common-loggers-pkg';

// The transport adapters log every request and response body in full. These fields must never reach a log file:
// credentials, and card data (PCI DSS forbids storing a full card number, and card_number here is a Tranzila token).
const SENSITIVE_KEYS = [
  'access_token',
  'refresh_token',
  'token',
  'mfa_code',
  'password',
  'card_number',
  'ccno',
  'cvv',
  'mycvv',
  'exp_date',
  'expdate',
  'expiry',
  'expire_month',
  'expire_year',
  'expiry_month',
  'expiry_year',
  'exp_month',
  'exp_year',
];

const REDACTED = '[REDACTED]';
const KEYS = SENSITIVE_KEYS.join('|');
const NUMBER = '-?\\d[\\d.eE+-]*';
// "key":"value" or "key":123, as the payload itself is logged.
const PLAIN_FIELD = new RegExp(`"(${KEYS})"\\s*:\\s*(?:"(?:[^"\\\\]|\\\\.)*"|${NUMBER})`, 'g');
// \"key\":\"value\", as it appears when a payload is nested inside another JSON string.
const ESCAPED_FIELD = new RegExp(`\\\\"(${KEYS})\\\\"\\s*:\\s*(?:\\\\"(?:[^"\\\\]|\\\\[^"])*?\\\\"|${NUMBER})`, 'g');

// The line winston writes: set by the logger's printf format, before any transport format runs.
const MESSAGE = Symbol.for('message');

export function redactSensitiveFields(line: string): string {
  return line
    .replace(ESCAPED_FIELD, (_, key: string) => `\\"${key}\\":\\"${REDACTED}\\"`)
    .replace(PLAIN_FIELD, (_, key: string) => `"${key}":"${REDACTED}"`);
}

/**
 * Redacts sensitive fields from every line the shared loggers write. The loggers come from @spalx/common-loggers-pkg,
 * so the redaction is attached to each of their transports: a transport's format runs on the finished line.
 */
export function redactSensitiveLogFields(): void {
  for (const target of [logger, kafkaLogger, httpLogger]) {
    for (const transport of target.transports) {
      const existing = transport.format;
      transport.format = {
        transform(info, opts) {
          const formatted = existing ? existing.transform(info, opts ?? existing.options) : info;
          if (!formatted) {
            return formatted;
          }

          const record = formatted as unknown as Record<string | symbol, unknown>;
          if (typeof record[MESSAGE] === 'string') {
            record[MESSAGE] = redactSensitiveFields(record[MESSAGE]);
          }
          if (typeof record.message === 'string') {
            record.message = redactSensitiveFields(record.message);
          }
          return formatted;
        },
      };
    }
  }
}
