// ============================================================
//  🛡️ 管理后台
// ============================================================

function renderAdminReports() {
  const container = document.getElementById('adminContent');
  container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px 0;">加载中...</div>';
  API.getReports().then(reports => {
    if (!reports || reports.length === 0) {
      container.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:40px 0;">${getIcon('success')} 暂无举报</div>`;
      return;
    }
    let html = '';
    const statusMap = {
      pending: `${getIcon('pending')} 待处理`,
      approved: `${getIcon('success')} 已删除`,
      rejected: `${getIcon('error')} 已驳回`
    };
    reports.forEach(r => {
      const postTitle = r.post_title || '无标题';
      html += `
        <div class="report-item">
          <div><strong>${escapeHTML(r.reporter_name || '匿名')}</strong> 举报了帖子</div>
          <div style="font-size:13px;color:#64748b;margin:4px 0;">原因：${escapeHTML(r.reason)}</div>
          <div style="font-size:13px;color:#64748b;margin:4px 0;">帖子：${escapeHTML(postTitle)} — ${escapeHTML((r.post_content || '').substring(0, 30))}${(r.post_content || '').length > 30 ? '...' : ''}</div>
          <div style="font-size:13px;font-weight:600;">状态：${statusMap[r.status] || escapeHTML(r.status)}</div>
          ${r.handler_name ? `<div style="font-size:12px;color:#94a3b8;">处理人：${escapeHTML(r.handler_name)}${r.handler_note ? ' (' + escapeHTML(r.handler_note) + ')' : ''}</div>` : ''}
          ${r.status === 'pending' ? `
            <div class="report-actions">
              <button class="btn-sm btn-danger" data-reportid="${r.id}" data-action="approve">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                删除帖子
              </button>
              <button class="btn-sm btn-secondary" data-reportid="${r.id}" data-action="reject">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                驳回举报
              </button>
            </div>
          ` : ''}
        </div>
      `;
    });
    container.innerHTML = sanitizeHTML(html);
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async function() {
        const id = this.dataset.reportid;
        const action = this.dataset.action;
        const status = action === 'approve' ? 'approved' : 'rejected';
        const note = action === 'approve' ? '已删除违规帖子' : '举报不成立';
        if (action === 'approve') {
          const ok = await showConfirm('确定要删除该帖子并标记举报为已处理吗？', {
            title: '删除帖子', confirmText: '删除', danger: true,
          });
          if (!ok) return;
        }
        API.updateReport(id, status, note).then(() => {
          renderAdminReports();
        }).catch(err => showToast('操作失败：' + err.message, 'error'));
      });
    });
  }).catch(() => {
    container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:20px 0;">加载失败</div>';
  });
}

// ============================================================
//  👥 用户列表（支持分页 + 搜索）
// ============================================================

let currentUsersPage = 1;
let usersTotalPages = 1;
let usersSearchKeyword = '';

