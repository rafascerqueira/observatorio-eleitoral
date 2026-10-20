// Navegadores reais, dados publicados, somente GET. Nenhum importador é iniciado por este roteiro.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import puppeteer from 'puppeteer-core';

const web = process.env.UI_WEB_URL ?? 'http://127.0.0.1:3000';
const api = process.env.UI_API_URL ?? 'http://127.0.0.1:3001';
for (const address of [web, api]) assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(address).hostname), 'O roteiro só aceita serviços locais.');
const artifactDirectory = resolve(process.env.UI_ARTIFACTS_DIRECTORY ?? `data/analysis/ui-checks/${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(artifactDirectory, { recursive: true });
const axe = await readFile(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const report = { web, api, startedAt: new Date().toISOString(), selection: process.env.UI_ONLY ?? 'all', results: [], limitations: ['Leitor de tela humano e Safari real não são simulados por este roteiro.', 'As capturas e os testes automáticos não certificam toda a acessibilidade.'] };
const selected = process.env.UI_BROWSER ?? 'all';
const browserNames = selected === 'all' ? ['chrome', 'firefox'] : [selected];
assert.ok(browserNames.every((name) => ['chrome', 'firefox'].includes(name)));
const testOrigins = new WeakMap();
async function noScriptProxy() {
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
    const abort = new AbortController(); response.once('close', () => abort.abort());
    try {
      const target = new URL(web), requested = new URL(request.url, 'http://test.invalid');
      target.pathname = requested.pathname; target.search = requested.search;
      const upstream = await fetch(target, { signal: abort.signal });
      const headers = Object.fromEntries(upstream.headers);
      // fetch decodifica o corpo: não repassar os cabeçalhos de compressão ou tamanho originais.
      for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'connection']) delete headers[name];
      headers['content-security-policy'] = "script-src 'none'; object-src 'none'"; headers['cache-control'] = 'no-store';
      response.writeHead(upstream.status, headers);
      if (upstream.body) await pipeline(Readable.fromWeb(upstream.body), response); else response.end();
    } catch { if (!response.headersSent) response.writeHead(502).end(); else response.destroy(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { url: `http://127.0.0.1:${server.address().port}`, close: async () => { server.closeAllConnections(); await new Promise((done) => server.close(done)); } };
}
async function executable(browser) {
  if (process.env.UI_EXECUTABLE_PATH) return process.env.UI_EXECUTABLE_PATH;
  if (browser === 'firefox') return '/usr/bin/firefox';
  const directory = resolve(homedir(), '.cache/puppeteer/chrome');
  const versions = (await readdir(directory)).filter((name) => name.startsWith('linux-')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  assert.ok(versions[0], 'Configure UI_EXECUTABLE_PATH com um Chromium/Chrome instalado.');
  return resolve(directory, versions[0], 'chrome-linux64/chrome');
}
const urls = ['/', '/?uf=SP', '/?office=senator&uf=SE', '/municipios/71072?uf=SP', '/municipios/26310?uf=PE', '/perfis?indicator=income-median&uf=MA', '/participacao?uf=SP&municipality=71072', '/mapa?uf=PE', '/mapa/candidaturas?uf=SP&round=2', '/fontes', '/mapa?uf=SP&office=governor&round=2&series=10', '/mapa?indicator=urban-ramp&uf=SE', '/municipios/71072/setores?uf=SP', '/municipios/71072/setores?uf=SP&view=355030830', '/propostas', '/propostas?q=acessibilidade'];
for (const name of browserNames) {
  const launch = async () => puppeteer.launch({ browser: name, executablePath: await executable(name), headless: true, args: name === 'chrome' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [], acceptInsecureCerts: false,
    ...(name === 'firefox' ? { extraPrefsFirefox: { 'ui.prefersReducedMotion': 1 } } : {}) });
  const browser = await launch();
  const browserReport = { browser: name, version: await browser.version(), cases: [] }; report.results.push(browserReport);
  async function scenario(title, sideEffects, run) {
    if (process.env.UI_ONLY && !new RegExp(process.env.UI_ONLY).test(title)) return;
    // Firefox instalado não implementa emulation.setScriptingEnabled; CSP bloqueia os scripts da página, mantendo a instrumentação.
    const proxy = name === 'firefox' && title.includes('JavaScript desativado') ? await noScriptProxy() : null;
    const page = await browser.newPage(); if (proxy) testOrigins.set(page, proxy.url);
    const errors = []; let expectedScriptBlocks = 0;
    page.on('pageerror', (error) => {
      if (proxy && error.message.startsWith('Content-Security-Policy:') && error.message.includes("script-src 'none'")) expectedScriptBlocks++;
      else errors.push(error.message);
    });
    const started = performance.now();
    try { const result = await run(page); assert.deepEqual(errors, [], 'Sem erros de execução inesperados no navegador'); browserReport.cases.push({ title, status: 'passed', elapsedMs: Math.round(performance.now() - started), sideEffects, expectedScriptBlocks, ...result }); console.log(`${name}: ${title} — passou`); }
    catch (error) { browserReport.cases.push({ title, status: 'failed', message: error.message, sideEffects }); await page.screenshot({ path: resolve(artifactDirectory, `${name}-failure-${browserReport.cases.length}.png`), fullPage: true }).catch(() => {}); throw error; }
    finally { await page.close(); await proxy?.close(); }
  }
  async function go(page, path) { await page.goto(new URL(path, testOrigins.get(page) ?? web).href, { waitUntil: 'networkidle0', timeout: 60000 }); }
  try {
    await scenario('Controle positivo do axe', 'DOM sintético apenas em about:blank, descartado ao fechar a aba.', async (page) => {
      await page.goto('about:blank'); await page.setContent('<html lang="pt-BR"><title>Teste</title><body><main><button></button></main></body></html>'); await page.addScriptTag({ content: axe });
      const result = await page.evaluate(async () => window.axe.run()); assert.ok(result.violations.some((item) => item.id === 'button-name'));
    });
    for (const javascript of [true, false]) await scenario(`Envio real dos seis formulários (JavaScript ${javascript ? 'ativo' : 'desativado'})`, 'GET preserva filtros; não cria nem altera dados. Sem JavaScript usa envio nativo.', async (page) => {
      if (name !== 'firefox') await page.setJavaScriptEnabled(javascript);
      const cases = [
        { path: '/?uf=SP', form: 'form[action="/"]', select: { uf: 'RJ' }, params: { uf: 'RJ' } },
        { path: '/municipios/71072?uf=SP', form: 'form[action^="/municipios/"]', fill: { zone: '0001' }, params: { zone: '0001', page: '1', uf: 'SP' } },
        { path: '/perfis?indicator=college&uf=SP', form: 'form[action="/perfis"]', select: { indicator: 'women' }, params: { indicator: 'women', uf: 'SP' } },
        { path: '/participacao?uf=SP', form: 'form[action="/participacao"]', select: { rows: 'education', cols: 'maritalStatus' }, params: { rows: 'education', cols: 'maritalStatus', uf: 'SP' } },
        { path: '/mapa?uf=SP', form: 'form[action="/mapa"]', select: { indicator: 'literacy-15' }, params: { indicator: 'literacy-15', uf: 'SP' } },
        { path: '/mapa/candidaturas?uf=SP', form: 'form[action="/mapa/candidaturas"]', select: { office: 'governor' }, params: { office: 'governor', uf: 'SP' } },
      ];
      for (const item of cases) {
        console.log(`${name}: envio ${javascript ? 'com' : 'sem'} JavaScript ${item.path}`);
        await go(page, item.path);
        if (!javascript) {
          await page.evaluate(() => { const probe = document.createElement('script'); probe.textContent = 'window.__inlineProbe = true'; document.head.appendChild(probe); });
          assert.equal(await page.evaluate(() => window.__inlineProbe), undefined, 'Controle positivo: JavaScript da página está realmente desativado');
        }
        await page.waitForSelector(`${item.form} button[type="submit"]`, { visible: true, timeout: 30000 });
        for (const [field, value] of Object.entries(item.select ?? {})) await page.select(`${item.form} [name="${field}"]`, value);
        for (const [field, value] of Object.entries(item.fill ?? {})) { const control = await page.$(`${item.form} [name="${field}"]`); await control.type(value); }
        await page.click(`${item.form} button[type="submit"]`);
        await page.waitForFunction((expected) => Object.entries(expected).every(([key, value]) => new URL(location.href).searchParams.get(key) === value), { timeout: 45000 }, item.params);
        await page.waitForNetworkIdle({ idleTime: 400, timeout: 45000 });
        const text = await page.evaluate(() => document.body.innerText); assert.ok(!text.includes('Corrija os filtros acima'), item.path); assert.ok(!text.includes('Não foi possível consultar'), item.path);
      }
      return { submissions: cases.length, scripting: javascript ? 'ativo' : name === 'firefox' ? "Scripts da página bloqueados por CSP script-src 'none' em proxy local de teste; controle positivo de não execução." : 'JavaScript desativado por CDP; controle positivo de não execução.' };
    });
    await scenario('Acessibilidade, refluxo e capturas das consultas', 'Somente GET; capturas locais. Tabelas largas têm rolagem própria.', async (page) => {
      let audits = 0;
      for (const width of [1280, 375, 320]) for (let index = 0; index < urls.length; index++) {
        console.log(`${name}: axe/refluxo ${width}px ${urls[index]}`);
        await page.setViewport({ width, height: 900 }); await go(page, urls[index]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); assert.equal(overflow, false, `Refluxo ${width}px: ${urls[index]}`);
        await page.addScriptTag({ content: axe }); const result = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
        assert.deepEqual(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })), [], `axe ${urls[index]} ${width}px`); audits++;
        if ([1, 4, 6].includes(index)) await page.screenshot({ path: resolve(artifactDirectory, `${name}-${width}-${index}.png`), fullPage: true });
      }
      return { audits };
    });
    // Seções recolhidas não são auditadas no estado padrão: tabelas do contexto e dos cartões de local só aparecem com os detalhes abertos.
    await scenario('Acessibilidade com detalhes abertos (municípios)', 'Somente GET; abre details nativos na aba, sem enviar formulário.', async (page) => {
      let audits = 0;
      for (const width of [1280, 375, 320]) for (const path of ['/municipios/71072?uf=SP', '/municipios/31054?uf=SE']) {
        console.log(`${name}: axe com detalhes abertos ${width}px ${path}`);
        await page.setViewport({ width, height: 900 }); await go(page, path);
        await page.evaluate(() => { for (const element of document.querySelectorAll('details')) element.open = true; });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); assert.equal(overflow, false, `Refluxo com detalhes abertos ${width}px: ${path}`);
        await page.addScriptTag({ content: axe }); const result = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
        assert.deepEqual(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })), [], `axe com detalhes abertos ${path} ${width}px`); audits++;
      }
      return { audits };
    });
    await scenario('Municípios: todas as candidaturas, categorias não válidas e paginação preservadas', 'Abre e fecha details nativo; navega por GET. Não soma apenas a página nem seleciona candidatura líder.', async (page) => {
      await go(page, '/?office=senator&uf=SE');
      const json = await (await fetch(`${api}/elections/municipalities?office=senator&uf=SE`)).json();
      const rows = await page.$$('.municipality-overview > table > tbody > tr'); assert.equal(rows.length, json.items.length);
      const summaries = await page.$$('.municipality-votes > summary'); assert.equal(summaries.length, json.items.length);
      await summaries[0].focus(); await page.keyboard.press('Enter');
      const details = await page.$('.municipality-votes[open]'); assert.ok(details);
      const candidateRows = await details.$$(':scope > table > tbody > tr'); assert.equal(candidateRows.length, json.items[0].candidates.length);
      const links = await page.$$eval('nav[aria-label*="municípios"] a[rel="next"]', (links) => links.map((link) => link.href)); assert.equal(links.length, 2);
      for (const href of links) { const url = new URL(href); assert.equal(url.searchParams.get('office'), 'senator'); assert.equal(url.searchParams.get('uf'), 'SE'); assert.equal(url.searchParams.get('page'), '2'); }
      await go(page, '/?uf=AM&search=MANAUS'); assert.ok(await page.$('.municipality-overview'));
      await page.click('.municipality-votes > summary'); assert.match(await page.$eval('.municipality-votes[open]', (element) => element.innerText), /seção\(ões\) não instalada/);
    });
    await scenario('Censo: diferença da fonte visível e filtros inválidos com foco', 'Leitura das publicações; consulta inválida não envia filtros recuperados silenciosamente.', async (page) => {
      await go(page, '/municipios/26310?uf=PE');
      const details = await page.$$('details'); for (const detail of details) await detail.evaluate((element) => { element.open = true; });
      assert.match(await page.evaluate(() => document.body.innerText), /Diferença não discriminada nas categorias da fonte/);
      assert.match(await page.evaluate(() => document.body.innerText), /1\.503/);
      await go(page, '/?uf=SP&round=3'); assert.ok(await page.$('#query-errors'));
      await page.waitForFunction(() => document.activeElement?.id === 'query-errors', { timeout: 10000 });
    });
    await scenario('Autocomplete por teclado, homônimos e turno único', 'Sugestões consultadas por GET; escolher não aplica o formulário automaticamente.', async (page) => {
      await go(page, '/'); const input = await page.$('#search'); await input.type('campo grande');
      await page.waitForSelector('[role="listbox"]:not([hidden]) [role="option"]', { timeout: 15000 }); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      assert.match(await page.$eval('#search', (element) => element.value), /campo grande/i); assert.ok(await page.$eval('[name="uf"]', (element) => element.value)); assert.equal(new URL(page.url()).searchParams.get('search'), null);
      await go(page, '/?uf=SP'); await page.click('[name="office"][value="senator"]');
      assert.equal(await page.$('[name="round"][value="2"]'), null); assert.equal(await page.$eval('[name="round"][value="1"]', (element) => element.checked), true);
    });
    await scenario('Movimento reduzido, foco e estabilidade após consulta', 'Emulação apenas da aba, sem mudar preferências do sistema.', async (page) => {
      if (name === 'chrome') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await go(page, '/?uf=SP');
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
      await page.evaluate(() => { window.__busy = []; const region = document.getElementById('resultados-consulta'); new MutationObserver(() => { window.__busy.push(region.getAttribute('aria-busy')); }).observe(region, { attributes: true, attributeFilter: ['aria-busy'] }); });
      if (name === 'chrome') {
        await page.evaluate(() => { window.__shifts = []; new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shifts.push(entry.value); }).observe({ type: 'layout-shift', buffered: false }); });
      }
      await page.select('[name="uf"]', 'RJ'); await page.click('form[action="/"] button[type="submit"]');
      await page.waitForFunction(() => new URL(location.href).searchParams.get('uf') === 'RJ', { timeout: 45000 }); await page.waitForNetworkIdle({ idleTime: 500, timeout: 45000 });
      assert.ok(await page.evaluate(() => window.__busy.includes('true')), 'Envio anuncia a região ocupada');
      assert.equal(await page.$eval('#resultados-consulta', (element) => element.getAttribute('aria-busy')), null);
      const shifts = name === 'chrome' ? await page.evaluate(() => window.__shifts?.reduce((sum, value) => sum + value, 0) ?? 0) : null;
      if (shifts !== null) assert.ok(shifts <= 0.1, `CLS da troca ${shifts}`);
      const summary = await page.$('.municipality-votes > summary'); await summary.focus();
      assert.equal(await summary.evaluate((element) => document.activeElement === element), true);
      if (name === 'chrome') {
        const session = await page.createCDPSession(); await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
        assert.equal(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), true); await page.screenshot({ path: resolve(artifactDirectory, `${name}-forced-colors.png`), fullPage: true }); await session.detach();
      }
      return { clsDuringQuery: shifts };
    });
  } finally { await browser.close(); await writeFile(resolve(artifactDirectory, 'report.json'), JSON.stringify(report, null, 2)); }
}
console.log(JSON.stringify({ status: 'ok', artifactDirectory, results: report.results.map((browser) => ({ browser: browser.browser, version: browser.version, cases: browser.cases.length })) }, null, 2));
