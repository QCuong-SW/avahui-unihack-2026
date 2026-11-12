import {
  isAllowedCorsOrigin,
  parseCorsOrigins,
} from '../src/common/utils/cors.util';

describe('CORS Origin Allow-List', () => {
  it('normalizes comma-separated origins and strips trailing slashes', () => {
    expect(
      parseCorsOrigins(' https://avahui.pages.dev/ , https://app.example.com '),
    ).toEqual(['https://avahui.pages.dev', 'https://app.example.com']);
  });

  it('allows exact origins and empty origin headers (health/curl)', () => {
    const allowed = parseCorsOrigins('https://avahui.pages.dev');
    expect(isAllowedCorsOrigin(undefined, allowed, true)).toBe(true);
    expect(isAllowedCorsOrigin('https://avahui.pages.dev', allowed, true)).toBe(
      true,
    );
    expect(
      isAllowedCorsOrigin('https://avahui.pages.dev/', allowed, true),
    ).toBe(true);
  });

  it('matches subdomain wildcards safely without allowing unrelated domains', () => {
    const allowed = parseCorsOrigins('https://*.pages.dev');
    expect(isAllowedCorsOrigin('https://avahui.pages.dev', allowed, true)).toBe(
      true,
    );
    expect(
      isAllowedCorsOrigin('https://preview-123.avahui.pages.dev', allowed, true),
    ).toBe(true);
    expect(isAllowedCorsOrigin('http://avahui.pages.dev', allowed, true)).toBe(
      false,
    );
    expect(isAllowedCorsOrigin('https://evilpages.dev', allowed, true)).toBe(
      false,
    );
    expect(
      isAllowedCorsOrigin('https://pages.dev.evil.com', allowed, true),
    ).toBe(false);
  });

  it('allows localhost only outside production when not explicitly listed', () => {
    const allowed = parseCorsOrigins('https://avahui.pages.dev');
    expect(isAllowedCorsOrigin('http://localhost:3000', allowed, false)).toBe(
      true,
    );
    expect(isAllowedCorsOrigin('http://localhost:3000', allowed, true)).toBe(
      false,
    );
  });
});