function renderAdminUsers(page = 1, search = '') {
  const container = document.getElementById('adminContent');
  container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px 0;">加载中...</div>';

  currentUsersPage = page;
  usersSearchKeyword = search;

  API.getUsers(page, 20, search).then(result => {
    const users = result.data || [];
    const pagination = result.pagination || { total: 0, totalPages: 1, page: 1 };
    usersTotalPages = pagination.totalPages || 1;

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <span style="font-size:13px;color:#94a3b8;">共 <strong>${pagination.total}</strong> 位用户</span>
        <div style="display:flex;gap:6px;">
          <input type="text" id="userSearchInput" placeholder="搜索用户名..." value="${escapeHTML(search)}"
                 style="padding:6px 12px;border:1px solid var(--border);border-radius:4px;font-size:13px;background:var(--bg);color:var(--text);" />
          <button id="userSearchBtn" class="btn-sm btn-primary" style="padding:6px 14px;">搜索</button>
          <button id="userClearSearchBtn" class="btn-sm btn-secondary" style="padding:6px 14px;">清空</button>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="text-align:left;border-bottom:2px solid #e2e8f0;">
              <th style="padding:10px 12px;">用户</th>
              <th style="padding:10px 12px;">角色</th>
              <th style="padding:10px 12px;">注册时间</th>
              <th style="padding:10px 12px;text-align:center;">操作</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (users.length === 0) {
      html += `<tr><td colspan="4" style="text-align:center;padding:40px 0;color:#94a3b8;">暂无用户</td></tr>`;
    } else {
      users.forEach(u => {
        const isAdmin = u.role === 'admin';
        const isCurrentUser = currentUser && currentUser.id === u.id;
        html += `
          <tr style="border-bottom:1px solid #f1f5f9;${isCurrentUser ? 'background:var(--primary-bg);' : ''}">
            <td style="padding:10px 12px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <img src="${escapeHTML(safeURL(u.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.username) + '&background=6366f1&color=fff&size=64', { image: true }))}"
                     style="width:28px;height:28px;border-radius:50%;object-fit:cover;" />
                <span style="font-weight:500;">${escapeHTML(u.username)}</span>
                ${isCurrentUser ? '<span style="font-size:11px;color:#94a3b8;background:#eef2ff;padding:1px 8px;border-radius:4px;">你</span>' : ''}
              </div>
            </td>
            <td style="padding:10px 12px;">
              <span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:500;${isAdmin ? 'background:#6366f1;color:#fff;' : 'background:#e2e8f0;color:#64748b;'}">
                ${isAdmin ? '管理员' : '普通用户'}
              </span>
            </td>
            <td style="padding:10px 12px;color:#94a3b8;font-size:13px;">${u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '—'}</td>
            <td style="padding:10px 12px;text-align:center;">
              ${isCurrentUser ? 
                '<span style="font-size:12px;color:#94a3b8;">不可操作自己</span>' :
                (isAdmin ? 
                  `<button class="btn-sm btn-secondary" data-userid="${u.id}" data-role="user" style="padding:4px 12px;">设为普通用户</button>` :
                  `<button class="btn-sm btn-primary" data-userid="${u.id}" data-role="admin" style="padding:4px 12px;background:#6366f1;color:#fff;border:none;border-radius:4px;cursor:pointer;">设为管理员</button>`
                )
              }
            </td>
          </tr>
        `;
      });
    }

    html += '</tbody></table></div>';

    // 分页控件
    if (usersTotalPages > 1) {
      html += `
        <div style="display:flex;justify-content:center;align-items:center;gap:6px;padding:16px 0;margin-top:8px;border-top:1px solid var(--border);flex-wrap:wrap;">
          <button class="users-page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}
                  style="padding:6px 12px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">
            &laquo;
          </button>
      `;

      let startPage = Math.max(1, page - 4);
      let endPage = Math.min(usersTotalPages, page + 4);

      if (page <= 4) endPage = Math.min(usersTotalPages, 9);
      if (page > usersTotalPages - 4) startPage = Math.max(1, usersTotalPages - 8);

      if (startPage > 1) {
        html += `<button class="users-page-btn" data-page="1" style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">1</button>`;
        if (startPage > 2) html += `<span style="color:var(--text-light);padding:0 4px;">…</span>`;
      }

      for (let i = startPage; i <= endPage; i++) {
        const isActive = i === page;
        html += `
          <button class="users-page-btn" data-page="${i}" ${isActive ? 'disabled style="background:var(--primary);color:#fff;cursor:default;border-color:var(--primary);"' : ''}
                  style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:${isActive ? 'var(--primary)' : 'var(--surface)'};color:${isActive ? '#fff' : 'var(--text)'};cursor:${isActive ? 'default' : 'pointer'};font-size:13px;min-width:32px;text-align:center;">
            ${i}
          </button>
        `;
      }

      if (endPage < usersTotalPages) {
        if (endPage < usersTotalPages - 1) html += `<span style="color:var(--text-light);padding:0 4px;">…</span>`;
        html += `<button class="users-page-btn" data-page="${usersTotalPages}" style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">${usersTotalPages}</button>`;
      }

      html += `
          <button class="users-page-btn" data-page="${page + 1}" ${page >= usersTotalPages ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}
                  style="padding:6px 12px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">
            &raquo;
          </button>
          <span style="font-size:13px;color:var(--text-light);margin-left:8px;">
            ${pagination.total} 位用户
          </span>
        </div>
      `;
    }

    container.innerHTML = sanitizeHTML(html);

    // 绑定分页按钮事件
    container.querySelectorAll('.users-page-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', function() {
        const newPage = parseInt(this.dataset.page);
        if (newPage >= 1 && newPage <= usersTotalPages) {
          renderAdminUsers(newPage, usersSearchKeyword);
        }
      });
    });

    // 绑定角色切换事件
    container.querySelectorAll('[data-role]').forEach(btn => {
      btn.addEventListener('click', async function() {
        const userId = this.dataset.userid;
        const role = this.dataset.role;
        const roleName = role === 'admin' ? '管理员' : '普通用户';
        const ok = await showConfirm(`确定要将该用户设为「${roleName}」吗？`, {
          title: '修改用户角色',
          confirmText: '确定',
          danger: role === 'admin',
        });
        if (!ok) return;
        API.updateUserRole(userId, role).then(() => {
          renderAdminUsers(currentUsersPage, usersSearchKeyword);
        }).catch(err => showToast('操作失败：' + err.message, 'error'));
      });
    });

    // 搜索按钮
    const searchBtn = document.getElementById('userSearchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function() {
        const input = document.getElementById('userSearchInput');
        renderAdminUsers(1, input.value.trim());
      });
    }

    // 清空搜索
    const clearBtn = document.getElementById('userClearSearchBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        const input = document.getElementById('userSearchInput');
        input.value = '';
        renderAdminUsers(1, '');
      });
    }

    // 回车搜索
    const searchInput = document.getElementById('userSearchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          renderAdminUsers(1, this.value.trim());
        }
      });
    }

  }).catch(() => {
    container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">加载失败</div>';
  });
}

