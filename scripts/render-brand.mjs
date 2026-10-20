// Exporta as aplicações de marca a partir dos SVGs locais, sem acessar a rede.
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

let executablePath = process.env.UI_EXECUTABLE_PATH;
if (!executablePath) {
  const directory = resolve(homedir(), '.cache/puppeteer/chrome');
  const versions = (await readdir(directory)).filter((name) => name.startsWith('linux-')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  if (!versions[0]) throw new Error('Configure UI_EXECUTABLE_PATH com um Chrome instalado.');
  executablePath = resolve(directory, versions[0], 'chrome-linux64/chrome');
}
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.setOfflineMode(true);
  for (const { source, target, width, height } of [
    { source: 'apps/web/public/brand/banner.svg', target: 'apps/web/app/opengraph-image.png', width: 1200, height: 630 },
    { source: 'apps/web/app/icon.svg', target: 'apps/web/app/apple-icon.png', width: 180, height: 180 },
  ]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(resolve(source)).href);
    await page.screenshot({ path: resolve(target) });
    console.log(`${target}: ${width} × ${height}`);
  }
} finally { await browser.close(); }
