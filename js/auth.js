// ============================================================
//  🔐 认证
// ============================================================

// 登录事件绑定
document.getElementById('loginBtn').addEventListener('click', () => {
  document.getElementById('loginModal').classList.add('active');
});

document.getElementById('loginSubmit').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { alert('请填写完整信息'); return; }
  try {
    const result = await API.login(email, password);
    closeModal(document.getElementById('loginModal'));
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    if (result.user) {
      currentUser = result.user;
      renderNav();
      if (currentPage === 'admin' && currentUser.role !== 'admin') {
        switchPage('feed');
      } else if (currentPage === 'feed') {
        renderFeed();
        renderStats();
      }
    }
  } catch (err) {
    alert('登录失败：' + err.message);
  }
});

// 注册事件绑定
document.getElementById('registerBtn').addEventListener('click', () => {
  refreshCaptcha('reg');
  syncBootstrapTokenField();
  document.getElementById('registerModal').classList.add('active');
});

// 管理员初始化令牌输入框仅在首次部署且配置了引导令牌时出现。
// 其余情况（普通部署、已初始化完成）普通用户完全看不到它。
async function syncBootstrapTokenField() {
  const field = document.getElementById('regBootstrapToken');
  if (!field) return;
  try {
    const settings = await API.getSettings();
    const required = settings.bootstrap_required === true;
    field.style.display = required ? '' : 'none';
    if (!required) field.value = '';
  } catch (err) {
    // 取不到设置时按「不需要」处理，避免把内部机制暴露给普通用户。
    field.style.display = 'none';
    field.value = '';
  }
}

document.getElementById('registerSubmit').addEventListener('click', async () => {
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const bootstrapField = document.getElementById('regBootstrapToken');
  // 字段被隐藏时视为未提供，避免普通注册误传空串触发后端的令牌校验分支。
  const bootstrapToken = bootstrapField && bootstrapField.style.display !== 'none'
    ? bootstrapField.value.trim()
    : '';
  const captchaInput = document.getElementById('regCaptchaInput').value.trim();
  const captchaAnswer = parseInt(document.getElementById('regCaptchaInput').dataset.answer);
  if (!username || !email || !password) { alert('请填写完整信息'); return; }
  if (password.length < 6) { alert('密码至少6位'); return; }
  if (parseInt(captchaInput) !== captchaAnswer) { alert('验证码错误，请重新计算'); refreshCaptcha('reg'); return; }
  try {
    await API.register(email, password, username, bootstrapToken);
  } catch (err) {
    alert('注册失败：' + err.message);
    return;
  }

  closeModal(document.getElementById('registerModal'));
  document.getElementById('regUsername').value = '';
  document.getElementById('regEmail').value = '';
  document.getElementById('regPassword').value = '';
  if (bootstrapField) bootstrapField.value = '';
  document.getElementById('regCaptchaInput').value = '';

  try {
    await API.login(email, password);
    currentUser = await API.getMe();
    renderNav();

    if (currentPage === 'admin' && currentUser.role !== 'admin') {
      switchPage('feed');
    } else if (currentPage === 'feed') {
      renderFeed();
      renderStats();
    }
  } catch (err) {
    alert('注册成功，但自动登录失败，请手动登录：' + err.message);
    return;
  }

  try {
    const recoveryData = await API.generateRecoveryCodes();
    if (recoveryData.codes?.length) {
      showRecoveryCodesModal(recoveryData.codes);
    }
  } catch (err) {
    console.warn('恢复码生成失败:', err);
    alert('注册并登录成功，但恢复码生成失败。请稍后在设置中重新生成。');
  }
});

document.getElementById('regCaptchaQuestion').addEventListener('click', function() {
  refreshCaptcha('reg');
});

// 退出
document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (!confirm('确定要退出吗？')) return;
  await API.logout();
  currentUser = null;
  renderNav();
  document.querySelectorAll('.page-slide').forEach(el => el.classList.remove('active'));
  switchPage('feed');
});
