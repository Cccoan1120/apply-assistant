import { chromium } from '@playwright/test';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('extension/vendor', { recursive: true });
await mkdir('extension/icons', { recursive: true });
await copyFile('node_modules/lucide/dist/umd/lucide.js', 'extension/vendor/lucide.js');
await copyFile('node_modules/lucide/LICENSE', 'extension/vendor/LUCIDE-LICENSE.txt');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const size of [16, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent('<style>body{margin:0}</style><canvas></canvas>');
    await page.evaluate(size => {
      const canvas = document.querySelector('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d'); ctx.scale(size / 128, size / 128);
      ctx.fillStyle = '#245bc4'; ctx.beginPath(); ctx.roundRect(0, 0, 128, 128, 24); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.roundRect(31, 23, 65, 82, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(46, 44); ctx.lineTo(79, 44); ctx.moveTo(46, 60); ctx.lineTo(64, 60); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(48, 80); ctx.lineTo(58, 89); ctx.lineTo(81, 71); ctx.stroke();
    }, size);
    await page.screenshot({ path: `extension/icons/icon${size}.png`, omitBackground: true });
  }
} finally { await browser.close(); }
