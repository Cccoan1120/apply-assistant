import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import preset from './fixtures/synthetic-profiles.mjs';
const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (label, html) => `<div class="form-item"><label class="form-item__text">${label}</label>${html}</div>`;
const entry = (role = '') => `<div class="record">${field('在校职务名称', `<input class="role" value="${role}">`)}${field('开始时间', '<input class="start" type="month">')}${field('结束时间', '<div class="fields-col"><div class="phoenix-select"><input class="end" readonly></div><label class="phoenix-checkbox"><input type="checkbox"><span class="phoenix-checkbox__text">至今</span></label></div>')}${field('在校职务描述', '<textarea maxlength="2000"></textarea>')}</div>`;
const section = (id, label, body) => `<section><div id="${id}">${label}</div><div class="ux-standard-form"><div class="form" id="${id}"><div class="records">${body}</div><button type="button" class="add">添加${label}</button></div></div></section>`;
function siteSetup(t, roles = [''], host) {
  const makeEntry = role => host === 'seif1.zhiye.com' ? entry(role).replaceAll('在校职务名称', '职务名称').replaceAll('在校职务描述', '职务描述') : entry(role);
  const dom = new JSDOM(section('campus', '在校职务', roles.map(makeEntry).join('')) + section('practice', '在校实践', field('社会工作团体', '<input>') + field('担任职务', '<input>') + field('工作职责', '<textarea></textarea>')) + '<button class="save">暂存</button><button class="submit">预览并提交</button>', { url: `https://${host}/form?fromPage=job`, runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(code); t.after(() => dom.window.close());
  const document = dom.window.document, api = dom.window.ApplyAssistant;
  const stats = { added: 0, practice: 0, save: 0, submit: 0 };
  const bind = node => { node.querySelector('input[type="checkbox"]').onclick = () => { node.querySelector('.end').disabled = true; }; };
  document.querySelectorAll('.record').forEach(bind);
  const form = document.querySelector('.form#campus');
  form.querySelector('.add').onclick = () => { stats.added++; form.querySelector('.records').insertAdjacentHTML('beforeend', makeEntry()); bind(form.querySelector('.records').lastElementChild); };
  for (const key of ['practice', 'save', 'submit']) (key === 'practice' ? document.querySelector('.form#practice .add') : document.querySelector(`.${key}`)).onclick = () => stats[key]++;
  return { api, document, stats, dom };
}
function data(edition) { return { ...edition.data, modules: edition.data.modules.filter(module => module.id === 'custom_campus') }; }

for (const host of ['aimer.zhiye.com', 'seif1.zhiye.com', 'new-company.zhiye.com', 'careers.example.org']) {
const setup = (t, roles) => siteSetup(t, roles, host);
test(`${host} adds three duties by role and fills each full description without duplicating campus practice`, async t => {
  for (const edition of preset.library.profiles) {
    const profile = data(edition), { api, document, stats } = setup(t);
    await api.prepare(profile);
    const rows = api.plan(profile).rows;
    const items = rows.filter(row => row.group === 'custom_campus' && !row.reason && (row.key !== 'field_end' || row.value === '至今'));
    assert.ok((await api.fill(items)).every(result => result.ok));
    const records = [...document.querySelectorAll('.record')], entries = profile.modules[0].entries;
    assert.equal(records.length, 3);
    assert.deepEqual(records.map(node => node.querySelector('.role').value), entries.map(entry => entry.field_role));
    assert.deepEqual(records.map(node => node.querySelector('textarea').value), entries.map(entry => entry.field_description));
    assert.deepEqual(records.map(node => node.querySelector('.start').value), entries.map(entry => entry.field_start));
    assert.deepEqual(Array.from(rows.filter(row => row.group === 'custom_campus' && row.key === 'field_end'), row => row.value), entries.map(entry => entry.field_end));
    assert.equal(records[0].querySelector('input[type="checkbox"]').checked, true);
    assert.ok([...document.querySelector('.form#practice').querySelectorAll('input,textarea')].every(node => !node.value));
    await api.prepare(profile);
    assert.deepEqual(stats, { added: 2, practice: 0, save: 0, submit: 0 });
  }
});

test(`${host} existing duty names determine record mapping before blank entries`, async t => {
  const { api, document } = setup(t, ['班长', '']), profile = data(preset.library.profiles[0]);
  const rows = api.plan(profile).rows;
  assert.equal(rows.find(row => row.key === 'field_description').value, profile.modules[0].entries[1].field_description);
  document.querySelector('textarea').value = '用户已有描述';
  assert.equal((await api.fill([rows.find(row => row.key === 'field_description')]))[0].ok, false);
  assert.equal(document.querySelector('textarea').value, '用户已有描述');
});

test(`${host} unknown or ambiguous duty names block addition and writing`, async t => {
  for (const duplicate of [false, true]) {
    const { api, stats } = setup(t, [duplicate ? '班长' : '未登记的职务']), profile = structuredClone(data(preset.library.profiles[0]));
    if (duplicate) profile.modules[0].entries[0].field_role = '班长';
    await api.prepare(profile);
    assert.equal(stats.added, 0);
    assert.ok(api.plan(profile).rows.filter(row => row.group === 'custom_campus').every(row => row.reason));
  }
});

test(`${host} duty mapping does not change other tenants or fill another campus module`, t => {
  const { api, dom } = setup(t), profile = data(preset.library.profiles[0]);
  const extra = structuredClone(profile.modules[0]); extra.id = 'custom_other'; profile.modules.push(extra);
  assert.ok(api.plan(profile).rows.every(row => row.reason));
  dom.reconfigure({ url: 'https://other.zhiye.com/form' });
  profile.modules.pop();
  const dutyRows = api.plan(profile).rows.filter(row => row.label === (host === 'seif1.zhiye.com' ? '职务名称' : '在校职务名称'));
  assert.ok(dutyRows.length > 0);
  assert.ok(dutyRows.every(row => row.group === 'custom_campus'));
});
}