// ============================================================
//  📜 操作日志（支持分页）
// ============================================================

function renderAdminLogs(page = 1) {
  const container = document.getElementById('adminContent');
  container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px 0;">加载中...</div>';
  
  API.getEventLogs(page, 20).then(result => {
    const logs = result.data || [];
    const pagination = result.pagination || { total: 0, totalPages: 1, page: 1 };
    const totalPages = pagination.totalPages || 1;

    if (!logs || logs.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">暂无日志</div>';
      return;
    }

    let html = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="text-align:left;border-bottom:1px solid #e2e8f0;">
            <th>时间</th>
            <th>用户</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
    `;
    logs.forEach(l => {
      html += `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:6px 0;">${new Date(l.created_at).toLocaleString('zh-CN')}</td>
          <td style="padding:6px 0;">${escapeHTML(l.username || '系统')}</td>
          <td style="padding:6px 0;">${escapeHTML(l.action)}</td>
        </tr>
      `;
    });
    html += '</tbody></table>';

    // 分页控件
    if (totalPages > 1) {
      html += `
        <div style="display:flex;justify-content:center;align-items:center;gap:6px;padding:16px 0;margin-top:8px;border-top:1px solid var(--border);flex-wrap:wrap;">
          <button class="logs-page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}
                  style="padding:6px 12px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">
            &laquo;
          </button>
      `;

      let startPage = Math.max(1, page - 4);
      let endPage = Math.min(totalPages, page + 4);

      if (page <= 4) endPage = Math.min(totalPages, 9);
      if (page > totalPages - 4) startPage = Math.max(1, totalPages - 8);

      if (startPage > 1) {
        html += `<button class="logs-page-btn" data-page="1" style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">1</button>`;
        if (startPage > 2) html += `<span style="color:var(--text-light);padding:0 4px;">…</span>`;
      }

      for (let i = startPage; i <= endPage; i++) {
        const isActive = i === page;
        html += `
          <button class="logs-page-btn" data-page="${i}" ${isActive ? 'disabled style="background:var(--primary);color:#fff;cursor:default;border-color:var(--primary);"' : ''}
                  style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:${isActive ? 'var(--primary)' : 'var(--surface)'};color:${isActive ? '#fff' : 'var(--text)'};cursor:${isActive ? 'default' : 'pointer'};font-size:13px;min-width:32px;text-align:center;">
            ${i}
          </button>
        `;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="color:var(--text-light);padding:0 4px;">…</span>`;
        html += `<button class="logs-page-btn" data-page="${totalPages}" style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">${totalPages}</button>`;
      }

      html += `
          <button class="logs-page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}
                  style="padding:6px 12px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">
            &raquo;
          </button>
          <span style="font-size:13px;color:var(--text-light);margin-left:8px;">
            ${pagination.total} 条日志
          </span>
        </div>
      `;
    }

    container.innerHTML = sanitizeHTML(html);

    // 绑定分页按钮事件
    container.querySelectorAll('.logs-page-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', function() {
        const newPage = parseInt(this.dataset.page);
        if (newPage >= 1 && newPage <= totalPages) {
          renderAdminLogs(newPage);
        }
      });
    });

  }).catch(() => {
    container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">加载失败</div>';
  });
}

// ============================================================
//  🔗 友情链接管理
// ============================================================

