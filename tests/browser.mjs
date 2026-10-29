import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(path); res.setHeader('Content-Type', ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' })[extname(path)] || 'application/octet-stream'); res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless:true });
const errors = [];
try {
  const context = await browser.newContext({ permissions:['clipboard-read','clipboard-write'] });
  const target = await context.newPage(); await target.goto(`${base}/tests/fixtures/application.html`); await target.addScriptTag({ path:'extension/engine.js' });
  const synthetic = {version:1,basic:{name:'测试候选人',phone:'13800000000',email:'test@example.com',gender:'男',city:'北京',summary:'这是一段超过十个字的测试自我评价',website:'https://new.example'},education:[],internship:[{company:'测试公司 A',role:'测试实习生',start:'2026-01',end:'2026-03',description:'仅用于验证填写流程。'},{company:'测试公司 B',role:'测试岗位 B'}],project:[],modules:[{id:'custom_awards',label:'获奖情况',fields:[{id:'field_award',label:'奖项名称',type:'text'}],entries:[{field_award:'测试奖项'}]}]};
  let saved = {profile:synthetic};
  const panel = await context.newPage(); panel.on('pageerror', error => errors.push(error.message));
  await panel.exposeFunction('extensionBridge', async ({ kind, data }) => {
    if (kind === 'tabs') return [{ id:1, url:target.url(), title:'网申测试页面' }];
    if (kind === 'get') return structuredClone(saved);
    if (kind === 'set') { saved = {...saved,...structuredClone(data)}; return; }
    if (kind === 'script') {
      if (data.files) return [];
      const [method, args, expectedUrl] = data.args;
      const result = await target.evaluate(async ({ method,args,expectedUrl }) => { if (location.href !== expectedUrl) throw new Error('页面变化'); return await window.ApplyAssistant[method](...args); }, { method,args,expectedUrl });
      return [{ result }];
    }
  });
  await panel.addInitScript(() => { window.chrome = { tabs:{query:() => window.extensionBridge({kind:'tabs'})}, storage:{local:{get:() => window.extensionBridge({kind:'get'}),set:data => window.extensionBridge({kind:'set',data})}}, scripting:{executeScript:opts => window.extensionBridge({kind:'script',data:{files:opts.files,args:opts.args}})} }; });
  await panel.setViewportSize({width:390,height:900}); await panel.goto(`${base}/extension/panel.html`);
  await panel.locator('#fill-version option').first().waitFor({state:'attached'});
  await panel.click('#mode-manual');
  await panel.click('#scan');
  await panel.locator('#rows .field-row').first().waitFor(); await panel.waitForFunction(() => !document.querySelector('#fill-view').inert);
  assert.equal(await panel.locator('.field-row input[type=checkbox]:checked').count(),4);
  await panel.screenshot({path:'test-results/fill-mobile.png',fullPage:true});
  await panel.click('#apply'); await panel.getByRole('status').filter({hasText:'已填入 4 项'}).waitFor();
  assert.equal(await target.inputValue('#candidate'),'测试候选人'); assert.equal(await target.inputValue('#gender'),'male'); assert.equal(await target.inputValue('#name'),''); assert.equal(await target.inputValue('#website'),'https://existing.example'); assert.equal(await target.inputValue('#summary'),''); assert.equal(await target.evaluate(() => window.submitCount),0);
  await target.fill('#candidate','手动修改'); await panel.click('#undo'); await panel.getByRole('status').filter({hasText:'已撤销 3 项'}).waitFor(); assert.equal(await target.inputValue('#candidate'),'手动修改'); assert.equal(await target.inputValue('#email'),'');
  await panel.selectOption('#fill-group','internship'); await panel.click('#scan'); await panel.waitForFunction(() => !document.querySelector('#fill-view').inert); await panel.check('#select-all');
  assert.equal(await panel.locator('.field-row input[type=checkbox]:checked').count(),2);
  await panel.getByRole('checkbox',{name:'填入公司名称',exact:true}).first().check();
  await panel.getByRole('checkbox',{name:'填入工作内容',exact:true}).first().check();
  await panel.click('#apply'); await panel.getByRole('status').filter({hasText:'已填入 4 项'}).waitFor(); assert.equal(await target.inputValue('#company1'),'测试公司 A'); assert.equal(await target.inputValue('#company2'),''); assert.equal(await target.inputValue('#start1'),'2026-01'); assert.equal(await target.inputValue('#end1'),'');
  await target.evaluate(()=>{const label=document.createElement('label');label.textContent='奖项名称';const input=document.createElement('input');input.id='award';label.append(input);document.querySelector('form').append(label);});
  await panel.selectOption('#fill-group','custom_awards'); await panel.click('#scan'); await panel.waitForFunction(() => !document.querySelector('#fill-view').inert); assert.equal(await panel.locator('.field-row input[type=checkbox]:checked').count(),1); await panel.click('#apply'); await panel.getByRole('status').filter({hasText:'已填入 1 项'}).waitFor(); assert.equal(await target.inputValue('#award'),'测试奖项');
  saved.library.profiles.push({...structuredClone(saved.library.profiles[0]),id:'profile_second',name:'运营岗'}); saved.library.profiles[1].data.basic.name='第二版本'; saved.library.revision++;
  await panel.reload(); await panel.selectOption('#fill-version','profile_second'); await panel.getByRole('status').filter({hasText:'已切换至运营岗'}).waitFor(); assert.equal(await panel.locator('#rows .field-row').count(),0); assert.equal(saved.library.activeId,'profile_second');
  for (const width of [300,390]) { await panel.setViewportSize({width,height:900}); await panel.screenshot({path:`test-results/panel-${width}.png`,fullPage:true}); assert.ok(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  await target.reload(); await target.addScriptTag({ path:'extension/engine.js' });
  await panel.reload();
  await panel.locator('#fill-version option').first().waitFor({state:'attached'});
  assert.equal(await panel.locator('#mode-auto').getAttribute('aria-pressed'),'true');
  assert.equal(await panel.locator('#manual-selectors').isVisible(),false);
  await panel.click('#auto-fill');
  await panel.getByRole('status').filter({hasText:'已自动填入'}).waitFor();
  assert.equal(await target.inputValue('#candidate'),'第二版本');
  assert.equal(await target.inputValue('#company1'),'测试公司 A');
  assert.equal(await target.inputValue('#company2'),'测试公司 B');
  assert.equal(await target.inputValue('#name'),'');
  assert.equal(await target.evaluate(()=>window.submitCount),0);
  for (const width of [300,390,480]) { await panel.setViewportSize({width,height:900}); await panel.screenshot({path:`test-results/auto-panel-${width}.png`,fullPage:true}); assert.ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); assert.ok((await panel.locator('.auto-row .field-content').first().boundingBox()).width > 180); }
  await target.evaluate(() => {
    document.body.innerHTML = '<form><section><h2>实习经历</h2><div id="entries"><div><label>公司名称<input></label><label>职位名称<input></label></div></div><button type="button" id="add">添加</button></section><button type="submit">提交</button></form>';
    window.submitCount = 0; window.addCount = 0;
    document.querySelector('form').onsubmit = event => { event.preventDefault(); window.submitCount++; };
    document.querySelector('#add').onclick = () => { window.addCount++; document.querySelector('#entries').insertAdjacentHTML('beforeend','<div><label>公司名称<input></label><label>职位名称<input></label></div>'); };
  });
  await panel.click('#scan'); await panel.waitForFunction(() => !document.querySelector('#fill-view').inert);
  assert.equal(await target.evaluate(() => window.addCount),0);
  await panel.click('#auto-fill'); await panel.getByRole('status').filter({hasText:'已添加 1 条经历'}).waitFor();
  assert.deepEqual(await target.locator('#entries input').evaluateAll(inputs=>inputs.map(input=>input.value)),['测试公司 A','测试实习生','测试公司 B','测试岗位 B']);
  await panel.click('#auto-fill'); await panel.waitForFunction(() => !document.querySelector('#fill-view').inert);
  assert.equal(await target.evaluate(() => window.addCount),1);
  assert.equal(await target.evaluate(() => window.submitCount),0);
  await target.evaluate(() => {
    document.body.innerHTML = '<section><h2>基本信息</h2><div id="delayed-fields"></div></section>';
    setTimeout(() => { document.querySelector('#delayed-fields').innerHTML = '<label>姓名<input id="delayed-name"></label>'; }, 400);
  });
  await panel.click('#scan'); await panel.waitForFunction(() => !document.querySelector('#fill-view').inert);
  assert.equal(await panel.locator('.field-name').filter({hasText:'姓名'}).count(), 1);
  await panel.click('#auto-fill'); await panel.getByRole('status').filter({hasText:'已自动填入'}).waitFor();
  assert.equal(await target.inputValue('#delayed-name'),'第二版本');
  const mokaFixture = await readFile('tests/fixtures/moka-manbang-live.html','utf8');
  await target.evaluate(() => {
    document.body.innerHTML = '<section><h2>实习经历</h2><div><label>公司名称<input value="测试公司 A"></label><label>职位名称<input value="网页旧职位"></label><label>工作内容<textarea>网页旧职责，保留换行。\n第二行原文。</textarea></label></div></section>';
  });
  await panel.click('#scan'); await panel.waitForFunction(() => !document.querySelector('#fill-view').inert);
  await panel.locator('#replace-differences').waitFor();
  assert.match(await panel.locator('#replace-differences').textContent(),/更新 2 处差异/);
  assert.equal(await target.locator('textarea').inputValue(),'网页旧职责，保留换行。\n第二行原文。');
  assert.ok(await panel.getByText('网页原文',{exact:true}).count() === 2);
  for (const width of [300,390,480]) {
    await panel.setViewportSize({width,height:900});
    await panel.screenshot({path:`test-results/template-differences-${width}.png`,fullPage:true});
    assert.ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await panel.click('#replace-differences'); await panel.getByRole('status').filter({hasText:'更新 2 项'}).waitFor();
  assert.equal(await target.locator('textarea').inputValue(),'仅用于验证填写流程。');
  await panel.click('#undo'); await panel.getByRole('status').filter({hasText:'已撤销'}).waitFor();
  assert.equal(await target.locator('textarea').inputValue(),'网页旧职责，保留换行。\n第二行原文。');
  await context.route('https://app.mokahr.com/**', route => route.fulfill({contentType:'text/html; charset=utf-8',body:mokaFixture}));
  await target.goto('https://app.mokahr.com/campus_apply/manbang/94191#/candidateHome/resume');
  await target.addScriptTag({path:'extension/engine.js'});
  await panel.reload(); await panel.locator('#fill-version option').first().waitFor({state:'attached'});
  await panel.click('#auto-fill'); await panel.getByRole('status').filter({hasText:'已自动填入'}).waitFor();
  assert.equal(await panel.locator('.field-name').filter({hasText:/^请选择$/}).count(),0);
  assert.equal(await target.locator('input[placeholder="所在地"]').inputValue(),'北京');
  const internship = target.locator('[class*="apply-block-"]').filter({has:target.locator('[class*="blockTitle-"]',{hasText:'实习经历'})});
  assert.equal(await internship.locator('input[placeholder="公司名称"]').inputValue(),'测试公司 A');
  for (const width of [300,390,480]) { await panel.setViewportSize({width,height:900}); await panel.screenshot({path:`test-results/moka-panel-${width}.png`,fullPage:true}); assert.ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); }
  const previewPage = await context.newPage();
  await previewPage.goto(`${base}/extension/dashboard.html`);
  await previewPage.locator('[data-field="name"]').waitFor();
  assert.equal(await previewPage.locator('#preview-notice').isVisible(),true);
  assert.match(await previewPage.locator('#save-data').textContent(),/保存到网页/);
  for (const width of [390,1280]) {
    await previewPage.setViewportSize({width,height:900});
    assert.ok(await previewPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await previewPage.screenshot({path:`test-results/preview-notice-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]); await context.close();
  console.log('PASS side panel: legacy migration, preview, fill, native select/month, duplicates, existing values, undo, custom fields, version switching, responsive layouts, no submission.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
const userData = resolve('test-results/extension-profile');
const extension = resolve('extension');
const ext = await chromium.launchPersistentContext(userData, { headless:true, channel:'chromium', args:[`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
try {
  const worker = ext.serviceWorkers()[0] || await ext.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const page = await ext.newPage(); const failures=[]; page.on('pageerror',e=>failures.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`); await page.locator('[data-field="name"]').fill('扩展加载测试'); await page.click('#save-data'); await page.getByRole('status').filter({hasText:'版本已保存'}).waitFor(); await page.reload(); assert.equal(await page.inputValue('[data-field="name"]'),'扩展加载测试'); assert.deepEqual(failures,[]);
  console.log('PASS unpacked Manifest V3 extension load, service worker, CSP and real chrome.storage persistence.');
} finally { await ext.close(); await rm(userData,{recursive:true,force:true}); }
