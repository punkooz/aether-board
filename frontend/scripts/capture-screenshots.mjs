#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('screenshots');
await fs.mkdir(outDir, { recursive: true });

let playwright;
try {
  playwright = await import('playwright');
} catch {
  console.error('Playwright is not installed.');
  console.error('Install it with: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const baseUrl = process.env.APP_URL || 'http://localhost:5173';
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const tabs = [
  ['board', 'Board'],
  ['task', 'Task Details'],
  ['agents', 'Agents'],
  ['rooms', 'Room Feeds'],
  ['milestones', 'Milestones'],
  ['reviews', 'CEO Review Queue']
];

await page.goto(baseUrl, { waitUntil: 'networkidle' });

for (const [slug, label] of tabs) {
  await page.getByRole('button', { name: label }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, `${slug}.png`), fullPage: true });
}

await browser.close();
console.log(`Saved screenshots to ${outDir}`);
