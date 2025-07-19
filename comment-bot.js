import { chromium } from 'playwright';
import fs from 'fs/promises';

const ACCOUNTS_FILE = './accounts.json';
const POST_URL = 'https://www.instagram.com/reel/DLSlffqo-1I2fL-Cud_XDazleIQkepEsR5DzXc0/?igsh=MWpvcG1xYjV0ajRyOA=='; // o'rniga real link yozing
const COMMENTS = ['Amazing!', 'So cool!', '🔥🔥🔥', 'Love this!', 'Beautiful!', 'Nice shot!'];

async function loadAccounts() {
  const data = await fs.readFile(ACCOUNTS_FILE, 'utf8');
  return JSON.parse(data);
}

function getRandomComment() {
  return COMMENTS[Math.floor(Math.random() * COMMENTS.length)];
}

async function commentFromAccount(account) {
  console.log(`💬 Commenting from: ${account.username}`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    proxy: account.proxy ? { server: account.proxy } : undefined
  });
  const page = await context.newPage();

  try {
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' });
    await page.fill('input[name="username"]', account.username);
    await page.fill('input[name="password"]', account.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    await page.goto(POST_URL, { waitUntil: 'networkidle' });
    await page.click('textarea');
    await page.fill('textarea', getRandomComment());
    await page.keyboard.press('Enter');

    console.log(`✅ Commented from ${account.username}`);
  } catch (err) {
    console.error(`❌ Failed ${account.username}: ${err.message}`);
  }

  await browser.close();
}

(async () => {
  const accounts = await loadAccounts();
  for (const account of accounts) {
    await commentFromAccount(account);
  }
})();
