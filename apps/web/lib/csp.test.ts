import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, newNonce } from './csp.ts';

const base = {
  nonce: 'abc123',
  supabaseUrl: 'https://project.supabase.test',
  development: false,
  https: true,
};

const directive = (policy: string, name: string) =>
  policy
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(' ') ?? [];

describe('contentSecurityPolicy', () => {
  const policy = contentSecurityPolicy(base);

  it('lets a script run only with this request’s nonce', () => {
    const scripts = directive(policy, 'script-src');
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it('allows eval in development only, where React needs it', () => {
    const dev = contentSecurityPolicy({ ...base, development: true });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
  });

  it('reaches Supabase over HTTPS and its realtime socket over WSS', () => {
    const connect = directive(policy, 'connect-src');
    expect(connect).toContain('https://project.supabase.test');
    expect(connect).toContain('wss://project.supabase.test');
  });

  it('uses ws: with the port for a local stack', () => {
    const local = contentSecurityPolicy({
      ...base,
      supabaseUrl: 'http://127.0.0.1:54321',
      https: false,
    });
    expect(directive(local, 'connect-src')).toEqual([
      "'self'",
      'http://127.0.0.1:54321',
      'ws://127.0.0.1:54321',
    ]);
    expect(local).not.toContain('upgrade-insecure-requests');
  });

  it('refuses framing, plugins and a rewritten base URL', () => {
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(directive(policy, 'base-uri')).toEqual(["'self'"]);
    expect(directive(policy, 'form-action')).toEqual(["'self'"]);
  });

  it('upgrades insecure requests on an HTTPS deployment', () => {
    expect(policy.endsWith('upgrade-insecure-requests')).toBe(true);
  });
});

describe('newNonce', () => {
  it('is 128 bits of base64 and different every time', () => {
    const a = newNonce();
    expect(atob(a)).toHaveLength(16);
    expect(newNonce()).not.toBe(a);
  });
});
