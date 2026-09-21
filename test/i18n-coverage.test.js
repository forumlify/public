const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// i18n 采用「中文原文作 key」的外挂方案：js/i18n.js 里的 zh 词典登记
// 哪些中文需要翻译（键与值相同），en 词典提供对应译文；运行时遍历
// DOM，只有能在 zh 词典里精确命中的文本才会被替换。
//
// 因此「漏翻译」= 界面文案没被登记进词典。历史上曾有 60 余条界面文案
// （各类失败提示、表单校验、确认对话框）从未登记，切到英文后仍是中文。
// 这里直接从源码里抽出中文文案，断言它们都在词典里出现过。

const root = path.join(__dirname, '..');
const i18nSource = fs.readFileSync(path.join(root, 'js', 'i18n.js'), 'utf8');

// 取 zh 词典块（第一个 'zh': { ... } ）。
function extractDict(source, lang) {
  const startMatch = source.match(new RegExp(`'${lang}'\\s*:\\s*\\{`));
  assert.ok(startMatch, `找不到 ${lang} 词典`);
  const start = startMatch.index + startMatch[0].length;
  // 从起点开始做花括号配平，避免被字符串里的括号干扰。
  let depth = 1;
  let i = start;
  let inString = false;
  let quote = '';
  for (; i < source.length && depth > 0; i++) {
    const ch = source[i];
    const prev = source[i - 1];
    if (inString) {
      if (ch === quote && prev !== '\\') inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  return source.slice(start, i - 1);
}

const zhBlock = extractDict(i18nSource, 'zh');
const enBlock = extractDict(i18nSource, 'en');

const keyPattern = /^\s*'((?:[^'\\]|\\.)*)'\s*:/gm;
const collectKeys = block => {
  const keys = new Set();
  let m;
  keyPattern.lastIndex = 0;
  while ((m = keyPattern.exec(block)) !== null) keys.add(m[1]);
  return keys;
};
const zhKeys = collectKeys(zhBlock);
const enKeys = collectKeys(enBlock);

// 从源码里抽出所有中文文案。
function collectChineseLiterals() {
  const literals = new Set();
  const files = ['index.html', ...fs.readdirSync(path.join(root, 'js'))
    .filter(f => f.endsWith('.js') && f !== 'i18n.js')
    .map(f => path.join('js', f))];

  const cjk = /[\u4e00-\u9fff]/;
  for (const file of files) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    // 引号包裹的中文串
    for (const m of text.matchAll(/(['"`])([\u4e00-\u9fff][^'"`\n]{0,80}?)\1/g)) {
      const value = m[2].trim();
      if (cjk.test(value) && value.length >= 2) literals.add(value);
    }
  }
  return literals;
}

test('zh and en dictionaries define exactly the same keys', () => {
  const missingInEn = [...zhKeys].filter(k => !enKeys.has(k));
  const missingInZh = [...enKeys].filter(k => !zhKeys.has(k));
  assert.deepEqual(missingInEn, [], `en 词典缺少：${missingInEn.join(', ')}`);
  assert.deepEqual(missingInZh, [], `zh 词典缺少：${missingInZh.join(', ')}`);
});

test('no translation maps to an empty string', () => {
  // walk() 命中词典后会用译文替换原文，空串会把界面文字抹掉。
  const empties = [];
  const pattern = /^\s*'((?:[^'\\]|\\.)*)'\s*:\s*''/gm;
  let m;
  pattern.lastIndex = 0;
  while ((m = pattern.exec(enBlock)) !== null) empties.push(m[1]);
  assert.deepEqual(empties, [], `以下条目的英文译文为空串：${empties.join(', ')}`);
});

test('common failure prefixes are registered for translation', () => {
  // 源码里的错误提示普遍是 「XX失败：」+ 具体原因 的形式，
  // 与不带冒号的短词属于不同字符串，必须分别登记。
  const prefixes = [
    '保存失败：', '删除失败：', '操作失败：', '登录失败：', '发布失败：',
    '上传失败：', '举报失败：', '注册失败：', '回复失败：', '添加失败：',
    '发送失败：', '编辑失败：', '加载失败：',
  ];
  const missing = prefixes.filter(k => !zhKeys.has(k));
  assert.deepEqual(missing, [], `以下错误提示前缀未登记，切英文后仍显示中文：${missing.join(', ')}`);
});

test('confirmation dialogs and form validation are registered', () => {
  const required = [
    '确定要退出吗？',
    '确定要删除这条帖子吗？',
    '确定要删除这条回复吗？',
    '密码至少6位',
    '验证码错误，请重新计算',
    '请输入论坛名称',
    '请填写回复内容',
    '松开上传',
    '暂无消息',
    '未知',
    '匿名用户',
  ];
  const missing = required.filter(k => !zhKeys.has(k));
  assert.deepEqual(missing, [], `以下文案未登记翻译：${missing.join(', ')}`);
});

test('interface copy coverage is above the required floor', () => {
  const literals = collectChineseLiterals();
  const uncovered = [...literals].filter(lit => !zhKeys.has(lit));

  // 允许少量无法静态登记的动态拼接串，但整体覆盖率必须保持在
  // 高水位，防止再次出现大批文案漏登记的情况。
  const coverage = 1 - uncovered.length / Math.max(literals.size, 1);
  assert.ok(
    coverage >= 0.9,
    `界面中文文案覆盖率 ${(coverage * 100).toFixed(1)}% 低于 90%；未登记：${uncovered.join(' | ')}`
  );
});
