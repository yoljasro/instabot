// signup.js - Instagram account creator with CAPTCHA + SMS support

import { chromium } from 'playwright';
import { faker } from '@faker-js/faker';
import axios from 'axios';
import fs from 'fs/promises';
import { URL } from 'url'; // 👈 kerakli modul


const TWO_CAPTCHA_API_KEY = '03e178c35fcc6f2aec93b02743e50bfc';
const SMS_API_KEY = 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODQxNDEyMjksImlhdCI6MTc1MjYwNTIyOSwicmF5IjoiMzdhYTIzYWMxOWYzNThmNzA1YjU1NzAzYmM0NWQyODkiLCJzdWIiOjE0NjE4NDJ9.f2ahSRVgBpa5JMBUx9pC0Zfk-sDFgYxc4uO2cR4Oxoxn0hI2woUQHtNbOxKNNwDQHfghc8M6o1ZDdac6pKdZTMq8Zy6nBNe9Lq_MvSSLmJhPIjEmUBv91tDHeiPuaAyuqNbOGnsINEIQ8Zo6gaaN8w8481EbvcOz4vuXZ5Inug-nwlURS8U0Fabzc3cnkCU2PyHvKzlOEKOvD4f5utbsGR-7-t6vQZRtPQwgI8THiqph_cRePCkZNuaAfXW2uge-ThLApCtXq6jeOHagTW_PhglzpGs63j069URAmtIoRC72wYFVqTvGfR70kuw0YA_cjAfj-OUfN9hRyZr9pWXpJQ';
const ACCOUNTS_FILE = './accounts.json';
const PROXY = process.argv[2]; // proxy passed from signup-multiple.js

// === Solve CAPTCHA ===
const uzbekFirstNames = ['Ali', 'Diyor', 'Jasur', 'Bekzod', 'Shahlo', 'Malika', 'Dilshod', 'Gulnora'];
const uzbekLastNames = ['Tursunov', 'Yunusova', 'Xolmatov', 'Karimova', 'Saidov'];

function generateFullName() {
  const first = faker.helpers.arrayElement(uzbekFirstNames);
  const last = faker.helpers.arrayElement(uzbekLastNames);
  return `${first} ${last}`;
}

function generateUsername() {
  const base = faker.internet.username().toLowerCase();
  const cleaned = base.replace(/[^a-z0-9._]/g, '');
  return (cleaned + faker.number.int(999)).slice(0, 20);
}

async function solveCaptcha(siteKey, pageUrl) {
  const { data: submit } = await axios.post('http://2captcha.com/in.php', null, {
    params: {
      key: TWO_CAPTCHA_API_KEY,
      method: 'userrecaptcha',
      googlekey: siteKey,
      pageurl: pageUrl,
      json: 1
    }
  });

  const requestId = submit.request;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data: poll } = await axios.get('http://2captcha.com/res.php', {
      params: { key: TWO_CAPTCHA_API_KEY, action: 'get', id: requestId, json: 1 }
    });
    if (poll.status === 1) return poll.request;
  }
  throw new Error('❌ CAPTCHA yechilmadi (timeout)');
}

async function getSmsNumber() {
  const { data } = await axios.get(`https://5sim.net/v1/user/buy/activation/any/any/instagram`, {
    headers: { Authorization: `Bearer ${SMS_API_KEY}` }
  });
  return data;
}

async function getSmsCode(id) {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await axios.get(`https://5sim.net/v1/user/check/${id}`, {
      headers: { Authorization: `Bearer ${SMS_API_KEY}` }
    });
    if (data.sms?.[0]?.code) return data.sms[0].code;
  }
  throw new Error('❌ SMS kodi kelmadi (timeout)');
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
    fullName: generateFullName(),
    username: generateUsername(),
    password: faker.internet.password({ length: 10 })
  };

  const smsData = await getSmsNumber();
  const phone = smsData.phone;
  const proxyUrl = new URL(proxy);
  const browser = await chromium.launch({ headless: false });

  const context = await browser.newContext({
    proxy: {
      server: `${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`,
      username: proxyUrl.username,
      password: proxyUrl.password
    }
  });

  const page = await context.newPage();
  await page.goto('https://www.instagram.com/accounts/emailsignup/', { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="emailOrPhone"]', phone);
  await page.fill('input[name="fullName"]', user.fullName);
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="password"]', user.password);

  await Promise.all([
    page.locator('button[type="submit"]').click(),
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {})
  ]);

try {
  console.log('⏳ CAPTCHA tekshirilmoqda...');
  await page.waitForSelector('iframe', { timeout: 10000 });
  console.log('⚠️ CAPTCHA ehtimoliy mavjud. Qo‘lda yeching va "Далее" tugmasini bosing...');

  // 5 daqiqa ichida foydalanuvchi tugmani bosishini kutamiz
  await page.waitForSelector('button:has-text("Далее"), button:has-text("Next")', { timeout: 300000 });
  await page.click('button:has-text("Далее"), button:has-text("Next")');
} catch (e) {
  console.log('✅ CAPTCHA topilmadi yoki avtomatik o‘tildi...');
}



  try {
    await page.waitForSelector('select', { timeout: 15000 });
    const selects = await page.$$('select');
    if (selects.length < 3) throw new Error('❌ Select elementlar topilmadi');

    const year = faker.number.int({ min: 1990, max: 2004 }).toString();
    const month = faker.number.int({ min: 1, max: 12 }).toString();
    const day = faker.number.int({ min: 1, max: 28 }).toString();

    await selects[0].selectOption(month);
    await selects[1].selectOption(day);
    await selects[2].selectOption(year);

    await page.click('button:has-text("Далее"), button:has-text("Next")');
    console.log(`✅ Sana: ${day}-${month}-${year}`);
  } catch (e) {
    console.error('❌ DOB sahifasida xatolik:', e);
    await browser.close();
    return;
  }

  try {
    await page.waitForSelector('input[name="email_confirmation_code"]', { timeout: 30000 });
  } catch {
    console.error('❌ Confirmation input topilmadi');
    await browser.close();
    return;
  }

  const smsCode = await getSmsCode(smsData.id);
  await page.fill('input[name="email_confirmation_code"]', smsCode);
  await page.keyboard.press('Enter');

  await saveAccount({ username: user.username, password: user.password, phone, proxy });
  console.log(`✅ Created: ${user.username}`);
  await browser.close();
}

signup(PROXY).catch(console.error);