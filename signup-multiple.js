// signup-multiple.js
import fs from 'fs/promises';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const PROXY_LIST_FILE = './proxies.txt';
const ACCOUNTS_FILE = './accounts.json';
const TOTAL_ACCOUNTS = 10; // ✅ faqat 10 ta yaratamiz

async function loadProxies() {
  const data = await fs.readFile(PROXY_LIST_FILE, 'utf8');
  return data.split('\n').map(p => p.trim()).filter(p => p);
}

async function saveAccount(account) {
  let existing = [];
  try {
    const data = await fs.readFile(ACCOUNTS_FILE, 'utf8');
    existing = JSON.parse(data);
  } catch {}
  existing.push(account);
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(existing, null, 2));
}

async function run() {
  const proxies = await loadProxies();

  for (let i = 0; i < TOTAL_ACCOUNTS; i++) {
    const proxy = proxies[i % proxies.length];
    console.log(`\n\n▶️ Starting signup ${i + 1}/${TOTAL_ACCOUNTS} using proxy: ${proxy}`);

    try {
      const { stdout, stderr } = await execPromise(`node signup.js "${proxy}"`);
      if (stderr) console.error(stderr);
      console.log(stdout);
    } catch (err) {
      console.error(`Signup failed for proxy ${proxy}:`, err.message);
    }
  }
}

run();
