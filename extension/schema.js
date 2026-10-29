export const groups = {
  basic: { label: "个人信息", fields: { name: "姓名", phone: "手机号码", email: "电子邮箱", gender: "性别", birthMonth: "出生年月", birthDate: "出生日期", identityType: "证件类型", identityNumber: "身份证号/证件号码", nationality: "国籍", ethnicity: "民族", politicalStatus: "政治面貌", height: "身高(cm)", weight: "体重(kg)", nativePlace: "籍贯", hukou: "户籍所在地", hukouAddress: "户籍详细地址", city: "现居城市", residentialAddress: "现居住地址", mailingAddress: "邮寄地址", address: "详细地址", postalCode: "邮政编码", cet4Score: "CET4成绩", cet6Score: "CET6成绩", website: "个人主页", skills: "技能与证书", summary: "自我评价" } },
  education: { label: "教育经历", fields: { school: "学校名称", college: "学院", major: "专业名称", degree: "学历", studyType: "教育类型", graduationStatus: "毕业状态", rank: "成绩排名", classRank: "班级成绩排名", gpa: "GPA", start: "开始时间", end: "结束时间", description: "在校经历" } },
  internship: { label: "实习经历", fields: { company: "公司名称", role: "职位名称", department: "部门", start: "开始时间", end: "结束时间", description: "工作内容" } },
  project: { label: "项目经历", fields: { name: "项目名称", role: "项目角色", start: "开始时间", end: "结束时间", description: "项目描述", url: "项目链接" } }
};
Object.assign(groups.basic.fields, { maritalStatus: '婚否', overseasStudy: '海外留学经历', yearsExperience: '工作年限' });
Object.assign(groups.education.fields, { academicDegree: '学位', trainingMode: '培养方式', combinedDegree: '是否直博或硕博连读' });
Object.assign(groups.internship.fields, { roleLevel: '职位级别', salary: '月薪（税前）', companySize: '企业规模', leaveReason: '离职原因' });
Object.assign(groups.internship.fields, { location: '工作地点', industry: '所属行业', occupation: '职业类别', employmentType: '工作性质' });
Object.assign(groups.internship.fields, { results: '工作业绩' });
Object.assign(groups.project.fields, { responsibilities: '项目中职责', results: '项目成果', previousNames: '项目旧名称' });
export function emptyProfile() { return { version: 1, basic: {}, education: [], internship: [], project: [], modules: [] }; }

const moduleId = /^custom_[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const fieldId = /^field_[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const fieldTypes = new Set(["text", "textarea", "month", "email", "url"]);
const isRecord = value => !!value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function text(value, label, required = false) {
  if (typeof value !== "string" || value.length > 20000 || (required && !value.trim())) throw new Error(`${label}需要文本，且不超过 20000 字。`);
  return value;
}

function normalizeRecords(records, fields, label) {
  if (!Array.isArray(records) || records.length > 100) throw new Error(`${label}格式不正确或超过 100 条。`);
  return records.map(record => {
    if (!isRecord(record)) throw new Error("经历格式不正确。");
    return Object.fromEntries(Object.entries(fields).map(([key, name]) => [key, text(Object.hasOwn(record, key) ? record[key] : "", name)]));
  });
}

export function validateProfile(value) {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.basic)) throw new Error("资料格式不正确，需要 version 1 的资料文件。");
  const clean = emptyProfile();
  for (const [group, config] of Object.entries(groups)) {
    const records = group === "basic" ? [value.basic] : value[group];
    const normalized = normalizeRecords(records, config.fields, config.label);
    clean[group] = group === "basic" ? normalized[0] : normalized;
  }
  const modules = value.modules === undefined ? [] : value.modules;
  if (!Array.isArray(modules) || modules.length > 32) throw new Error("自定义模块格式不正确或超过 32 个。");
  const ids = new Set();
  clean.modules = modules.map(module => {
    if (!isRecord(module) || typeof module.id !== "string" || !moduleId.test(module.id) || ids.has(module.id)) throw new Error("自定义模块 ID 无效或重复。");
    ids.add(module.id);
    const label = text(module.label, "模块名称", true);
    if (!Array.isArray(module.fields) || module.fields.length < 1 || module.fields.length > 40) throw new Error("每个模块需要 1 到 40 个字段。");
    const fieldIds = new Set();
    const labels = new Set();
    const fields = module.fields.map(field => {
      if (!isRecord(field) || typeof field.id !== "string" || !fieldId.test(field.id) || fieldIds.has(field.id)) throw new Error("自定义字段 ID 无效或重复。");
      fieldIds.add(field.id);
      const name = text(field.label, "字段名称", true);
      if (labels.has(name.trim())) throw new Error("同一模块内的字段名称不能重复。");
      labels.add(name.trim());
      if (!fieldTypes.has(field.type)) throw new Error("自定义字段类型不正确。");
      return { id: field.id, label: name, type: field.type };
    });
    return { id: module.id, label, fields, entries: normalizeRecords(module.entries, Object.fromEntries(fields.map(field => [field.id, field.label])), label) };
  });
  return clean;
}

export function profileGroups(profile) {
  return {
    ...groups,
    ...Object.fromEntries((profile.modules || []).map(module => [module.id, {
      label: module.label,
      fields: Object.fromEntries(module.fields.map(field => [field.id, field.label])),
      types: Object.fromEntries(module.fields.map(field => [field.id, field.type]))
    }]))
  };
}

export function profileRecords(profile, group) {
  if (group === "basic") return [profile.basic];
  if (Object.hasOwn(groups, group)) return profile[group];
  return profile.modules?.find(module => module.id === group)?.entries || [];
}
