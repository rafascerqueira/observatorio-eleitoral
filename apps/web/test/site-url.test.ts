import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SITE_URL, siteUrl } from '../lib/site-url';

test('SITE_URL ausente ou vazia vale o padrão local; inválida ou sem http(s) interrompe com mensagem própria', () => {
  for (const value of [undefined, '', '   ']) assert.equal(siteUrl(value).href, `${DEFAULT_SITE_URL}/`, JSON.stringify(value));
  assert.equal(siteUrl(' https://exemplo.org ').href, 'https://exemplo.org/');
  assert.equal(siteUrl('https://exemplo.org/mente').href, 'https://exemplo.org/mente');
  assert.throws(() => siteUrl('exemplo.org'), /SITE_URL inválida: "exemplo\.org"/);
  assert.throws(() => siteUrl('ftp://exemplo.org'), /SITE_URL precisa usar http ou https/);
});
