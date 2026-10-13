import assert from 'node:assert/strict';

const api = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3001';
const web = process.env.SMOKE_WEB_URL ?? 'http://127.0.0.1:3000';
const timings = [];
async function request(base, path, status = 200) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000) });
  timings.push({ path, milliseconds: Math.round(performance.now() - start) });
  assert.equal(response.status, status, path);
  return response;
}
async function places(params) { return (await request(api, `/elections/municipalities/71072/places?${new URLSearchParams(params)}`)).json(); }
const keys = (data) => data.items.map((place) => `${place.zone}/${place.code}`);

for (const round of ['1', '2']) {
  const lookup = await places({ round, zone: '0001', section: '0001' });
  assert.equal(lookup.total, 1);
  const match = lookup.items[0];
  assert.equal(match.zone, 1); assert.equal(match.code, '1015');
  assert.ok(match.sectionNumbers.includes(1));
  assert.equal(new Set(match.sectionNumbers).size, match.sections);
  const wholePlace = await places({ round, zone: '1', local: '1015' });
  assert.deepEqual(match.totals, wholePlace.items[0].totals, 'Filtro de seção deve localizar, sem recortar os totais do local.');

  const acrossZones = await places({ round, section: '1', pageSize: '100' });
  assert.ok(new Set(acrossZones.items.map((place) => place.zone)).size > 1);
  assert.ok(acrossZones.items.every((place) => place.sectionNumbers.includes(1)));
  assert.equal(new Set(keys(acrossZones)).size, acrossZones.items.length);

  const first = await places({ round, zone: '1', pageSize: '2' });
  const second = await places({ round, zone: '1', pageSize: '2', page: '2' });
  assert.equal(first.total, second.total);
  assert.ok(first.items.every((place) => place.zone === 1));
  assert.ok(second.items.every((place) => place.zone === 1));
  assert.notDeepEqual(keys(first), keys(second));

  const noMatch = await places({ round, zone: '1', section: '99999' });
  assert.equal(noMatch.total, 0); assert.deepEqual(noMatch.items, []);
  const outsidePage = await places({ round, zone: '1', section: '1', page: '2' });
  assert.equal(outsidePage.total, 1); assert.deepEqual(outsidePage.items, []);

  const accented = await places({ round, search: 'José Dias da Silveira', pageSize: '100' });
  const plain = await places({ round, search: 'jose dias da silveira', pageSize: '100' });
  assert.ok(accented.items.some((place) => place.zone === 258 && place.code === '1430'));
  assert.deepEqual(keys(accented), keys(plain));
  const variant = accented.items.find((place) => place.zone === 258 && place.code === '1430');
  assert.equal(variant.metadataConflict, true); assert.equal(variant.name, null);
  const address = await places({ round, search: 'padre antonio jose dos santos', zone: '258', local: '1430' });
  assert.equal(address.total, 1);
  for (const text of ['%', '_', "'); SELECT 1; --"]) assert.equal((await places({ round, search: text })).total, 0);

  const html = await (await request(web, `/municipios/71072?round=${round}&zone=0001&section=0001`)).text();
  assert.match(html, /Localizar um local de votação/);
  assert.match(html, /Seção <!-- -->1<!-- --> encontrada neste local/);
  assert.match(html, /data-section="1"/);
  assert.match(html, /local inteiro/);
  assert.match(html, /name="page"[^>]*value="1"/);
  for (const name of ['zone', 'section', 'local', 'search']) assert.match(html, new RegExp(`name="${name}"`));
  const pageHtml = await (await request(web, `/municipios/71072?round=${round}&zone=1&pageSize=2`)).text();
  const hrefs = [...pageHtml.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll('&amp;', '&'));
  const next = hrefs.find((href) => href.includes('page=2'));
  assert.ok(next); assert.equal(new URL(next, web).searchParams.get('zone'), '1');
  const turn = hrefs.find((href) => new URL(href, web).searchParams.get('round') === (round === '1' ? '2' : '1') && href.includes('/municipios/'));
  assert.ok(turn); assert.equal(new URL(turn, web).searchParams.get('zone'), '1');
  const empty = await (await request(web, `/municipios/71072?round=${round}&zone=1&section=99999`)).text();
  assert.match(empty, /Nenhum local corresponde à busca/);
  const out = await (await request(web, `/municipios/71072?round=${round}&zone=1&section=1&page=2`)).text();
  assert.match(out, /Esta página não contém locais/);
}
for (const query of ['zone=0', 'section=-1', 'local=abc', 'zone=1&zone=2']) await request(api, `/elections/municipalities/71072/places?${query}`, 400);
const invalid = await (await request(web, '/municipios/71072?zone=-1')).text();
assert.match(invalid, /Confira os filtros/);
assert.match(invalid, /aria-invalid="true"/);
const unsupported = await (await request(web, '/municipios/71072?year=2026')).text();
assert.match(unsupported, /Recorte sem publicação disponível/);
console.log('Smoke de locais OK: zona/seção, códigos, texto e acentos, variantes, paginação e estados da interface.');
console.log(JSON.stringify({ requests: timings.length, maximumMilliseconds: Math.max(...timings.map((timing) => timing.milliseconds)), lookupTimings: timings.filter((timing) => timing.path.includes('zone=0001')) }, null, 2));
