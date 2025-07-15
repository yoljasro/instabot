// signup.js - Instagram account creator with CAPTCHA + SMS support

import { chromium } from 'playwright';
import { faker } from '@faker-js/faker';
import axios from 'axios';
import fs from 'fs/promises';

const TWO_CAPTCHA_API_KEY = 'YOUR_2CAPTCHA_API_KEY';
const SMS_API_KEY = 'YOUR_5SIM_API_KEY';
const ACCOUNTS_FILE = './accounts.json';
const PROXY = process.argv[2]; // passed from signup-multiple.js

async function getSmsNumber() {
  const res = await axios.get(`https://5sim.net/v1/user/buy/activation/any/any/instagram`, {
    headers: { Authorization: `Bearer ${SMS_API_KEY}` }
  });
  return res.data;
}

async function getSmsCode(id) {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await axios.get(`https://5sim.net/v1/user/check/${id}`, {
      headers: { Authorization: `Bearer ${SMS_API_KEY}` }
    });
    if (res.data.sms && res.data.sms[0]) return res.data.sms[0].code;
  }
  throw new Error('SMS code timeout');
}

async function solveCaptcha(siteKey, pageUrl) {
  const req = await axios.post(`http://2captcha.com/in.php`, null, {
    params: {
      key: TWO_CAPTCHA_API_KEY,
      method: 'userrecaptcha',
      googlekey: siteKey,
      pageurl: pageUrl,
      json: 1
    }
  });
  const requestId = req.data.request;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await axios.get(`http://2captcha.com/res.php?key=${TWO_CAPTCHA_API_KEY}&action=get&id=${requestId}&json=1`);
    if (res.data.status === 1) return res.data.request;
  }
  throw new Error('CAPTCHA solve timeout');
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

async function signup(proxy) {
  const user = {
    fullName: faker.person.fullName(),
    username: faker.internet.userName().toLowerCase() + faker.number.int(1000),
    password: faker.internet.password({ length: 10 })
  };

  const smsData = await getSmsNumber();
  const phone = smsData.phone;

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    proxy: proxy ? { server: proxy } : undefined
  });
  const page = await context.newPage();

  await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'load' });
  await page.getByPlaceholder('Mobile Number or Email').fill(phone);
  await page.getByPlaceholder('Full Name').fill(user.fullName);
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.locator('text=Sign up').click();

  // CAPTCHA bypass (placeholder): auto-solve if needed
  // const siteKey = await page.getAttribute('iframe[title*="captcha"]', 'src').match(/k=([^&]+)/)[1];
  // const token = await solveCaptcha(siteKey, page.url());
  // await page.evaluate(`document.getElementById('g-recaptcha-response').innerHTML='${token}'`);

  const smsCode = await getSmsCode(smsData.id);
  await page.getByPlaceholder('Confirmation Code').fill(smsCode);
  await page.keyboard.press('Enter');

  await saveAccount({ username: user.username, password: user.password, phone, proxy });
  console.log(`✅ Created: ${user.username}`);

  await browser.close();
}

signup(PROXY).catch(console.error);