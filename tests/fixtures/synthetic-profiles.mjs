import { emptyProfile, validateProfile } from '../../extension/schema.js';

// Synthetic variants keep regression tests independent of personal resume files.
const profiles = ['产品岗', '财务岗'].map((name, edition) => {
  const data = emptyProfile();
  data.internship = Array.from({ length: edition ? 4 : 3 }, (_, index) => ({
    company: `演示公司${index + 1}`, role: `演示实习岗位${index + 1}`, department: '演示部门',
    start: '2026-01', end: index ? '2026-06' : '至今',
    description: `版本${edition + 1}实习${index + 1}完整职责。` + '虚构测试正文，用于核对多条记录和完整填入。'.repeat(12)
  }));
  data.project = Array.from({ length: edition ? 6 : 4 }, (_, index) => ({
    name: `演示项目${index + 1}`, previousNames: index < 3 ? `旧演示项目${index + 1}\n历史演示名称${index + 1}` : '',
    role: `演示角色${index + 1}`, start: '2026-01', end: index ? '2026-06' : '至今',
    description: `版本${edition + 1}项目${index + 1}完整描述。` + '虚构项目背景、实施过程与结果。'.repeat(12),
    responsibilities: `版本${edition + 1}项目${index + 1}具体职责。` + '虚构职责正文，与项目角色分开存储。'.repeat(12)
  }));
  data.modules = [{
    id: 'custom_campus', label: '校园经历',
    fields: [
      { id: 'field_organization', label: '学校 / 组织', type: 'text' },
      { id: 'field_role', label: '职务', type: 'text' },
      { id: 'field_start', label: '开始时间', type: 'month' },
      { id: 'field_end', label: '结束时间', type: 'month' },
      { id: 'field_description', label: '工作内容', type: 'textarea' }
    ],
    entries: ['组织委员', '班长', '学生会干事'].map((role, index) => ({
      field_organization: `演示学校组织${index + 1}`, field_role: role,
      field_start: '2025-09', field_end: index ? '2026-06' : '至今',
      field_description: `版本${edition + 1}校园职务${index + 1}。` + '虚构校园工作内容，用于完整正文匹配检查。'.repeat(12)
    }))
  }];
  return { id: `profile_synthetic_${edition + 1}`, name, target: '', data: validateProfile(data) };
});

export default { library: { version: 2, revision: 0, activeId: profiles[0].id, profiles } };