function renderAdminLinks() {
  const container = document.getElementById('adminContent');
  container.innerHTML = `
    <div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;">
      <input type="text" id="newLinkTitle" placeholder="链接名称" style="flex:1;min-width:120px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:4px;" />
      <input type="url" id="newLinkUrl" placeholder="链接地址" style="flex:2;min-width:160px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:4px;" />
      <button id="addLinkBtn" class="btn-primary" style="padding:8px 16px;">添加</button>
    </div>
    <div id="linkList"></div>
  `;

  function loadLinks() {
    API.getLinks().then(links => {
      const ul = document.getElementById('linkList');
      if (!links || links.length === 0) {
        ul.innerHTML = '<div style="color:#94a3b8;font-size:13px;">暂无友情链接</div>';
        return;
      }
      let html = '';
      links.forEach(l => {
        html += `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;">
            <span><a href="${escapeHTML(safeURL(l.url, { allowRelative: false }))}" target="_blank" rel="noopener noreferrer" style="color:#6366f1;text-decoration:none;">${escapeHTML(l.title)}</a></span>
            <button class="btn-sm btn-danger" data-linkid="${l.id}" style="background:rgba(239,68,68,0.08);border:1.5px solid #ef4444;color:#1a1a2e;padding:2px 10px;border-radius:6px;transition:all 0.2s;cursor:pointer;font-size:12px;font-weight:500;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              删除
            </button>
          </div>
        `;
      });
      ul.innerHTML = sanitizeHTML(html);
      ul.querySelectorAll('[data-linkid]').forEach(btn => {
        btn.addEventListener('click', async function() {
          const ok = await showConfirm('确定删除该链接吗？', {
            title: '删除友链', confirmText: '删除', danger: true,
          });
          if (!ok) return;
          API.deleteLink(this.dataset.linkid).then(() => {
            loadLinks();
          }).catch(err => showToast('删除失败：' + err.message, 'error'));
        });
      });
    }).catch(() => {});
  }
  loadLinks();
  document.getElementById('addLinkBtn').addEventListener('click', function() {
    const title = document.getElementById('newLinkTitle').value.trim();
    const url = document.getElementById('newLinkUrl').value.trim();
    if (!title || !url) { showToast('请填写完整信息', 'warning'); return; }
    API.addLink(title, url).then(() => {
      document.getElementById('newLinkTitle').value = '';
      document.getElementById('newLinkUrl').value = '';
      loadLinks();
    }).catch(err => showToast('添加失败：' + err.message, 'error'));
  });
}

// ============================================================
//  ⚙️ 论坛设置（只改名称）
// ============================================================

function renderAdminSettings() {
  const container = document.getElementById('adminContent');
  container.innerHTML = `
    <h3 style="margin-bottom:16px;text-align:center;">${getIcon('settings')} 论坛名称</h3>

    <div class="forum-name-form">
      <label for="settingsForumName" style="font-weight:600;font-size:14px;display:block;margin-bottom:6px;width:100%;">论坛名称</label>
      <input type="text" id="settingsForumName" placeholder="论坛名称" />
      <button id="settingsForumSave" class="btn-primary" style="padding:10px 24px;">保存</button>
      <span id="settingsResult" style="font-size:14px;"></span>
    </div>
  `;

  API.getSettings().then(data => {
    document.getElementById('settingsForumName').value = data.forum_name || 'Forumlify';
  }).catch(() => {});

  document.getElementById('settingsForumSave').addEventListener('click', async () => {
    const name = document.getElementById('settingsForumName').value.trim();
    if (!name) { showToast('请输入论坛名称', 'warning'); return; }
    try {
      await API.updateSettings(name);
      document.getElementById('settingsResult').innerHTML = `${getIcon('success')} 保存成功！`;
      document.getElementById('settingsResult').style.color = '#22c55e';
      document.getElementById('forumName').textContent = name;
      document.title = name;
      const titleEl = document.getElementById('pageTitle');
      if (titleEl) titleEl.textContent = name;
    } catch (err) {
      document.getElementById('settingsResult').innerHTML = `${getIcon('error')} 保存失败`;
      document.getElementById('settingsResult').style.color = '#ef4444';
    }
  });
}

// ============================================================
//  📧 邮件设置（SMTP）
// ============================================================

