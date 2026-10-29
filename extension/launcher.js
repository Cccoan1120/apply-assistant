(() => {
  if (window.top !== window || document.querySelector('apply-assistant-launcher')) return;
  const host = document.createElement('apply-assistant-launcher');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; position: fixed; inset: auto 20px 24px auto; z-index: 2147483647; color-scheme: light; }
    :host([hidden]) { display: none !important; }
    * { box-sizing: border-box; }
    .tools { display: flex; align-items: center; gap: 4px; padding: 4px; background: #fff; border-radius: 8px; box-shadow: 0 4px 20px #20252c30; }
    button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; border: 0; border-radius: 5px; font: 600 14px/1.4 "Segoe UI", "Microsoft YaHei", sans-serif; letter-spacing: 0; cursor: pointer; }
    .open { padding: 0 12px; color: #fff; background: #245bc4; }
    .open:hover { background: #174aab; }
    .close { width: 36px; color: #58616d; background: #fff; }
    .close:hover { background: #f4f6f8; }
    button:focus-visible { outline: 2px solid #245bc4; outline-offset: 3px; }
    button:disabled { cursor: wait; opacity: .6; }
    svg { width: 18px; height: 18px; flex-shrink: 0; }
    .error { margin: 0 0 8px; padding: 12px; width: 248px; max-width: calc(100vw - 32px); border: 1px solid #dce1e7; border-radius: 5px; background: #fff; color: #ae302d; font: 14px/1.6 "Segoe UI", "Microsoft YaHei", sans-serif; overflow-wrap: anywhere; }
    [hidden] { display: none !important; }
    @media (max-width: 600px) { :host { right: 12px; bottom: 12px; } }
  `;
  const tools = document.createElement('div'); tools.className = 'tools';
  const error = document.createElement('p'); error.className = 'error'; error.hidden = true; error.setAttribute('role', 'alert');
  const open = document.createElement('button'); open.type = 'button'; open.className = 'open'; open.title = '打开网申助手侧栏';
  open.append(lucide.createElement(lucide.PanelRightOpen));
  const label = document.createElement('span'); label.textContent = '网申助手'; open.append(label);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'close'; close.title = '本页隐藏'; close.setAttribute('aria-label', '本页隐藏网申助手'); close.append(lucide.createElement(lucide.X));
  tools.append(open, close); shadow.append(style, error, tools);
  let dismissed = false, timer;
  function update() {
    if (dismissed) return;
    const recruitmentHost = ['zhaopin.liby.com.cn', 'zhaopin.deppon.com', 'campus.boe.com', 'campushr.hikvision.com'].includes(location.hostname) || /(^|\.)(mokahr\.com|hotjob\.cn|italent\.cn|beisen\.com|zhiye\.com)$/.test(location.hostname);
    const recruitmentRoute = /(?:recruitment|candidate|resume|careers|\/jobs(?:\/|$)|\/apply(?:\/|$))|(^|\.)jobs\./i.test(location.hostname + location.pathname + location.hash);
    const resumeForm = document.querySelector('input:not([type=hidden]), textarea, select') && /简历|教育经历|教育背景|实习经历|求职意向/.test(document.body?.innerText || '');
    host.hidden = !(recruitmentHost || recruitmentRoute || resumeForm);
    if (!host.isConnected) document.documentElement.append(host);
  }
  open.addEventListener('click', async () => {
    error.hidden = true;
    open.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'apply-assistant:open-panel' });
      if (!result?.ok) throw new Error('open failed');
      open.dataset.state = 'opened';
    } catch {
      error.textContent = '侧栏打开失败，请刷新网页后重试，或点击浏览器工具栏中的网申助手图标。';
      error.hidden = false;
    } finally { open.disabled = false; }
  });
  close.addEventListener('click', () => { dismissed = true; host.remove(); observer.disconnect(); clearTimeout(timer); });
  const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(update, 200); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', update);
  window.addEventListener('popstate', update);
  update();
})();
