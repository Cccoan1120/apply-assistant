import { chromium } from '@playwright/test';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

await mkdir('test-results', { recursive: true });
const profile = await mkdtemp(resolve('test-results/launcher-profile-'));
const extension = resolve('extension');
const fixture = await readFile('tests/fixtures/application.html', 'utf8');
const context = await chromium.launchPersistentContext(profile, {
  headless: true, channel: 'chromium',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const failures = [];
  context.on('weberror', event => failures.push(event.error().message));
  // Only synthetic responses reach this isolated browser, including the Moka URL from the report.
  await context.route('https://**/*', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: /\/(?:docx|loading)\//.test(new URL(route.request().url()).pathname) ? '<!doctype html><title>普通页面</title><body><p>页面正文</p></body>' : (/feishu\.cn$/.test(new URL(route.request().url()).hostname) ? fixture : fixture.replace(/data-form-field-i18n-name=/g, 'data-fixture-label=').replace(/atsx-form-item/g, 'generic-form-item'))
  }));
  const page = await context.newPage();
  await page.goto('https://app.mokahr.com/campus-recruitment/shein/2932#/candidateHome/resume');
  const launcher = page.locator('apply-assistant-launcher');
  await launcher.getByRole('button', { name: '网申助手', exact: true }).waitFor();
  assert.equal(await page.inputValue('#candidate'), '');
  assert.equal(await page.evaluate(() => window.submitCount), 0);
  // Host permission must allow engine injection without a toolbar activeTab grant.
  const scan = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://app.mokahr.com/*' });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['engine.js'] });
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => globalThis.ApplyAssistant.scan('basic') });
    return result.result;
  });
  assert.equal(scan.platform, 'Moka'); assert.ok(scan.rows.length > 0);
  await launcher.getByRole('button', { name: '网申助手', exact: true }).click();
  await launcher.locator('.open[data-state="opened"]').waitFor();
  assert.equal(await launcher.locator('.error').isVisible(), false);
  assert.equal(await page.inputValue('#candidate'), '');
  assert.equal(await page.evaluate(() => window.submitCount), 0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/launcher-${width}.png` });
    const box = await launcher.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.y + box.height <= 900);
  }
  await launcher.getByRole('button', { name: '本页隐藏网申助手' }).click();
  assert.equal(await launcher.count(), 0);
  await page.evaluate(() => { location.hash = '/candidateHome/resume/education'; });
  assert.equal(await launcher.count(), 0);
  await page.reload(); await launcher.locator('.open').waitFor();
  await page.goto('https://example.feishu.cn/docx/test');
  await page.waitForFunction(() => document.querySelector('apply-assistant-launcher')?.hidden === true);
  assert.equal(await launcher.isVisible(), false);
  await page.evaluate(() => {
    const form = document.createElement('form'); const label = document.createElement('label');
    label.textContent = '教育经历'; label.append(document.createElement('input')); form.append(label); document.body.append(form);
  });
  await launcher.locator('.open').waitFor();
  await page.goto('https://jobs.feishu.cn/campus/position/application'); await launcher.locator('.open').waitFor();
  await page.goto('https://campus.hotjob.cn/application'); await launcher.locator('.open').waitFor();
  await page.goto('https://campushr.hikvision.com/school?schoolType=nozxf&activeTab=0'); await launcher.locator('.open').waitFor();
  const hikvisionScan = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://campushr.hikvision.com/*' });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['engine.js'] });
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => globalThis.ApplyAssistant.scan('basic') });
    return result.result;
  });
  assert.ok(hikvisionScan.rows.length > 0);
  await page.goto('https://zhaopin.deppon.com/form?fromPage=editMyResume'); await launcher.locator('.open').waitFor();
  const depponScan = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://zhaopin.deppon.com/*' });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['engine.js'] });
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => globalThis.ApplyAssistant.scan('basic') });
    return result.result;
  });
  assert.equal(depponScan.platform, '北森');
  await launcher.getByRole('button', { name: '网申助手', exact: true }).click();
  await launcher.locator('.open[data-state="opened"]').waitFor();
  await page.goto('https://zhaopin.liby.com.cn/loading/'); await launcher.locator('.open').waitFor();
  assert.equal(await page.locator('input,textarea,select').count(), 0);
  await launcher.getByRole('button', { name: '网申助手', exact: true }).click();
  await launcher.locator('.open[data-state="opened"]').waitFor();
  await page.goto('https://zhaopin.liby.com.cn/form?fromPage=job'); await launcher.locator('.open').waitFor();
  const libyScan = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://zhaopin.liby.com.cn/*' });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['engine.js'] });
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => globalThis.ApplyAssistant.scan('basic') });
    return result.result;
  });
  assert.equal(libyScan.platform, '北森'); assert.ok(libyScan.rows.length > 0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/liby-launcher-${width}.png` });
    const box = await launcher.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.y + box.height <= 900);
  }
  await launcher.getByRole('button', { name: '网申助手', exact: true }).click();
  await launcher.locator('.open[data-state="opened"]').waitFor();
  assert.equal(await launcher.locator('.error').isVisible(), false);
  assert.equal(await page.inputValue('#candidate'), '');
  assert.equal(await page.evaluate(() => window.submitCount), 0);
  await page.goto('https://zhaopin.liby.com.cn.unrelated.example/form?fromPage=job');
  assert.equal(await launcher.count(), 0);
  await page.goto('https://campus.boe.com/form'); await launcher.locator('.open').waitFor();
  const boeScan = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://campus.boe.com/*' });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['engine.js'] });
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => globalThis.ApplyAssistant.scan('basic') });
    return result.result;
  });
  assert.equal(boeScan.platform, '北森'); assert.ok(boeScan.rows.length > 0);
  await page.goto('https://baicgroup.zhiye.com/loading/'); await launcher.locator('.open').waitFor();
  assert.equal(await page.locator('input, textarea, select').count(), 0);
  const zhiyeUrl = 'https://baicgroup.zhiye.com/form?fromPage=editMyResume';
  await page.goto(zhiyeUrl); await launcher.locator('.open').waitFor();
  const zhiyeScan = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.url) throw new Error('Zhiye active tab URL is inaccessible without an activeTab grant');
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['engine.js'] });
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => globalThis.ApplyAssistant.scan('basic') });
    return { url: tab.url, scan: result.result };
  });
  assert.equal(zhiyeScan.url, zhiyeUrl);
  assert.equal(zhiyeScan.scan.platform, '北森'); assert.ok(zhiyeScan.scan.rows.length > 0);
  await launcher.getByRole('button', { name: '网申助手', exact: true }).click();
  await launcher.locator('.open[data-state="opened"]').waitFor();
  assert.equal(await launcher.locator('.error').isVisible(), false);
  assert.equal(await page.inputValue('#candidate'), '');
  assert.equal(await page.evaluate(() => window.submitCount), 0);
  await page.goto('https://unrelated.example/application');
  assert.equal(await launcher.count(), 0);
  assert.deepEqual(failures, []);
  console.log('PASS launcher: Moka/Zhiye/Liby URL auto-injection, real sidePanel.open, host-permission scan without activeTab, no autofill/submission, desktop/mobile, loading-page entry, dismiss/reload, Feishu dynamic form, Beisen, unrelated and lookalike-site exclusion.');
} finally {
  await context.close(); await rm(profile, { recursive: true, force: true });
}
