import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import preset from './fixtures/synthetic-profiles.mjs';
const engine = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const url = 'https://app-tc.mokahr.com/campus-recruitment/vipshophr/10039#/job/3785d45d-b6bc-49a6-822e-1c91d61b0d4e/apply';
const field = (label, html) => `<div class="apply-field-test"><div class="title-test">${label}</div>${html}</div>`;
const date = part => `<div class="sd-Dropdown-container-test"><div class="sd-Select-container-test"><span class="sd-Input-display-value-test"></span><input readonly placeholder="${part}"></div></div>`;
const period = () => field('起止时间', `<div class="range">${date('年')}${date('月')}<span class="end-dates">${date('年')}${date('月')}</span><label><input type="checkbox">至今</label></div>`);
const record = work => `<div class="record">${work ? field('公司名称', '<input class="identity">') : ''}${period()}${work ? field('工作职责', '<textarea class="description"></textarea>') + field('所在部门', '<input class="department">') + field('职位名称', '<input class="role">') : field('项目名称', '<input class="identity">') + field('职责', '<input class="role">') + field('项目描述', '<textarea class="description"></textarea>') + field('项目中职责', '<textarea class="responsibilities"></textarea>')}</div>`;
const section = (name, body) => `<div class="apply-block-test"><div class="blockTitle-test">${name}</div><div class="records">${body}</div><button type="button" class="add">添加</button></div>`;
function setup(t, { target = url, work = true, project = true } = {}) {
  const dom = new JSDOM((work ? section('工作经历', record(true)) : '') + (project ? section('项目经验', record(false).repeat(3)) : '') + '<button class="save">保存</button><button class="submit">提交</button>', { url: target, runScripts: 'outside-only' });
  const { document } = dom.window;
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(engine); t.after(() => dom.window.close());
  const stats = { work: 0, project: 0, save: 0, submit: 0 };
  function bind(root) {
    for (const input of root.querySelectorAll('.sd-Select-container-test input')) input.onclick = () => {
      const dropdown = input.closest('.sd-Dropdown-container-test');
      dropdown.querySelector('.sd-Select-menu-test')?.remove();
      const menu = document.createElement('div'); menu.className = 'sd-Select-menu-test';
      for (const value of input.placeholder === '年' ? ['2024', '2025', '2026'] : Array.from({ length: 12 }, (_, i) => String(i + 1))) {
        const item = document.createElement('div'); item.className = 'sd-Select-common-item-test'; item.textContent = value;
        item.onclick = () => { dropdown.querySelector('.sd-Input-display-value-test').textContent = value; menu.remove(); };
        menu.append(item);
      }
      dropdown.append(menu);
    };
    for (const checkbox of root.querySelectorAll('input[type="checkbox"]')) checkbox.onclick = () => { if (checkbox.checked) checkbox.closest('.range').querySelector('.end-dates')?.remove(); };
  }
  bind(document);
  for (const block of document.querySelectorAll('.apply-block-test')) block.querySelector('.add').onclick = () => {
    const work = block.querySelector('.blockTitle-test').textContent === '工作经历'; stats[work ? 'work' : 'project']++;
    block.querySelector('.records').insertAdjacentHTML('beforeend', record(work)); bind(block.querySelector('.records').lastElementChild);
  };
  for (const name of ['save', 'submit']) document.querySelector(`.${name}`).onclick = () => stats[name]++;
  return { dom, document, api: dom.window.ApplyAssistant, stats };
}

test('Vipshop fills each edition internships and all project bodies, including historical names', async t => {
  for (const edition of preset.library.profiles) {
    const { document, api, stats } = setup(t), data = edition.data;
    const projectSection = document.querySelectorAll('.apply-block-test')[1];
    const initial = data.project.slice(0, 3);
    for (const [index, node] of [...projectSection.querySelectorAll('.record')].entries()) {
      node.querySelector('.identity').value = initial[index].previousNames.split('\n')[0];
      node.querySelector('.description').value = '网页中保留的旧项目正文';
    }
    await api.prepare(data);
    assert.equal(stats.work, data.internship.length - 1);
    assert.equal(stats.project, data.project.length - 3);
    const rows = api.plan(data).rows;
    const results = await api.fill(rows.filter(row => !row.reason));
    assert.ok(results.every(row => row.ok), JSON.stringify(results.filter(row => !row.ok)));
    assert.ok([...projectSection.querySelectorAll('.description')].slice(0, 3).every(node => node.value === '网页中保留的旧项目正文'));
    assert.ok((await api.replace(api.plan(data).rows.filter(row => row.canReplace))).every(row => row.ok));
    const works = [...document.querySelector('.apply-block-test').querySelectorAll('.record')];
    assert.deepEqual(works.map(node => node.querySelector('.identity').value), data.internship.map(entry => entry.company));
    assert.deepEqual(works.map(node => node.querySelector('.role').value), data.internship.map(entry => entry.role));
    assert.deepEqual(works.map(node => node.querySelector('.description').value), data.internship.map(entry => entry.description));
    assert.ok(works[0].querySelector('input[type="checkbox"]').checked);
    for (const node of projectSection.querySelectorAll('.record')) {
      const name = node.querySelector('.identity').value;
      const entry = data.project.find(entry => entry.name === name || entry.previousNames.split('\n').includes(name));
      assert.ok(entry, name);
      assert.equal(node.querySelector('.description').value, entry.description);
      assert.equal(node.querySelector('.responsibilities').value, entry.responsibilities);
      assert.equal(node.querySelector('.role').value, entry.role);
    }
    const before = { ...stats }; await api.prepare(data); assert.deepEqual(stats, before);
    assert.equal(stats.save, 0); assert.equal(stats.submit, 0);
  }
});

test('Work-only Moka forms use internships across tenant routes', t => {
  const data = preset.library.profiles[0].data;
  const { api, dom } = setup(t, { project: false });
  assert.ok(api.plan(data).rows.some(row => row.group === 'internship' && row.value));
  dom.window.history.pushState({}, '', '/campus-recruitment/other-company/10039#/job/test/apply');
  assert.ok(api.plan(data).rows.some(row => row.group === 'internship' && row.value));
  const other = setup(t, { target: url.replace('10039#', '100390#'), project: false });
  assert.ok(other.api.plan(data).rows.some(row => row.group === 'internship' && row.value));
});

test('Vipshop never replaces an existing end date when selecting present', async t => {
  const { api, document } = setup(t, { project: false });
  const data = preset.library.profiles[0].data;
  document.querySelector('.end-dates .sd-Input-display-value-test').textContent = '2025';
  const row = api.plan(data).rows.find(row => row.part === 'present');
  assert.equal((await api.fill([row]))[0].ok, false);
  assert.equal(document.querySelector('input[type="checkbox"]').checked, false);
});

test('Vipshop unknown company names block internship additions and updates', async t => {
  const { api, document, stats } = setup(t, { project: false });
  document.querySelector('.identity').value = '网页另一个公司';
  const data = preset.library.profiles[0].data;
  await api.prepare(data);
  assert.equal(stats.work, 0);
  assert.ok(api.plan(data).rows.every(row => row.reason && !row.canReplace));
});
