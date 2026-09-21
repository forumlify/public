// ============================================================
//  🚀 主入口
// ============================================================

let currentUser = null;

// ============================================================
//  带出场动画的关闭
// ============================================================
// .modal 与 .dropdown-menu 的默认状态是 display:none，直接移除类名会让
// 元素瞬间消失，CSS 动画没有机会播放。这里先挂上 .closing 播放收起
// 动画，等 animationend 再移除类名恢复默认状态。
//
// 用 requestAnimationFrame 等待样式生效后再挂类，避免元素在同一帧内
// 被移除而跳过动画；animationend 同时兜底超时，防止动画未触发时卡住。

const CLOSING_CLASS = 'closing';
const CLOSE_FALLBACK_MS = 260;

function closeWithAnimation(el, className) {
  if (!el || !el.classList.contains(className)) return;
  // 已经在收起过程中则忽略重复调用
  if (el.classList.contains(CLOSING_CLASS)) return;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.classList.remove(CLOSING_CLASS);
    el.classList.remove(className);
    el.removeEventListener('animationend', onEnd);
  };
  const onEnd = event => {
    if (event.target === el) finish();
  };

  el.addEventListener('animationend', onEnd);
  // 元素不可见（无动画）或动画被浏览器跳过时兜底
  const fallback = setTimeout(finish, CLOSE_FALLBACK_MS);

  requestAnimationFrame(() => {
    // 若期间元素被重新打开（类名已被移除），取消本次关闭，
    // 否则会把 .closing 挂到一个本应显示的弹窗上。
    if (!el.classList.contains(className) || finished) {
      clearTimeout(fallback);
      el.removeEventListener('animationend', onEnd);
      return;
    }
    el.classList.add(CLOSING_CLASS);
  });
}

const closeModal = el => closeWithAnimation(el, 'active');
const closeDropdown = el => closeWithAnimation(el, 'show');

// ============================================================
//  确认对话框
// ============================================================
// 替代浏览器原生 confirm()：原生弹窗样式无法定制、会阻塞渲染线程，
// 在移动端尤其突兀。这里返回 Promise<boolean>，配合 await 使用：
//
//   if (!await showConfirm('确定删除吗？')) return;
//
// 支持 Esc 取消、点击遮罩取消、危险操作红色按钮，并复用模态框的
// 进出场动画。

function showConfirm(message, options = {}) {
  const {
    title = '请确认',
    confirmText = '确定',
    cancelText = '取消',
    danger = false,
  } = options;

  return new Promise(resolve => {
    let settled = false;
    const modal = document.createElement('div');
    modal.className = 'modal confirm-modal';

    // 用 textContent 而非模板字符串拼接，避免消息里的特殊字符被当作 HTML
    modal.innerHTML = `
      <div class="modal-content" style="max-width:380px;">
        <h2 class="confirm-title"></h2>
        <p class="confirm-message"></p>
        <div class="confirm-actions">
          <button class="btn-secondary confirm-cancel" type="button"></button>
          <button class="btn-primary confirm-ok" type="button"></button>
        </div>
      </div>
    `;

    modal.querySelector('.confirm-title').textContent = title;
    modal.querySelector('.confirm-message').textContent = message;
    modal.querySelector('.confirm-cancel').textContent = cancelText;
    const okBtn = modal.querySelector('.confirm-ok');
    okBtn.textContent = confirmText;
    if (danger) okBtn.classList.add('btn-danger-solid');

    document.body.appendChild(modal);

    const cleanup = () => {
      document.removeEventListener('keydown', onKey);
      closeModal(modal);
      // 等出场动画结束再移除节点，与 closeWithAnimation 的兜底时长一致
      setTimeout(() => modal.remove(), 300);
    };

    const settle = value => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        settle(false);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        settle(true);
      }
    };

    okBtn.addEventListener('click', () => settle(true));
    modal.querySelector('.confirm-cancel').addEventListener('click', () => settle(false));

    // 点击遮罩（内容区之外）视为取消
    modal.addEventListener('click', event => {
      if (event.target === modal) settle(false);
    });

    document.addEventListener('keydown', onKey);

    // 下一帧再加 .active，确保入场动画能播放
    requestAnimationFrame(() => {
      modal.classList.add('active');
      okBtn.focus();
    });
  });
}