function renderAdminSmtp() {
  const container = document.getElementById('adminContent');
  container.innerHTML = `
    <h3 style="margin-bottom:6px;text-align:center;">${getIcon('message')} 邮件设置</h3>
    <p style="text-align:center;color:var(--text-secondary);font-size:13px;margin-bottom:20px;">
      配置后可用于注册邮箱验证与密码找回。密码只写不读，保存后不会回显。
    </p>

    <div class="smtp-form">
      <div id="smtpStatus" style="margin-bottom:16px;padding:10px 14px;border-radius:var(--radius-sm);font-size:13px;"></div>

      <label class="smtp-check">
        <input type="checkbox" id="smtpEnabled" />
        启用邮件发送
      </label>

      <label for="smtpHost">SMTP 服务器</label>
      <input type="text" id="smtpHost" placeholder="smtp.example.com" autocomplete="off" />
      <div class="smtp-hint">
        Resend 填 <code>smtp.resend.com</code>，端口 465、加密选 SSL/TLS、用户名填 <code>resend</code>。
        其他服务商请填写其官方 SMTP 地址。
      </div>

      <div class="smtp-row">
        <div>
          <label for="smtpPort">端口</label>
          <input type="number" id="smtpPort" placeholder="587" min="1" max="65535" />
        </div>
        <div>
          <label for="smtpSecure">加密方式</label>
          <select id="smtpSecure">
            <option value="false">STARTTLS（587）</option>
            <option value="true">SSL/TLS（465）</option>
          </select>
        </div>
      </div>

      <label for="smtpUser">用户名</label>
      <input type="text" id="smtpUser" placeholder="通常为完整邮箱地址" autocomplete="off" />

      <label for="smtpPassword">密码 / 授权码</label>
      <input type="password" id="smtpPassword" placeholder="留空表示不修改已保存的密码" autocomplete="new-password" />
      <div class="smtp-hint">
        QQ、163 等邮箱填「授权码」；<strong>Resend 填 API Key</strong>（re_ 开头）。
      </div>

      <label for="smtpFromName">发件人名称</label>
      <input type="text" id="smtpFromName" placeholder="例如：论坛名称" />

      <label for="smtpFromEmail">发件人邮箱 <span style="color:#ef4444;">*</span></label>
      <input type="email" id="smtpFromEmail" placeholder="noreply@example.com" />
      <div class="smtp-hint">
        必须是你已在邮件服务商处验证过的域名下的地址，否则会被拒收。
      </div>

      <label class="smtp-check" style="margin-bottom:20px;">
        <input type="checkbox" id="smtpAllowSelfSigned" />
        允许自签证书（仅自建邮件服务器需要）
      </label>

      <div class="smtp-actions">
        <button id="smtpSaveBtn" class="btn-primary" style="padding:10px 22px;">保存配置</button>
        <button id="smtpTestBtn" class="btn-secondary" style="padding:10px 22px;">发送测试邮件</button>
        <button id="smtpClearPwBtn" class="btn-secondary" style="padding:10px 22px;">清除密码</button>
      </div>

      <hr />

      <h4 style="font-size:15px;margin-bottom:6px;">注册邮箱验证</h4>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
        开启后，新用户注册必须填写邮箱收到的验证码。需先完成上方配置并确保测试邮件可送达。
      </p>
      <label class="smtp-check" style="margin-bottom:0;">
        <input type="checkbox" id="emailVerifyRequired" />
        要求注册时验证邮箱
      </label>
    </div>
  `;

  const $ = id => document.getElementById(id);

  // 载入现有配置
  API.getSmtpConfig().then(cfg => {
    $('smtpEnabled').checked = cfg.enabled;
    $('smtpHost').value = cfg.host || '';
    $('smtpPort').value = cfg.port || 587;
    $('smtpSecure').value = String(cfg.secure);
    $('smtpUser').value = cfg.user || '';
    $('smtpFromName').value = cfg.from_name || '';
    $('smtpFromEmail').value = cfg.from_email || '';
    $('smtpAllowSelfSigned').checked = cfg.allow_self_signed === true;
    // 密码永不回显，只用占位文字提示是否已设置
    $('smtpPassword').placeholder = cfg.password_set
      ? '已保存密码，留空则不修改'
      : '尚未设置密码';

    const status = $('smtpStatus');
    if (cfg.configured) {
      status.innerHTML = `${getIcon('success')} 配置完整，可以发信`;
      status.style.background = 'rgba(34,197,94,0.12)';
      status.style.color = '#16a34a';
    } else {
      status.innerHTML = `${getIcon('warning')} 尚未配置完成，邮件功能不可用`;
      status.style.background = 'rgba(245,158,11,0.12)';
      status.style.color = '#d97706';
    }
  }).catch(err => {
    showToast('加载配置失败：' + err.message, 'error');
  });

  // 读取邮箱验证开关（该值在公开设置接口中）
  API.getSettings().then(s => {
    $('emailVerifyRequired').checked = s.email_verify_required === true;
  }).catch(() => {});

  $('smtpSaveBtn').addEventListener('click', async () => {
    const payload = {
      enabled: $('smtpEnabled').checked,
      host: $('smtpHost').value.trim(),
      port: Number($('smtpPort').value || 587),
      secure: $('smtpSecure').value === 'true',
      user: $('smtpUser').value.trim(),
      from_name: $('smtpFromName').value.trim(),
      from_email: $('smtpFromEmail').value.trim(),
      allow_self_signed: $('smtpAllowSelfSigned').checked,
    };
    // 只有填了才提交，避免把已保存的密码覆盖成空
    const pw = $('smtpPassword').value;
    if (pw) payload.password = pw;

    try {
      await API.saveSmtpConfig(payload);
      $('smtpPassword').value = '';
      showToast('配置已保存', 'success');
      renderAdminSmtp();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('smtpTestBtn').addEventListener('click', async function() {
    const btn = this;
    btn.disabled = true;
    btn.textContent = '发送中…';
    try {
      const r = await API.sendTestMail();
      showToast('测试邮件已发送至 ' + r.to, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '发送测试邮件';
    }
  });

  $('smtpClearPwBtn').addEventListener('click', async () => {
    const ok = await showConfirm('确定要清除已保存的 SMTP 密码吗？', {
      title: '清除密码', confirmText: '清除', danger: true,
    });
    if (!ok) return;
    try {
      await API.clearSmtpPassword();
      showToast('密码已清除', 'success');
      renderAdminSmtp();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('emailVerifyRequired').addEventListener('change', async function() {
    const desired = this.checked;
    try {
      await API.setEmailVerifyRequired(desired);
      showToast(desired ? '已开启注册邮箱验证' : '已关闭注册邮箱验证', 'success');
    } catch (err) {
      // 失败时把开关状态回滚，避免界面与服务端不一致
      this.checked = !desired;
      showToast(err.message, 'error');
    }
  });
}

// ============================================================
//  🎨 自定义 CSS（独立标签页）- 已改用 Toast 提示
// ============================================================

function renderAdminCustomCSS() {
  const container = document.getElementById('adminContent');
  container.innerHTML = `
    <h3 style="margin-bottom:8px;text-align:center;">${getIcon('paint')} 自定义 CSS</h3>
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;text-align:center;">上传 style.css 覆盖默认样式，自定义论坛外观。</p>

    <div style="max-width:500px;margin:0 auto;">
      <div id="customCssDropZone" style="border:2px dashed var(--border);border-radius:8px;padding:32px;text-align:center;cursor:pointer;transition:all 0.3s;background:var(--bg);">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 8px;color:var(--text-secondary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <p style="color:var(--text-secondary);font-size:14px;margin:0;">
          <span id="customCssDropText">点击或拖拽上传 style.css</span>
        </p>
        <p style="color:var(--text-light);font-size:12px;margin:4px 0 0;">只能上传 style.css 文件</p>
        <input type="file" id="customCssInput" accept=".css" style="display:none;" />
      </div>
      <div id="customCssStatus" style="font-size:13px;margin-top:8px;color:var(--text-light);"></div>

      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;justify-content:center;">
        <button id="customCssSaveBtn" class="btn-primary" style="padding:8px 20px;">${getIcon('save')} 保存 CSS</button>
        <button id="customCssDeleteBtn" class="btn-secondary" style="padding:8px 20px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text);">${getIcon('delete')} 删除自定义 CSS</button>
      </div>
    </div>
  `;

  // 自定义 CSS 上传逻辑
  const dropZone = document.getElementById('customCssDropZone');
  const fileInput = document.getElementById('customCssInput');
  const dropText = document.getElementById('customCssDropText');
  const statusEl = document.getElementById('customCssStatus');

  let selectedFile = null;

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', function() {
      fileInput.click();
    });

    fileInput.addEventListener('change', function() {
      if (this.files.length > 0) {
        handleCssFile(this.files[0]);
      }
    });

    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--primary)';
      this.style.background = 'var(--primary-bg)';
      dropText.textContent = '松开上传';
    });

    dropZone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--border)';
      this.style.background = 'var(--bg)';
      dropText.textContent = '点击或拖拽上传 style.css';
    });

    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      this.style.borderColor = 'var(--border)';
      this.style.background = 'var(--bg)';
      dropText.textContent = '点击或拖拽上传 style.css';
      if (e.dataTransfer.files.length > 0) {
        handleCssFile(e.dataTransfer.files[0]);
      }
    });
  }

  function handleCssFile(file) {
    if (file.name !== 'style.css') {
      showToast('文件名必须是 style.css', 'error');
      selectedFile = null;
      fileInput.value = '';
      return;
    }
    if (!file.type.includes('text/css') && !file.name.endsWith('.css')) {
      showToast('请上传 CSS 文件', 'error');
      selectedFile = null;
      fileInput.value = '';
      return;
    }
    selectedFile = file;
    showToast('已选择: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)', 'success');
  }

  document.getElementById('customCssSaveBtn').addEventListener('click', function() {
    if (!selectedFile) {
      showToast('请先选择 style.css 文件', 'warning');
      return;
    }

    showCustomCssWarningModal(async function() {
      try {
        await API.uploadCustomCSS(selectedFile);
        showToast('CSS 上传成功！刷新页面查看效果', 'success');
        selectedFile = null;
        fileInput.value = '';
        dropText.textContent = '点击或拖拽上传 style.css';
        loadCustomCSS();
      } catch (err) {
        showToast('上传失败：' + err.message, 'error');
      }
    });
  });

  document.getElementById('customCssDeleteBtn').addEventListener('click', async function() {
    const ok = await showConfirm('确定要删除自定义 CSS 吗？将恢复默认样式。', {
      title: '删除自定义 CSS',
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await API.deleteCustomCSS();
      showToast('已删除自定义 CSS', 'success');
      const link = document.getElementById('customCssLink');
      if (link) link.remove();
    } catch (err) {
      showToast('删除失败：' + err.message, 'error');
    }
  });
}

