import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureError, logger, setErrorReporter } from './observability';

afterEach(() => {
  setErrorReporter(null);
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('emits single-line JSON with level, msg, time, and fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('something.broke', { userId: 'u1', count: 3 });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: 'error',
      msg: 'something.broke',
      userId: 'u1',
      count: 3,
    });
    expect(typeof parsed.time).toBe('string');
  });

  it('routes warn/info to the matching console method', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.warn('a');
    logger.info('b');
    expect(warn).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
  });
});

describe('captureError', () => {
  it('serializes an Error to name/message/stack instead of {}', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    captureError('webhook.process_failed', new Error('boom'), { entry: 1 });

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.msg).toBe('webhook.process_failed');
    expect(parsed.entry).toBe(1);
    expect(parsed.error).toMatchObject({ name: 'Error', message: 'boom' });
    expect(typeof parsed.error.stack).toBe('string');
  });

  it('forwards to the registered reporter with the event name', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reporter = vi.fn();
    setErrorReporter(reporter);

    const err = new Error('nope');
    captureError('cron.failed', err, { job: 'flows' });

    expect(reporter).toHaveBeenCalledWith(err, {
      event: 'cron.failed',
      job: 'flows',
    });
  });

  it('never throws if the reporter itself throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setErrorReporter(() => {
      throw new Error('reporter down');
    });
    expect(() => captureError('x', new Error('y'))).not.toThrow();
  });
});
