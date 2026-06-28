import {
  createCorsOptions,
  isAllowedCorsOrigin,
} from './cors';

describe('CORS config', () => {
  it('allows the dev shopping mall origin', () => {
    expect(
      isAllowedCorsOrigin('https://demo-shoppingmall.dev.loop-ad.org'),
    ).toBe(true);
  });

  it('allows local frontend origins', () => {
    expect(isAllowedCorsOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedCorsOrigin('http://127.0.0.1:3000')).toBe(true);
  });

  it('allows requests without an Origin header', () => {
    expect(isAllowedCorsOrigin(undefined)).toBe(true);
    expect(isAllowedCorsOrigin('')).toBe(true);
  });

  it('rejects unregistered origins without throwing', () => {
    expect(isAllowedCorsOrigin('https://dashboard.dev.loop-ad.org')).toBe(false);
  });

  it('uses a non-throwing origin callback', () => {
    const origin = createCorsOptions().origin;

    expect(typeof origin).toBe('function');

    if (typeof origin !== 'function') {
      return;
    }

    origin('https://dashboard.dev.loop-ad.org', (error, allowedOrigin) => {
      expect(error).toBeNull();
      expect(allowedOrigin).toBe(false);
    });
  });
});
