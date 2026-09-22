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

    // 已登录且不是本人时，查一次屏蔽关系，用于决定按钮文案
    let blockStatus = { blocked_by_me: false, blocked_me: false };
    if (currentUser && currentUser.id !== user.id) {
      try {
        blockStatus = await API.getBlockStatus(user.id);
      } catch (err) {
        // 查询失败时按未屏蔽处理，不阻断页面渲染
      }
    }

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
          <div style="display:flex;justify-content:center;gap:10px;margin-top:16px;flex-wrap:wrap;">
            <!-- 被我屏蔽时不给出发私信入口，避免必然失败的尝试 -->
            ${blockStatus.blocked_by_me ? '' : `
              <button id="dmBtn" class="btn-primary" style="padding:8px 24px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                发私信
              </button>
            `}
            <button id="blockBtn" class="btn-secondary ${blockStatus.blocked_by_me ? 'is-blocked' : ''}"
                    data-userid="${escapeHTML(user.id)}" data-username="${escapeHTML(user.username)}"
                    data-blocked="${blockStatus.blocked_by_me ? '1' : '0'}"
                    style="padding:8px 20px;">
              ${blockStatus.blocked_by_me ? '解除屏蔽' : '屏蔽'}
            </button>
          </div>
          ${blockStatus.blocked_by_me ? `
            <p style="margin-top:10px;font-size:12px;color:var(--text-light);">
              已屏蔽该用户：你不再看到 TA 的帖子与回复，TA 也无法给你发私信
            </p>
          ` : ''}
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

    // 屏蔽 / 解除屏蔽。两者都需要确认——屏蔽会影响双方的内容可见性，
    // 属于不容易察觉后果的操作。
    const blockBtn = document.getElementById('blockBtn');
    if (blockBtn) {
      blockBtn.addEventListener('click', async function() {
        const targetId = this.dataset.userid;
        const targetName = this.dataset.username;
        const isBlocked = this.dataset.blocked === '1';

        const ok = await showConfirm(
          isBlocked
            ? `解除对「${targetName}」的屏蔽？解除后你将继续看到 TA 的帖子和回复，TA 也能再次给你发私信。`
            : `确定屏蔽「${targetName}」？屏蔽后你不再看到 TA 的帖子和回复，TA 也无法给你发私信。`,
          {
            title: isBlocked ? '解除屏蔽' : '屏蔽用户',
            confirmText: isBlocked ? '解除屏蔽' : '屏蔽',
            danger: !isBlocked,
          }
        );
        if (!ok) return;

        try {
          if (isBlocked) {
            await API.unblockUser(targetId);
            showToast('已解除屏蔽', 'success');
          } else {
            await API.blockUser(targetId);
            showToast('已屏蔽该用户', 'success');
          }
          // 重新渲染以更新按钮状态与提示
          renderUserProfile(user.username);
        } catch (err) {
          showToast(err.message, 'error');
        }
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
