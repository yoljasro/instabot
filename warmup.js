// warmup.js - Instagram account warm-up script using Playwright

import { chromium } from 'playwright';
import fs from 'fs/promises';

const ACCOUNTS_FILE = './accounts.json';

async function loadAccounts() {
  const data = await fs.readFile(ACCOUNTS_FILE, 'utf8');
  return JSON.parse(data);
}

async function warmUp(account) {
  console.log(`\n🔥 Warm-up: ${account.username}`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    proxy: account.proxy ? { server: account.proxy } : undefined
  });
  const page = await context.newPage();

  try {
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[name="username"]');
    await page.type('input[name="username"]', account.username, { delay: 50 });
    await page.type('input[name="password"]', account.password, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // Warm-up actions
    await page.goto('https://www.instagram.com/natgeo/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const posts = await page.$$('article a');
    if (posts.length > 0) {
      await posts[0].click();
      await page.waitForSelector('svg[aria-label="Like"]');
      await page.click('svg[aria-label="Like"]');
      await page.keyboard.press('Escape');
    }

    const followBtn = await page.locator('text=Follow').first();
    if (await followBtn.isVisible()) {
      await followBtn.click();
    }
  } catch (err) {
    console.error(`❌ Error warming up ${account.username}:`, err.message);
  }

  await browser.close();
}

(async () => {
  const accounts = await loadAccounts();
  for (const account of accounts) {
    await warmUp(account);
  }
})();
