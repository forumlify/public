// ============================================================
//  👤 用户主页
// ============================================================

async function renderUserProfile(username) {
  const container = document.getElementById('userProfileContent');
  container.innerHTML = Skeleton.userProfile();

  try {
    // 使用公开接口 /users/profile/:username
    const user = await apiFetch('/users/profile/' + encodeURIComponent(username));
    
    if (user.error || !user.id) {
      container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:40px 0;">用户不存在</div>';
      return;
    }

    document.getElementById('userPageTitle').textContent = '👤 ' + user.username;

    const result = await apiFetch('/posts?user_id=' + user.id + '&page=1&limit=100');
    const posts = result.data || [];

    const avatar = user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.username) + '&background=6366f1&color=fff&size=128';

    let html = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:32px;text-align:center;">
        <img src="${escapeHTML(safeURL(avatar, { image: true }))}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--primary);" />
        <h2 style="margin:16px 0 4px;font-size:24px;">${escapeHTML(user.username)}</h2>
        <p style="color:var(--text-secondary);font-size:14px;">${escapeHTML(user.bio || '这个人很懒，什么都没写')}</p>
        <div style="display:flex;justify-content:center;gap:32px;margin-top:16px;font-size:14px;color:var(--text-secondary);flex-wrap:wrap;">
          <span>📅 加入于 ${user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '未知'}</span>
          <span>📝 发了 ${posts.length} 个帖子</span>
          ${user.role === 'admin' ? '<span style="color:var(--primary);font-weight:600;">🛡️ 管理员</span>' : ''}
        </div>
        ${currentUser && currentUser.id !== user.id ? `
          <button id="dmBtn" class="btn-primary" style="margin-top:16px;padding:8px 24px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            发私信
          </button>
        ` : ''}
      </div>
      <h3 style="margin:24px 0 16px;font-size:18px;">📝 发布的帖子</h3>
    `;

    if (posts.length === 0) {
      html += '<div style="color:#94a3b8;padding:20px 0;text-align:center;">还没有发帖</div>';
    } else {
      posts.forEach(p => {
        const time = p.created_at ? new Date(p.created_at).toLocaleString('zh-CN') : '';
        html += `
          <div class="post-card" data-postid="${escapeHTML(p.id)}" style="cursor:pointer;">
            <div class="post-title" style="font-size:16px;font-weight:600;">${escapeHTML(p.title || '无标题')}</div>
            <div class="post-content" style="font-size:14px;color:var(--text-secondary);">${escapeHTML((p.content || '').substring(0, 100))}${(p.content || '').length > 100 ? '...' : ''}</div>
            <div style="font-size:12px;color:var(--text-light);margin-top:8px;">${time}</div>
          </div>
        `;
      });
    }

    container.innerHTML = sanitizeHTML(html);

    container.querySelectorAll('.post-card[data-postid]').forEach(card => {
      card.addEventListener('click', function() {
        switchToPost(this.dataset.postid);
      });
    });

    const dmBtn = document.getElementById('dmBtn');
    if (dmBtn) {
      dmBtn.addEventListener('click', function() {
        openPrivateChat(user.id, user.username);
      });
    }

  } catch (err) {
    container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:40px 0;">加载失败：' + escapeHTML(err.message) + '</div>';
  }
}

function showUserPage(username) {
  const goingBack = typeof window.isNavigatingBack === 'function' && window.isNavigatingBack();
  const el = document.getElementById('pageUser');

  // 先让其他覆盖页滑出（例如从帖子详情跳到用户主页）
  document.querySelectorAll('.page-slide.active').forEach(other => {
    if (other !== el) hideSlide(other, { back: goingBack });
  });

  // 首页留在背景中下沉，新页面从屏幕外滑入
  showSlide(el, { back: goingBack });
  currentPage = 'user';
  renderUserProfile(username);
}