function showToast(message, type = 'success', duration = 3000) {
  // 移除已有 toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast ' + type;

  const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>`
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.success}</span>
    ${escapeHTML(message)}
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}
let currentPage = 'feed';
let currentPageNum = 1;

function renderNav() {
  const authBtns = document.getElementById('authButtons');
  const userDropdown = document.getElementById('userDropdown');
  if (currentUser) {
    authBtns.style.display = 'none';
    userDropdown.style.display = 'block';
    document.getElementById('avatarImg').src = currentUser.avatar_url ||
      'https://ui-avatars.com/api/?name=U&background=6366f1&color=fff';
    document.getElementById('adminEntry').style.display = currentUser.role === 'admin' ? 'block' : 'none';
    updateUnreadBadge();
  } else {
    authBtns.style.display = 'flex';
    userDropdown.style.display = 'none';
  }
}

async function loadForumName() {
  try {
    const data = await API.getSettings();
    const name = data.forum_name || CONFIG.FORUM_NAME || 'Forumlify';
    document.getElementById('forumName').textContent = name;
    document.title = name;
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = name;
  } catch (e) {
    const name = CONFIG.FORUM_NAME || 'Forumlify';
    document.getElementById('forumName').textContent = name;
    document.title = name;
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = name;
  }
}

function switchPage(page, param) {
  const url = new URL(window.location);

  if (page === 'user' && param) {
    url.searchParams.set('user', param);
    url.searchParams.delete('page');
    url.searchParams.delete('post');
    window.history.pushState({ page: 'user', username: param }, '', url);
    showUserPage(param);
    return;
  }

  if (page === 'post' && param) {
    url.searchParams.set('post', param);
    url.searchParams.delete('page');
    url.searchParams.delete('user');
    window.history.pushState({ page: 'post', postId: param }, '', url);
    showPostPage(param);
    return;
  }

  if (page === 'custom' && param) {
    url.searchParams.set('custom', param);
    url.searchParams.delete('page');
    url.searchParams.delete('post');
    url.searchParams.delete('user');
    window.history.pushState({ page: 'custom', custom: param }, '', url);
    showCustomPage(param);
    return;
  }

  if (page === 'feed') {
    url.searchParams.delete('page');
    url.searchParams.delete('post');
    url.searchParams.delete('user');
    url.searchParams.delete('custom');
  } else {
    url.searchParams.set('page', page);
    url.searchParams.delete('post');
    url.searchParams.delete('user');
    url.searchParams.delete('custom');
  }
  window.history.pushState({ page: page }, '', url);

  document.getElementById('app').style.display = 'none';
  document.querySelectorAll('.page-slide').forEach(el => {
    el.classList.remove('active', 'slide-out');
  });

  const customContainer = document.getElementById('customPageContainer');
  if (customContainer) {
    customContainer.classList.remove('active');
    customContainer.style.display = 'none';
  }

  if (page === 'feed') {
    document.getElementById('app').style.display = 'flex';
    currentPage = 'feed';
    renderFeed();
    renderStats();
    renderLinks();
    return;
  }

  const pageMap = {
    messages: 'pageMessages',
    settings: 'pageSettings',
    admin: 'pageAdmin',
    new: 'pageNew'
  };
  const el = document.getElementById(pageMap[page]);
  if (el) {
    el.classList.add('active');
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';
    currentPage = page;

    if (page === 'admin') {
      document.querySelectorAll('.admin-tab').forEach((t, i) => {
        t.classList.toggle('active', i === 0);
      });
      renderAdminReports();
    }
    if (page === 'settings') {
      renderSettingsPage('profile');
    }
    if (page === 'messages') {
      renderMessagesPage();
    }
    if (page === 'new') {
      document.getElementById('postTitle').value = '';
      document.getElementById('postContent').value = '';
      clearSelectedImages();
      document.getElementById('fileInput').value = '';
      document.getElementById('postCaptchaInput').value = '';
      refreshCaptcha('post');
      const dropText = document.getElementById('dropZoneText');
      if (dropText) dropText.textContent = '点击或拖拽上传图片';
    }
  }
}

// ============================================================
//  ✉️ 私信系统
// ============================================================

let currentChatUserId = null;
let currentChatUsername = null;
let currentConversationId = null;
let messagePollInterval = null;

async function updateUnreadBadge() {
  const badge = document.getElementById('messageBadge');
  if (!badge || !currentUser) return;
  try {
    const conversations = await API.getConversations();
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    if (totalUnread > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {}
}

function openMessageList() {
  document.getElementById('messageListModal').classList.add('active');
  renderMessageList();
}

function closeMessageList() {
  closeModal(document.getElementById('messageListModal'));
  if (messagePollInterval) {
    clearInterval(messagePollInterval);
    messagePollInterval = null;
  }
}

async function renderMessageList() {
  const container = document.getElementById('messageListContent');
  container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">加载中...</div>';

  try {
    const conversations = await API.getConversations();
    if (conversations.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">暂无私信</div>';
      return;
    }
    let html = '';
    conversations.forEach(c => {
      const unread = c.unread_count || 0;
      const lastMsg = c.last_message || '暂无消息';
      const time = c.last_message_time ? new Date(c.last_message_time).toLocaleString('zh-CN') : '';
      const avatar = c.other_avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.other_username) + '&background=6366f1&color=fff&size=64';
      html += `
        <div class="message-list-item" data-conversation-id="${escapeHTML(c.id)}" data-user-id="${escapeHTML(c.other_user_id)}" data-username="${escapeHTML(c.other_username)}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s;">
          <img src="${escapeHTML(safeURL(avatar, { image: true }))}"
               style="width:40px;height:40px;border-radius:50%;object-fit:cover;" />
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:600;">${escapeHTML(c.other_username)}</span>
              <span style="font-size:12px;color:var(--text-light);">${time}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:13px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${escapeHTML(lastMsg)}</span>
              ${unread > 0 ? `<span style="background:#ef4444;color:#fff;border-radius:50%;padding:2px 8px;font-size:11px;font-weight:600;">${unread}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = sanitizeHTML(html);
    container.querySelectorAll('.message-list-item').forEach(item => {
      item.addEventListener('click', function() {
        openChat(this.dataset.conversationId, this.dataset.userId, this.dataset.username);
      });
    });
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:20px 0;">加载失败</div>';
  }
}

function openChat(conversationId, otherUserId, otherUsername) {
  currentConversationId = conversationId;
  currentChatUserId = otherUserId;
  currentChatUsername = otherUsername;

  document.getElementById('chatModal').classList.add('active');
  document.getElementById('chatTitle').textContent = otherUsername;

  renderMessages(conversationId);

  if (messagePollInterval) clearInterval(messagePollInterval);
  messagePollInterval = setInterval(() => {
    if (currentConversationId) {
      renderMessages(currentConversationId, true);
    }
  }, 3000);
}

function closeChat() {
  closeModal(document.getElementById('chatModal'));
  if (messagePollInterval) {
    clearInterval(messagePollInterval);
    messagePollInterval = null;
  }
  currentConversationId = null;
  currentChatUserId = null;
  currentChatUsername = null;
  updateUnreadBadge();
}

async function renderMessages(conversationId, silent = false) {
  const container = document.getElementById('chatMessages');
  if (!silent) {
    container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">加载中...</div>';
  }

  try {
    const messages = await API.getMessages(conversationId);
    if (messages.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">还没有消息，打个招呼吧</div>';
      return;
    }
    let html = '';
    messages.forEach(m => {
      const isMine = m.sender_id === currentUser.id;
      const time = m.created_at ? new Date(m.created_at).toLocaleString('zh-CN') : '';
      const avatar = m.sender_avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(m.sender_username) + '&background=6366f1&color=fff&size=64';
      html += `
        <div style="display:flex;${isMine ? 'justify-content:flex-end;' : 'justify-content:flex-start;'} margin-bottom:12px;">
          ${!isMine ? `<img src="${escapeHTML(safeURL(avatar, { image: true }))}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;margin-right:8px;flex-shrink:0;" />` : ''}
          <div style="max-width:70%;">
            <div style="background:${isMine ? 'var(--primary)' : 'var(--surface)'};color:${isMine ? '#fff' : 'var(--text)'};padding:10px 14px;border-radius:12px;border:${isMine ? 'none' : '1px solid var(--border)'};word-break:break-word;">
              ${renderPlainText(m.content)}
            </div>
            <div style="font-size:11px;color:var(--text-light);margin-top:4px;${isMine ? 'text-align:right;' : ''}">
              ${time} ${isMine ? (m.is_read ? '✓✓' : '✓') : ''}
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = sanitizeHTML(html);
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    if (!silent) {
      container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:20px 0;">加载失败</div>';
    }
  }
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content || !currentConversationId) return;

  try {
    await API.sendMessage(currentConversationId, content);
    input.value = '';
    renderMessages(currentConversationId);
    updateUnreadBadge();
    if (document.getElementById('messageListModal').classList.contains('active')) {
      renderMessageList();
    }
  } catch (err) {
    showToast('发送失败：' + err.message, 'error');
  }
}

