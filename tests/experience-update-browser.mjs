import { chromium } from '@playwright/test';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import assert from 'node:assert/strict';
import { emptyLibrary, validateLibrary } from '../extension/library.js';

await mkdir('test-results', { recursive: true });
const temp = await mkdtemp(resolve('test-results/experience-update-'));
const extension = resolve(temp, 'extension');
await cp('extension', extension, { recursive: true, filter: path => basename(path) !== 'local-profile-preset.js' });
const seed = emptyLibrary();
seed.profiles.push({ ...structuredClone(seed.profiles[0]), id: 'profile_finance', name: '财务岗' });
seed.activeId = 'profile_finance';
for (const profile of seed.profiles) {
  profile.data.basic.name = '原姓名';
  profile.data.education = [{ school: '保留学校' }];
  profile.data.internship = [{ company: '旧公司', department: '用户补充部门', description: '旧正文' }, { company: '不在新版中的公司' }];
  profile.data.project = [{ name: '旧项目名', results: '旧成果' }];
}
const library = validateLibrary(seed);
const updates = library.profiles.map(profile => ({ id: `replace-${profile.id}`, profileId: profile.id, replaceExperiences: {
  internship: [{ match: '新增公司', values: { company: '新增公司', role: '新岗位', start: '2026-04', end: '2026-06', description: '新经历正文' } }, { match: '旧公司', values: { company: '旧公司', role: '新实习岗位', start: '2026-07', end: '至今', description: '新版正文' } }],
  project: [{ match: '旧项目名', values: { name: '新项目名', role: '项目负责人', description: '新项目正文', responsibilities: '新职责', results: '新成果', url: '' } }, { match: '新增项目', values: { name: '新增项目', description: '新增项目正文' } }]
} }));
await writeFile(resolve(extension, 'local-profile-preset.js'), `export default ${JSON.stringify({ id: 'synthetic-existing-setup', library, profileUpdates: updates })};`);
const context = await chromium.launchPersistentContext(resolve(temp, 'browser'), { headless: true, channel: 'chromium', args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(library => chrome.storage.local.set({ library, localPresetMigration: 'synthetic-existing-setup' }), library);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/dashboard.html`);
  await page.locator('#version-list button').nth(1).waitFor();
  const updated = await worker.evaluate(() => chrome.storage.local.get(['library', 'localProfileUpdates', 'localProfileUpdateBackups']));
  assert.equal(updated.library.activeId, 'profile_finance');
  assert.equal(updated.library.revision, library.revision + 2);
  for (const [index, profile] of updated.library.profiles.entries()) {
    assert.deepEqual(profile.data.basic, library.profiles[index].data.basic);
    assert.deepEqual(profile.data.education, library.profiles[index].data.education);
    assert.deepEqual(profile.data.modules, library.profiles[index].data.modules);
    assert.deepEqual(profile.data.internship.map(entry => entry.company), ['新增公司', '旧公司']);
    assert.equal(profile.data.internship[1].department, '用户补充部门');
    assert.equal(profile.data.internship[1].description, '新版正文');
    assert.equal(profile.data.internship[1].end, '至今');
    assert.deepEqual(profile.data.project.map(entry => entry.name), ['新项目名', '新增项目']);
    assert.equal(profile.data.project[0].results, '新成果');
    assert.deepEqual(updated.localProfileUpdateBackups[`replace-${profile.id}`].data, library.profiles[index].data);
    assert.deepEqual(updated.localProfileUpdates[`replace-${profile.id}`].changed, ['internship', 'project']);
  }
  await worker.evaluate(async () => {
    const { library } = await chrome.storage.local.get('library');
    library.profiles[0].data.internship[0].description = '迁移后用户修改';
    library.profiles[1].data.project = []; library.revision++;
    await chrome.storage.local.set({ library });
  });
  await page.reload(); await page.locator('#version-list button').nth(1).waitFor();
  const later = await worker.evaluate(() => chrome.storage.local.get(['library', 'localProfileUpdateBackups']));
  assert.equal(later.library.profiles[0].data.internship[0].description, '迁移后用户修改');
  assert.deepEqual(later.library.profiles[1].data.project, []);
  assert.equal(later.library.revision, updated.library.revision + 1);
  assert.deepEqual(later.localProfileUpdateBackups, updated.localProfileUpdateBackups);
  console.log('PASS experience edition migration: both versions, order, additions, rename, supplemental fields, atomic backups, unrelated data and later edits preserved.');
} finally { await context.close(); await rm(temp, { recursive: true, force: true }); }
