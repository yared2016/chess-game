import { chromium } from '@playwright/test';
import path from 'path';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\539d710b-3c1d-4414-b6e7-ec2c16b9a828';
const baseURL = 'https://chess-game-beta-mocha.vercel.app';

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  const pages = [
    { name: 'mobile_home', url: '/' },
    { name: 'mobile_leaderboard', url: '/leaderboard' },
    { name: 'mobile_university', url: '/university' },
    { name: 'mobile_signin', url: '/sign-in' },
  ];

  for (const p of pages) {
    try {
      console.log(`Navigating to ${baseURL}${p.url}...`);
      await page.goto(`${baseURL}${p.url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      const filePath = path.join(outDir, `${p.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`Saved screenshot: ${filePath}`);
    } catch (err) {
      console.error(`Failed on ${p.url}:`, err.message);
    }
  }

  await browser.close();
}

run();
