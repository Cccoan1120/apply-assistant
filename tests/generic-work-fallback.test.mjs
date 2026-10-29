import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const engine = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const record = () => '<article><label>公司名称<input class="company"></label><label>职位名称<input class="role"></label><label>工作职责<textarea></textarea></label></article>';
const section = title => `<section><h2>${title}</h2><div class="records">${record()}</div><button type="button">添加${title}</button></section>`;
const profile = () => ({ basic: {}, education: [], project: [], modules: [], internship: [1, 2].map(i => ({ company: `实习公司${i}`, role: `产品实习生${i}`, description: `职责${i}` })) });
function setup(t, html, host = 'new-employer.example.com') {
  const dom = new JSDOM(html, { url: `https://${host}/apply`, runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(engine);
  t.after(() => dom.window.close());
  const document = dom.window.document;
  for (const button of document.querySelectorAll('button')) button.onclick = () => button.parentElement.querySelector('.records').insertAdjacentHTML('beforeend', record());
  return { api: dom.window.ApplyAssistant, document };
}

test('Work-only sections expand and fill internships on unlisted employers', async t => {
  for (const host of ['new-company.zhiye.com', 'app.mokahr.com', 'new-employer.example.com']) {
    const { api, document } = setup(t, section('工作经历'), host), data = profile();
    await api.prepare(data);
    await api.fill(api.plan(data).rows.filter(row => !row.reason));
    assert.deepEqual([...document.querySelectorAll('.company')].map(node => node.value), data.internship.map(entry => entry.company));
    assert.deepEqual([...document.querySelectorAll('.role')].map(node => node.value), data.internship.map(entry => entry.role));
    await api.prepare(data);
    assert.equal(document.querySelectorAll('article').length, 2);
  }
});

test('Separate internship sections prevent duplicate filling of work sections', async t => {
  const { api, document } = setup(t, section('工作经历') + section('实习经历')), data = profile();
  await api.prepare(data);
  await api.fill(api.plan(data).rows.filter(row => !row.reason));
  const [work, internship] = document.querySelectorAll('section');
  assert.equal(work.querySelectorAll('article').length, 1);
  assert.equal(work.querySelector('.company').value, '');
  assert.deepEqual([...internship.querySelectorAll('.company')].map(node => node.value), data.internship.map(entry => entry.company));
});

test('Explicit work module always owns work sections, even if empty', async t => {
  for (const entries of [[], [{ company: '正式工作公司', role: '专员', description: '正式工作职责' }]]) {
    const { api, document } = setup(t, section('工作经历')), data = profile();
    data.modules.push({ id: 'paid_work', label: '工作经历', fields: [{ id: 'company', label: '公司名称' }, { id: 'role', label: '职位名称' }, { id: 'description', label: '工作职责' }], entries });
    await api.prepare(data);
    const rows = api.plan(data).rows;
    assert.ok(rows.every(row => row.group !== 'internship'));
    await api.fill(rows.filter(row => !row.reason));
    assert.equal(document.querySelectorAll('article').length, 1);
    assert.equal(document.querySelector('.company').value, entries[0]?.company || '');
  }
});

test('Collapsed internship section retains ownership until opened', async t => {
  const { api, document } = setup(t, section('工作经历') + `<div hidden>${section('实习经历')}</div>`), data = profile();
  await api.prepare(data);
  assert.ok(api.plan(data).rows.every(row => row.group !== 'internship'));
  assert.equal(document.querySelector('.company').value, '');
});
