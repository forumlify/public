// ============================================================
//  🔐 认证
// ============================================================

// 三个认证表单的提交拦截。
// 输入框与按钮原本裸放在 div 中（页面没有 form 标签），密码管理器因此
// 找不到表单边界，会靠启发式猜测把首页搜索框也当成账号字段填入。
// 现改用真正的 <form> 包裹，需要拦下默认提交行为——否则按回车或点按钮
// 会触发浏览器原生提交导致页面刷新。
['loginForm', 'registerForm', 'forgotPasswordForm'].forEach(id => {
  const form = document.getElementById(id);
  if (form) form.addEventListener('submit', e => e.preventDefault());
});

// 登录事件绑定
document.getElementById('loginBtn').addEventListener('click', () => {
  document.getElementById('loginModal').classList.add('active');
});

document.getElementById('loginSubmit').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showToast('请填写完整信息', 'warning'); return; }
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
    showToast('登录失败：' + err.message, 'error');
  }
});

// 注册事件绑定
document.getElementById('registerBtn').addEventListener('click', () => {
  refreshCaptcha('reg');
  syncBootstrapTokenField();
  syncEmailCodeField();
  document.getElementById('registerModal').classList.add('active');
});

// 邮箱验证码字段：仅在站点开启邮箱验证且 SMTP 可用时显示。
// 显隐通过切换类名完成，布局交给 CSS——直接改 style.display 会覆盖
// 掉保证输入框与按钮并排的 flex 布局。
async function syncEmailCodeField() {
  const row = document.getElementById('regEmailCodeRow');
  const field = document.getElementById('regEmailCode');
  if (!row || !field) return;
  try {
    const settings = await API.getSettings();
    const required = settings.email_verify_required === true;
    row.classList.toggle('is-visible', required);
    if (!required) field.value = '';
  } catch (err) {
    // 取不到设置时按「不需要」处理，避免用户卡在无法完成的注册流程上
    row.classList.remove('is-visible');
    field.value = '';
  }
}

// 发送邮箱验证码，含 60 秒倒计时防止连点
(function bindSendCodeButton() {
  const btn = document.getElementById('regSendCodeBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const email = document.getElementById('regEmail').value.trim();
    if (!email) { showToast('请先填写邮箱', 'warning'); return; }

    btn.disabled = true;
    try {
      await API.sendRegisterCode(email);
      showToast('验证码已发送，请查收邮件', 'success');

      let remain = 60;
      btn.textContent = remain + 's';
      const timer = setInterval(() => {
        remain -= 1;
        if (remain <= 0) {
          clearInterval(timer);
          btn.disabled = false;
          btn.textContent = '获取验证码';
        } else {
          btn.textContent = remain + 's';
        }
      }, 1000);
    } catch (err) {
      btn.disabled = false;
      showToast(err.message, 'error');
    }
  });
})();

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
  const codeField = document.getElementById('regEmailCode');
  const codeRow = document.getElementById('regEmailCodeRow');
  // 以容器的 is-visible 类判断该字段是否启用，而不是读 style.display
  const codeEnabled = Boolean(codeRow && codeRow.classList.contains('is-visible'));
  const emailCode = codeEnabled && codeField ? codeField.value.trim() : '';
  const captchaInput = document.getElementById('regCaptchaInput').value.trim();
  const captchaAnswer = parseInt(document.getElementById('regCaptchaInput').dataset.answer);
  if (!username || !email || !password) { showToast('请填写完整信息', 'warning'); return; }
  if (password.length < 6) { showToast('密码至少6位', 'warning'); return; }
  if (codeEnabled && !emailCode) {
    showToast('请输入邮箱验证码', 'warning'); return;
  }
  if (parseInt(captchaInput) !== captchaAnswer) { showToast('验证码错误，请重新计算', 'error'); refreshCaptcha('reg'); return; }
  try {
    await API.register(email, password, username, bootstrapToken, emailCode);
  } catch (err) {
    showToast('注册失败：' + err.message, 'error');
    return;
  }

  closeModal(document.getElementById('registerModal'));
  document.getElementById('regUsername').value = '';
  document.getElementById('regEmail').value = '';
  document.getElementById('regPassword').value = '';
  if (bootstrapField) bootstrapField.value = '';
  if (codeField) codeField.value = '';
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
    showToast('注册成功，但自动登录失败，请手动登录：' + err.message, 'error');
    return;
  }

  try {
    const recoveryData = await API.generateRecoveryCodes();
    if (recoveryData.codes?.length) {
      showRecoveryCodesModal(recoveryData.codes);
    }
  } catch (err) {
    console.warn('恢复码生成失败:', err);
    showToast('注册并登录成功，但恢复码生成失败。请稍后在设置中重新生成。', 'error');
  }
});

document.getElementById('regCaptchaQuestion').addEventListener('click', function() {
  refreshCaptcha('reg');
});

// 退出
document.getElementById('logoutBtn').addEventListener('click', async () => {
  const ok = await showConfirm('确定要退出吗？', {
    title: '退出登录', confirmText: '退出',
  });
  if (!ok) return;
  await API.logout();
  currentUser = null;
  renderNav();
  document.querySelectorAll('.page-slide').forEach(el => el.classList.remove('active'));
  switchPage('feed');
});
