import { httpLogger, kafkaLogger, logger } from '@spalx/common-loggers-pkg';

import { redactSensitiveFields, redactSensitiveLogFields } from './log-redaction';

interface FakeFormat {
  transform: jest.Mock;
  options?: object;
}

interface FakeTransport {
  format?: FakeFormat;
}

// Three loggers whose transports have formats the redaction can wrap, in place of the shared loggers.
jest.mock('@spalx/common-loggers-pkg', () => ({
  logger: { transports: [] as FakeTransport[] },
  kafkaLogger: { transports: [] as FakeTransport[] },
  httpLogger: { transports: [] as FakeTransport[] },
}));

const MESSAGE = Symbol.for('message');

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

function transportsOf(target: unknown): FakeTransport[] {
  return (target as { transports: FakeTransport[] }).transports;
}

// A format that writes the finished line the way the shared loggers' printf does.
function printfFormat(): FakeFormat {
  return {
    options: { colorize: false },
    transform: jest.fn((info: Record<string | symbol, unknown>) => ({
      ...info,
      [MESSAGE]: `[INFO] ${String(info.message)}`,
    })),
  };
}

describe('log-redaction - redactSensitiveFields', () => {
  describe('should_mask_every_sensitive_key_when_it_appears_as_plain_json', () => {
    it.each(SENSITIVE_KEYS)('should mask a string %s', (key) => {
      expect(redactSensitiveFields(`{"${key}":"value-1","user":"u1"}`)).toBe(`{"${key}":"[REDACTED]","user":"u1"}`);
    });

    it.each(SENSITIVE_KEYS)('should mask a number %s', (key) => {
      expect(redactSensitiveFields(`{"${key}":4580123412341234}`)).toBe(`{"${key}":"[REDACTED]"}`);
    });

    it.each([
      ['a negative number', '-12'],
      ['a decimal', '12.5'],
      ['an exponent', '1.2e+5'],
    ])('should mask %s', (_label, value) => {
      expect(redactSensitiveFields(`{"cvv":${value},"n":1}`)).toBe('{"cvv":"[REDACTED]","n":1}');
    });

    it('should mask a string that holds escaped quotes', () => {
      expect(redactSensitiveFields('{"password":"p\\"ass","ok":true}')).toBe('{"password":"[REDACTED]","ok":true}');
    });

    it('should allow spaces around the colon', () => {
      expect(redactSensitiveFields('{"token" :  "abc"}')).toBe('{"token":"[REDACTED]"}');
    });
  });

  describe('should_mask_every_sensitive_key_when_it_is_escaped_inside_another_json_string', () => {
    it.each(SENSITIVE_KEYS)('should mask an escaped string %s and keep the escaping', (key) => {
      const line = `{"body":"{\\"${key}\\":\\"value-1\\",\\"user\\":\\"u1\\"}"}`;

      expect(redactSensitiveFields(line)).toBe(`{"body":"{\\"${key}\\":\\"[REDACTED]\\",\\"user\\":\\"u1\\"}"}`);
    });

    it('should mask an escaped number', () => {
      expect(redactSensitiveFields('{"body":"{\\"card_number\\":4580123412341234}"}')).toBe(
        '{"body":"{\\"card_number\\":\\"[REDACTED]\\"}"}'
      );
    });
  });

  describe('should_leave_other_text_alone_when_it_is_not_a_sensitive_field', () => {
    it.each([
      ['another key', '{"user":"u1","amount":49.9}'],
      ['a sensitive word inside a value', '{"note":"password reset requested"}'],
      ['a longer key that starts with a sensitive one', '{"passwords":"x","tokens":["a"]}'],
      ['a sensitive word with no JSON', 'login failed for user u1: wrong password'],
      ['an empty line', ''],
    ])('should not change %s', (_label, line) => {
      expect(redactSensitiveFields(line)).toBe(line);
    });
  });

  it('should mask several fields and both forms in one line', () => {
    const line = '{"password":"a","ok":1,"token":2,"body":"{\\"cvv\\":\\"123\\"}"}';

    expect(redactSensitiveFields(line)).toBe(
      '{"password":"[REDACTED]","ok":1,"token":"[REDACTED]","body":"{\\"cvv\\":\\"[REDACTED]\\"}"}'
    );
  });
});

describe('log-redaction - redactSensitiveLogFields', () => {
  beforeEach(() => {
    for (const target of [logger, kafkaLogger, httpLogger]) {
      transportsOf(target).length = 0;
    }
  });

  it('should wrap the format of every transport of every shared logger', () => {
    // Arrange
    const transports = [printfFormat(), printfFormat(), printfFormat()].map((format) => ({ format }));
    transportsOf(logger).push(transports[0], transports[1]);
    transportsOf(kafkaLogger).push(transports[2]);
    transportsOf(httpLogger).push({});

    // Act
    redactSensitiveLogFields();

    // Assert
    for (const transport of [...transportsOf(logger), ...transportsOf(kafkaLogger), ...transportsOf(httpLogger)]) {
      expect(transport.format?.transform).toEqual(expect.any(Function));
    }
  });

  it('should run the transport own format first, then redact the finished line and the message', () => {
    // Arrange
    const own = printfFormat();
    transportsOf(httpLogger).push({ format: own });
    redactSensitiveLogFields();
    const info = { level: 'info', message: 'Request {"password":"p1","user":"u1"}' };

    // Act
    const out = transportsOf(httpLogger)[0].format?.transform(info, undefined) as Record<string | symbol, unknown>;

    // Assert
    expect(own.transform).toHaveBeenCalledWith(info, { colorize: false });
    expect(out[MESSAGE]).toBe('[INFO] Request {"password":"[REDACTED]","user":"u1"}');
    expect(out.message).toBe('Request {"password":"[REDACTED]","user":"u1"}');
  });

  it('should pass the options it is given to the transport own format', () => {
    const own = printfFormat();
    transportsOf(logger).push({ format: own });
    redactSensitiveLogFields();

    transportsOf(logger)[0].format?.transform({ level: 'info', message: 'x' }, { level: true });

    expect(own.transform).toHaveBeenCalledWith(expect.any(Object), { level: true });
  });

  it('should keep an entry the transport own format drops dropped', () => {
    const own: FakeFormat = { transform: jest.fn(() => false) };
    transportsOf(logger).push({ format: own });
    redactSensitiveLogFields();

    expect(transportsOf(logger)[0].format?.transform({ level: 'debug', message: '{"token":"t"}' }, {})).toBe(false);
  });

  it('should still redact on a transport with no format of its own', () => {
    transportsOf(kafkaLogger).push({});
    redactSensitiveLogFields();
    const info: Record<string | symbol, unknown> = {
      level: 'info',
      message: '{"token":"t1"}',
      [MESSAGE]: '{"token":"t1"}',
    };

    const out = transportsOf(kafkaLogger)[0].format?.transform(info, {}) as Record<string | symbol, unknown>;

    expect(out).toBe(info);
    expect(out[MESSAGE]).toBe('{"token":"[REDACTED]"}');
    expect(out.message).toBe('{"token":"[REDACTED]"}');
  });

  it('should leave a message that is not text as it is', () => {
    transportsOf(logger).push({});
    redactSensitiveLogFields();
    const payload = { password: 'p1' };

    const out = transportsOf(logger)[0].format?.transform({ level: 'info', message: payload }, {}) as Record<
      string,
      unknown
    >;

    expect(out.message).toBe(payload);
  });
});