// ============================================================
//  📄 自定义页面管理
// ============================================================

let editingPageId = null;

function renderAdminCustomPages() {
  const container = document.getElementById('adminContent');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h3 style="margin:0;">${getIcon('page')} 自定义页面</h3>
      <button id="addCustomPageBtn" class="btn-primary" style="padding:8px 16px;">${getIcon('add')} 添加页面</button>
    </div>
    <div id="customPageList"></div>
  `;

  loadCustomPageList();

  document.getElementById('addCustomPageBtn').addEventListener('click', function() {
    editingPageId = null;
    openCustomPageEditor();
  });
}

function loadCustomPageList() {
  const container = document.getElementById('customPageList');
  container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px 0;">加载中...</div>';
  API.getAdminCustomPages().then(pages => {
    if (pages.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px 0;">暂无自定义页面</div>';
      return;
    }
    let html = `<div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;border-bottom:2px solid var(--border);">
            <th style="padding:8px 12px;">名称</th>
            <th style="padding:8px 12px;">标题</th>
            <th style="padding:8px 12px;">URL</th>
            <th style="padding:8px 12px;">状态</th>
            <th style="padding:8px 12px;text-align:center;">操作</th>
          </tr>
        </thead>
        <tbody>
    `;
    pages.forEach(p => {
      html += `
        <tr style="border-bottom:1px solid var(--border-light);">
          <td style="padding:8px 12px;"><code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-size:12px;">${escapeHTML(p.name)}</code></td>
          <td style="padding:8px 12px;">${escapeHTML(p.title)}</td>
          <td style="padding:8px 12px;"><code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-size:12px;">?custom=${escapeHTML(p.name)}</code></td>
          <td style="padding:8px 12px;"><span style="color:${p.enabled ? '#22c55e' : '#ef4444'};">${p.enabled ? `${getIcon('success')} 启用` : `${getIcon('error')} 禁用`}</span></td>
          <td style="padding:8px 12px;text-align:center;display:flex;gap:6px;justify-content:center;">
            <button class="btn-sm btn-secondary" data-id="${p.id}" data-action="edit">${getIcon('edit')}</button>
            <button class="btn-sm btn-danger" data-id="${p.id}" data-action="delete">${getIcon('delete')}</button>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table></div>';
    container.innerHTML = sanitizeHTML(html);

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', function() {
        const page = pages.find(p => p.id === this.dataset.id);
        if (page) {
          editingPageId = page.id;
          openCustomPageEditor(page);
        }
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async function() {
        const ok = await showConfirm('确定要删除这个页面吗？', {
          title: '删除页面', confirmText: '删除', danger: true,
        });
        if (!ok) return;
        API.deleteCustomPage(this.dataset.id).then(() => {
          loadCustomPageList();
          loadCustomPagesNav();
        }).catch(err => showToast('删除失败：' + err.message, 'error'));
      });
    });
  }).catch(err => {
    container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:20px 0;">加载失败</div>';
  });
}

