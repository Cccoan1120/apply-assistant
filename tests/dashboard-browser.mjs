import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';

const results = resolve('test-results');
await mkdir(results, { recursive: true });
const userData = await mkdtemp(resolve(results, 'dashboard-profile-'));
const extension = resolve(userData, 'extension');
await cp('extension', extension, { recursive: true, filter: source => basename(source) !== 'local-profile-preset.js' });
const errors = [];
let context;
const synthetic = { version: 1, basic: { name: '演示候选人', phone: '13800000000', email: 'demo@example.com', city: '上海', summary: '虚构测试资料，用于验证网申助手。' }, education: [{ school: '示例大学', major: '管理学', degree: '硕士' }], internship: [{ company: '示例公司', role: '产品实习生' }], project: [] };

async function submitDialog(page, values) {
  await expect(page.locator('#edit-dialog')).toBeVisible();
  for (const [name, value] of Object.entries(values)) {
    const field = page.locator(`#dialog-fields [name="${name}"]`);
    if (await field.evaluate(el => el.tagName === 'SELECT')) await field.selectOption(value);
    else await field.fill(value);
  }
  await page.locator('#dialog-form button[type="submit"]').click();
  await expect(page.locator('#edit-dialog')).not.toBeVisible();
}
async function save(page) {
  await page.locator('#save-data').click();
  await expect(page.locator('#status')).toHaveText('版本已保存');
}
async function confirmClick(page, selector, accept = true) {
  page.once('dialog', dialog => accept ? dialog.accept() : dialog.dismiss());
  await page.locator(selector).click();
}
async function download(page, selector) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const file = await pending;
  return { name: file.suggestedFilename(), mimeType: 'application/json', buffer: await readFile(await file.path()) };
}
async function readStored(page) { return page.evaluate(async () => (await chrome.storage.local.get('library')).library); }
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `horizontal overflow at ${(await page.viewportSize()).width}px`);
}

