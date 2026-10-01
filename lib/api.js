// 前端 API 封装 (替代原 index.html 的 apiFetch + API 对象)
// 所有调用返回 JSON；HTTP 错误时抛出带 error 消息的 Error

const API_BASE_URL = '/api';

let token = null;
if (typeof window !== 'undefined') {
  token = localStorage.getItem('forumlify-token') || null;
}

export function getToken() {
  return token;
}

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('forumlify-token', t);
  else localStorage.removeItem('forumlify-token');
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API_BASE_URL + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = new Error(data.error || '请求失败');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const API = {
  // 认证
  async login(email, password) {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (data.token) setToken(data.token);
    return data;
  },
  // 服务端验证码（HMAC 签名挑战）
  getCaptcha() {
    return apiFetch('/captcha');
  },
  register(email, password, username, captcha, emailCode = '') {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, email_code: emailCode, captcha_id: captcha?.id, captcha_answer: captcha?.answer, captcha_sig: captcha?.sig }),
    });
  },
  sendRegisterCode(email) {
    return apiFetch('/auth/send-code', { method: 'POST', body: JSON.stringify({ email }) });
  },
  sendResetCode(email) {
    return apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  },
  resetPasswordByEmail(email, code, newPassword) {
    return apiFetch('/auth/reset-password-by-email', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) });
  },
  logout() { setToken(null); },
  getMe() { return apiFetch('/auth/me'); },

  // 帖子
  getPosts(sort, userId, page = 1, limit = 20) {
    let q = '/posts?sort=' + (sort || 'latest') + '&page=' + page + '&limit=' + limit;
    if (userId) q += '&user_id=' + userId;
    return apiFetch(q);
  },
  searchPosts(query, page = 1, limit = 20) {
    return apiFetch(`/posts/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
  },
  getPost(postId) { return apiFetch('/posts/' + postId); },
  createPost(title, content, images, captcha) {
    return apiFetch('/posts', {
      method: 'POST',
      body: JSON.stringify({ title, content, images: images || [], captcha_id: captcha?.id, captcha_answer: captcha?.answer, captcha_sig: captcha?.sig }),
    });
  },
  updatePost(postId, title, content, images) {
    return apiFetch('/posts/' + postId, { method: 'PUT', body: JSON.stringify({ title, content, images }) });
  },
  togglePinPost(postId) {
    return apiFetch('/posts/' + postId + '/pin', { method: 'PUT' });
  },
  deletePost(postId) { return apiFetch('/posts/' + postId, { method: 'DELETE' }); },

  // 回复
  getReplies(postId) { return apiFetch('/posts/' + postId + '/replies'); },
  createReply(postId, content, captcha, replyToId, replyToUsername) {
    return apiFetch('/posts/' + postId + '/replies', {
      method: 'POST',
      body: JSON.stringify({
        content,
        captcha_id: captcha?.id,
        captcha_answer: captcha?.answer,
        captcha_sig: captcha?.sig,
        reply_to_id: replyToId || null,
        reply_to_username: replyToUsername || null,
      }),
    });
  },
  deleteReply(replyId) { return apiFetch('/replies/' + replyId, { method: 'DELETE' }); },

  // 用户管理
  getUsers() { return apiFetch('/users'); },
  getUsersByUsername(username) { return apiFetch('/users?username=' + encodeURIComponent(username)); },
  getUserProfile(username) { return apiFetch('/users/profile/' + encodeURIComponent(username)); },
  searchUsers(query, limit = 10) {
    return apiFetch(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },
  getBlockStatus(userId) { return apiFetch(`/users/${encodeURIComponent(userId)}/block-status`); },
  getBlockedUsers() { return apiFetch('/blocks'); },
  blockUser(userId) { return apiFetch(`/users/${encodeURIComponent(userId)}/block`, { method: 'POST' }); },
  unblockUser(userId) { return apiFetch(`/users/${encodeURIComponent(userId)}/block`, { method: 'DELETE' }); },
  updateUserRole(userId, role) {
    return apiFetch('/users/' + userId + '/role', { method: 'PUT', body: JSON.stringify({ role }) });
  },
  updateProfile(userId, username, bio, signature) {
    return apiFetch('/users/' + userId, { method: 'PUT', body: JSON.stringify({ username, bio, signature }) });
  },
  updateAvatar(userId, avatar_url) {
    return apiFetch('/users/' + userId + '/avatar', { method: 'PUT', body: JSON.stringify({ avatar_url }) });
  },
  updatePassword(userId, oldPassword, newPassword) {
    return apiFetch('/users/' + userId + '/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) });
  },
  updateEmail(userId, password, newEmail) {
    return apiFetch('/users/' + userId + '/email', { method: 'PUT', body: JSON.stringify({ password, newEmail }) });
  },

  // 举报
  getReports() { return apiFetch('/reports'); },
  createReport(postId, reason) {
    return apiFetch('/reports', { method: 'POST', body: JSON.stringify({ post_id: postId, reason }) });
  },
  updateReport(reportId, status, note) {
    return apiFetch('/reports/' + reportId, { method: 'PUT', body: JSON.stringify({ status, note }) });
  },

  // 统计 + 设置 + 友链
  getStats() { return apiFetch('/stats'); },
  getSettings() { return apiFetch('/settings'); },
  updateSettings(forum_name) {
    return apiFetch('/settings', { method: 'PUT', body: JSON.stringify({ forum_name }) });
  },
  adminGetSmtp() { return apiFetch('/admin/smtp'); },
  adminSaveSmtp(config) {
    return apiFetch('/admin/smtp', { method: 'PUT', body: JSON.stringify(config) });
  },
  adminTestSmtp(to) {
    return apiFetch('/admin/smtp/test', { method: 'POST', body: JSON.stringify({ to }) });
  },
  adminClearSmtpPassword() { return apiFetch('/admin/smtp/password', { method: 'DELETE' }); },
  adminSetEmailVerification(required) {
    return apiFetch('/admin/email-verify', { method: 'PUT', body: JSON.stringify({ required }) });
  },
  uploadFavicon(file) {
    const fd = new FormData();
    fd.append('file', file);
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch('/api/admin/favicon', { method: 'POST', body: fd, headers }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || '上传失败');
      return data;
    });
  },
  getLinks() { return apiFetch('/links'); },
  addLink(title, url) {
    return apiFetch('/links', { method: 'POST', body: JSON.stringify({ title, url }) });
  },
  deleteLink(id) { return apiFetch('/links/' + id, { method: 'DELETE' }); },

  // 事件日志
  getEventLogs() { return apiFetch('/event-logs'); },
  logEvent(action) {
    return apiFetch('/event-logs', { method: 'POST', body: JSON.stringify({ action }) }).catch(() => {});
  },

  // 私信
  getConversations() { return apiFetch('/conversations'); },
  getOrCreateConversation(other_user_id) {
    return apiFetch('/conversations', { method: 'POST', body: JSON.stringify({ other_user_id }) });
  },
  getMessages(conversationId) { return apiFetch('/conversations/' + conversationId + '/messages'); },
  sendMessage(conversationId, content) {
    return apiFetch('/conversations/' + conversationId + '/messages', { method: 'POST', body: JSON.stringify({ content }) });
  },
  markMessageRead(messageId) {
    return apiFetch('/messages/' + messageId + '/read', { method: 'PUT' });
  },

  // 自定义页面
  getCustomPages() { return apiFetch('/custom-pages'); },
  getCustomPage(name) { return apiFetch('/custom-pages/' + name); },
  adminGetCustomPages() { return apiFetch('/admin/custom-pages'); },
  adminCreateCustomPage(name, title, content) {
    return apiFetch('/admin/custom-pages', { method: 'POST', body: JSON.stringify({ name, title, content }) });
  },
  adminUpdateCustomPage(id, title, content, enabled) {
    return apiFetch('/admin/custom-pages/' + id, { method: 'PUT', body: JSON.stringify({ title, content, enabled }) });
  },
  adminDeleteCustomPage(id) {
    return apiFetch('/admin/custom-pages/' + id, { method: 'DELETE' });
  },

  // 自定义 CSS
  uploadCustomCss(file) {
    const fd = new FormData();
    fd.append('file', file);
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch('/api/admin/custom-css', { method: 'POST', body: fd, headers }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || '上传失败');
      return data;
    });
  },
  deleteCustomCss() {
    return apiFetch('/admin/custom-css', { method: 'DELETE' });
  },

  // 通知
  getNotifications() { return apiFetch('/notifications'); },
  markNotificationRead(id) { return apiFetch('/notifications/' + id + '/read', { method: 'PUT' }); },
  markAllNotificationsRead() { return apiFetch('/notifications/read-all', { method: 'PUT' }); },

  // 恢复码
  generateRecoveryCodes() { return apiFetch('/auth/recovery-codes/generate', { method: 'POST' }); },
  getRecoveryCodeCount() { return apiFetch('/auth/recovery-codes/count'); },
  resetPassword(email, recoveryCode, newPassword) {
    return apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, recoveryCode, newPassword }) });
  },
};

// 图片上传 (multipart)
export async function uploadImage(file) {
  const fd = new FormData();
  fd.append('file', file);
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch('/api/upload', { method: 'POST', body: fd, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || '上传失败');
  return data.url;
}

// 验证码 (10以内加减法，与原实现一致)
export function generateCaptcha() {
  let a = Math.floor(Math.random() * 9) + 1;
  let b = Math.floor(Math.random() * 9) + 1;
  let op = ['+', '-'][Math.floor(Math.random() * 2)];
  if (op === '-' && a < b) { const t = a; a = b; b = t; }
  return { question: a + ' ' + op + ' ' + b + ' = ?', answer: op === '+' ? a + b : a - b };
}

// 主题：手动设置优先，否则跟随系统偏好
export function getTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('forumlify-theme');
  if (saved) return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}