function openCustomPageEditor(page) {
  const isEdit = !!page;
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:600px;max-height:90vh;overflow-y:auto;">
      <span class="close" style="position:absolute;top:12px;right:16px;font-size:24px;cursor:pointer;color:var(--text-light);">&times;</span>
      <h2 style="margin-bottom:16px;">${isEdit ? getIcon('edit') + ' 编辑页面' : getIcon('add') + ' 添加页面'}</h2>
      <div style="margin-bottom:12px;">
        <label style="font-weight:600;font-size:14px;display:block;margin-bottom:4px;">页面名称</label>
        <input type="text" id="editorPageName" value="${isEdit ? escapeHTML(page.name) : ''}" ${isEdit ? 'readonly style="background:var(--border-light);color:var(--text-light);"' : ''}
               placeholder="about (用于 URL: ?custom=about)" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:14px;background:var(--bg);color:var(--text);" />
        ${isEdit ? '<div style="font-size:12px;color:var(--text-light);margin-top:2px;">⚠️ 名称不可修改</div>' : '<div style="font-size:12px;color:var(--text-light);margin-top:2px;">只允许字母、数字、短横线和下划线</div>'}
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-weight:600;font-size:14px;display:block;margin-bottom:4px;">导航栏显示名称</label>
        <input type="text" id="editorPageTitle" value="${isEdit ? escapeHTML(page.title) : ''}"
               placeholder="关于我们" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:14px;background:var(--bg);color:var(--text);" />
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-weight:600;font-size:14px;display:block;margin-bottom:4px;">状态</label>
        <select id="editorEnabled" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:14px;background:var(--bg);color:var(--text);">
          <option value="true" ${isEdit && page.enabled ? 'selected' : ''}>启用</option>
          <option value="false" ${isEdit && !page.enabled ? 'selected' : ''}>禁用</option>
        </select>
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-weight:600;font-size:14px;display:block;margin-bottom:4px;">页面内容（HTML + CSS + JS）</label>
        <textarea id="editorContent" rows="12" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-size:13px;font-family:monospace;background:var(--bg);color:var(--text);resize:vertical;">${isEdit ? escapeHTML(page.content) : ''}</textarea>
        <div style="font-size:12px;color:var(--text-light);margin-top:2px;">支持 HTML、CSS（&lt;style&gt;）、JS（&lt;script&gt;），内容会在独立的沙盒中渲染</div>
      </div>
      <button id="editorSaveBtn" class="btn-primary" style="padding:10px 24px;width:100%;">保存</button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.close').addEventListener('click', function() {
    modal.remove();
  });
  modal.addEventListener('click', function(e) {
    if (e.target === this) modal.remove();
  });

  modal.querySelector('#editorSaveBtn').addEventListener('click', async function() {
    const name = document.getElementById('editorPageName').value.trim();
    const title = document.getElementById('editorPageTitle').value.trim();
    const content = document.getElementById('editorContent').value.trim();
    const enabled = document.getElementById('editorEnabled').value === 'true';

    if (!name) { showToast('请输入页面名称', 'warning'); return; }
    if (!title) { showToast('请输入导航栏显示名称', 'warning'); return; }
    if (!content) { showToast('请输入页面内容', 'warning'); return; }
    if (!/^[a-zA-Z0-9\-_]+$/.test(name)) {
      showToast('页面名称只允许字母、数字、短横线和下划线', 'warning');
      return;
    }

    try {
      if (isEdit) {
        await API.updateCustomPage(page.id, title, content, enabled);
      } else {
        await API.createCustomPage(name, title, content);
      }
      modal.remove();
      loadCustomPageList();
      loadCustomPagesNav();
    } catch (err) {
      showToast('保存失败：' + err.message, 'error');
    }
  });
}

