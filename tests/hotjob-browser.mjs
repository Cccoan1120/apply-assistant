import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Public build 60993f75573087485a09, downloaded for reproducing its actual React controls.
const assets = Object.fromEntries(await Promise.all(['vendor.js', 'resumeOperation.js', 'vendor.css', 'resumeOperation.css'].map(async name => [name, await readFile(`test-results/hotjob-${name}`, 'utf8')])));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body><div id="test-root"></div></body></html>' })
    : route.abort());
  const page = await context.newPage();
  await page.goto('https://wecruit.hotjob.cn/SUtest/pb/resumeOperation.html');
  await page.addStyleTag({ content: assets['vendor.css'] });
  await page.addStyleTag({ content: assets['resumeOperation.css'] });
  await page.addScriptTag({ content: assets['vendor.js'] });
  // Register the site's modules without starting its application or requesting any APIs.
  await page.evaluate(() => {
    window.fixtureJsonp = window.webpackJsonp;
    window.webpackJsonp = (chunks, modules) => window.fixtureJsonp(chunks, modules, []);
  });
  await page.addScriptTag({ content: assets['resumeOperation.js'] });
  await page.evaluate(() => {
    window.fixtureJsonp([], { fixture: (module, exports, require) => {
      const React = require(0), ReactDOM = require(12), DatePicker = require(493).default, Select = require(47).default, moment = require(14);
      moment.locale('zh-cn');
      const h = React.createElement;
      window.fixtureValues = {};
      class Fixture extends React.Component {
        state = { schoolOptions: [], start: '', end: '', school: undefined, gender: undefined, description: '' };
        change = (key, value) => { window.fixtureValues[key] = value; this.setState({ [key]: value }); };
        field(label, element) { return h('div', { className: 'ant-form-item' }, h('div', { className: 'ant-form-item-label' }, h('label', null, label)), h('div', { className: 'ant-form-item-children' }, element)); }
        section(label, fields) { return h('div', { className: 'form-cell' }, h('div', { className: 'tit-wrap' }, h('div', { className: 'tit' }, h('p', null, label), h('span', null, '必填'))), h('div', { className: 'form-cell-right' }, h('div', { className: 'form-cell-inner' }, ...fields))); }
        render() {
          return h('div', null,
            this.section('基本信息', [this.field('性别', h(Select, { style: { width: 250 }, value: this.state.gender, showSearch: true, onChange: value => this.change('gender', value) }, h(Select.Option, { value: 'male' }, '男'), h(Select.Option, { value: 'female' }, '女')))]),
            this.section('教育经历', [this.field('学校名称', h(Select, { style: { width: 250 }, showSearch: true, filterOption: false, value: this.state.school, onSearch: text => this.setState({ schoolOptions: text === '测试大学' ? ['测试大学'] : [] }), onChange: value => this.change('school', value) }, ...this.state.schoolOptions.map(name => h(Select.Option, { key: name, value: name }, name))))]),
            this.section('项目经历', [this.field('项目名称', h('input', { defaultValue: '项目甲' })),
              this.field('项目描述', h('textarea', { defaultValue: '', onBlur: event => this.change('description', event.target.value) })),
              this.field('开始时间', h(DatePicker, { value: this.state.start ? moment(this.state.start, 'YYYY-MM-DD') : null, showToday: false, onChange: (_, text) => this.change('start', text) })),
              this.field('结束时间', h(React.Fragment, null, h(DatePicker, { open: this.state.endOpen, value: null, showToday: false, onOpenChange: endOpen => this.setState({ endOpen }), renderExtraFooter: () => h('div', { onClick: () => { this.change('end', '至今'); this.setState({ endOpen: false }); } }, '至今') }), this.state.end === '至今' ? h('div', { style: { position: 'absolute' } }, '至今') : null))]));
        }
      }
      ReactDOM.render(h(Fixture), document.getElementById('test-root'));
    } }, ['fixture']);
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const result = await page.evaluate(async () => {
    const profile = { basic: { gender: '男' }, education: [{ school: '测试大学' }], internship: [], project: [{ name: '项目甲', start: '2025-03-12', end: '至今', description: '完整的项目描述。'.repeat(30) }], modules: [] };
    const rows = window.ApplyAssistant.plan(profile).rows;
    const filled = await window.ApplyAssistant.fill(rows.filter(row => !row.reason));
    return { rows: rows.map(({ label, reason, choice }) => ({ label, reason, choice })), filled, values: window.fixtureValues };
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.filled.some(item => !item.ok)) console.log(await page.locator('.ant-calendar-picker-container').evaluateAll(nodes => nodes.map(node => node.outerHTML.slice(0,7000))));
  assert.equal(result.values.description, '完整的项目描述。'.repeat(30));
  assert.equal(result.values.start, '2025-03-12');
  assert.equal(result.values.end, '至今');
  assert.equal(result.values.gender, 'male');
  assert.equal(result.values.school, '测试大学');
  assert.ok(result.filled.every(item => item.ok));
  await page.screenshot({ path: 'test-results/hotjob-real-controls.png', fullPage: true });
  console.log('Hotjob public React/Ant controls: actual callback values verified; all external requests blocked.');
} finally { await browser.close(); }
