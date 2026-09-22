// ============================================================
//  API 请求封装
// ============================================================
let token = localStorage.getItem('forumlify-token') || null;

function getAuthHeaders() {
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function apiFetch(path, options = {}) {
  const url = CONFIG.API_BASE_URL + path;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers || {})
  };
  return fetch(url, {
    ...options,
    headers
  }).then(res => res.json());
}

const API = {
  // ============================================================
  //  认证
  // ============================================================
  async login(email, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.error) throw new Error(data.error);
    if (data.token) {
      token = data.token;
      localStorage.setItem('forumlify-token', token);
    }
    return data;
  },

  async register(email, password, username, bootstrapToken = '', emailCode = '') {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        username,
        bootstrap_token: bootstrapToken || undefined,
        email_code: emailCode || undefined
      })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async logout() {
    token = null;
    localStorage.removeItem('forumlify-token');
    currentUser = null;
  },

  async getMe() {
    const data = await apiFetch('/auth/me');
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  帖子（含分页）
  // ============================================================
  async getPosts(sort, page = 1, limit = 20) {
    const data = await apiFetch('/posts?sort=' + (sort || 'latest') + '&page=' + page + '&limit=' + limit);
    if (data.error) throw new Error(data.error);
    return data;
  },

  // 搜索帖子（标题与正文）
  async searchPosts(keyword, page = 1, limit = 20) {
    const data = await apiFetch(
      '/posts/search?q=' + encodeURIComponent(keyword) + '&page=' + page + '&limit=' + limit
    );
    if (data.error) throw new Error(data.error);
    return data;
  },

  async getPost(postId) {
    const data = await apiFetch('/posts/' + postId);
    if (data.error) throw new Error(data.error);
    return data;
  },

  async createPost(title, content, images) {
    const data = await apiFetch('/posts', {
      method: 'POST',
      body: JSON.stringify({ title, content, images: images || [] })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(CONFIG.API_BASE_URL + '/upload', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    const data = await response.json().catch(() => ({ error: '上传响应无效' }));
    if (!response.ok || data.error) throw new Error(data.error || '图片上传失败');
    return data;
  },

  async updatePost(postId, title, content) {
    const data = await apiFetch('/posts/' + postId, {
      method: 'PUT',
      body: JSON.stringify({ title, content })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async deletePost(postId) {
    const data = await apiFetch('/posts/' + postId, { method: 'DELETE' });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async togglePinPost(postId) {
    const data = await apiFetch('/posts/' + postId + '/pin', {
      method: 'PUT'
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  回复
  // ============================================================
  async getReplies(postId) {
    const data = await apiFetch('/posts/' + postId + '/replies');
    if (data.error) throw new Error(data.error);
    return data || [];
  },

  async createReply(postId, content) {
    const data = await apiFetch('/posts/' + postId + '/replies', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async deleteReply(replyId) {
    const data = await apiFetch('/replies/' + replyId, { method: 'DELETE' });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  用户管理（支持分页和搜索）
  // ============================================================
  async getUsers(page = 1, limit = 20, search = '') {
    const data = await apiFetch('/users?page=' + page + '&limit=' + limit + '&search=' + encodeURIComponent(search));
    if (data.error) throw new Error(data.error);
    return data;
  },

  async updateUserRole(userId, role) {
    const data = await apiFetch('/users/' + userId + '/role', {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  举报
  // ============================================================
  async getReports() {
    const data = await apiFetch('/reports');
    if (data.error) throw new Error(data.error);
    return data || [];
  },

  async createReport(postId, reason) {
    const data = await apiFetch('/reports', {
      method: 'POST',
      body: JSON.stringify({ post_id: postId, reason })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async updateReport(reportId, status, note) {
    const data = await apiFetch('/reports/' + reportId, {
      method: 'PUT',
      body: JSON.stringify({ status, note })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  统计
  // ============================================================
  async getStats() {
    const data = await apiFetch('/stats');
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  友情链接
  // ============================================================
  async getLinks() {
    const data = await apiFetch('/links');
    if (data.error) throw new Error(data.error);
    return data || [];
  },

  async addLink(title, url) {
    const data = await apiFetch('/links', {
      method: 'POST',
      body: JSON.stringify({ title, url })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async deleteLink(id) {
    const data = await apiFetch('/links/' + id, { method: 'DELETE' });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  事件日志（支持分页）
  // ============================================================
  async getEventLogs(page = 1, limit = 20) {
    const data = await apiFetch('/event-logs?page=' + page + '&limit=' + limit);
    if (data.error) throw new Error(data.error);
    return data;
  },


  // ============================================================
  //  论坛设置
  // ============================================================
  async getSettings() {
    const data = await apiFetch('/settings');
    if (data.error) throw new Error(data.error);
    return data;
  },

  async updateSettings(forum_name) {
    const data = await apiFetch('/settings', {
      method: 'PUT',
      body: JSON.stringify({ forum_name })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  私信
  // ============================================================
  async getConversations() {
    const data = await apiFetch('/conversations');
    if (data.error) throw new Error(data.error);
    return data || [];
  },

  async getOrCreateConversation(other_user_id) {
    const data = await apiFetch('/conversations', {
      method: 'POST',
      body: JSON.stringify({ other_user_id })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async getMessages(conversationId) {
    const data = await apiFetch('/conversations/' + conversationId + '/messages');
    if (data.error) throw new Error(data.error);
    return data || [];
  },

  async sendMessage(conversationId, content) {
    const data = await apiFetch('/conversations/' + conversationId + '/messages', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async markMessageRead(messageId) {
    const data = await apiFetch('/messages/' + messageId + '/read', {
      method: 'PUT'
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  自定义页面
  // ============================================================
  async getCustomPages() {
    const data = await apiFetch('/custom-pages');
    if (data.error) throw new Error(data.error);
    return data || [];
  },

  async getCustomPage(name) {
    const data = await apiFetch('/custom-pages/' + encodeURIComponent(name));
    if (data.error) throw new Error(data.error);
    return data;
  },

  async getAdminCustomPages() {
    const data = await apiFetch('/admin/custom-pages');
    if (data.error) throw new Error(data.error);
    return data || [];
  },

  async createCustomPage(name, title, content) {
    const data = await apiFetch('/admin/custom-pages', {
      method: 'POST',
      body: JSON.stringify({ name, title, content })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async updateCustomPage(id, title, content, enabled) {
    const data = await apiFetch('/admin/custom-pages/' + id, {
      method: 'PUT',
      body: JSON.stringify({ title, content, enabled })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async deleteCustomPage(id) {
    const data = await apiFetch('/admin/custom-pages/' + id, { method: 'DELETE' });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  头像
  // ============================================================
  async updateAvatar(userId, avatar_url) {
    const data = await apiFetch('/users/' + userId + '/avatar', {
      method: 'PUT',
      body: JSON.stringify({ avatar_url })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  恢复码
  // ============================================================
  async generateRecoveryCodes() {
    const data = await apiFetch('/auth/recovery-codes/generate', {
      method: 'POST'
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async getRecoveryCodesCount() {
    const data = await apiFetch('/auth/recovery-codes/count');
    if (data.error) throw new Error(data.error);
    return data;
  },

  async resetPassword(email, recoveryCode, newPassword) {
    const data = await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, recoveryCode, newPassword })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  修改密码和邮箱
  // ============================================================
  // 这两个接口会递增 token_version 使旧令牌失效，服务端随即补发一个
  // 新令牌。这里必须接住它，否则用户操作成功后会被立刻登出。
  _persistRefreshedToken(data) {
    if (data && data.token) {
      token = data.token;
      localStorage.setItem('forumlify-token', token);
    }
    return data;
  },

  async changePassword(oldPassword, newPassword) {
    const data = await apiFetch('/users/' + currentUser.id + '/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword })
    });
    if (data.error) throw new Error(data.error);
    return this._persistRefreshedToken(data);
  },

  async changeEmail(password, newEmail) {
    const data = await apiFetch('/users/' + currentUser.id + '/email', {
      method: 'PUT',
      body: JSON.stringify({ password, newEmail })
    });
    if (data.error) throw new Error(data.error);
    return this._persistRefreshedToken(data);
  },

  // ============================================================
  //  更新用户资料（含签名）
  // ============================================================
  async updateProfile(userId, username, bio, signature) {
    const data = await apiFetch('/users/' + userId, {
      method: 'PUT',
      body: JSON.stringify({ username, bio, signature })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  自定义 CSS
  // ============================================================

  async uploadCustomCSS(file) {
    const formData = new FormData();
    formData.append('file', file);

    const url = CONFIG.API_BASE_URL + '/admin/custom-css';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('forumlify-token')
      },
      body: formData
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  async deleteCustomCSS() {
    const data = await apiFetch('/admin/custom-css', {
      method: 'DELETE'
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  SMTP 配置（管理员）
  // ============================================================

  async getSmtpConfig() {
    const data = await apiFetch('/admin/smtp');
    if (data.error) throw new Error(data.error);
    return data;
  },

  // password 留空表示保持原有密码不变
  async saveSmtpConfig(config) {
    const data = await apiFetch('/admin/smtp', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async clearSmtpPassword() {
    const data = await apiFetch('/admin/smtp/password', { method: 'DELETE' });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async sendTestMail(to) {
    const data = await apiFetch('/admin/smtp/test', {
      method: 'POST',
      body: JSON.stringify(to ? { to } : {})
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async setEmailVerifyRequired(required) {
    const data = await apiFetch('/admin/email-verify', {
      method: 'PUT',
      body: JSON.stringify({ required })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ============================================================
  //  邮箱验证码
  // ============================================================

  async sendRegisterCode(email) {
    const data = await apiFetch('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async forgotPassword(email) {
    const data = await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (data.error) throw new Error(data.error);
    return data;
  },

  async resetPasswordByEmail(email, code, newPassword) {
    const data = await apiFetch('/auth/reset-password-by-email', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword })
    });
    if (data.error) throw new Error(data.error);
    return data;
  }
};