async function openPrivateChat(otherUserId, otherUsername) {
  try {
    const result = await API.getOrCreateConversation(otherUserId);
    currentConversationId = result.id;
    currentChatUserId = otherUserId;
    currentChatUsername = otherUsername;

    document.getElementById('chatModal').classList.add('active');
    document.getElementById('chatTitle').textContent = otherUsername;

    renderMessages(currentConversationId);

    if (messagePollInterval) clearInterval(messagePollInterval);
    messagePollInterval = setInterval(() => {
      if (currentConversationId) {
        renderMessages(currentConversationId, true);
      }
    }, 3000);
  } catch (err) {
    showToast('打开私信失败：' + err.message, 'error');
  }
}

// ============================================================
//  📸 图片上传（拖拽上传）
// ============================================================

let selectedImageFiles = [];

function clearSelectedImages() {
  selectedImageFiles.forEach(entry => URL.revokeObjectURL(entry.previewUrl));
  selectedImageFiles = [];
  const preview = document.getElementById('imagePreview');
  if (preview) preview.innerHTML = '';
}

function handleImageFiles(files) {
  const preview = document.getElementById('imagePreview');
  if (!preview) return;

  for (const file of files) {
    if (selectedImageFiles.length >= 6) {
      showToast('每篇帖子最多上传 6 张图片', 'warning');
      break;
    }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      showToast('图片 ' + file.name + ' 格式不支持', 'error');
      continue;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片 ' + file.name + ' 超过 5MB，请压缩后上传', 'warning');
      continue;
    }

    const entry = { file, previewUrl: URL.createObjectURL(file) };
    selectedImageFiles.push(entry);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;width:80px;height:80px;';
    const img = document.createElement('img');
    img.src = entry.previewUrl;
    img.alt = file.name;
    img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid var(--border);';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', '移除 ' + file.name);
    remove.style.cssText = 'position:absolute;top:2px;right:2px;width:22px;height:22px;border:0;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;cursor:pointer;';
    remove.addEventListener('click', () => {
      selectedImageFiles = selectedImageFiles.filter(item => item !== entry);
      URL.revokeObjectURL(entry.previewUrl);
      wrapper.remove();
    });
    wrapper.append(img, remove);
    preview.appendChild(wrapper);
  }

  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';
}

// ============================================================
//  📄 自定义页面导航
// ============================================================

let customPagesNav = [];

async function loadCustomPagesNav() {
  try {
    const pages = await API.getCustomPages();
    customPagesNav = pages;
    renderCustomPagesNav();
  } catch (e) {
    customPagesNav = [];
  }
}

function renderCustomPagesNav() {
  const container = document.getElementById('customNavLinks');
  if (!container) return;
  container.innerHTML = '';

  customPagesNav.forEach(page => {
    const link = document.createElement('a');
    link.href = '#';
    link.dataset.custom = page.name;
    link.textContent = page.title;
    link.style.cssText = 'color:var(--text-secondary);text-decoration:none;font-size:14px;padding:4px 10px;border-radius:4px;transition:color 0.15s;';
    link.addEventListener('mouseenter', function() {
      this.style.color = 'var(--text)';
    });
    link.addEventListener('mouseleave', function() {
      this.style.color = 'var(--text-secondary)';
    });
    link.addEventListener('click', function(e) {
      e.preventDefault();
      switchPage('custom', page.name);
    });
    container.appendChild(link);
  });
}

// ============================================================
//  📄 自定义页面渲染
// ============================================================

