// signup.js - Instagram account creator with CAPTCHA + SMS support

import { chromium } from 'playwright';
import { faker } from '@faker-js/faker';
import axios from 'axios';
import fs from 'fs/promises';
import { URL } from 'url'; // 👈 kerakli modul


const TWO_CAPTCHA_API_KEY = '03e178c35fcc6f2aec93b02743e50bfc';
const SMS_API_KEY = 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODQxNDEyMjksImlhdCI6MTc1MjYwNTIyOSwicmF5IjoiMzdhYTIzYWMxOWYzNThmNzA1YjU1NzAzYmM0NWQyODkiLCJzdWIiOjE0NjE4NDJ9.f2ahSRVgBpa5JMBUx9pC0Zfk-sDFgYxc4uO2cR4Oxoxn0hI2woUQHtNbOxKNNwDQHfghc8M6o1ZDdac6pKdZTMq8Zy6nBNe9Lq_MvSSLmJhPIjEmUBv91tDHeiPuaAyuqNbOGnsINEIQ8Zo6gaaN8w8481EbvcOz4vuXZ5Inug-nwlURS8U0Fabzc3cnkCU2PyHvKzlOEKOvD4f5utbsGR-7-t6vQZRtPQwgI8THiqph_cRePCkZNuaAfXW2uge-ThLApCtXq6jeOHagTW_PhglzpGs63j069URAmtIoRC72wYFVqTvGfR70kuw0YA_cjAfj-OUfN9hRyZr9pWXpJQ';
const ACCOUNTS_FILE = './accounts.json';
const PROXY = process.argv[2]; // passed from signup-multiple.js

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

  // Polling uchun 30 soniya (har 5s tekshirish)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await axios.get(`http://2captcha.com/res.php`, {
      params: {
        key: TWO_CAPTCHA_API_KEY,
        action: 'get',
        id: requestId,
        json: 1
      }
    });
    if (res.data.status === 1) return res.data.request;
  }

  throw new Error('❌ CAPTCHA yechish timeout');
}

// 🎯 2. SMS raqam olish
async function getSmsNumber() {
  const res = await axios.get(`https://5sim.net/v1/user/buy/activation/any/any/instagram`, {
    headers: { Authorization: `Bearer ${SMS_API_KEY}` }
  });
  return res.data;
}

// 🎯 3. SMS kod kutish
async function getSmsCode(id) {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await axios.get(`https://5sim.net/v1/user/check/${id}`, {
      headers: { Authorization: `Bearer ${SMS_API_KEY}` }
    });
    if (res.data.sms && res.data.sms[0]) return res.data.sms[0].code;
  }
  throw new Error('❌ SMS code timeout');
}

// 🎯 4. JSON saqlash
async function saveAccount(account) {
  let existing = [];
  try {
    const data = await fs.readFile(ACCOUNTS_FILE, 'utf8');
    existing = JSON.parse(data);
  } catch {}
  existing.push(account);
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(existing, null, 2));
}

// 🎯 5. Asosiy SIGNUP funksiyasi
async function signup(proxy) {
  const user = {
    fullName: faker.person.fullName(),
    username: faker.internet.username().toLowerCase() + faker.number.int(1000),
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

  // 🎯 CAPTCHA bor-yo‘qligini aniqlash
  const captchaFrame = await page.$('iframe[title*="challenge"], iframe[title*="captcha"]');
  if (captchaFrame) {
    console.log('🛡️ CAPTCHA aniqlandi, yechilyapti...');
    const frameSrc = await captchaFrame.getAttribute('src');
    const siteKey = frameSrc.match(/k=([^&]+)/)?.[1];
    if (siteKey) {
      const token = await solveCaptcha(siteKey, page.url());
      await page.evaluate(token => {
        const el = document.getElementById('g-recaptcha-response');
        if (el) el.innerHTML = token;
      }, token);
      console.log('✅ CAPTCHA yechildi');
    } else {
      console.warn('⚠️ CAPTCHA sitekey topilmadi');
    }
  } else {
    console.log('✔️ CAPTCHA topilmadi');
  }

  // Formani to‘ldirish
  await page.getByPlaceholder('Mobile Number or Email').fill(phone);
  await page.getByPlaceholder('Full Name').fill(user.fullName);
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.locator('text=Sign up').click();

  const smsCode = await getSmsCode(smsData.id);
  await page.getByPlaceholder('Confirmation Code').fill(smsCode);
  await page.keyboard.press('Enter');

  await saveAccount({ username: user.username, password: user.password, phone, proxy });
  console.log(`✅ Created: ${user.username}`);

  await browser.close();
}

signup(PROXY).catch(console.error);
