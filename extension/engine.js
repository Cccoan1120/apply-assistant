(() => {
  if (globalThis.ApplyAssistant?.version === '0.6.24') return;
  const normalize = value => String(value || "").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  const aliases = {
    basic: {
      name: ["姓名", "中文姓名", "真实姓名", "候选人姓名", "name", "fullname", "candidatename"],
      phone: ["手机", "手机号", "手机号码", "联系电话", "电话号码", "phone", "mobile", "tel"],
      email: ["邮箱", "电子邮箱", "联系邮箱", "电子邮件", "email", "emailaddress"],
      highestDegree: ["最高学历", "最高教育程度"],
      gender: ["性别", "gender", "sex"], birthMonth: ["出生年月", "出生月份"],
      birthDate: ['出生日期', '出生日期（年龄）', '生日', 'dateofbirth'],
      identityType: ['证件类型', '证件类别'], identityNumber: ['身份证号', '身份证号码', '居民身份证号码', '证件号码', '证件号'],
      nationality: ['国籍', '国籍地区', '国家地区'], ethnicity: ['民族'], politicalStatus: ['政治面貌'],
      height: ['身高', '身高(cm)', '身高（厘米）', '身高（公分）'], weight: ['体重', '体重(kg)', '体重（公斤）', '体重（千克）'],
      nativePlace: ['籍贯'], hukou: ['户籍', '户籍所在地', '户口所在地'], address: ['通讯地址', '联系地址', '现居地址', '详细地址'], postalCode: ['邮编', '邮政编码'],
      hukouAddress: ['户籍地址', '户籍详细地址', '户口详细地址'],
      residentialAddress: ['现居住地址', '现居住地址(请详细到省市区/县)', '现居住地址（请详细到省市区/县）'],
      mailingAddress: ['邮寄地址', '邮寄地址(请详细到省市区/县)', '邮寄地址（请详细到省市区/县）'],
      cet4Score: ['CET4成绩', 'CET-4成绩', '英语四级成绩', '大学英语四级成绩', '四级成绩'],
      cet6Score: ['CET6成绩', 'CET-6成绩', '英语六级成绩', '大学英语六级成绩', '六级成绩'],
      city: ["现居城市", "现居住城市", "当前城市", "目前居住地", "现居住地", "现居地", "所在地", "city"],
      website: ["个人主页", "个人网站", "作品集链接", "个人链接", "website", "portfolio"],
      skills: ["技能与证书", "技能特长", "专业技能", "技能描述", "skills"],
      summary: ["自我评价", "自我介绍", "个人评价", "个人优势", "自我描述", "selfintroduction", "summary"]
    },
    education: { school: ["学校", "学校名称", "毕业院校", "院校", "院校名称", "school", "university"], major: ["专业", "专业名称", "所学专业", "major"], degree: ["学历", "教育程度", "学历层次", "degree", "educationlevel"], start: ["开始时间", "开始日期", "入学时间", "入学日期", "startdate", "starttime"], end: ["结束时间", "结束日期", "毕业时间", "毕业日期", "enddate", "endtime"], description: ["在校经历", "在校描述", "在校表现", "教育经历描述", "description"] },
    internship: { company: ["公司名称", "公司", "企业名称", "实习单位", "工作单位", "组织名称", "company", "companyname", "employer"], role: ["职位名称", "职位", "岗位", "岗位名称", "担任职务", "实习职位", "职务", "jobtitle", "position", "title"], department: ["部门", "所在部门", "部门名称", "department"], start: ["开始时间", "开始日期", "入职时间", "入职日期", "startdate", "starttime"], end: ["结束时间", "结束日期", "离职时间", "离职日期", "enddate", "endtime"], description: ["工作内容", "工作描述", "实习内容", "实习描述", "工作职责", "职责描述", "工作业绩", "实习经历描述", "description", "responsibilities"] },
    project: { name: ["项目名称", "项目名", "projectname", "projecttitle"], role: ["项目角色", "担任角色", "项目职责", "项目职务", "项目中担任角色", "role"], start: ["开始时间", "开始日期", "项目开始时间", "startdate", "starttime"], end: ["结束时间", "结束日期", "项目结束时间", "enddate", "endtime"], description: ["项目描述", "项目介绍", "项目内容", "项目经历描述", "项目成果", "description"], url: ["项目链接", "项目网址", "作品链接", "projecturl"] }
  };
  Object.assign(aliases.education, {
    rank: ['成绩排名', '专业排名', '排名'], studyType: ['学历类型', '教育类型', '学习形式'],
    academicDegree: ['学位'], trainingMode: ['培养方式'], combinedDegree: ['是否直博或硕博连读'],
    classRank: ['班级成绩排名', '班级排名'],
    graduationStatus: ['毕业状态', '是否毕业'],
    gpa: ['GPA', '绩点', '平均绩点'], college: ['学院', '院系', '所在院系']
  });
  aliases.education.college.push('学院名称');
  aliases.internship.company.push('单位名称');
  aliases.project.role.push('职务', '职责');
  Object.assign(aliases.basic, { maritalStatus: ['婚否', '婚姻状况'], overseasStudy: ['海外留学经历', '是否有海外留学经历'], yearsExperience: ['工作年限'] });
  Object.assign(aliases.internship, { roleLevel: ['职位级别'], salary: ['月薪（税前）', '税前月薪'], companySize: ['企业规模'], leaveReason: ['离职原因'] });
  Object.assign(aliases.internship, { location: ['工作地点', '实习地点', '工作城市', '实习城市'], industry: ['所属行业', '行业'], occupation: ['职业类别'], employmentType: ['工作性质', '实习性质'] });
  aliases.internship.description = aliases.internship.description.filter(label => label !== '工作业绩');
  aliases.internship.results = ['工作业绩', '实习业绩'];
  aliases.internship.start.push('工作开始时间');
  aliases.internship.end.push('工作结束时间');
  aliases.project.role = aliases.project.role.filter(label => label !== '项目职责');
  aliases.project.description = aliases.project.description.filter(label => label !== '项目成果');
  aliases.project.responsibilities = ['项目中职责', '项目职责', '项目责任'];
  aliases.project.results = ['项目成果', '项目业绩'];
  const formItem = '[class*="form-item"], [class*="FormItem"], [class*="formItem"], [class*="field-item"], [class*="FieldItem"], .form-group';
  const state = { fields: new Map(), undo: [], stopped: false };
  const controlSelector = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';
  let isMoka, isHotjob, isFeishu, isBeisen;
  function detectPlatforms() {
    isMoka = /(^|\.)mokahr\.com$/.test(location.hostname) || !!document.querySelector('[class*="apply-block-"] [class*="apply-field-"]');
    isHotjob = /(^|\.)hotjob\.cn$/.test(location.hostname) || (!!document.querySelector('.form-cell > .tit-wrap > .tit') && !!document.querySelector('.form-cell .ant-form-item'));
    isFeishu = /(^|\.)(feishu\.cn|larkoffice\.com|larksuite\.com)$/.test(location.hostname) || !!document.querySelector('.applyFormModuleWrapper-windows, [data-form-field-i18n-name], .atsx-form-item');
    isBeisen = ['zhaopin.liby.com.cn', 'zhaopin.deppon.com', 'campus.boe.com'].includes(location.hostname) || /(^|\.)(hotjob\.cn|italent\.cn|beisen\.com|zhiye\.com)$/.test(location.hostname) || !!document.querySelector('.ux-standard-form .form[id], .form-item .phoenix-select');
  }
  detectPlatforms();
  function workUsesInternships(modules = []) {
    if (modules.some(module => ['工作经历', '工作经验', '工作履历'].includes(module.label))) return false;
    return !state.hasInternshipSection;
  }
  function detectInternshipSection() {
    // A separate internship section owns these records, including a collapsed section.
    return [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,[role="heading"],div,span,p')].some(node =>
      !node.matches(controlSelector) && !node.querySelector(controlSelector) &&
      ['实习经历', '实习经验'].includes(normalize(caption(node)).replace(/\d+$/, '')));
  }
  const mokaFieldSelector = '[class*="apply-field-"], [class^="field-"]';
  const mokaSelectSelector = '[class*="sd-Select-container-"]';
  function caption(node) {
    const copy = node.cloneNode(true);
    for (const child of copy.querySelectorAll(`${controlSelector},button,[role="button"],[class*="sd-Icon-"],[class*="sd-Input-display-value-"],[class*="sd-Input-addon-"]`)) child.remove();
    return copy.textContent.trim();
  }
  const cleanLabel = value => normalize(String(value).replace(/[（(](?:例(?:如)?\s*[:：]?|如\s*[:：]|e\.g\.).*?[）)]/gi, '')).replace(/^(请输入|请填写|请选择|pleaseenter|enter)/, '').replace(/(必填|required|选填|optional)$/, '');
  function widget(el) {
    if (el.tagName === 'SELECT') return null;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (node !== el && isMoka && node.matches(mokaFieldSelector)) break;
      if (node.matches('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="tree"], [aria-autocomplete]') || /(?:^|[\s_-])(select|cascader|autocomplete|picker|datepicker)(?:[\s_-]|$)/i.test(node.className || '')) return node;
      if (node !== el && node.matches(formItem)) break;
    }
    return null;
  }
  function visible(el) {
    if (el.disabled || el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return el.getClientRects().length > 0;
  }
  function rawLabels(el) {
    if (isHotjob) {
      const field = el.closest('.ant-form-item');
      const labels = [...(field?.querySelectorAll('.ant-form-item-label > label') || [])].filter(node => node.closest('.ant-form-item') === field);
      if (labels.length === 1) return [caption(labels[0])];
    }
    if (isFeishu) {
      const label = el.closest('[data-form-field-i18n-name]')?.getAttribute('data-form-field-i18n-name');
      if (label) return [label];
      const field = el.closest('.atsx-form-item');
      const ownLabels = [...(field?.querySelectorAll('.atsx-form-item-label > label') || [])].filter(node => node.closest('.atsx-form-item') === field);
      if (ownLabels.length === 1) return [caption(ownLabels[0])];
    }
    if (isBeisen) {
      const label = el.closest('.form-item')?.querySelector('.form-item__text')?.textContent;
      if (label) return [label];
    }
    if (isMoka) {
      const field = el.closest(mokaFieldSelector);
      const title = field && [...field.children].find(node => node.matches('[class^="title-"], [class^="filed-title-"]'));
      if (title && caption(title)) {
        const text = caption(title);
        if (['证件号码', '证件号'].includes(cleanLabel(text))) {
          const inputs = [...field.querySelectorAll('input')].filter(input => ['text', 'search', 'number', 'tel'].includes(input.type));
          // Moka groups the type selector and number input under one caption.
          if (inputs.length === 2 && inputs[0].closest(mokaSelectSelector) && !inputs[1].closest(mokaSelectSelector)) {
            if (el === inputs[0]) return ['证件类型'];
            if (el === inputs[1]) return ['证件号码'];
          }
        }
        return [text];
      }
    }
    const labelText = label => {
      const copy = label.cloneNode(true);
      for (const control of copy.querySelectorAll('input,textarea,select,button,[role="combobox"],[contenteditable],[class*="sd-Icon-"],[class*="sd-Input-addon-"]')) control.remove();
      return copy.textContent;
    };
    const result = Array.from(el.labels || []).map(labelText);
    result.push(el.getAttribute("aria-label"));
    for (const id of (el.getAttribute("aria-labelledby") || "").split(/\s+/)) result.push(el.getRootNode().getElementById?.(id)?.textContent);
    const explicit = [...new Set(result.map(text => text?.trim()).filter(Boolean))];
    if (explicit.length) return explicit;
    // Only take labels from the field's own branch, never the first label in a whole form.
    for (let branch = el; branch?.parentElement && branch.parentElement !== document.body; branch = branch.parentElement) {
      const parent = branch.parentElement;
      const neighbours = [...parent.children].filter(node => node !== branch && !node.matches(controlSelector) && !node.querySelector(controlSelector));
      const local = widget(parent) ? [] : neighbours.filter(node => node.matches('label, [class*="label"], [class*="Label"]') || (node === branch.previousElementSibling && node.textContent.trim().length <= 40));
      const localText = local.map(labelText).filter(text => normalize(text));
      if (localText.length) { result.push(...localText); break; }
      if (controls(parent).filter(node => visible(node) && node !== el && !node.contains(el) && !el.contains(node)).length > 0) break;
    }
    const readable = [...new Set(result.map(s => s?.trim()).filter(Boolean))];
    if (readable.length) return readable;
    const field = el.closest(formItem);
    if (field) {
      const captions = [...field.querySelectorAll('label,[class*="form-item-label"]')].filter(node => node.closest(formItem) === field);
      const range = captions.map(labelText).find(text => ['起止时间', '就读时间', '在校时间', '项目时间', '实习时间'].includes(cleanLabel(text)));
      if (range) return [range];
    }
    const placeholder = el.getAttribute("placeholder")?.trim();
    if (placeholder) return [placeholder];
    return [el.getAttribute("name"), el.id].filter(Boolean);
  }
  function mokaPresent(el) {
    if (!isMoka || !el.matches('input[type="checkbox"]') || normalize(el.closest('label')?.textContent) !== '至今') return null;
    const field = el.closest(mokaFieldSelector);
    if (!field || field.querySelectorAll('input[type="checkbox"]').length !== 1 || !rawLabels(el).some(text => ['起止时间', '实习时间', '项目时间', '在校时间', '就读时间'].includes(cleanLabel(text)))) return null;
    const inputs = [...field.querySelectorAll('input')].filter(node => !['checkbox', 'hidden'].includes(node.type));
    return [2, 4].includes(inputs.length) && inputs.every((node, index) => node.placeholder === (index % 2 ? '月' : '年')) ? field : null;
  }
  function splitDate(el) {
    if (!isMoka) return null;
    const field = el.closest(mokaFieldSelector);
    if (!field) return null;
    const texts = rawLabels(el).map(cleanLabel);
    const range = texts.some(text => ['起止时间', '就读时间', '在校时间', '项目时间', '实习时间'].includes(text));
    const endpoint = texts.some(text => ['开始时间', '开始日期', '入学时间', '入学日期'].includes(text)) ? 'start' : texts.some(text => ['结束时间', '结束日期', '毕业时间', '毕业日期'].includes(text)) ? 'end' : texts.some(text => ['获奖时间', '获奖日期', '获奖年月'].includes(text)) ? 'award' : '';
    if (!range && !endpoint) return null;
    const inputs = [...field.querySelectorAll('input')].filter(input => !['checkbox', 'radio', 'hidden'].includes(input.type));
    const current = !!field.querySelector('input[type="checkbox"]:checked');
    if (!(range ? inputs.length === 4 || (inputs.length === 2 && current) : inputs.length === 2) || !inputs.every((input, index) => input.placeholder === (index % 2 ? '月' : '年') || (!input.placeholder && (index % 2 ? /^(0?[1-9]|1[0-2])月?$/ : /^\d{4}年?$/).test(valueOf(input))))) return null;
    const index = inputs.indexOf(el);
    return index < 0 ? null : { key: endpoint || (index < 2 ? 'start' : 'end'), part: index % 2 ? 'month' : 'year', peer: inputs[index % 2 ? index - 1 : index + 1] };
  }
  function dateValue(el, value) {
    const date = splitDate(el);
    if (!date) return { value };
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return { value: date.part === 'year' ? value.slice(0, 4) : String(Number(value.slice(5))) };
    if (date.part === 'year' ? /^\d{4}$/.test(value) : /^(0?[1-9]|1[0-2])$/.test(value)) return { value };
    return { reason: '资料需要有效的年月格式' };
  }
  function labels(el) {
    if (mokaPresent(el)) return ['结束时间'];
    const date = splitDate(el);
    if (date) return [{ start: '开始时间', end: '结束时间', award: '获奖时间' }[date.key]];
    const texts = rawLabels(el);
    if (!texts.some(text => ['起止时间', '就读时间', '在校时间', '项目时间', '实习时间'].includes(cleanLabel(text)))) return texts;
    // A shared range caption only determines endpoints when its local pair is unambiguous.
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const inputs = controls(node).filter(input => visible(input) && !['checkbox', 'radio', 'hidden'].includes(input.type));
      if (inputs.length > 2) break;
      if (inputs.length === 2 && inputs.every(input => rawLabels(input).some(text => texts.includes(text)))) {
        return [inputs.indexOf(el) === 0 ? '开始时间' : '结束时间'];
      }
    }
    return texts;
  }
  function classify(texts, group, customFields = null) {
    const candidates = new Set();
    for (const text of texts) {
      const key = cleanLabel(text);
      const definitions = customFields ? Object.fromEntries(Object.entries(customFields).map(([id,label]) => [id, Array.isArray(label) ? label : [label]])) : aliases[group] || {};
      for (const [field, names] of Object.entries(definitions)) if (names.some(name => normalize(name) === key)) candidates.add(field);
    }
    return candidates.size === 1 ? [...candidates][0] : "";
  }
  function controls(root = document) {
    const list = [...root.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="combobox"]')];
    if (isFeishu) list.push(...root.querySelectorAll('.atsx-date-picker-period-month-label'));
    if (isBeisen) list.push(...[...root.querySelectorAll('.phoenix-radio-group')].filter(phoenixRadio));
    for (const el of root.querySelectorAll("*")) if (el.shadowRoot) list.push(...controls(el.shadowRoot));
    return [...new Set(list)].filter(el => {
      if (hotjobSelect(el)) return el === hotjobSelect(el);
      if (isFeishu && el.matches('.atsx-date-picker-period-hidden-input')) return false;
      if (el.matches('[role="combobox"]')) return ![...el.querySelectorAll('input,select')].some(visible);
      return true;
    });
  }
  function valueOf(el) {
    if (mokaPresent(el)) return el.checked ? '至今' : '';
    const hotjob = hotjobSelect(el);
    if (hotjob) return hotjob.querySelector('.ant-select-selection-selected-value')?.textContent.trim() || '';
    if (hotjobDate(el)) {
      const content = el.closest('.ant-form-item-children');
      const present = content && [...content.children].filter(node => node.tagName === 'DIV' && node.textContent.trim() === '至今' && visible(node));
      return present?.length === 1 ? '至今' : el.value || '';
    }
    if (isFeishu && el.matches('.atsx-date-picker-period-month-label')) {
      const prefix = '.atsx-date-picker-period-month-label-';
      const present = el.querySelector(prefix + 'toToday');
      if (present) return present.textContent.trim();
      const year = el.querySelector(prefix + 'year')?.textContent.trim() || '';
      const month = el.querySelector(prefix + 'month')?.textContent.trim() || '';
      return year === 'YYYY' && month === 'MM' ? '' : `${year === 'YYYY' ? '' : year}-${month === 'MM' ? '' : month}`;
    }
    if (phoenixRadio(el)) return [...el.querySelectorAll('.phoenix-radio--checked')].map(node => node.querySelector('.phoenix-radio__radio-text')?.textContent.trim() || '').join(' / ');
    const site = siteControl(el);
    if (['ud-search', 'atsx-search'].includes(site?.kind)) return el.value || '';
    if (site?.kind === 'ud-select') return site.node.querySelector('.ud__select__selector__selectItem')?.textContent.trim() || '';
    if (site?.kind === 'phoenix') return site.node.querySelector('.phoenix-select__tipEle')?.textContent.trim() || el.value || '';
    const moka = isMoka && el.closest(mokaSelectSelector);
    if (moka) return moka.querySelector('[class*="sd-Input-display-value-"]')?.textContent.trim() || '';
    const choice = choiceControl(el);
    if (choice) {
      const container = el.closest('[class*="select-selector"], [class*="select-selection"], .atsx-select, .ant-select') || choice;
      const selected = container.querySelector('[aria-selected="true"], .ant-select-selection-item, .atsx-select-selection-item, .atsx-select-selection-selected-value');
      if (selected) return selected.textContent.trim();
      const selectedOption = (choice.getAttribute('aria-controls') || el.getAttribute('aria-controls') || '').split(/\s+/).flatMap(id => [...(el.getRootNode().getElementById?.(id)?.querySelectorAll('[role="option"][aria-selected="true"]') || [])]);
      if (selectedOption.length) return selectedOption.map(option => option.textContent.trim()).join('、');
      if (el.tagName !== 'INPUT') {
        const text = el.textContent.trim();
        return /^(请选择|选择|select|please select)$/i.test(text) ? '' : text;
      }
    }
    return el.isContentEditable ? el.textContent : (el.value ?? el.textContent ?? "");
  }
  function choiceControl(el) {
    if (mokaPresent(el)) return el;
    if (hotjobSelect(el)) return hotjobSelect(el);
    if (hotjobDate(el)) return hotjobDate(el);
    if (phoenixRadio(el)) return el;
    if (mokaLocation(el)) return mokaLocation(el);
    if (siteControl(el)) return siteControl(el).node;
    if (isMoka && el.closest(mokaSelectSelector)) return el.closest(mokaSelectSelector);
    const node = el.closest('[role="combobox"], [aria-haspopup="listbox"]');
    if (!node) return null;
    return (node.getAttribute('aria-controls') || el.getAttribute('aria-controls')) ? node : null;
  }
  function optionNames(value, el) {
    if (['工作地点', '实习地点', '工作城市', '实习城市'].includes(cleanLabel(rawLabels(el)[0])) && /^(北京|天津|上海|重庆)市?$/.test(value)) return [value.replace(/市$/, ''), value.replace(/市$/, '') + '市'].map(normalize);
    if (isBeisen && classify(rawLabels(el), 'education') === 'studyType' && ['全日制', '统招全日制', '全国普通高等院校全日制'].includes(value)) return ['全日制', '统招全日制', '全国普通高等院校全日制'].map(normalize);
    if (classify(rawLabels(el), 'basic') === 'politicalStatus' && ['党员', '中共党员'].includes(value)) return ['党员', '中共党员'].map(normalize);
    if (splitDate(el)?.part === 'month' && /^(0?[1-9]|1[0-2])$/.test(value)) return [String(Number(value)), String(Number(value)).padStart(2, '0')].flatMap(month => [month, `${month}月`]).map(normalize);
    if (splitDate(el)?.part === 'year' && /^\d{4}$/.test(value)) return [value, `${value}年`].map(normalize);
    const synonyms = { 硕士: ['硕士', '硕士研究生'], 硕士研究生: ['硕士', '硕士研究生'], 本科: ['本科', '学士'], 男: ['男', '男性', 'male'], 女: ['女', '女性', 'female'] };
    return (synonyms[value] || [value]).map(normalize);
  }
  function hotjobDate(el) {
    return isHotjob && el.matches('input.ant-calendar-picker-input') && el.closest('.form-cell') && el.closest('.ant-calendar-picker');
  }
  async function chooseHotjobDate(el, value, record, url) {
    const present = value === '至今';
    if (present && !['education', 'internship', 'project'].some(group => classify(labels(el), group) === 'end')) return { reason: '至今只能用于明确的结束日期' };
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!present && (!parts || new Date(Date.UTC(+parts[1], +parts[2] - 1, +parts[3])).toISOString().slice(0, 10) !== value)) return { reason: '网站需要完整日期，请补充真实日期或确认按每月1日填报' };
    const popups = () => [...document.querySelectorAll('.ant-calendar-picker-container')].filter(visible);
    if (popups().length || [...document.querySelectorAll('.ant-select-dropdown')].some(visible)) return { reason: '请先收起已打开的选项或日历，再重新填写' };
    const peers = [...(el.closest('.form-cell-inner') || el.closest('.form-cell')).querySelectorAll('input.ant-calendar-picker-input')].filter(node => node !== el).map(node => ({ node, value: valueOf(node) }));
    const stable = () => !state.stopped && location.href === url && unchanged(record) && (!record.identity || unchanged(record.identity) && valueOf(record.identity.el) === record.identity.value) && peers.every(peer => peer.node.isConnected && valueOf(peer.node) === peer.value);
    const active = () => stable() && valueOf(el) === record.original;
    if (!active()) return { reason: '已停止或页面已变化' };
    el.click();
    for (let i = 0; i < 25 && active() && !popups().length; i++) await pauseControl();
    let opened = popups();
    if (!active() || opened.length !== 1) return { reason: '未找到唯一的日期弹层' };
    const popup = opened[0];
    const ready = () => active() && popups().length === 1 && popups()[0] === popup;
    const enabled = node => node && visible(node) && !node.closest('[aria-disabled="true"], .ant-calendar-disabled-cell, [class*="disabled"]');
    let target;
    if (present) {
      const options = [...popup.querySelectorAll('.ant-calendar-footer-extra > div')].filter(node => enabled(node) && node.textContent.trim() === '至今');
      if (options.length !== 1) return { reason: '该结束日期没有唯一可用的至今选项' };
      target = options[0];
    } else {
      const cells = () => [...popup.querySelectorAll('.ant-calendar-cell[title]')].filter(node => !node.matches('.ant-calendar-last-month-cell, .ant-calendar-next-month-btn-day') && visible(node));
      const dateOf = node => {
        const match = /^(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*$/.exec(node.title);
        if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        const english = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(node.title);
        const month = english && ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(english[1]);
        return english && month >= 0 ? `${english[3]}-${String(month + 1).padStart(2, '0')}-${english[2].padStart(2, '0')}` : '';
      };
      const monthOf = () => { const months = [...new Set(cells().map(node => dateOf(node).slice(0, 7)))]; return months.length === 1 ? months[0] : ''; };
      for (let moves = 0; ready() && moves < 130; moves++) {
        const month = monthOf();
        if (!month) return { reason: '无法确定日历显示的年月' };
        if (month === value.slice(0, 7)) break;
        const yearDelta = +parts[1] - Number(month.slice(0, 4));
        const selector = yearDelta ? `.ant-calendar-${yearDelta > 0 ? 'next' : 'prev'}-year-btn` : `.ant-calendar-${value.slice(0, 7) > month ? 'next' : 'prev'}-month-btn`;
        const commands = [...popup.querySelectorAll(selector)].filter(enabled);
        if (commands.length !== 1 || !ready()) return { reason: '没有唯一可用的日历翻页按钮' };
        commands[0].click();
        for (let wait = 0; wait < 15 && ready() && monthOf() === month; wait++) await pauseControl();
        if (!ready() || monthOf() === month) return { reason: '日历未接受翻页或页面已变化' };
      }
      const matches = cells().filter(node => dateOf(node) === value && enabled(node) && !node.querySelector('[aria-disabled="true"]'));
      if (matches.length !== 1) return { reason: '目标日期不可选或不唯一' };
      target = matches[0];
    }
    if (!ready() || !enabled(target)) return { reason: '已停止或页面已变化' };
    target.click();
    for (let i = 0; i < 25 && stable(); i++) {
      if (valueOf(el) === value && !popups().length) return { value };
      await pauseControl();
    }
    return { reason: '网页未确认日期，请核对' };
  }
  function hotjobSelect(el) {
    if (!isHotjob) return null;
    const root = el.closest('.ant-select');
    const selector = root?.matches('[role="combobox"]') ? root : root?.querySelector('.ant-select-selection[role="combobox"]');
    return selector && (selector === el || selector.contains(el)) ? selector : null;
  }
  async function chooseHotjobSelect(el, value, record, url) {
    const node = hotjobSelect(el);
    if (!node || !interactive(node) || node.matches('.ant-select-selection--multiple') || node.querySelector('.ant-select-selection--multiple') || node.closest('.cascader-plugins-wrap,.ant-cascader-picker') || !(node.matches('.ant-select-selection--single') || node.querySelector('.ant-select-selection--single'))) return { reason: '该复合或禁用选择框需手动核对' };
    const input = node.querySelector('input.ant-select-search__field');
    const originalQuery = record.hotjobQueryOriginal ?? input?.value ?? '';
    let query = originalQuery;
    const identityValid = () => !record.identity || unchanged(record.identity) && valueOf(record.identity.el) === record.identity.value;
    const valid = () => !state.stopped && location.href === url && unchanged(record) && identityValid() && valueOf(el) === record.original && (!input || input.isConnected && input.value === query);
    if (originalQuery.trim() || !valid()) return { reason: '已有搜索内容或页面已变化，保持原值' };
    const wasOpen = node.getAttribute('aria-expanded') === 'true';
    const associatedLists = () => {
      const ids = [...new Set([node, input].filter(Boolean).flatMap(control => ['aria-controls', 'aria-owns'].flatMap(attr => (control.getAttribute(attr) || '').split(/\s+/))).filter(Boolean))];
      return [...new Set(ids.flatMap(id => {
        const owner = node.getRootNode().getElementById?.(id);
        return owner ? owner.matches('[role="listbox"]') ? [owner] : [...owner.querySelectorAll('[role="listbox"]')] : [];
      }))].filter(interactive);
    };
    const restore = () => {
      if (input && query !== originalQuery && location.href === url && unchanged(record) && valueOf(el) === record.original && input.value === query) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, originalQuery);
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        query = originalQuery;
      }
      if (!wasOpen && location.href === url && unchanged(record) && valueOf(el) === record.original && (!input || input.value === query)) node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    };
    if (!wasOpen) { node.focus(); if (!valid()) return { reason: '已停止或页面已变化' }; node.click(); }
    const searchable = input && !input.readOnly && ['school', 'major'].includes(classify(rawLabels(el), 'education'));
    if (searchable) {
      if (!valid()) { restore(); return { reason: '已停止或页面已变化' }; }
      query = value;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, query);
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    let match, list;
    for (let attempt = 0; attempt < (searchable ? 40 : 15); attempt++) {
      if (!valid()) { restore(); return { reason: '已停止或页面已变化' }; }
      const lists = associatedLists();
      if (lists.length > 1) { restore(); return { reason: '下拉选项关联不唯一，请核对' }; }
      list = lists[0];
      if (list?.getAttribute('aria-multiselectable') === 'true') { restore(); return { reason: '多选控件需手动核对' }; }
      const matches = [...(list?.querySelectorAll('[role="option"]') || [])].filter(option => interactive(option) && optionNames(value, el).includes(normalize(option.textContent)));
      if (matches.length > 1) { restore(); return { reason: '下拉选项不唯一，请核对' }; }
      if (matches.length === 1) { match = matches[0]; break; }
      await pauseControl();
    }
    if (!match) { restore(); return { reason: '未找到唯一匹配的下拉选项' }; }
    if (!valid() || !interactive(match) || associatedLists().length !== 1 || !associatedLists()[0].contains(match)) { restore(); return { reason: '已停止或页面已变化' }; }
    match.click();
    for (let attempt = 0; attempt < 20; attempt++) {
      if (state.stopped || location.href !== url || !unchanged(record) || !identityValid()) break;
      if (optionNames(value, el).includes(normalize(valueOf(el))) && node.getAttribute('aria-expanded') === 'false' && !interactive(list)) return { value: valueOf(el), option: match };
      if (valueOf(el) && valueOf(el) !== record.original && !optionNames(value, el).includes(normalize(valueOf(el)))) break;
      await pauseControl();
    }
    restore();
    return { reason: '网页未确认选项，请核对' };
  }
  async function choose(el, value, record, url) {
    if (mokaPresent(el)) {
      const field = mokaPresent(el);
      const inputs = [...field.querySelectorAll('input')].filter(node => !['checkbox', 'hidden'].includes(node.type));
      const start = inputs.slice(0, 2).map(node => valueOf(node));
      if (value !== '至今' || inputs.length !== 4 || inputs.slice(2).some(node => valueOf(node).trim())) return { reason: '只为没有结束年月的经历勾选至今' };
      const stable = () => !state.stopped && location.href === url && unchanged(record) && (!record.identity || unchanged(record.identity) && valueOf(record.identity.el) === record.identity.value) && inputs.slice(0, 2).every((node, i) => node.isConnected && valueOf(node) === start[i]);
      if (!stable() || el.checked) return { reason: '页面已变化或已勾选，请重新识别' };
      el.click();
      for (let wait = 0; wait < 25 && stable(); wait++) {
        if (el.checked && inputs.slice(2).every(node => !node.isConnected || node.disabled || !visible(node))) return { value: '至今' };
        await pauseControl();
      }
      return { reason: '网页未确认至今，请核对' };
    }
    if (hotjobSelect(el)) return chooseHotjobSelect(el, value, record, url);
    if (hotjobDate(el)) return chooseHotjobDate(el, value, record, url);
    if (phoenixRadio(el)) return chooseRadio(el, value, record, url);
    if (mokaLocation(el)) return chooseLocation(el, value, record, url);
    if (siteControl(el)) return chooseSite(el, value, record, url);
    const date = dateValue(el, value);
    if (date.reason) return date;
    value = date.value;
    const trigger = choiceControl(el);
    if (!trigger) return { reason: '下拉框缺少可验证的选项关联' };
    const moka = isMoka && trigger.matches(mokaSelectSelector);
    const dropdown = moka && trigger.closest('[class*="sd-Dropdown-container-"]');
    const wasExpanded = trigger.getAttribute('aria-expanded') === 'true' || !!(dropdown && [...dropdown.querySelectorAll('[class*="sd-Select-menu-"]')].some(visible));
    if (!wasExpanded) {
      el.focus();
      if (state.stopped || location.href !== url || !unchanged(record) || valueOf(el) !== record.original) return { reason: '已停止或页面已变化' };
      el.click();
    }
    if (state.stopped || location.href !== url || !unchanged(record) || valueOf(el) !== record.original || (moka && el.value !== record.queryOriginal)) return { reason: '已停止或页面已变化' };
    const searchable = moka && !el.readOnly && ['school', 'major'].includes(classify(rawLabels(el), 'education'));
    const initialQuery = el.value;
    const query = searchable ? value : initialQuery;
    if (searchable) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    const active = () => !state.stopped && location.href === url && unchanged(record) && valueOf(el) === record.original && (!moka || el.value === query);
    const restoreQuery = () => {
      if (searchable && location.href === url && unchanged(record) && el.value === query && valueOf(el) === record.original) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, initialQuery);
        el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }
    };
    let matches = [];
    for (let attempt = 0; attempt < (searchable ? 60 : 15); attempt++) {
      if (!active()) { restoreQuery(); return { reason: '已停止或页面已变化' }; }
      const ids = (trigger.getAttribute('aria-controls') || el.getAttribute('aria-controls') || '').split(/\s+/);
      const lists = moka ? [...(dropdown?.querySelectorAll('[class*="sd-Select-menu-"]') || [])].filter(visible) : [...new Set(ids.flatMap(id => {
        const node = el.getRootNode().getElementById?.(id);
        return node ? node.matches('[role="listbox"]') ? [node] : [...node.querySelectorAll('[role="listbox"]')] : [];
      }))].filter(visible);
      const list = lists.length === 1 ? lists[0] : null;
      const options = list ? [...list.querySelectorAll(moka ? '[class*="sd-Select-common-item-"], [data-key="sugar.select.label"]' : '[role="option"]')].filter(option => !moka || !option.matches('[data-key="sugar.select.label"]') || !option.closest('[class*="sd-Select-common-item-"]')) : [];
      matches = options.filter(option => visible(option) && !option.closest('[aria-disabled="true"], [class*="disabled"], [class*="Disabled"]') && optionNames(value, el).includes(normalize(option.textContent)));
      if (matches.length) break;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    if (matches.length !== 1) {
      restoreQuery();
      if (!wasExpanded) {
        if (moka) { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); el.blur(); }
        else if (trigger.getAttribute('aria-expanded') === 'true') el.click();
      }
      return { reason: matches.length > 1 ? '下拉选项不唯一，需核对' : '未找到唯一匹配的下拉选项' };
    }
    if (!active() || !matches[0].isConnected || !visible(matches[0])) { restoreQuery(); return { reason: '已停止或页面已变化' }; }
    (moka ? matches[0].querySelector('[class*="sd-Menu-container-"]') || matches[0] : matches[0]).click();
    if (moka && el.isConnected) el.blur();
    await new Promise(resolve => setTimeout(resolve, 80));
    const accepted = location.href === url && el.isConnected && (optionNames(value, el).includes(normalize(valueOf(el))) || (!moka && matches[0].isConnected && matches[0].getAttribute('aria-selected') === 'true'));
    if (!accepted) restoreQuery();
    return accepted ? { value: valueOf(el), option: matches[0] } : { reason: '网页未确认选项，请核对' };
  }
  function mokaLocation(el) {
    return isMoka ? el.closest('[class*="location_info-"]')?.querySelector('[class*="sd-Dropdown-container-"]') || null : null;
  }
  async function chooseLocation(el, value, record, url) {
    const owner = mokaLocation(el);
    const menu = () => [...owner.querySelectorAll('[class*="menu-wrapper-"]')].filter(visible);
    let expected = record.original, remaining = normalize(value), parts = [], lastLevel = -1;
    const stable = () => !state.stopped && location.href === url && unchanged(record);
    const active = () => stable() && normalize(el.value) === normalize(expected);
    const levelOf = node => {
      const title = node.querySelector('[class*="sd-Tabs-active-"] [class*="sd-Ellipsis-"]')?.textContent.trim();
      return ['省份', '城市', '县区'].indexOf(title);
    };
    if (!active()) return { reason: '已停止或页面已变化' };
    if (!menu().length) { el.focus(); if (!active()) return { reason: '页面已变化' }; el.click(); }
    for (let step = 0; step < 3; step++) {
      let panel, level = -1;
      for (let wait = 0; wait < 30 && active(); wait++) {
        const menus = menu();
        if (menus.length === 1) { panel = menus[0]; level = levelOf(panel); if (level > lastLevel) break; }
        await pauseControl();
      }
      if (!active() || !panel || level <= lastLevel || level < 0) return { reason: '地区级联状态已变化，请核对' };
      let candidates = [...panel.querySelectorAll('[class*="sd-Tag-text-"]')].filter(interactive);
      if (level === 0 && panel.querySelector('[class*="alphabet-"]')) candidates = candidates.filter(node => node.closest('[class*="alphabet-"]'));
      const matches = candidates.flatMap(node => {
        const text = normalize(node.textContent), variants = level === 0 && !/[省市区]$/.test(text) ? [text + '省', text] : [text];
        const prefix = variants.find(label => remaining.startsWith(label));
        return prefix ? [{ node, prefix, text: node.textContent.trim() }] : [];
      });
      if (matches.length !== 1 || level === 2 && remaining !== matches[0]?.prefix) return { reason: '资料中的省市区没有唯一完整匹配，地区尚未确认' };
      const match = matches[0], previous = expected;
      remaining = remaining.slice(match.prefix.length); parts.push(match.text); expected = parts.join(' ');
      if (!stable() || normalize(el.value) !== normalize(previous) || !interactive(match.node)) return { reason: '地区已被修改，停止填写' };
      match.node.click();
      for (let wait = 0; wait < 25 && stable() && normalize(el.value) === normalize(previous); wait++) await pauseControl();
      if (!active()) return { reason: '网页未确认地区选择，请核对' };
      lastLevel = level;
      if (!remaining && level === 2) {
        const panels = menu();
        if (panels.length) {
          const confirm = panels.length === 1 ? [...panels[0].querySelectorAll('[class*="confirm-"] button')].filter(node => interactive(node) && node.textContent.trim() === '确认' && node.type === 'button') : [];
          if (confirm.length !== 1 || !active()) return { reason: '地区确认入口不唯一，请核对' };
          confirm[0].click();
        }
        for (let wait = 0; wait < 25 && active() && menu().length; wait++) await pauseControl();
        return active() && !menu().length ? { value: el.value } : { reason: '地区尚未确认，请核对' };
      }
      if (!remaining) return { reason: '资料缺少下一级地区，未自动确认' };
    }
    return { reason: '地区信息不完整，请核对' };
  }
  function siteControl(el) {
    if (isFeishu) {
      if (el.matches('.atsx-date-picker-period-month-label')) return { kind: 'atsx-period', node: el };
      const atsxDate = el.closest('.atsx-date-picker');
      if (atsxDate && el.matches('input[placeholder="YYYY"]')) return { kind: 'atsx-year', node: atsxDate };
      const school = classify(rawLabels(el), 'education') === 'school';
      const autocomplete = el.closest('.atsx-select');
      if (school && autocomplete && el.matches('input.atsx-select-search__field') && autocomplete.querySelector('[role="combobox"]')) return { kind: 'atsx-search', node: autocomplete };
      if (school && el.matches('input.ud__native-input') && el.closest('[data-form-field-i18n-name]')) return { kind: 'ud-search', node: el };
      const select = el.closest('.ud__select__selector');
      if (select) return { kind: 'ud-select', node: select };
      const date = el.closest('.throne-biz-date-range-picker-input,.ud__picker');
      if (date) return { kind: 'ud-date', node: date };
      const search = el.closest('.ud__select');
      if (search && ['school', 'major'].includes(classify(rawLabels(el), 'education'))) return { kind: 'ud-search', node: search };
    }
    const phoenix = isBeisen && el.closest('.phoenix-select');
    return phoenix ? { kind: 'phoenix', node: phoenix } : null;
  }
  const sitePopupSelector = '.ud__select__dropdown,.throne-biz-date-range-picker-panel,.ud__picker-date-panel,.common-unmodeled-layer,.atsx-date-picker-period-month-panel,.atsx-date-picker-panel,.atsx-select-dropdown';
  const pauseControl = () => new Promise(resolve => setTimeout(resolve, 80));
  function phoenixRadio(el) {
    return isBeisen && el.matches('.phoenix-radio-group') && (['gender', 'maritalStatus', 'overseasStudy'].includes(classify(rawLabels(el), 'basic')) || classify(rawLabels(el), 'education') === 'combinedDegree');
  }
  async function chooseRadio(el, value, record, url) {
    const active = () => !state.stopped && location.href === url && unchanged(record) && valueOf(el) === record.original && !valueOf(el).trim();
    const options = [...el.querySelectorAll('.phoenix-radio')].filter(node => interactive(node) && optionNames(value, el).includes(normalize(node.querySelector('.phoenix-radio__radio-text')?.textContent)));
    if (!active()) return { reason: '已填写或页面已变化，请重新识别' };
    if (options.length !== 1) return { reason: '单选没有唯一可选项，请核对' };
    options[0].click();
    for (let attempt = 0; attempt < 20; attempt++) {
      if (state.stopped || location.href !== url || !unchanged(record)) break;
      const selected = [...el.querySelectorAll('.phoenix-radio--checked')];
      if (selected.length === 1 && selected[0] === options[0] && optionNames(value, el).includes(normalize(valueOf(el)))) return { value: valueOf(el) };
      if (valueOf(el).trim()) break;
      await pauseControl();
    }
    return { reason: '网页未确认单选选项，请核对' };
  }
  function interactive(node) {
    return node?.isConnected && visible(node) && !node.closest('[aria-disabled="true"],[class*="disabled"],[class*="Disabled"],.ud__select__dropdown-hidden,.common-unmodeled-layer-hidden,.atsx-select-dropdown-hidden,.atsx-date-picker-dropdown-hidden') && getComputedStyle(node).pointerEvents !== 'none';
  }
  function sitePopups() {
    const popups = [...document.querySelectorAll(sitePopupSelector)].filter(interactive);
    // UD renders the range footer beside the inner date panel, inside this owner.
    return popups.filter(node => !node.matches('.ud__picker-date-panel') || !popups.some(owner => owner !== node && owner.matches('.throne-biz-date-range-picker-panel') && owner.contains(node)));
  }
  function setQuery(el, value) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }
  async function chooseSite(el, value, record, url) {
    const site = siteControl(el), initial = el.value;
    if (site.kind === 'atsx-period') return chooseAtsxPeriod(el, value, record, url);
    if (site.kind === 'phoenix' && value === '至今') return choosePhoenixPresent(el, record, url);
    const present = site.kind === 'ud-date' && value === '至今';
    const owner = present && el.closest('.throne-biz-date-range-picker-wrapper');
    const endpoints = owner ? [...owner.querySelectorAll('.throne-biz-date-range-picker-input input')] : [];
    if (present && (endpoints.length !== 2 || endpoints[1] !== el)) return { reason: '只有已识别的结束时间可选至今' };
    const peer = present && endpoints[0], peerBefore = peer && valueOf(peer);
    const stable = () => !state.stopped && location.href === url && unchanged(record) &&
      (!record.identity || unchanged(record.identity) && valueOf(record.identity.el) === record.identity.value) &&
      (!present || peer.isConnected && peer.closest('.throne-biz-date-range-picker-wrapper') === owner && valueOf(peer) === peerBefore &&
        [...owner.querySelectorAll('.throne-biz-date-range-picker-input input')].every((node, index) => node === endpoints[index]) && owner.querySelectorAll('.throne-biz-date-range-picker-input input').length === 2);
    const searchable = ['ud-search', 'atsx-search'].includes(site.kind);
    let query = initial, search = null, queryBefore = '', popup = null, committed = false;
    let acceptedNames = optionNames(value, el);
    const active = () => stable() &&
      (searchable ? el.value === query : valueOf(el) === record.original) &&
      (!search || search.isConnected && search.value === query);
    const popupActive = () => active() && popup?.isConnected && sitePopups().length === 1 && sitePopups()[0] === popup;
    const failure = reason => ({ reason });
    // These components have no ARIA owner ID. Only a newly opened, unique popup is eligible.
    if (!active() || sitePopups().length) return failure('请先收起已打开的选项或日历，再重新填写');
    try {
      el.focus();
      if (!active()) return failure('已停止或页面已变化');
      if (site.kind === 'ud-date') {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0, buttons: 1 }));
        if (!active()) return failure('已停止或页面已变化');
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true, button: 0 }));
        if (!active()) return failure('已停止或页面已变化');
      }
      el.click();
      if (searchable) {
        if (!active() || initial.trim() && initial !== value) return failure('已有搜索内容，保持原值');
        search = el; queryBefore = initial; query = value;
        setQuery(search, query);
      }
      for (let i = 0; i < 30 && active(); i++) {
        const opened = sitePopups();
        if (opened.length > 1) return failure('同时出现多个弹层，需核对');
        if (opened.length === 1) { popup = opened[0]; break; }
        await pauseControl();
      }
      if (!popupActive()) return failure('未找到当前字段的唯一选项弹层');
      if (site.kind === 'phoenix') {
        for (let wait = 0; wait < 30 && popupActive() && !popup.querySelector('.phoenix-date-picker,.constant-main-selector-container,.area-selector-container,.phoenix-selectList__listItem'); wait++) await pauseControl();
        if (!popupActive()) return failure('已停止或页面已变化');
      }
      if (popup.querySelector('.area-selector-container')) {
        const result = await choosePhoenixArea(el, value, record, popup, popupActive, stable);
        committed = !result.reason;
        return result;
      }
      if (site.kind === 'atsx-year') {
        const result = await chooseYear(el, value, popup, popupActive, () => !state.stopped && location.href === url && unchanged(record));
        committed = !result.reason;
        return result;
      }
      if (site.kind === 'ud-date' || popup.querySelector('.phoenix-date-picker')) {
        const result = await chooseCalendar(el, value, popup, popupActive, stable, record);
        committed = !result.reason;
        return result;
      }
      const constant = popup.querySelector('.constant-main-selector-container');
      if (constant && (constant.querySelector('.select-data-num-limit')?.textContent.trim() !== '1' || !constant.querySelector('.select-data-empty'))) return failure('选项不是空白单选，需手动核对');
      if (site.kind === 'atsx-search' && !popup.matches('.atsx-select-dropdown')) return failure('未找到学校候选列表');
      if (site.kind === 'atsx-search') {
        const ids = (site.node.querySelector('[role="combobox"]')?.getAttribute('aria-controls') || '').split(/\s+/).filter(Boolean);
        if (!ids.length || !ids.some(id => popup.id === id || [...popup.querySelectorAll('[id]')].some(node => node.id === id))) return failure('学校候选列表与字段不对应');
      }
      if (!search) search = popup.querySelector('input[placeholder="搜索"]');
      if (search && !searchable) {
        queryBefore = search.value;
        if (queryBefore.trim()) return failure('已有搜索内容，保持原值');
        query = value;
        setQuery(search, query);
      }
      const selectors = site.kind === 'atsx-search' ? '.atsx-select-dropdown-menu-item' : site.kind.startsWith('ud-') ? '.ud__select__list__item' : constant ? '.list-item-container' : '.phoenix-selectList__listItem';
      let matches = [];
      for (let i = 0; i < 50 && popupActive(); i++) {
        matches = [...popup.querySelectorAll(selectors)].filter(n => interactive(n) && optionNames(value, el).includes(normalize(n.querySelector('.ud__select__list__item__content,.item-text-label,.phoenix-selectList__singleLabel')?.textContent || n.textContent)));
        if (matches.length) break;
        await pauseControl();
      }
      if (!popupActive()) return failure('已停止或页面已变化');
      if (!matches.length && site.kind === 'phoenix' && record.combinedAwardLevel && ['省级', '市级'].includes(value) && !search && !constant) {
        if ([...popup.querySelectorAll(selectors)].some(n => visible(n) && optionNames(value, el).includes(normalize(n.querySelector('.phoenix-selectList__singleLabel')?.textContent || n.textContent)))) return failure('精确级别选项不可选，请核对');
        matches = [...popup.querySelectorAll(selectors)].filter(n => interactive(n) && normalize(n.querySelector('.phoenix-selectList__singleLabel')?.textContent || n.textContent) === '省市级');
        if (matches.length) acceptedNames = ['省市级'];
      }
      if (matches.length !== 1) return failure(matches.length ? '下拉选项不唯一，需核对' : '未找到唯一匹配的下拉选项');
      const selected = matches[0];
      if (!interactive(selected)) return failure('选项已变化，请重试');
      const optionTarget = constant ? selected.querySelector('.icon-container svg') || selected.querySelector('.icon-container') || selected : selected;
      if (!interactive(optionTarget)) return failure('选项不可点击，请核对');
      optionTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      if (constant) {
        let staged = false;
        for (let i = 0; i < 20 && popupActive(); i++) {
          const values = [...constant.querySelectorAll('.select-data-container .select-text-label')];
          staged = values.length === 1 && acceptedNames.includes(normalize(values[0].textContent));
          if (staged) break;
          await pauseControl();
        }
        const confirm = [...constant.querySelectorAll('.selector-footer-button .phoenix-button')].filter(n => n.textContent.trim() === '确定' && interactive(n));
        if (!popupActive() || !staged || confirm.length !== 1) return failure('选项未确认，已停止');
        // This confirms this field's staged option, never the application form.
        confirm[0].click();
      }
      for (let i = 0; i < 25; i++) {
        if (state.stopped || location.href !== url || !unchanged(record)) break;
        const accepted = acceptedNames.includes(normalize(valueOf(el)));
        const closed = !popup.isConnected || !interactive(popup);
        if (accepted && closed) { committed = true; return { value: valueOf(el) }; }
        await pauseControl();
      }
      return failure('网页未确认选项，请核对');
    } finally {
      if (!committed && location.href === url && unchanged(record)) {
        if (search?.isConnected && search.value === query && (searchable || valueOf(el) === record.original)) setQuery(search, queryBefore);
        if (popup?.isConnected && sitePopups().length === 1 && sitePopups()[0] === popup) {
          const cancel = [...popup.querySelectorAll('.selector-footer-button .phoenix-button')].filter(n => n.textContent.trim() === '取消' && interactive(n));
          const stagedValues = [...popup.querySelectorAll('.select-data-container .select-text-label')];
          if (cancel.length === 1 && (!stagedValues.length || stagedValues.length === 1 && acceptedNames.includes(normalize(stagedValues[0].textContent)))) cancel[0].click();
          else if (!cancel.length) { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); el.blur(); }
        }
      }
    }
  }
  async function choosePhoenixPresent(el, record, url) {
    const owner = el.closest('.fields-col');
    const checkboxes = owner ? [...owner.querySelectorAll('.phoenix-checkbox input[type="checkbox"]')].filter(input => input.closest('.phoenix-checkbox').querySelector('.phoenix-checkbox__text')?.textContent.trim() === '至今') : [];
    const dateInputs = owner ? [...owner.querySelectorAll('.phoenix-select input')] : [];
    const isEnd = ['education', 'internship', 'project'].some(group => classify(rawLabels(el), group) === 'end');
    if (!isEnd || checkboxes.length !== 1 || dateInputs.length !== 1 || dateInputs[0] !== el || sitePopups().length) return { reason: '未找到结束日期独立的至今选项' };
    const checkbox = checkboxes[0];
    const stable = () => !state.stopped && location.href === url && el.isConnected && owner.contains(el) && owner.contains(checkbox) &&
      record.ancestors.every((node, index) => ancestors(el)[index] === node) && labels(el).join('\n') === record.signature &&
      (!record.identity || unchanged(record.identity) && valueOf(record.identity.el) === record.identity.value);
    if (!stable() || !interactive(checkbox) || checkbox.checked || valueOf(el) !== record.original || record.original.trim()) return { reason: '日期已有内容或页面已变化' };
    checkbox.click();
    for (let wait = 0; wait < 25 && stable(); wait++) {
      if (checkbox.checked && (el.disabled || valueOf(el) === '至今' || !visible(el))) return { value: '至今' };
      await pauseControl();
    }
    return { reason: '网页未确认至今，请核对' };
  }
  function phoenixRegion(value, detailed = false) {
    const text = String(value || '').replace(/[\s/]/g, '');
    const municipality = /^(北京市|天津市|上海市|重庆市)(?:市辖区)?(.+?[区县])/.exec(text);
    const province = /^(.+?(?:省|自治区))(.+?(?:市|自治州|地区|盟))(.+?(?:区|县|市|旗))/.exec(text);
    const match = municipality || province;
    if (!match || !detailed && match[0] !== text) return null;
    const parts = match.slice(1);
    return { parts, leaf: parts.at(-1), value: parts.join('/') };
  }
  async function choosePhoenixArea(el, value, record, popup, active, settled) {
    const url = location.href;
    const area = popup.querySelector('.area-selector-container');
    const city = record.workLocation && /^(北京|天津|上海|重庆)市?$/.exec(value.trim());
    const region = phoenixRegion(value) || (city && { parts: [city[1] + '市'], leaf: city[1] + '市' });
    if (!region || !record.workLocation && !['nativePlace', 'hukou', 'city'].includes(classify(rawLabels(el), 'basic'))) return { reason: '地区资料需要完整省市区县，请在模板补充' };
    const selected = () => [...area.querySelectorAll('.select-data-container .select-area-text-label')].map(node => node.textContent.trim());
    const search = area.querySelector('.area-search-input input');
    const original = record.original.trim(), before = selected();
    if (area.querySelector('.select-data-num-limit')?.textContent.trim() !== '/1' || !search || search.value.trim() ||
      (original ? before.length !== 1 || before[0] !== original : before.length)) return { reason: '地区不是可确认的单选状态，请核对' };
    let committed = false;
    const valid = () => active() && search.isConnected && search.value === region.leaf;
    const expectedPath = region.parts.join('/');
    const pathMatches = node => {
      const leaf = node.querySelector('.area-text-label')?.textContent.trim();
      if (leaf !== region.leaf) return false;
      const parts = (node.querySelector('.area-item-path')?.textContent || '').split('/').map(text => text.trim()).filter(Boolean);
      while (['全国', '全部省市', '中国'].includes(parts[0])) parts.shift();
      if (/^(北京市|天津市|上海市|重庆市)$/.test(parts[0]) && [parts[0], '市辖区'].includes(parts[1])) parts.splice(1, 1);
      if (parts.at(-1) !== leaf) parts.push(leaf);
      return parts.join('/') === expectedPath;
    };
    const accepted = text => text === region.leaf || text.replace(/[\s/]/g, '') === region.parts.join('');
    try {
      if (!active()) return { reason: '页面已变化，请重新识别' };
      setQuery(search, region.leaf);
      let matches = [];
      for (let wait = 0; wait < 50 && valid(); wait++) {
        matches = [...area.querySelectorAll('.area-item-container')].filter(node => visible(node) && pathMatches(node));
        if (matches.length) break;
        await pauseControl();
      }
      const icons = matches.length === 1 ? [...matches[0].querySelectorAll('svg.area-icon-RadioUnchecked')].filter(interactive) : [];
      if (!valid() || matches.length !== 1 || icons.length !== 1) return { reason: '没有唯一匹配完整路径的可选地区' };
      icons[0].dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      for (let wait = 0; wait < 25 && valid() && !(selected().length === 1 && accepted(selected()[0])); wait++) await pauseControl();
      const buttons = [...area.querySelectorAll('.area-footer-button .phoenix-button')].filter(node => interactive(node) && node.textContent.trim() === '确定');
      if (!valid() || selected().length !== 1 || !accepted(selected()[0]) || buttons.length !== 1) return { reason: '地区暂存结果未确认' };
      buttons[0].click();
      for (let wait = 0; wait < 25 && settled(); wait++) {
        if (accepted(valueOf(el)) && (!popup.isConnected || !interactive(popup))) { committed = true; return { value: valueOf(el) }; }
        await pauseControl();
      }
      return { reason: '网页未确认地区，请核对' };
    } finally {
      if (!committed && location.href === url && unchanged(record) && valueOf(el) === record.original &&
        sitePopups().length === 1 && sitePopups()[0] === popup && search.value === region.leaf && selected().every(text => before.includes(text) || accepted(text))) {
        const cancel = [...area.querySelectorAll('.area-footer-button .phoenix-button')].filter(node => interactive(node) && node.textContent.trim() === '取消');
        if (cancel.length === 1) cancel[0].click();
      }
    }
  }
  async function chooseCalendar(el, value, popup, active, settled, record) {
    const ud = popup.matches('.ud__picker-date-panel,.throne-biz-date-range-picker-panel');
    if (ud && value === '至今') {
      // The range component commits its special end value through this footer.
      const candidates = () => [...popup.querySelectorAll('.throne-biz-date-range-picker-cell')].filter(node => visible(node) && node.textContent.trim() === '至今');
      for (let wait = 0; wait < 30 && active() && !candidates().length; wait++) await pauseControl();
      const cells = candidates();
      if (!active() || cells.length !== 1 || !interactive(cells[0]) || cells[0].closest('[disabled]')) return { reason: '至今没有唯一可选项，请核对' };
      cells[0].click();
      for (let wait = 0; wait < 25 && settled(); wait++) {
        if (valueOf(el) === value && (!popup.isConnected || !interactive(popup))) return { value };
        await pauseControl();
      }
      return { reason: '网页未确认至今，请核对' };
    }
    if (ud && el.placeholder === 'YYYY') return chooseYear(el, value, popup, active, settled);
    const monthly = ud || !!popup.querySelector('.phoenix-calendar-month-calendar');
    // The user confirmed first-of-month reporting for Gjzq project and campus dates.
    if (!monthly && record?.monthAsFirstDay && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) value += '-01';
    const match = /^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.exec(value);
    if (!match || (!monthly && !match[3]) || (monthly && match[3])) return { reason: monthly ? '此日历需要年月资料' : '此日历需要完整日期，不能推测日期' };
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    if (match[3] && new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) return { reason: '日期无效，请核对资料' };
    const yearSelector = ud ? '.ud__picker-panel-header-btn' : monthly ? '.phoenix-calendar-month-panel-year-select-content' : '.phoenix-calendar-year-select';
    const readYear = () => Number(popup.querySelector(yearSelector)?.textContent.match(/\d{4}/)?.[0]);
    for (let i = 0; i < 150 && active() && readYear() !== year; i++) {
      const before = readYear();
      if (!Number.isFinite(before) || Math.abs(before - year) > 150) return { reason: '日历年份范围无法确认' };
      const backwards = before > year;
      const button = ud ? popup.querySelector(`[data-icon="${backwards ? 'Left' : 'Right'}BoldOutlined"]`)?.closest('button') : popup.querySelector(monthly ? `.phoenix-calendar-month-panel-${backwards ? 'prev' : 'next'}-year-btn` : `.phoenix-calendar-${backwards ? 'prev' : 'next'}-year-btn`);
      if (!interactive(button)) return { reason: '日历年份不可选' };
      button.click();
      for (let wait = 0; wait < 15 && active() && readYear() === before; wait++) await pauseControl();
      if (readYear() !== before + (backwards ? -1 : 1)) return { reason: '日历年份切换未确认' };
    }
    if (!active() || readYear() !== year) return { reason: '已停止或日期面板已变化' };
    if (!monthly) {
      const readMonth = () => Number(popup.querySelector('.phoenix-calendar-month-select')?.textContent.match(/\d+/)?.[0]);
      for (let i = 0; i < 12 && active() && readMonth() !== month; i++) {
        const before = readMonth(), backwards = before > month;
        const button = popup.querySelector(`.phoenix-calendar-${backwards ? 'prev' : 'next'}-month-btn`);
        if (!Number.isFinite(before) || !interactive(button)) return { reason: '日历月份不可选' };
        button.click();
        for (let wait = 0; wait < 15 && active() && readMonth() === before; wait++) await pauseControl();
        if (readMonth() !== before + (backwards ? -1 : 1)) return { reason: '日历月份切换未确认' };
      }
      if (readMonth() !== month || readYear() !== year) return { reason: '日历月份未确认' };
    }
    const selector = ud ? '.ud__picker-month-panel-cell .ud__picker__cell-interactive-area' : monthly ? '.phoenix-calendar-month-panel-month' : '.phoenix-calendar-date';
    const cells = [...popup.querySelectorAll(selector)].filter(n => interactive(n) && !n.closest('.phoenix-calendar-last-month-cell,.phoenix-calendar-next-month-btn-day') && Number(n.textContent.match(/\d+/)?.[0]) === (monthly ? month : day));
    if (!active() || cells.length !== 1) return { reason: '日期没有唯一可选项' };
    cells[0].click();
    for (let i = 0; i < 25; i++) {
      if (!settled()) break;
      if (valueOf(el).replace(/[年月/.]/g, '-').replace(/日$/, '') === value && (!popup.isConnected || !interactive(popup))) return { value: valueOf(el) };
      await pauseControl();
    }
    return { reason: '网页未确认日期，请核对' };
  }
  async function chooseYear(el, value, popup, active, settled) {
    if (!/^\d{4}$/.test(value)) return { reason: '此日历需要四位年份' };
    const target = Number(value);
    const atsx = popup.matches('.atsx-date-picker-panel');
    const cellSelector = atsx ? '.atsx-date-picker-panel-body-year .atsx-date-picker-panel-body-cell-content' : '.ud__picker__cell-interactive-area';
    const cells = () => [...popup.querySelectorAll(cellSelector)].filter(node => visible(node) && /^\d{4}年?$/.test(node.textContent.trim()));
    const years = () => cells().map(node => Number(node.textContent.match(/\d{4}/)[0]));
    for (let wait = 0; wait < 30 && active() && !cells().length; wait++) await pauseControl();
    for (let step = 0; step < 30 && active(); step++) {
      const displayed = years();
      if (!displayed.length) return { reason: '未识别到年份选项，请手动核对' };
      const candidates = cells().filter(node => Number(node.textContent.match(/\d{4}/)[0]) === target);
      if (candidates.length) {
        if (candidates.length !== 1 || !interactive(candidates[0]) || !active()) return { reason: '年份没有唯一可选项' };
        candidates[0].click();
        for (let wait = 0; wait < 25 && settled(); wait++) {
          if (valueOf(el) === value && (!popup.isConnected || !interactive(popup))) return { value };
          await pauseControl();
        }
        return { reason: '网页未确认年份，请核对' };
      }
      const low = Math.min(...displayed), high = Math.max(...displayed);
      if (target >= low && target <= high) return { reason: '年份没有可选项' };
      const backwards = target < low;
      const buttons = atsx
        ? [...popup.querySelectorAll(`.atsx-date-picker-panel-header [data-cy="${backwards ? 'prev' : 'next'}"]`)].filter(interactive)
        : [...popup.querySelectorAll(`[data-icon="${backwards ? 'Left' : 'Right'}BoldOutlined"]`)].map(icon => icon.closest('button')).filter(interactive);
      if (buttons.length !== 1 || !active()) return { reason: '年份翻页入口不唯一' };
      buttons[0].click();
      for (let wait = 0; wait < 15 && active() && years().join(',') === displayed.join(','); wait++) await pauseControl();
      const next = years();
      if (!active() || !next.length || !(backwards ? Math.max(...next) < high : Math.min(...next) > low)) return { reason: '年份翻页未确认或页面已变化' };
    }
    return { reason: '已停止或年份超出本次查找范围' };
  }
  async function chooseAtsxPeriod(el, value, record, url) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    const present = value === '至今';
    const owner = el.closest('.atsx-date-picker-period-month');
    const endpoints = owner ? [...owner.querySelectorAll('.atsx-date-picker-period-month-label')] : [];
    if (endpoints.length !== 2 || (!match && !present) || (present && el !== endpoints[1])) return { reason: '日期需要有效年月，只有结束时间可选至今' };
    const peer = endpoints.find(node => node !== el), peerBefore = valueOf(peer);
    const stable = () => !state.stopped && location.href === url && unchanged(record) && valueOf(peer) === peerBefore &&
      (!record.identity || unchanged(record.identity) && valueOf(record.identity.el) === record.identity.value);
    let popup;
    const opened = sitePopups();
    // The component opens the end selector after a completed start. Only consume
    // that exact continuation within the same fill operation.
    if (opened.length) {
      const next = state.atsxNext;
      if (!next || next.el !== el || next.popup !== opened[0] || opened.length !== 1 || !el.matches('.atsx-date-picker-period-month-label-focus')) return { reason: '请先收起已打开的选项或日历，再重新填写' };
      popup = next.popup;
    }
    state.atsxNext = null;
    if (!stable() || valueOf(el) !== record.original) return { reason: '日期或对应经历已变化，请重新识别' };
    if (!popup) {
      el.click();
      for (let i = 0; i < 30 && stable(); i++) {
        const candidates = sitePopups();
        if (candidates.length > 1) break;
        if (candidates.length === 1 && candidates[0].matches('.atsx-date-picker-period-month-panel')) { popup = candidates[0]; break; }
        await pauseControl();
      }
    }
    const active = () => stable() && popup?.isConnected && sitePopups().length === 1 && sitePopups()[0] === popup;
    const options = column => {
      const lists = [...(popup?.querySelectorAll('.atsx-date-picker-period-month-panel-list') || [])];
      return lists.length === 2 ? [...lists[column].querySelectorAll('.atsx-date-picker-period-month-panel-list-item')].filter(visible) : [];
    };
    const choosePart = async (column, text) => {
      const matches = options(column).filter(node => node.textContent.trim() === text);
      if (!active() || matches.length !== 1 || !interactive(matches[0])) return false;
      matches[0].scrollIntoView?.({ block: 'nearest' });
      if (!active()) return false;
      matches[0].click();
      return true;
    };
    if (!active() || valueOf(el) !== record.original) return { reason: '未找到当前日期的唯一年月列表' };
    if (!await choosePart(0, present ? '至今' : match[1])) return { reason: '年份没有唯一可选项' };
    if (!present) {
      let confirmed = false;
      for (let i = 0; i < 25 && active(); i++) {
        if (valueOf(el) === `${match[1]}-`) { confirmed = true; break; }
        if (valueOf(el) !== record.original) break;
        await pauseControl();
      }
      if (!confirmed || !await choosePart(1, match[2])) return { reason: '年份未确认或月份没有唯一选项，请核对' };
    }
    for (let i = 0; i < 25 && stable(); i++) {
      if (valueOf(el) === value) {
        const panels = sitePopups();
        if (!panels.length) return { value };
        if (el === endpoints[0] && panels.length === 1 && panels[0].matches('.atsx-date-picker-period-month-panel') && peer.matches('.atsx-date-picker-period-month-label-focus') && !el.matches('.atsx-date-picker-period-month-label-focus')) {
          state.atsxNext = { el: peer, popup: panels[0] };
          return { value };
        }
      }
      await pauseControl();
    }
    return { reason: '网页未确认完整年月，请核对' };
  }
  function targetValue(el, value) {
    if (el.tagName === "SELECT") {
      const synonyms = { "硕士": ["硕士", "研究生", "硕士研究生", "master", "masters"], "本科": ["本科", "学士", "bachelor", "bachelors"], "男": ["男", "男性", "male"], "女": ["女", "女性", "female"] };
      const names = [...new Set([...(synonyms[value] || [value]).map(normalize), ...optionNames(value, el)])];
      const options = [...el.options].filter(option => !option.disabled && !option.hidden && (names.includes(normalize(option.textContent)) || normalize(option.value) === normalize(value)));
      if (options.length !== 1) return { reason: "选项需手动选择" };
      return { value: options[0].value };
    }
    if (el.readOnly || widget(el) || el.isContentEditable) return { reason: "自定义控件需手动填写" };
    if (el.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { reason: "网站需要完整日期" };
    if (el.type === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return { reason: "网站需要年月格式" };
    if (el.maxLength >= 0 && value.length > el.maxLength) return { reason: `超过 ${el.maxLength} 字限制` };
    return { value };
  }
  function scan(group, customFields = null) {
    detectPlatforms();
    state.campusRole = detectCampusRole();
    state.hasInternshipSection = detectInternshipSection();
    state.fields.clear();
    const rows = [];
    for (const el of controls()) {
      if (isHotjob && el.closest('.ant-select-dropdown,.ant-calendar-picker-container')) continue;
      if (isMoka && document.querySelector('[class*="apply-block-"]') && !el.closest(mokaFieldSelector)) continue;
      if (!visible(el) || el.closest('.ud__select__dropdown,.ud__picker__list__box,.throne-biz-date-range-picker-panel,.common-unmodeled-layer') || (el.tagName === "INPUT" && !mokaPresent(el) && !["text", "email", "tel", "url", "date", "month", "number", "search"].includes(el.type))) continue;
      const texts = labels(el);
      if (/验证码|密码|护照|银行卡|verification|password|captcha|passport/i.test(texts.join(" "))) continue;
      const id = crypto.randomUUID();
      const row = { id, label: texts[0] || "未命名字段", key: classify(texts, group, customFields), current: valueOf(el), type: el.type || el.tagName.toLowerCase(), part: mokaPresent(el) ? 'present' : splitDate(el)?.part || '' };
      if (row.part) row.label += row.part === 'year' ? '（年）' : row.part === 'present' ? '（至今）' : '（月）';
      state.fields.set(id, { el, parent: el.parentElement, original: row.current, queryOriginal: isMoka && el.closest(mokaSelectSelector) ? el.value : null, signature: texts.join("\n"), ancestors: ancestors(el) });
      if (hotjobSelect(el)) state.fields.get(id).hotjobQueryOriginal = hotjobSelect(el).querySelector('input.ant-select-search__field')?.value || '';
      rows.push(row);
    }
    const platform = isMoka ? "Moka" : isFeishu ? "飞书招聘" : isBeisen ? "北森" : "通用表单";
    return { rows, platform, url: location.href, frames: document.querySelectorAll("iframe").length };
  }
  function ancestors(el) {
    const result = [];
    for (let node = el.parentElement; node; node = node.parentElement) result.push(node);
    return result;
  }
  function unchanged(record) {
    return record.el?.isConnected && visible(record.el) && labels(record.el).join('\n') === record.signature &&
      record.ancestors.every((node, index) => ancestors(record.el)[index] === node) &&
      (!record.evidence || record.evidence.every(item => unchanged(item) && valueOf(item.el) === item.value));
  }
  const campusLabels = ['校园经历', '院校经历', '校园经验', '院校经验', '学生会&社团活动经历', '在校实践', '在校经历', '校内经历', '在校职务'];
  const campusUsesRole = () => !!state.campusRole;
  const detectCampusRole = () => [...document.querySelectorAll('.form-item__text, label, [class^="title-"], [class^="filed-title-"]')].some(node => {
    if (!visible(node) || !['在校职务名称', '职务名称', '职务', '担任职务', '职位名称'].includes(cleanLabel(node.textContent))) return false;
    const section = node.closest('[class*="apply-block-"], .applyFormModuleWrapper-windows, .form-cell, section, fieldset');
    const form = node.closest('.ux-standard-form .form[id]');
    const titles = section ? [...section.querySelectorAll('h1,h2,h3,legend,[role="heading"], [class*="blockTitle-"], .applyFormModuleWrapper-text, .tit > p')] : [];
    if (form) for (let parent = form.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      titles.push(...[...parent.children].filter(child => child.id === form.id && !child.contains(form)));
    }
    const root = form || section;
    const organization = root && [...root.querySelectorAll('.form-item__text,label,[class^="title-"]')].some(label => visible(label) && ['学校组织', '组织名称', '项目名称', '活动名称', '社团名称', '社会工作团体'].includes(cleanLabel(label.textContent)));
    return !organization && titles.some(title => normalize(caption(title)) === '在校职务');
  });
  const campusPageLabels = () => campusUsesRole() ? ['在校职务'] : campusLabels;
  const isCampusModule = module => campusLabels.some(label => normalize(label) === normalize(module?.label));
  const awardLabels = ['获奖经历', '获奖情况', '获奖信息', '获奖', '荣誉奖项'];
  const isAwardModule = module => awardLabels.some(label => normalize(label) === normalize(module?.label));
  const languageLabels = ['语言能力', '语言水平'];
  const isLanguageModule = module => languageLabels.some(label => normalize(label) === normalize(module?.label));
  const familyLabels = ['家庭情况', '家庭成员', '家庭信息'];
  const isFamilyModule = module => familyLabels.some(label => normalize(label) === normalize(module?.label));
  function moduleFields(module) {
    const campusAliases = [
      ['学校 / 组织', '学校/组织', '组织名称', '项目名称', '活动名称', '社团名称', '社会工作团体'],
      ['职务', '担任职务', '职位名称', '项目角色', '社团职务', '在校职务名称', '职务名称'],
      ['开始时间', '开始日期'], ['结束时间', '结束日期'],
      ['工作内容', '职务描述', '职责描述', '活动描述', '工作职责', '在校职务描述']
    ];
    const awardAliases = [
      ['奖项名称', '获奖名称', '获奖项', '名称'], ['获奖年份', '获奖时间', '获奖日期', '获奖年月', '获取时间'],
      ['奖项级别', '获奖级别', '级别'], ['获奖说明', '获奖描述', '奖项描述']
    ];
    const languageAliases = [['语言类型', '语种', '语言'], ['听说', '听说能力'], ['读写', '读写能力'], ['精通程度']];
    const familyAliases = [['姓名', '成员姓名'], ['与本人关系', '关系', '称谓'], ['性别'], ['联系电话', '手机号码', '联系方式', '电话'], ['工作单位', '单位名称'], ['职务', '职位'], ['出生年月', '出生日期']];
    const scopedAliases = isCampusModule(module) ? campusAliases : isAwardModule(module) ? awardAliases : isLanguageModule(module) ? languageAliases : isFamilyModule(module) ? familyAliases : [];
    return Object.fromEntries(module.fields.map(field => [field.id, scopedAliases.find(names => names.some(name => normalize(name) === normalize(field.label))) || [field.label]]));
  }
  function moduleAnchor(module) {
    if (!module) return '';
    if (isFamilyModule(module)) {
      const names = Object.entries(moduleFields(module)).filter(([, labels]) => labels.includes('姓名'));
      return names.length === 1 ? names[0][0] : '';
    }
    if (isCampusModule(module)) {
      const matches = Object.entries(moduleFields(module)).filter(([, names]) => names.includes(campusUsesRole() ? '在校职务名称' : '项目名称'));
      return matches.length === 1 ? matches[0][0] : '';
    }
    if (isAwardModule(module)) {
      const names = Object.entries(moduleFields(module)).filter(([, labels]) => labels.includes('奖项名称'));
      return names.length === 1 ? names[0][0] : '';
    }
    return module.fields[0]?.id || '';
  }
  function matchRecord(group, entries, key, el, block = null) {
    const exact = entries.flatMap((entry, index) => normalize(entry[key]) === normalize(valueOf(el)) ? [index] : []);
    if (exact.length || group !== 'project' || !valueOf(el).trim()) return { indexes: exact, evidence: [] };
    const previous = entries.flatMap((entry, index) => String(entry.previousNames || '').split(/\r?\n/).some(name => name.trim() && normalize(name) === normalize(valueOf(el))) ? [index] : []);
    if (previous.length) return { indexes: previous, evidence: [] };
    if (!block) {
      const section = sectionFor(el, []).section;
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        const names = controls(node).filter(input => visible(input) && classify(labels(input), 'project') === 'name');
        if (names.length !== 1 || names[0] !== el) break;
        block = node;
        if (node === section) break;
      }
    }
    if (!block) return { indexes: [], evidence: [] };
    const canonical = value => {
      try { const url = new URL(value.trim()); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; }
    };
    const evidence = [], links = new Set();
    for (const field of controls(block).filter(visible)) {
      const fieldKey = classify(labels(field), 'project'), text = valueOf(field);
      const values = fieldKey === 'url' && text.trim() ? [text] : fieldKey === 'description'
        ? [...text.matchAll(/(?:^|\n)\s*(?:\d+[.、]\s*)?(?:项目链接|项目网址|作品链接)\s*[:：]\s*(https?:\/\/[^\s<>]+)/g)].map(match => match[1]) : [];
      if (!values.length) continue;
      for (const value of values) links.add(canonical(value));
      evidence.push({ el: field, value: text, signature: labels(field).join('\n'), ancestors: ancestors(field) });
    }
    if (links.size !== 1 || links.has('')) return { indexes: [], evidence: [] };
    const indexes = entries.flatMap((entry, index) => entry.url && links.has(canonical(entry.url)) ? [index] : []);
    return { indexes, evidence };
  }
  function sectionFor(el, modules) {
    const groups = {
      basic: ['基础信息', '基本信息', '个人信息', '个人资料', '基本资料', '自我描述', '自我评价', '专业技能'],
      education: ['教育经历', '教育背景', '教育信息', '教育经历信息'],
      internship: ['实习经历', '实习经验'],
      work: ['工作经历', '工作经验', '工作履历'],
      thirdParty: ['紧急联系人', '家庭成员', '家庭信息', '家庭情况', '联系人信息'],
      unmapped: ['培训经历', '培训经验', '附加问题', '附加信息', '求职意向'],
      project: ['项目经历', '项目经验'],
      ...Object.fromEntries(modules.map(module => [module.id, isCampusModule(module) ? campusPageLabels() : isAwardModule(module) ? awardLabels : isLanguageModule(module) ? languageLabels : isFamilyModule(module) ? familyLabels : [module.label]]))
    };
    if (campusUsesRole()) groups.unmapped.push('在校实践');
    const headingGroup = text => {
      const matches = Object.keys(groups).filter(key => groups[key].some(label => normalize(text).replace(/\d+$/, '') === normalize(label)));
      if (familyLabels.some(label => normalize(text).replace(/\d+$/, '') === normalize(label))) {
        const family = modules.filter(isFamilyModule);
        return family.length === 1 ? family[0].id : 'thirdParty';
      }
      const group = matches.find(key => ['basic', 'education', 'internship', 'work', 'thirdParty', 'project'].includes(key)) || (matches.length === 1 ? matches[0] : '');
      return group === 'work' && workUsesInternships(modules) ? 'internship' : group;
    };
    if (isFeishu) {
      const section = el.closest('.applyFormModuleWrapper-windows');
      const title = section?.querySelector('.applyFormModuleWrapper-text');
      if (title) return { group: headingGroup(title.textContent) || 'unmapped', section };
    }
    if (isMoka) {
      const section = el.closest('[class*="apply-block-"], [class*="basic-block-"]');
      const title = section && [...section.children].find(node => node.matches('[class*="blockTitle-"], [class*="block-title-"]'));
      if (title) return { group: headingGroup(caption(title)) || 'unmapped', section };
    }
    if (isHotjob) {
      const section = el.closest('.form-cell');
      if (section) {
        const titles = [...section.querySelectorAll(':scope > .tit-wrap > .tit > p')];
        return { group: titles.length === 1 ? headingGroup(titles[0].textContent) || 'unmapped' : 'unmapped', section };
      }
    }
    if (isBeisen) {
      const form = el.closest('.ux-standard-form .form[id]');
      if (form) {
        // Phoenix repeats the form ID on its section heading, outside the form.
        for (let node = form.parentElement; node && node !== document.body; node = node.parentElement) {
          const headings = [...node.children].filter(child => child.id === form.id && !child.contains(form) && !child.querySelector(controlSelector));
          if (headings.length === 1) return { group: headingGroup(caption(headings[0])) || 'unmapped', section: node };
        }
      }
    }
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const headings = [...node.children].flatMap(child => child.matches('h1,h2,h3,h4,h5,h6,legend,[role="heading"]') ? [child] : [...child.children].filter(item => item.matches('h1,h2,h3,h4,h5,h6,legend,[role="heading"]')));
      // Platform sections sometimes use a plain div for the heading.
      headings.push(...[...node.children].flatMap(child => [child, ...child.children]).filter(child => !child.matches(controlSelector) && !child.querySelector(controlSelector) && headingGroup(caption(child))));
      const matches = [...new Set(headings.map(heading => headingGroup(caption(heading))).filter(Boolean))];
      if (matches.length === 1) return { group: matches[0], section: node };
    }
    return { group: '', section: null };
  }
  function plan(profile) {
    const data = scan('basic');
    const modules = profile.modules || [];
    const definitions = Object.fromEntries(modules.map(module => [module.id, moduleFields(module)]));
    const work = modules.find(module => ['工作经历', '工作经验', '工作履历'].includes(module.label));
    if (work) definitions.work = definitions[work.id];
    const records = { basic: [profile.basic], education: profile.education, internship: profile.internship, project: profile.project, work: work?.entries || [], ...Object.fromEntries(modules.map(module => [module.id, module.entries])) };
    const rows = data.rows.map(row => {
      const field = state.fields.get(row.id), texts = labels(field.el), context = sectionFor(field.el, modules);
      let group = context.group, key = classify(texts, group, definitions[group]);
      if (isMoka && group === 'project' && field.el.tagName === 'TEXTAREA' && texts.some(text => cleanLabel(text) === '职责')) key = 'responsibilities';
      // Feishu reuses the plain caption only inside an explicitly identified module.
      if (isFeishu && context.section && texts.some(text => cleanLabel(text) === '描述')) {
        if (['internship', 'project'].includes(group)) key = 'description';
        else if (isAwardModule(modules.find(module => module.id === group))) {
          const matches = Object.entries(definitions[group]).filter(([, names]) => names.includes('获奖说明'));
          if (matches.length === 1) key = matches[0][0];
        }
      }
      if (!group) {
        const candidates = Object.keys(records).flatMap(group => { const key = classify(texts, group, definitions[group]); return key ? [{ group, key }] : []; });
        if (candidates.length === 1) ({ group, key } = candidates[0]);
      }
      return { ...row, key, group, entry: 0, value: '', source: '', reason: '', section: context.section };
    });
    const groups = Object.keys(records).filter(group => group !== 'basic');
    for (const group of groups) {
      const relevant = rows.filter(row => row.group === group && row.key);
      const anchor = ({ education: 'school', internship: 'company', project: 'name' })[group] || moduleAnchor(group === 'work' ? work : modules.find(module => module.id === group));
      const anchors = relevant.filter(row => row.key === anchor);
      const blocks = new Map();
      for (const row of relevant) {
        const el = state.fields.get(row.id).el;
        let block = null;
        for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
          const inside = anchors.filter(item => node.contains(state.fields.get(item.id).el));
          if (inside.length > 1) break;
          if (inside.length === 1) block = node;
          if (node === row.section) break;
        }
        if (!block) { row.reason = '无法确定对应的经历区块'; continue; }
        if (!blocks.has(block)) blocks.set(block, []);
        blocks.get(block).push(row);
      }
      const used = new Set();
      // Match already named records first so blank blocks cannot consume their source entry.
      const assignments = new Map(), evidence = new Map();
      for (const [block, items] of blocks) {
        const anchorRow = items.find(row => row.key === anchor);
        const existing = anchorRow?.current.trim();
        if (!existing && state.fields.get(anchorRow?.id)?.queryOriginal?.trim()) { assignments.set(block, -1); continue; }
        if (!existing) continue;
        const matched = matchRecord(group, records[group], anchor, state.fields.get(anchorRow.id).el, block);
        const matches = matched.indexes;
        if (matches.length === 1 && !used.has(matches[0])) { assignments.set(block, matches[0]); used.add(matches[0]); evidence.set(block, matched.evidence); }
        else assignments.set(block, -1);
      }
      for (const [block, items] of blocks) {
        let entry = assignments.get(block);
        if (entry === undefined) entry = records[group].findIndex((record, index) => !used.has(index) && ((!['education', 'internship', 'project'].includes(group) && !isAwardModule(modules.find(module => module.id === group)) && !isFamilyModule(modules.find(module => module.id === group))) || record[anchor]?.trim()));
        if (entry >= 0) used.add(entry);
        for (const row of items) {
          row.entry = entry;
          const identity = items.find(item => item.key === anchor);
          if (identity?.current.trim() && entry >= 0) {
            const anchorState = state.fields.get(identity.id);
            state.fields.get(row.id).identity = { el: anchorState.el, value: identity.current, ancestors: anchorState.ancestors, signature: anchorState.signature,
              evidence: (evidence.get(block) || []).filter(item => item.el !== state.fields.get(row.id).el) };
          }
          if (entry < 0) row.reason = '没有可确定对应的资料经历';
          else if (items.filter(other => other.key === row.key && other.part === row.part).length > 1) row.reason = '区块内有同名字段，需核对';
        }
      }
    }
    const groupLabels = { basic: '个人信息', education: '教育经历', internship: '实习经历', project: '项目经历', work: '工作经历', ...Object.fromEntries(modules.map(module => [module.id, module.label])) };
    for (const row of rows) {
      const record = records[row.group]?.[row.entry];
      row.value = record?.[row.key] || '';
      if (row.part === 'present' && row.value !== '至今') row.reason ||= '该经历无需勾选至今';
      if (row.group === 'internship' && row.key === 'employmentType' && record && workUsesInternships(modules) && !row.value) row.value = '实习';
      state.fields.get(row.id).workLocation = row.group === 'internship' && row.key === 'location';
      const element = state.fields.get(row.id).el;
      if (isBeisen && row.group === 'project' && row.key === 'description' && row.value && /^https?:\/\//.test(record?.url || '') &&
        !rows.some(other => other.group === 'project' && other.entry === row.entry && other.key === 'url') && !row.value.includes(record.url)) {
        row.value += `\n项目链接：${record.url}`;
      }
      if (row.group === 'basic' && siteControl(element)?.kind === 'phoenix' && ['city', 'hukou', 'nativePlace'].includes(row.key)) {
        const detail = row.key === 'city' ? profile.basic.residentialAddress : row.key === 'hukou' ? profile.basic.hukouAddress : '';
        const region = phoenixRegion(detail, true) || phoenixRegion(row.value);
        if (region) {
          row.value = region.value;
          // Only deepen a selected ancestor within the user's supplied path.
          if (row.current && region.parts.slice(0, -1).includes(row.current.trim())) {
            row.refineRegion = true;
            state.fields.get(row.id).refineRegion = row.value;
          }
        }
      }
      if (isAwardModule(modules.find(module => module.id === row.group)) && definitions[row.group]?.[row.key]?.includes('获奖年份') && ['ud-date', 'atsx-year'].includes(siteControl(element)?.kind) && element.placeholder === 'YYYY' && row.value) {
        if (/^\d{4}(?:-(0[1-9]|1[0-2]))?$/.test(row.value)) row.value = row.value.slice(0, 4);
        else { row.value = ''; row.reason ||= '获奖时间需要有效的年份或年月'; }
      }
      if (row.key === 'birthDate' && siteControl(element)?.kind === 'ud-date' && element.placeholder === 'YYYY-MM') row.value = (row.value || profile.basic.birthMonth || '').slice(0, 7);
      const date = splitDate(state.fields.get(row.id).el);
      if (date && row.value) {
        const source = row.value;
        // Selecting a Moka year also generates January, so a year-only award is incomplete.
        const converted = date.key === 'award' && /^\d{4}$/.test(source)
          ? { reason: '模板仅有获奖年份，请补充月份（YYYY-MM）后自动填写日期' }
          : dateValue(state.fields.get(row.id).el, source);
        row.reason ||= converted.reason || '';
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(source)) row.reason ||= '资料需要有效的年月格式';
        else if (valueOf(date.peer).trim() && !optionNames(dateValue(date.peer, source).value, date.peer).includes(normalize(valueOf(date.peer)))) row.reason ||= '已有日期与资料不同，保持原值';
        row.value = converted.value || '';
        state.fields.get(row.id).dateSource = source;
      }
      if (row.group === 'basic' && row.key === 'highestDegree') {
        const rank = { 博士: 5, 博士研究生: 5, 硕士: 4, 硕士研究生: 4, 研究生: 4, 本科: 3, 学士: 3, 大专: 2, 专科: 2, 高中: 1 };
        const known = profile.education.filter(item => rank[item.degree]);
        row.value = known.length === profile.education.filter(item => item.degree?.trim()).length ? known.sort((a, b) => rank[b.degree] - rank[a.degree])[0]?.degree || '' : '';
      }
      row.source = row.group ? [(groupLabels[row.group] || '未匹配模块') + (row.group === 'basic' || row.entry < 0 || !records[row.group] ? '' : ` ${row.entry + 1}`), record?.school || record?.company || record?.name].filter(Boolean).join(' · ') : '';
      row.reason ||= row.group === 'work' && !work ? '未配置工作经历资料' : !row.key ? '未可靠识别字段' : row.current.trim() && !row.refineRegion ? '已有内容，保持原值' : !row.value ? '资料未填写' : '';
      if (!row.reason && state.fields.get(row.id).queryOriginal?.trim()) row.reason = '已有搜索内容，保持原值';
      if (!row.reason && row.group === 'basic' && rows.filter(other => other.group === 'basic' && other.key === row.key).length > 1) row.reason = '有多个同名字段，需核对';
      if (!row.reason) {
        row.choice = !!choiceControl(state.fields.get(row.id).el);
        row.reason = row.choice ? '' : targetValue(state.fields.get(row.id).el, row.value).reason || '';
      }
      const fieldState = state.fields.get(row.id);
      fieldState.combinedAwardLevel = isAwardModule(modules.find(module => module.id === row.group)) && !!definitions[row.group]?.[row.key]?.includes('奖项级别');
      fieldState.monthAsFirstDay = location.hostname === 'gjzq.zhiye.com' && (row.group === 'project' && ['start', 'end'].includes(row.key) || isCampusModule(modules.find(module => module.id === row.group)) && definitions[row.group]?.[row.key]?.some(label => ['开始时间', '结束时间'].includes(label)));
      if (row.group === 'education' && row.key === 'school' && row.reason === '已有内容，保持原值' && row.current === row.value && ['ud-search', 'atsx-search'].includes(siteControl(fieldState.el)?.kind)) {
        fieldState.confirmation = row.value;
        row.confirmOnly = true; row.choice = true; row.reason = '';
      }
      const replaceable = ['role', 'description', 'department'].includes(row.key) || row.group === 'project' && ['responsibilities', 'results'].includes(row.key);
      row.canReplace = !!(fieldState.identity && ['internship', 'project'].includes(row.group) && replaceable && row.reason === '已有内容，保持原值' && row.value.trim() && row.current.trim() !== row.value.trim() && !targetValue(fieldState.el, row.value).reason);
      if (row.canReplace) { fieldState.replacement = row.value; row.reason = '与当前模板不同'; }
      delete row.section;
    }
    return { ...data, rows };
  }
  const pendingAdds = new Map();
  function addTargets(group, modules = []) {
    const module = modules.find(item => item.id === group);
    const names = { basic: ['自我评价'], education: ['教育经历', '教育背景'], internship: ['实习经历', '实习经验'], project: ['项目经历', '项目经验'] }[group] || (isCampusModule(module) ? campusPageLabels() : isAwardModule(module) ? awardLabels : isLanguageModule(module) ? languageLabels : isFamilyModule(module) ? familyLabels : [module?.label].filter(Boolean));
    if (workUsesInternships(modules) && group === 'internship') names.push('工作经历', '工作经验', '工作履历');
    const allowed = new Set(['添加', '新增', ...names.flatMap(name => [`添加${name}`, `新增${name}`, ...(isHotjob ? [`添加新的${name}`] : [])])].map(normalize));
    return [...document.querySelectorAll('button,[role="button"],a,span,div')].filter(button => {
      const text = normalize(button.getAttribute('aria-label') || button.textContent);
      if (!allowed.has(text) || !visible(button) || button.getAttribute('aria-disabled') === 'true') return false;
      if ([...button.children].some(child => allowed.has(normalize(child.textContent)))) return false;
      const command = button.closest('button,[role="button"],a') || button;
      if (!visible(command) || command.getAttribute('aria-disabled') === 'true' || !allowed.has(normalize(command.getAttribute('aria-label') || command.textContent))) return false;
      if (command.matches('a[href]') && !['', '#'].includes(command.getAttribute('href'))) return false;
      if (command.matches('button') && command.form && command.type !== 'button') return false;
      if (command.closest('[role="dialog"],dialog')) return false;
      if (group === 'basic' && !summarySection(command)) return false;
      return sectionFor(command, modules).group === group;
    }).map(button => button.closest('button,[role="button"],a') || button).filter((button, index, all) => all.indexOf(button) === index);
  }
  function summarySection(el) {
    if (!isFeishu) return null;
    const section = el.closest('.applyFormModuleWrapper-windows');
    return normalize(section?.querySelector('.applyFormModuleWrapper-text')?.textContent) === '自我评价' ? section : null;
  }
  function experienceAnchors(group, modules = []) {
    const module = modules.find(item => item.id === group);
    const key = { education: 'school', internship: 'company', project: 'name' }[group] || moduleAnchor(module);
    return controls().filter(el => visible(el) && sectionFor(el, modules).group === group && classify(labels(el), group, module && moduleFields(module)) === key);
  }
  async function revealExperience(group, modules, count, url) {
    if (!isMoka || experienceAnchors(group, modules).length >= count) return '';
    const module = modules.find(module => module.id === group);
    const names = { internship: ['是否有实习经历', '是否有实习经验'], project: ['是否有项目经历', '是否有项目经验'] }[group] || (isCampusModule(module) ? ['是否有院校经历', '是否有校园经历'] : isAwardModule(module) ? ['是否有获奖经历', '是否有获奖情况'] : []);
    const gates = controls().filter(el => visible(el) && sectionFor(el, modules).group === group && rawLabels(el).some(label => names.includes(cleanLabel(label))));
    for (const el of gates) {
      if (experienceAnchors(group, modules).length >= count) break;
      if (state.stopped || location.href !== url) return '已停止或页面已变化';
      const current = valueOf(el).trim();
      if (current === '是') continue;
      if (current) return '网页已选择没有该经历，请先核对经历开关';
      if (!choiceControl(el) || el.value?.trim()) return '经历开关需手动核对';
      const record = { el, original: valueOf(el), queryOriginal: el.value, signature: labels(el).join('\n'), ancestors: ancestors(el) };
      const before = experienceAnchors(group, modules).length;
      const result = await choose(el, '是', record, url);
      if (result.reason) return result.reason;
      for (let wait = 0; wait < 25 && !state.stopped && location.href === url && experienceAnchors(group, modules).length <= before; wait++) await pauseControl();
      if (experienceAnchors(group, modules).length <= before) return '经历开关已选择，但详细字段尚未出现';
    }
    return '';
  }
  async function prepare(profile) {
    detectPlatforms();
    state.campusRole = detectCampusRole();
    state.hasInternshipSection = detectInternshipSection();
    state.stopped = false;
    const url = location.href, results = [];
    const modules = profile.modules || [];
    if (isFeishu && profile.basic?.summary?.trim()) {
      const fields = () => controls().filter(el => visible(el) && summarySection(el) && classify(labels(el), 'basic') === 'summary');
      if (!fields().length) {
        const buttons = addTargets('basic', modules), pending = pendingAdds.get('basic');
        if (pending?.url === url) results.push({ group: 'basic', added: 0, reason: '上次添加尚未出现，请等待或刷新页面后重试' });
        else if (buttons.length === 1 && !state.stopped && location.href === url) {
          const section = summarySection(buttons[0]);
          pendingAdds.set('basic', { url });
          buttons[0].click();
          for (let wait = 0; wait < 25 && !state.stopped && location.href === url && section.isConnected && !fields().length; wait++) await pauseControl();
          const added = fields().filter(el => summarySection(el) === section).length;
          if (added) pendingAdds.delete('basic');
          results.push({ group: 'basic', added, reason: state.stopped || location.href !== url ? '已停止或页面已变化' : added === 1 ? '' : '添加后未出现唯一的自我评价字段，请核对' });
        } else if (buttons.length > 1) results.push({ group: 'basic', added: 0, reason: '自我评价添加入口不唯一，需手动核对' });
      } else pendingAdds.delete('basic');
    }
    for (const group of ['education', 'internship', 'project', ...modules.filter(module => isCampusModule(module) || isAwardModule(module) || isLanguageModule(module) || isFamilyModule(module)).map(module => module.id)]) {
      const module = modules.find(item => item.id === group);
      const key = { education: 'school', internship: 'company', project: 'name' }[group] || moduleAnchor(module);
      const entries = (module?.entries || profile[group] || []).filter(entry => entry[key]?.trim());
      let added = 0, reason = '';
      if (!entries.length) continue;
      reason = await revealExperience(group, modules, entries.length, url);
      if (reason) { results.push({ group, added, reason }); continue; }
      // Do not create more blank rows while a previous click may still be rendering.
      const pending = pendingAdds.get(group);
      if (pending?.url === url && experienceAnchors(group, modules).length <= pending.count) {
        results.push({ group, added, reason: '上次添加尚未出现，请等待或刷新页面后重试' }); continue;
      }
      pendingAdds.delete(group);
      while (experienceAnchors(group, modules).length < entries.length) {
        if (state.stopped || location.href !== url) { reason = '已停止或页面已变化'; break; }
        const buttons = addTargets(group, modules), anchors = experienceAnchors(group, modules);
        const matched = anchors.filter(el => valueOf(el).trim()).map(el => matchRecord(group, entries, key, el).indexes);
        if (matched.some(indexes => indexes.length !== 1) || new Set(matched.map(indexes => indexes[0])).size !== matched.length) { reason = '已有经历不属于当前版本或对应关系不唯一，请核对后添加'; break; }
        if (buttons.length !== 1) { reason = buttons.length ? '添加入口不唯一，需手动添加' : '未找到明确的添加入口'; break; }
        const section = sectionFor(buttons[0], modules).section;
        if (anchors.some(el => !section?.contains(el))) { reason = '经历分布在多个区块，需手动添加'; break; }
        const count = anchors.length;
        pendingAdds.set(group, { url, count });
        buttons[0].click();
        let nextCount = count;
        for (let attempt = 0; attempt < 25; attempt++) {
          if (state.stopped || location.href !== url) break;
          reason = await revealExperience(group, modules, entries.length, url);
          if (reason) break;
          nextCount = experienceAnchors(group, modules).length;
          if (nextCount > count) break;
          await new Promise(resolve => setTimeout(resolve, 80));
        }
        if (state.stopped || location.href !== url) { reason = '已停止或页面已变化'; break; }
        if (reason) break;
        if (nextCount <= count) { reason = '添加后未出现新的经历，请检查页面提示'; break; }
        pendingAdds.delete(group); added += nextCount - count;
        if (nextCount !== count + 1) { reason = '页面一次新增了多个区块，请核对'; break; }
        if (added >= 100) { reason = '已达到本次添加上限'; break; }
      }
      results.push({ group, added, reason });
      if (state.stopped || location.href !== url) break;
    }
    return { results, stopped: state.stopped || location.href !== url };
  }
  function preview(items) {
    return items.map(item => {
      const record = state.fields.get(item.id);
      if (!record) return { id: item.id, reason: "页面已变化，请重新识别" };
      return { id: item.id, ...targetValue(record.el, item.value) };
    });
  }
  function assign(el, value) {
    if (el.isContentEditable) el.textContent = value;
    else {
      const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    }
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    el.dispatchEvent(new FocusEvent("blur", { bubbles: true, composed: true }));
  }
  async function fill(items, options = {}) {
    if (!options.continueRun) state.stopped = false;
    state.atsxNext = null;
    const url = location.href;
    const results = [];
    // Moka generates January when choosing a previously empty year. Only the same
    // fill operation may replace that observed default with its planned month.
    const generatedMonths = new Map();
    for (const item of items) {
      let record = state.fields.get(item.id);
      const el = record?.el;
      const generated = el && generatedMonths.get(el);
      const ownDefault = generated && record.original === '' && record.dateSource === generated.source && valueOf(el) === generated.value;
      const confirmation = record?.confirmation && record.confirmation === item.value && record.original === item.value;
      const refinement = record?.refineRegion && record.refineRegion === item.value;
      if (ownDefault) record = { ...record, original: generated.value };
      let reason = "";
      if (state.stopped) reason = '已停止填写';
      else if (location.href !== url || !record || !unchanged(record)) reason = "页面已变化，请重新识别";
      else if (record.identity && (!unchanged(record.identity) || valueOf(record.identity.el) !== record.identity.value)) reason = '对应经历已变化，请重新识别';
      else if (valueOf(el) !== record.original || (valueOf(el).trim() && !ownDefault && !confirmation && !refinement)) reason = "已填写，保持原值";
      else if ((record.queryOriginal !== null && el.value !== record.queryOriginal) || record.queryOriginal?.trim()) reason = '已有搜索内容，保持原值';
      else if (typeof item.value !== "string" || !item.value.trim()) reason = "资料为空";
      if (!reason && splitDate(el)) {
        const peer = splitDate(el).peer, source = record.dateSource || item.value;
        if (valueOf(peer).trim() && /^\d{4}-(0[1-9]|1[0-2])$/.test(source) && !optionNames(dateValue(peer, source).value, peer).includes(normalize(valueOf(peer)))) reason = '已有日期与资料不同，保持原值';
      }
      const target = reason ? {} : item.choice && choiceControl(el) ? {} : targetValue(el, item.value);
      reason ||= target.reason || "";
      if (!reason) {
        const before = valueOf(el);
        if (item.choice && choiceControl(el)) {
          const date = splitDate(el), peerBefore = date && valueOf(date.peer);
          const result = await choose(el, item.value, record, url);
          reason = result.reason || '';
          if (!reason && date?.part === 'year' && !peerBefore && record.dateSource && date.peer.isConnected && /^0?1月?$/.test(valueOf(date.peer))) generatedMonths.set(date.peer, { value: valueOf(date.peer), source: record.dateSource });
          if (reason && ownDefault) reason += '；网页自动生成的月份尚未改为资料月份，请核对';
          if (!reason) state.undo.push({ el, before, after: valueOf(el), choice: true });
          results.push({ id: item.id, ok: !reason, reason });
          continue;
        }
        assign(el, target.value);
        await new Promise(resolve => setTimeout(resolve, 40));
        if (valueOf(el) === target.value) state.undo.push({ el, before, after: target.value });
        else reason = "网页未接受该值，请手动填写";
      }
      results.push({ id: item.id, ok: !reason, reason });
    }
    return results;
  }
  function undo() {
    let restored = 0, skipped = 0;
    for (const { el, before, after, choice } of state.undo.reverse()) {
      if (!choice && el.isConnected && valueOf(el) === after) { assign(el, before); restored++; } else skipped++;
    }
    state.undo = [];
    return { restored, skipped };
  }
  async function replace(items) {
    state.stopped = false;
    const url = location.href, results = [];
    for (const item of items) {
      const record = state.fields.get(item.id), identity = record?.identity;
      let reason = '';
      if (state.stopped || location.href !== url || !record || !unchanged(record) || !identity || !unchanged(identity) || valueOf(identity.el) !== identity.value || valueOf(record.el) !== record.original) reason = '页面内容已变化，请重新预览差异';
      else if (!record.replacement || item.value !== record.replacement) reason = '此字段不在已预览的模板差异中';
      const target = reason ? {} : targetValue(record.el, item.value);
      reason ||= target.reason || '';
      if (!reason) {
        const before = valueOf(record.el);
        assign(record.el, target.value);
        await pauseControl();
        if (location.href === url && unchanged(record) && valueOf(record.el) === target.value) {
          state.undo.push({ el: record.el, before, after: target.value });
          delete record.replacement;
        } else reason = '网页未确认更新，请核对';
      }
      results.push({ id: item.id, ok: !reason, reason });
    }
    return results;
  }
  globalThis.ApplyAssistant = { version: '0.6.24', scan, plan, prepare, preview, fill, replace, undo, classify, targetValue, stop: () => { state.stopped = true; return true; } };
})();