function showCustomPage(pageName) {
  document.getElementById('app').style.display = 'none';
  document.querySelectorAll('.page-slide').forEach(el => {
    el.classList.remove('active', 'slide-out');
  });

  let container = document.getElementById('customPageContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'customPageContainer';
    container.className = 'page-slide';
    container.style.cssText = 'display:none;position:fixed;inset:0;background:var(--bg);z-index:50;padding:84px 32px 40px;overflow-y:auto;transition:background 0.2s;';
    document.body.appendChild(container);
  }

  container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">加载中...</div>';
  container.classList.add('active');
  container.style.display = 'block';
  currentPage = 'custom';

  API.getCustomPage(pageName).then(page => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;min-height:70vh;border:none;border-radius:8px;background:var(--surface);';
    iframe.sandbox = 'allow-scripts allow-modals allow-top-navigation allow-same-origin allow-popups';
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 24px;
            background: var(--bg, #f6f8fc);
            color: var(--text, #0a0e1a);
          }
          @media (prefers-color-scheme: dark) {
            body { background: #0f1117; color: #e8edf5; }
          }
        </style>
        ${page.content}
      </head>
      <body></body>
      </html>
    `;
    container.innerHTML = '';
    container.appendChild(iframe);

    document.querySelectorAll('.custom-page-nav-link').forEach(el => {
      el.style.color = el.dataset.custom === pageName ? 'var(--primary)' : 'var(--text-secondary)';
    });
  }).catch(err => {
    container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:40px 0;">页面加载失败：' + escapeHTML(err.message) + '</div>';
  });
}

// ============================================================
//  📩 消息页面
// ============================================================

async function renderMessagesPage() {
  const container = document.getElementById('messagesContent');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">加载中...</div>';

  try {
    const notifications = await apiFetch('/notifications');
    if (notifications.error) throw new Error(notifications.error);

    if (notifications.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;color:#94a3b8;padding:60px 0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 16px;display:block;color:#94a3b8;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <p style="font-size:16px;">暂无消息</p>
          <p style="font-size:13px;">当有人回复你的帖子或处理你的举报时，会在这里通知你</p>
        </div>
      `;
      return;
    }

    await apiFetch('/notifications/read-all', { method: 'PUT' });

    let html = '';
    const typeMap = {
      reply: getIcon('message'),
      post_deleted: getIcon('delete'),
      report_handled: getIcon('shield'),
      system: getIcon('megaphone')
    };
    notifications.forEach(n => {
      const icon = typeMap[n.type] || getIcon('pin');
      const time = n.created_at ? new Date(n.created_at).toLocaleString('zh-CN') : '';
      html += `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border-light);background:var(--surface);border-radius:6px;margin-bottom:6px;">
          <span style="font-size:20px;display:inline-flex;align-items:center;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;">${escapeHTML(n.title)}</div>
            <div style="color:var(--text-secondary);font-size:13px;margin-top:2px;">${escapeHTML(n.content)}</div>
            ${n.link ? `<a href="${escapeHTML(safeURL(n.link))}" style="color:var(--primary);font-size:13px;text-decoration:none;margin-top:4px;display:inline-block;">查看详情 →</a>` : ''}
            <div style="font-size:12px;color:var(--text-light);margin-top:4px;">${time}</div>
          </div>
        </div>
      `;
    });
    container.innerHTML = sanitizeHTML(html);
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:20px 0;">加载失败</div>';
  }
}

// ============================================================
//  📊 统计数据
// ============================================================

function renderStats() {
  API.getStats().then(stats => {
    // 主页的统计
    const topicsEl = document.getElementById('statTopics');
    const postsEl = document.getElementById('statPosts');
    const usersEl = document.getElementById('statUsers');
    if (topicsEl) topicsEl.textContent = stats.topics || 0;
    if (postsEl) postsEl.textContent = stats.posts || 0;
    if (usersEl) usersEl.textContent = stats.users || 0;

    // 帖子详情页的统计（ID 带 2）
    const topics2El = document.getElementById('statTopics2');
    const posts2El = document.getElementById('statPosts2');
    const users2El = document.getElementById('statUsers2');
    if (topics2El) topics2El.textContent = stats.topics || 0;
    if (posts2El) posts2El.textContent = stats.posts || 0;
    if (users2El) users2El.textContent = stats.users || 0;
  }).catch(() => {});
}

// ============================================================
//  🔗 友情链接
// ============================================================

function renderLinks() {
  API.getLinks().then(links => {
    // 主页的友链
    const ul = document.getElementById('friendlyLinks');
    if (ul) {
      if (!links || links.length === 0) {
        ul.innerHTML = '<li style="color:#94a3b8;font-size:13px;">暂无链接</li>';
      } else {
        let html = '';
        links.forEach(l => {
          html += '<li><a href="' + escapeHTML(safeURL(l.url, { allowRelative: false })) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(l.title) + '</a></li>';
        });
        ul.innerHTML = sanitizeHTML(html);
      }
    }

    // 帖子详情页的友链
    const ul2 = document.getElementById('friendlyLinks2');
    if (ul2) {
      if (!links || links.length === 0) {
        ul2.innerHTML = '<li style="color:#94a3b8;font-size:13px;">暂无链接</li>';
      } else {
        let html = '';
        links.forEach(l => {
          html += '<li><a href="' + escapeHTML(safeURL(l.url, { allowRelative: false })) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(l.title) + '</a></li>';
        });
        ul2.innerHTML = sanitizeHTML(html);
      }
    }
  }).catch(() => {});
}

// ============================================================
//  ⚙️ 设置页面（含侧边栏）
// ============================================================

let currentSettingsTab = 'profile';

async function renderSettingsPage(tab = 'profile') {
  const container = document.getElementById('settingsContent');
  if (!container) return;

  // 更新侧边栏高亮
  document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.settings-nav-item[data-settings-tab="${tab}"]`)?.classList.add('active');
  currentSettingsTab = tab;

  if (!currentUser) {
    container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">请先登录</div>';
    return;
  }

  const user = currentUser;

  try {
    const userPosts = await apiFetch('/posts?user_id=' + user.id);
    const postCount = userPosts.data ? userPosts.data.length : 0;

    let recoveryCount = 0;
    try {
      const countData = await API.getRecoveryCodesCount();
      recoveryCount = countData.count || 0;
    } catch (e) {}

    if (tab === 'profile') {
      container.innerHTML = `
        <h3 style="margin-bottom:16px;text-align:center;">${getIcon('user')} 个人资料</h3>

        <!-- 头像 -->
        <div style="text-align:center;margin-bottom:24px;">
          <div style="position:relative;display:inline-block;">
            <img id="avatarPreview" src="${escapeHTML(safeURL(user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.username) + '&background=6366f1&color=fff&size=128', { image: true }))}"
                 style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid var(--primary);" />
            <button id="avatarUploadBtn" style="position:absolute;bottom:0;right:0;background:var(--primary);color:#fff;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(99,102,241,0.4);">
              ${getIcon('camera')}
            </button>
          </div>
          <input type="file" id="avatarFileInput" accept="image/*" style="display:none;" />
          <h2 style="margin:12px 0 4px;">${escapeHTML(user.username)}</h2>
          <p style="color:var(--text-secondary);font-size:14px;">${escapeHTML(user.bio || '这个人很懒，什么都没写')}</p>
          <div style="display:flex;justify-content:center;gap:16px;margin-top:8px;font-size:13px;color:var(--text-secondary);flex-wrap:wrap;">
            <span>${getIcon('calendar')} 加入 ${user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '未知'}</span>
            <span>${getIcon('file')} ${postCount} 帖</span>
            ${user.role === 'admin' ? `<span style="color:var(--primary);font-weight:600;">${getIcon('shield')} 管理员</span>` : ''}
          </div>
          <div id="avatarUploadStatus" style="font-size:13px;margin-top:8px;"></div>
        </div>

        <!-- 基本资料 -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:20px;">
          <div style="margin-bottom:16px;">
            <label style="font-weight:600;font-size:14px;display:block;margin-bottom:4px;">用户名</label>
            <input type="text" id="settingsUsername" value="${escapeHTML(user.username)}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:14px;background:var(--bg);color:var(--text);" />
          </div>
          <div style="margin-bottom:16px;">
            <label style="font-weight:600;font-size:14px;display:block;margin-bottom:4px;">个人简介</label>
            <textarea id="settingsBio" rows="3" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:14px;background:var(--bg);color:var(--text);resize:vertical;">${escapeHTML(user.bio || '')}</textarea>
          </div>
          <div style="margin-bottom:16px;">
            <label style="font-weight:600;font-size:14px;display:block;margin-bottom:4px;">帖子签名</label>
            <textarea id="settingsSignature" rows="2" placeholder="显示在每篇帖子底部，支持 Markdown" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:13px;background:var(--bg);color:var(--text);resize:vertical;font-family:inherit;">${escapeHTML(user.signature || '')}</textarea>
            <div style="font-size:12px;color:var(--text-light);margin-top:2px;">用 --- 分隔，支持 Markdown</div>
          </div>
          <button id="settingsSaveBtn" class="btn-primary" style="width:100%;padding:10px;">保存设置</button>
        </div>
      `;

      // ===== 头像上传 =====
      const avatarBtn = document.getElementById('avatarUploadBtn');
      const avatarInput = document.getElementById('avatarFileInput');
      const avatarPreview = document.getElementById('avatarPreview');
      const statusEl = document.getElementById('avatarUploadStatus');

      if (avatarBtn && avatarInput) {
        avatarBtn.addEventListener('click', function() {
          avatarInput.click();
        });

        avatarInput.addEventListener('change', async function() {
          const file = this.files[0];
          if (!file) return;
          if (!file.type.startsWith('image/')) {
            showToast('请选择图片文件', 'error');
            return;
          }
          if (file.size > 5 * 1024 * 1024) {
            showToast('图片不能超过 5MB', 'error');
            return;
          }

          showToast('上传中...', 'warning');

          try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch(CONFIG.API_BASE_URL + '/upload', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('forumlify-token')
              },
              body: formData
            });
            const uploadData = await uploadRes.json();
            if (uploadData.error) throw new Error(uploadData.error);

            const avatarUrl = uploadData.url;

            const updateRes = await API.updateAvatar(user.id, avatarUrl);
            if (updateRes.error) throw new Error(updateRes.error);

            currentUser.avatar_url = avatarUrl;
            avatarPreview.src = avatarUrl;
            showToast('头像更新成功！', 'success');
            renderNav();

          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      }

      // ===== 保存设置（含签名） =====
      document.getElementById('settingsSaveBtn').addEventListener('click', async function() {
        const username = document.getElementById('settingsUsername').value.trim();
        const bio = document.getElementById('settingsBio').value.trim();
        const signature = document.getElementById('settingsSignature').value.trim();
        if (!username) { showToast('用户名不能为空', 'error'); return; }
        try {
          await API.updateProfile(user.id, username, bio, signature);
          currentUser.username = username;
          currentUser.bio = bio;
          currentUser.signature = signature;
          showToast('保存成功！', 'success');
          renderNav();
          renderSettingsPage('profile');
        } catch (err) {
          showToast('保存失败：' + err.message, 'error');
        }
      });
    }

    else if (tab === 'security') {
      container.innerHTML = `
        <h3 style="margin-bottom:16px;text-align:center;">${getIcon('lock')} 安全设置</h3>

        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:20px;">
          <h4 style="font-size:14px;margin-bottom:12px;">修改密码</h4>
          <div style="margin-bottom:12px;">
            <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px;">当前密码</label>
            <input type="password" id="changeOldPassword" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:14px;background:var(--bg);color:var(--text);" />
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px;">新密码</label>
            <input type="password" id="changeNewPassword" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:14px;background:var(--bg);color:var(--text);" />
          </div>
          <button id="changePasswordBtn" class="btn-secondary" style="padding:8px 16px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text);">修改密码</button>
          <div id="passwordChangeStatus" style="font-size:13px;margin-top:6px;color:var(--text-light);"></div>

          <div style="border-top:1px solid var(--border);margin:16px 0;"></div>

          <h4 style="font-size:14px;margin-bottom:12px;">修改邮箱</h4>
          <div style="margin-bottom:12px;">
            <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px;">当前密码（验证身份）</label>
            <input type="password" id="changeEmailPassword" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:14px;background:var(--bg);color:var(--text);" />
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px;">新邮箱</label>
            <input type="email" id="changeNewEmail" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:14px;background:var(--bg);color:var(--text);" />
          </div>
          <button id="changeEmailBtn" class="btn-secondary" style="padding:8px 16px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text);">修改邮箱</button>
          <div id="emailChangeStatus" style="font-size:13px;margin-top:6px;color:var(--text-light);"></div>
        </div>
      `;

      // ===== 修改密码 =====
      document.getElementById('changePasswordBtn').addEventListener('click', async function() {
        const oldPassword = document.getElementById('changeOldPassword').value;
        const newPassword = document.getElementById('changeNewPassword').value;
        const statusEl = document.getElementById('passwordChangeStatus');

        if (!oldPassword || !newPassword) {
          statusEl.textContent = '请填写完整信息';
          statusEl.style.color = '#ef4444';
          return;
        }
        if (newPassword.length < 6) {
          statusEl.textContent = '新密码至少6位';
          statusEl.style.color = '#ef4444';
          return;
        }

        try {
          await API.changePassword(oldPassword, newPassword);
          document.getElementById('changeOldPassword').value = '';
          document.getElementById('changeNewPassword').value = '';
          // getIcon 返回 SVG 标记，必须用 innerHTML 渲染，否则会把标签当纯文本打印。
          statusEl.innerHTML = getIcon('success') + ' 密码修改成功，正在返回首页…';
          statusEl.style.color = '#22c55e';
          // 服务端已补发新令牌（见 API.changePassword），本次登录保持有效。
          setTimeout(() => switchPage('feed'), 800);
        } catch (err) {
          statusEl.innerHTML = getIcon('error') + ' ' + escapeHTML(err.message);
          statusEl.style.color = '#ef4444';
        }
      });

      // ===== 修改邮箱 =====
      document.getElementById('changeEmailBtn').addEventListener('click', async function() {
        const password = document.getElementById('changeEmailPassword').value;
        const newEmail = document.getElementById('changeNewEmail').value;
        const statusEl = document.getElementById('emailChangeStatus');

        if (!password || !newEmail) {
          statusEl.textContent = '请填写完整信息';
          statusEl.style.color = '#ef4444';
          return;
        }

        try {
          await API.changeEmail(password, newEmail);
          document.getElementById('changeEmailPassword').value = '';
          document.getElementById('changeNewEmail').value = '';
          statusEl.innerHTML = getIcon('success') + ' 邮箱修改成功，正在返回首页…';
          statusEl.style.color = '#22c55e';
          // 同上：令牌由服务端补发，保持登录状态。
          setTimeout(() => switchPage('feed'), 800);
        } catch (err) {
          statusEl.innerHTML = getIcon('error') + ' ' + escapeHTML(err.message);
          statusEl.style.color = '#ef4444';
        }
      });
    }

    else if (tab === 'recovery') {
      container.innerHTML = `
        <h3 style="margin-bottom:16px;text-align:center;">${getIcon('key')} 恢复码</h3>

        <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:20px;">
          <p style="font-size:14px;color:var(--text-secondary);margin-bottom:12px;">用于忘记密码时重置账户。每个恢复码只能使用一次。</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button id="viewRecoveryCodesBtn" class="btn-secondary" style="padding:8px 16px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text);">${getIcon('list')} 查看恢复码</button>
            <button id="regenerateRecoveryCodesBtn" class="btn-secondary" style="padding:8px 16px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text);">${getIcon('refresh')} 重新生成</button>
          </div>
          <div id="recoveryCodesStatus" style="font-size:13px;color:var(--text-light);margin-top:8px;">剩余 ${recoveryCount} 个可用恢复码</div>
        </div>
      `;

      // ===== 恢复码管理 =====
      const viewBtn = document.getElementById('viewRecoveryCodesBtn');
      const regenBtn = document.getElementById('regenerateRecoveryCodesBtn');
      const recoveryStatus = document.getElementById('recoveryCodesStatus');

      if (viewBtn) {
        viewBtn.addEventListener('click', async function() {
          try {
            const data = await API.generateRecoveryCodes();
            showRecoveryCodesModal(data.codes);
            const countData = await API.getRecoveryCodesCount();
            if (recoveryStatus) recoveryStatus.textContent = '剩余 ' + (countData.count || 0) + ' 个可用恢复码';
          } catch (err) {
            showToast('获取恢复码失败：' + err.message, 'error');
          }
        });
      }

      if (regenBtn) {
        regenBtn.addEventListener('click', async function() {
          const ok = await showConfirm('重新生成将替换所有旧的恢复码，确定继续吗？', {
            title: '重新生成恢复码',
            confirmText: '重新生成',
            danger: true,
          });
          if (!ok) return;
          try {
            const data = await API.generateRecoveryCodes();
            showRecoveryCodesModal(data.codes);
            const countData = await API.getRecoveryCodesCount();
            if (recoveryStatus) recoveryStatus.textContent = '剩余 ' + (countData.count || 0) + ' 个可用恢复码';
          } catch (err) {
            showToast('重新生成失败：' + err.message, 'error');
          }
        });
      }
    }

  } catch (err) {
    container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:20px 0;">加载失败</div>';
  }
}

// ============================================================
//  设置页面侧边栏切换
// ============================================================

document.querySelector('.settings-nav')?.addEventListener('click', function(e) {
  const tabLink = e.target.closest('.settings-nav-item');
  if (!tabLink) return;
  e.preventDefault();
  const tab = tabLink.dataset.settingsTab;
  if (!tab) return;
  renderSettingsPage(tab);
});

// ============================================================
//  ✏️ 编辑帖子模态框
// ============================================================

function openEditModal(postId, currentTitle, currentContent) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:600px;">
      <span class="close" style="position:absolute;top:12px;right:16px;font-size:24px;cursor:pointer;color:var(--text-light);">&times;</span>
      <h2 style="margin-bottom:16px;">${getIcon('edit')} 编辑帖子</h2>
      <input type="text" id="editPostTitle" value="${escapeHTML(currentTitle || '')}" placeholder="标题" style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:6px;font-size:15px;font-weight:600;margin-bottom:12px;font-family:inherit;background:var(--bg);color:var(--text);" />
      <textarea id="editPostContent" rows="6" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:6px;font-size:15px;font-family:inherit;resize:vertical;background:var(--bg);color:var(--text);">${escapeHTML(currentContent || '')}</textarea>
      <button id="editPostSaveBtn" class="btn-primary" style="padding:10px 24px;margin-top:12px;width:100%;">保存修改</button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.close').addEventListener('click', function() {
    modal.remove();
  });
  modal.addEventListener('click', function(e) {
    if (e.target === this) modal.remove();
  });

  modal.querySelector('#editPostSaveBtn').addEventListener('click', async function() {
    const title = document.getElementById('editPostTitle').value.trim() || '无标题';
    const content = document.getElementById('editPostContent').value.trim();
    if (!content) { showToast('请填写内容', 'warning'); return; }

    try {
      await API.updatePost(postId, title, content);
      modal.remove();
      if (currentPage === 'post') {
        renderPostDetail(currentPostId);
      } else {
        renderFeed();
      }
      showToast('编辑成功！', 'success');
    } catch (err) {
      showToast('编辑失败：' + err.message, 'error');
    }
  });
}

// ============================================================
//  🔑 恢复码显示模态框
// ============================================================

function showRecoveryCodesModal(codes) {
  let modal = document.getElementById('recoveryCodesModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'recoveryCodesModal';
    modal.className = 'modal active';
    modal.style.display = 'flex';
    document.body.appendChild(modal);
  }

  let codesHtml = '';
  codes.forEach((code, i) => {
    codesHtml += `
      <div style="display:flex;justify-content:space-between;padding:6px 12px;background:var(--bg);border-radius:4px;margin-bottom:4px;font-family:monospace;font-size:14px;letter-spacing:0.5px;">
        <span>${String(i + 1).padStart(2, '0')}.</span>
        <span>${code}</span>
      </div>
    `;
  });

  modal.innerHTML = `
    <div class="modal-content" style="max-width:480px;">
      <h2 style="margin-bottom:8px;">${getIcon('key')} 恢复码</h2>
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px;">
        请妥善保存以下恢复码。当你忘记密码时，可以使用它们重置密码。
        <strong style="color:#ef4444;">每个恢复码只能使用一次。</strong>
      </p>
      <div style="margin-bottom:16px;">${codesHtml}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="copyRecoveryCodesBtn" class="btn-secondary" style="padding:8px 16px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text);">${getIcon('list')} 复制全部</button>
        <button id="closeRecoveryCodesBtn" class="btn-primary" style="padding:8px 16px;">我已保存</button>
      </div>
      <div id="copyStatus" style="font-size:13px;margin-top:8px;color:var(--text-light);"></div>
    </div>
  `;

  modal.style.display = 'flex';
  modal.classList.add('active');

  document.getElementById('closeRecoveryCodesBtn').addEventListener('click', function() {
    modal.remove();
  });

  document.getElementById('copyRecoveryCodesBtn').addEventListener('click', function() {
    const text = codes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      document.getElementById('copyStatus').innerHTML = getIcon('success') + ' 已复制到剪贴板';
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      document.getElementById('copyStatus').innerHTML = getIcon('success') + ' 已复制到剪贴板';
    });
  });

  modal.addEventListener('click', function(e) {
    if (e.target === this) modal.remove();
  });
}

// ============================================================
//  🖼️ 图片查看器
// ============================================================

function openImageViewer(imageUrl) {
  const existing = document.getElementById('imageViewerModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'imageViewerModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;animation:fadeIn 0.2s ease-out;
  `;

  const img = document.createElement('img');
  img.src = imageUrl;
  img.style.cssText = `
    max-width:90vw;max-height:90vh;object-fit:contain;
    border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);
    cursor:default;user-select:none;
  `;

  modal.addEventListener('click', function(e) {
    if (e.target === this) {
      this.remove();
    }
  });

  modal.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') this.remove();
  });

  modal.appendChild(img);
  document.body.appendChild(modal);
  modal.focus();
}

