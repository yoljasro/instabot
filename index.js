// index.js
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';

const execPromise = util.promisify(exec);

// === Config ===
const STEP_LOG = true;
const STEPS = [
  { label: 'Signup 100 Accounts', script: 'signup-multiple.js' },
  { label: 'Warm-up Accounts', script: 'warmup.js' },
  { label: 'Like Bot (target post)', script: 'like-bot.js' },
  { label: 'Comment Bot (target post)', script: 'comment-bot.js' }
];

const LOG_FILE = './log.txt';

// === Helper ===
async function runStep(label, command) {
  console.log(`\n▶️ STEP: ${label}`);
  try {
    const { stdout, stderr } = await execPromise(`node ${command}`);
    if (STEP_LOG) {
      await fs.appendFile(LOG_FILE, `\n[${label}] STDOUT:\n${stdout}`);
      if (stderr) await fs.appendFile(LOG_FILE, `\n[${label}] STDERR:\n${stderr}`);
    }
    console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (err) {
    const message = `❌ ERROR (${label}): ${err.message}`;
    console.error(message);
    await fs.appendFile(LOG_FILE, `\n[${label}] ❌ ERROR:\n${err.message}`);
  }
}

async function main() {
  console.log(`\n🚀 STARTING INSTAGRAM BOT`);
  const start = Date.now();

  for (const step of STEPS) {
    await runStep(step.label, step.script);
  }

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n✅ COMPLETED in ${duration} sec`);
}

main();