// ============================================================
//  自定义 CSS 警告模态框
// ============================================================

function showCustomCssWarningModal(onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:420px;">
      <h2 style="margin-bottom:12px;">${getIcon('warning')} 警告</h2>
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px;">
        若上传的 <strong>style.css</strong> 存在问题，将导致整个论坛界面样式错乱，甚至无法正常使用。
      </p>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:20px;">
        请确保 CSS 文件是完整的、经过测试的版本。如出现问题，可点击「删除自定义 CSS」恢复默认样式。
      </p>
      <div style="display:flex;gap:8px;">
        <button id="cssWarningConfirm" class="btn-primary" style="padding:8px 24px;">我了解，继续上传</button>
        <button id="cssWarningCancel" class="btn-secondary" style="padding:8px 24px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--text);">取消</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#cssWarningConfirm').addEventListener('click', function() {
    modal.remove();
    if (onConfirm) onConfirm();
  });

  modal.querySelector('#cssWarningCancel').addEventListener('click', function() {
    modal.remove();
  });

  modal.addEventListener('click', function(e) {
    if (e.target === this) modal.remove();
  });
}

// ============================================================
//  加载自定义 CSS
// ============================================================

function loadCustomCSS() {
  const existing = document.getElementById('customCssLink');
  if (existing) existing.remove();

  const link = document.createElement('link');
  link.id = 'customCssLink';
  link.rel = 'stylesheet';
  link.href = CONFIG.API_BASE_URL + '/custom-css?v=' + Date.now();
  link.onerror = function() {
    // 如果自定义 CSS 不存在，静默失败
  };
  document.head.appendChild(link);
}

// ============================================================
//  管理后台Tab切换（侧边栏适配）
// ============================================================

// 使用事件委托监听 .admin-nav 下的点击
document.querySelector('.admin-nav')?.addEventListener('click', function(e) {
  const tabLink = e.target.closest('.admin-nav-item');
  if (!tabLink) return;

  e.preventDefault();
  const tab = tabLink.dataset.tab;
  if (!tab) return;

  // 切换高亮
  document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
  tabLink.classList.add('active');

  // 渲染对应内容
  const tabMap = {
    reports: renderAdminReports,
    users: renderAdminUsers,
    logs: renderAdminLogs,
    links: renderAdminLinks,
    'custom-css': renderAdminCustomCSS,
    settings: renderAdminSettings,
    smtp: renderAdminSmtp,
    custom: renderAdminCustomPages
  };
  if (tabMap[tab]) tabMap[tab]();
});

// 页面加载时尝试加载自定义 CSS
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(loadCustomCSS, 500);
});