// 添加淡入动画
(function() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
})();

// ============================================================
//  🚀 初始化
// ============================================================
async function init() {
  applyTheme();

  document.getElementById('forumName').textContent = CONFIG.FORUM_NAME || 'Forumlify';

  refreshCaptcha('reg');
  refreshCaptcha('post');
  refreshCaptcha('reply');

  if (token) {
    try {
      const user = await API.getMe();
      currentUser = user;

    } catch (e) {
      token = null;
      localStorage.removeItem('forumlify-token');
    }
  }
  renderNav();
  await loadForumName();
  await loadCustomPagesNav();
  renderStats();
  renderLinks();

  const urlParams = new URLSearchParams(window.location.search);
  const postParam = urlParams.get('post');
  const pageParam = urlParams.get('page');
  const userParam = urlParams.get('user');
  const postPageParam = urlParams.get('postpage');
  const customParam = urlParams.get('custom');

  if (postPageParam) {
    currentPageNum = parseInt(postPageParam) || 1;
  }

  if (customParam) {
    showCustomPage(customParam);
  } else if (userParam) {
    showUserPage(userParam);
  } else if (postParam) {
    showPostPage(postParam);
  } else if (pageParam && ['messages', 'settings', 'admin', 'new'].includes(pageParam)) {
    if (pageParam === 'admin' && currentUser?.role !== 'admin') {
      switchPage('feed');
    } else {
      switchPage(pageParam);
    }
  } else {
    switchPage('feed');
  }

  // ============================================================
  //  绑定所有事件
  // ============================================================

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme(e);
      closeDropdown(document.getElementById('dropdownMenu'));
    });
  }

  document.getElementById('avatarImg').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('dropdownMenu').classList.toggle('show');
  });
  document.addEventListener('click', function() {
    closeDropdown(document.getElementById('dropdownMenu'));
  });

  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      const page = this.dataset.page;
      if (page === 'admin' && currentUser?.role !== 'admin') {
        showToast('无权限访问', 'error');
        return;
      }
      closeDropdown(document.getElementById('dropdownMenu'));
      switchPage(page);
    });
  });

  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      switchPage('feed');
    });
  });

  document.getElementById('forumName').addEventListener('click', function() {
    switchPage('feed');
  });

  // ===== 忘记密码 =====
  const forgotLink = document.getElementById('forgotPasswordLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('forgotPasswordModal').classList.add('active');
      document.getElementById('resetStatus').textContent = '';
    });
  }

  document.getElementById('resetPasswordSubmit').addEventListener('click', async function() {
    const email = document.getElementById('resetEmail').value.trim();
    const code = document.getElementById('resetRecoveryCode').value.trim().toUpperCase();
    const newPassword = document.getElementById('resetNewPassword').value;
    const statusEl = document.getElementById('resetStatus');

    if (!email || !code || !newPassword) {
      statusEl.textContent = '请填写完整信息';
      statusEl.style.color = '#ef4444';
      return;
    }
    if (newPassword.length < 6) {
      statusEl.textContent = '密码至少6位';
      statusEl.style.color = '#ef4444';
      return;
    }

    try {
      await API.resetPassword(email, code, newPassword);
      statusEl.innerHTML = getIcon('success') + ' 重置成功！请登录';
      statusEl.style.color = '#22c55e';
      setTimeout(() => {
        closeModal(document.getElementById('forgotPasswordModal'));
        document.getElementById('resetEmail').value = '';
        document.getElementById('resetRecoveryCode').value = '';
        document.getElementById('resetNewPassword').value = '';
      }, 1500);
    } catch (err) {
      statusEl.innerHTML = getIcon('error') + ' ' + escapeHTML(err.message);
      statusEl.style.color = '#ef4444';
    }
  });

  // ===== 发帖 =====
  document.getElementById('fab').addEventListener('click', () => {
    if (!currentUser) { showToast('请先登录', 'warning'); return; }
    switchPage('new');
  });

  document.getElementById('postSubmit').addEventListener('click', async () => {
    if (!currentUser || !currentUser.id) {
      showToast('请先登录', 'warning');
      switchPage('feed');
      return;
    }
    const title = document.getElementById('postTitle').value.trim() || '无标题';
    const content = document.getElementById('postContent').value.trim();
    const captchaInput = document.getElementById('postCaptchaInput').value.trim();
    const captchaAnswer = parseInt(document.getElementById('postCaptchaInput').dataset.answer);
    if (!content) { showToast('请填写内容', 'warning'); return; }
    if (parseInt(captchaInput) !== captchaAnswer) { showToast('验证码错误，请重新计算', 'error'); refreshCaptcha('post'); return; }
    const submitButton = document.getElementById('postSubmit');
    submitButton.disabled = true;
    submitButton.textContent = selectedImageFiles.length ? '上传图片中...' : '发布中...';
    try {
      const images = [];
      for (const entry of selectedImageFiles) {
        const uploaded = await API.uploadImage(entry.file);
        images.push(uploaded.url);
      }
      await API.createPost(title, content, images);

      showToast('发布成功！', 'success');
      clearSelectedImages();
      switchPage('feed');
      renderFeed();
      renderStats();
    } catch (err) {
      showToast('发布失败：' + err.message, 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = '发布帖子';
    }
  });

  document.getElementById('postCaptchaQuestion').addEventListener('click', function() {
    refreshCaptcha('post');
  });
  document.getElementById('regCaptchaQuestion').addEventListener('click', function() {
    refreshCaptcha('reg');
  });

  // ===== 拖拽上传 =====
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const dropZoneText = document.getElementById('dropZoneText');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', function() {
      fileInput.click();
    });

    fileInput.addEventListener('change', function() {
      handleImageFiles(this.files);
    });

    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--primary)';
      this.style.background = 'var(--primary-bg)';
      if (dropZoneText) dropZoneText.textContent = '松开上传';
    });

    dropZone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--border)';
      this.style.background = 'var(--bg)';
      if (dropZoneText) dropZoneText.textContent = '点击或拖拽上传图片';
    });

    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--border)';
      this.style.background = 'var(--bg)';
      if (dropZoneText) dropZoneText.textContent = '点击或拖拽上传图片';
      handleImageFiles(e.dataTransfer.files);
    });
  }

  // ===== 举报 =====
  document.getElementById('reportSubmit').addEventListener('click', async () => {
    if (!reportTargetPostId) return;
    const reason = document.getElementById('reportReason').value;
    try {
      await API.createReport(reportTargetPostId, reason);
      closeModal(document.getElementById('reportModal'));
      showToast('举报已提交，管理员将尽快处理', 'success');
      reportTargetPostId = null;
    } catch (err) {
      showToast('举报失败：' + err.message, 'error');
    }
  });

  // ===== 模态框关闭 =====
  document.querySelectorAll('.modal .close').forEach(btn => {
    btn.addEventListener('click', function() {
      closeModal(document.getElementById(this.dataset.modal));
    });
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', function(e) {
      if (e.target === this) closeModal(this);
    });
  });

  // ===== 前进后退 =====
  window.addEventListener('popstate', function(e) {
    const state = e.state || {};
    const page = state.page || 'feed';
    const postId = state.postId || null;
    const username = state.username || null;
    const custom = state.custom || null;
    if (postId) {
      showPostPage(postId);
    } else if (username) {
      showUserPage(username);
    } else if (custom) {
      showCustomPage(custom);
    } else {
      switchPage(page);
    }
  });

  // ===== 私信按钮 =====
  const messageBtn = document.getElementById('messageBtn');
  if (messageBtn) {
    const newBtn = messageBtn.cloneNode(true);
    messageBtn.parentNode.replaceChild(newBtn, messageBtn);
    newBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!currentUser) { showToast('请先登录', 'warning'); return; }
      openMessageList();
    });
  }

  const closeMessageListBtn = document.querySelector('#messageListModal .close');
  if (closeMessageListBtn) {
    closeMessageListBtn.addEventListener('click', closeMessageList);
  }

  const closeChatBtn = document.querySelector('#chatModal .close');
  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', closeChat);
  }

  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', function(e) {
      if (e.target === this) {
        closeModal(this);
        if (this.id === 'messageListModal') {
          closeMessageList();
        }
        if (this.id === 'chatModal') {
          closeChat();
        }
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