try {
  context = await chromium.launchPersistentContext(userData, { headless: true, channel: 'chromium', acceptDownloads: true, viewport: { width: 1360, height: 900 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  await worker.evaluate(profile => chrome.storage.local.set({ profile }), synthetic);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const url = `chrome-extension://${extensionId}/dashboard.html`;
  await page.goto(url);
  await expect(page.locator('[data-field="name"]')).toHaveValue('演示候选人');
  const migrated = await readStored(page);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.profiles.length, 1);
  assert.deepEqual(migrated.profiles[0].data.modules, []);
  assert.deepEqual(await page.evaluate(async () => (await chrome.storage.local.get('profile')).profile), synthetic);
  const originalId = migrated.activeId;
  await page.reload();
  await expect(page.locator('[data-field="name"]')).toHaveValue('演示候选人');
  assert.equal((await readStored(page)).activeId, originalId);

  await page.locator('[data-field="city"]').fill('北京');
  await expect(page.getByRole('spinbutton', { name: '身高(cm)', exact: true })).toHaveValue('');
  await page.getByRole('spinbutton', { name: '身高(cm)', exact: true }).fill('175.5');
  await page.getByRole('spinbutton', { name: '体重(kg)', exact: true }).fill('65.5');
  const addedFields = { hukouAddress: '测试户籍详细地址', residentialAddress: '测试现居住地址', mailingAddress: '测试邮寄地址', cet4Score: '501', cet6Score: '502' };
  for (const [key, value] of Object.entries(addedFields)) {
    await expect(page.locator(`[data-field="${key}"]`)).toHaveValue('');
    await page.locator(`[data-field="${key}"]`).fill(value);
  }
  await save(page);
  await page.reload();
  await expect(page.locator('[data-field="height"]')).toHaveValue('175.5');
  await expect(page.locator('[data-field="weight"]')).toHaveValue('65.5');
  assert.equal((await readStored(page)).profiles[0].data.basic.weight, '65.5');
  for (const [key, value] of Object.entries(addedFields)) await expect(page.locator(`[data-field="${key}"]`)).toHaveValue(value);
  await page.locator('#duplicate-version').click();
  await submitDialog(page, { name: '产品经理版本', target: '校招产品经理' });
  await expect(page.locator('#version-title')).toHaveText('产品经理版本');
  const productId = (await readStored(page)).activeId;
  await expect(page.locator('[data-field="city"]')).toHaveValue('北京');
  await page.locator('[data-field="summary"]').fill('面向产品经理岗位的项目与实习经验。');
  await save(page);
  await page.locator(`[data-version="${originalId}"]`).click();
  await expect(page.locator('[data-field="summary"]')).toHaveValue(synthetic.basic.summary);
  await page.locator(`[data-version="${productId}"]`).click();
  await expect(page.locator('[data-field="summary"]')).toHaveValue('面向产品经理岗位的项目与实习经验。');

  await page.locator('#add-module').click();
  await submitDialog(page, { label: '获奖与竞赛' });
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('示例创新挑战赛');
  await page.getByRole('textbox', { name: '内容描述', exact: true }).fill('虚构竞赛经历，仅用于测试。');
  await page.locator('#add-field').click();
  await submitDialog(page, { label: '获奖年月', type: 'month' });
  await page.getByRole('textbox', { name: '获奖年月', exact: true }).fill('2026-05');
  await page.locator('#add-entry').click();
  await page.getByRole('textbox', { name: '名称', exact: true }).nth(1).fill('示例商业案例竞赛');
  await page.getByRole('textbox', { name: '获奖年月', exact: true }).nth(1).fill('2025-10');
  await save(page);
  let stored = await readStored(page);
  const awardModule = stored.profiles.find(p => p.id === productId).data.modules[0];
  assert.equal(awardModule.fields.length, 3);
  assert.equal(awardModule.entries.length, 2);
  assert.equal(stored.profiles.find(p => p.id === originalId).data.modules.length, 0);
  await page.reload();
  await page.locator(`[data-group="${awardModule.id}"]`).click();
  await expect(page.getByRole('textbox', { name: '获奖年月', exact: true }).nth(1)).toHaveValue('2025-10');
  await noOverflow(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(results, 'dashboard-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(results, 'dashboard-mobile.png') });
  await page.setViewportSize({ width: 1360, height: 900 });

  const versionExport = await download(page, '#export-data');
  const exported = JSON.parse(versionExport.buffer.toString('utf8'));
  assert.equal(exported.format, 'apply-assistant-version');
  assert.equal(exported.name, '产品经理版本');
  assert.deepEqual(exported.data.modules, [awardModule]);
  const libraryExport = await download(page, '#export-all');
  assert.equal(JSON.parse(libraryExport.buffer.toString('utf8')).profiles.length, 2);
  await page.locator('#import-file').setInputFiles(versionExport);
  await expect(page.locator('#status')).toHaveText('已导入 1 个版本');
  stored = await readStored(page);
  assert.equal(stored.profiles.length, 3);
  assert.deepEqual(stored.profiles.find(p => p.id === stored.activeId).data.modules, [awardModule]);
  assert.notEqual(stored.activeId, productId);
  await page.locator('#import-file').setInputFiles(libraryExport);
  await expect(page.locator('#status')).toHaveText('已导入 2 个版本');
  stored = await readStored(page);
  assert.equal(stored.profiles.length, 5);
  assert.equal(new Set(stored.profiles.map(p => p.id)).size, 5);

  await page.locator(`[data-version="${productId}"]`).click();
  await expect(page.locator('#version-title')).toHaveText('产品经理版本');
  await page.locator(`[data-group="${awardModule.id}"]`).click();
  await confirmClick(page, '[aria-label="删除字段获奖年月"]', false);
  await expect(page.getByRole('textbox', { name: '获奖年月', exact: true })).toHaveCount(2);
  await confirmClick(page, '[aria-label="删除字段获奖年月"]');
  await expect(page.getByRole('textbox', { name: '获奖年月', exact: true })).toHaveCount(0);
  await save(page);
  assert.equal((await readStored(page)).profiles.find(p => p.id === productId).data.modules[0].fields.length, 2);
  await confirmClick(page, '#delete-module', false);
  await expect(page.locator('#module-title')).toHaveText('获奖与竞赛');
  await confirmClick(page, '#delete-module');
  await save(page);
  assert.equal((await readStored(page)).profiles.find(p => p.id === productId).data.modules.length, 0);
  await confirmClick(page, '#delete-version', false);
  assert.equal((await readStored(page)).profiles.length, 5);
  await confirmClick(page, '#delete-version');
  await expect(page.locator('#status')).toHaveText('版本已删除');
  assert.equal((await readStored(page)).profiles.length, 4);

  const second = await context.newPage();
  second.on('pageerror', error => errors.push(error.message));
  await second.goto(url);
  await expect(second.locator('[data-field="name"]')).toHaveValue('演示候选人');
  await second.locator('[data-field="name"]').fill('窗口 B 未保存草稿');
  await page.locator('[data-field="name"]').fill('窗口 A 最新资料');
  await save(page);
  await expect(second.locator('#conflict')).toBeVisible();
  await expect(second.locator('[data-field="name"]')).toHaveValue('窗口 B 未保存草稿');
  await second.locator('#save-data').click();
  await expect(second.locator('#status')).toContainText('资料已在另一个窗口更新');
  stored = await readStored(page);
  assert.equal(stored.profiles.find(p => p.id === stored.activeId).data.basic.name, '窗口 A 最新资料');
  await confirmClick(second, '#reload-data', false);
  await expect(second.locator('[data-field="name"]')).toHaveValue('窗口 B 未保存草稿');
  await confirmClick(second, '#reload-data');
  await expect(second.locator('[data-field="name"]')).toHaveValue('窗口 A 最新资料');
  await expect(second.locator('#conflict')).not.toBeVisible();
  await page.evaluate(() => chrome.storage.local.set({library:null}));
  await page.reload();
  await expect(page.locator('#status')).toContainText('资料读取失败');
  assert.equal(await readStored(page),null,'invalid stored values must remain untouched');
  assert.deepEqual(errors, []);
  console.log('PASS real extension dashboard: legacy migration, save, version isolation, custom fields/entries, persistence, export/import, deletion confirmations, multi-window conflict, desktop/mobile layout and no page errors.');
} finally {
  if (context) await context.close();
  assert.ok(userData.startsWith(results + sep));
  await rm(userData, { recursive: true, force: true });
}
