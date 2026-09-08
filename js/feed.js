// ============================================================
//  📋 帖子列表（Discourse 风格）
// ============================================================

let currentSort = 'latest';
let totalPages = 1;
const PAGE_SIZE = 20;

function renderFeed() {
  const container = document.getElementById('postList');
  container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">加载中...</div>';

  API.getPosts(currentSort, currentPageNum, PAGE_SIZE).then(result => {
    const posts = result.data || [];
    const pagination = result.pagination || { total: 0, totalPages: 1, page: 1 };
    totalPages = pagination.totalPages || 1;
    currentPageNum = pagination.page || 1;

    if (posts.length === 0 && currentPageNum === 1) {
      container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px 0;">还没有帖子，快来发布第一条吧！</div>';
      return;
    }

    if (posts.length === 0 && currentPageNum > 1) {
      currentPageNum = 1;
      renderFeed();
      return;
    }

    let html = '';
    posts.forEach(p => {
      const username = p.username || '匿名用户';
      const time = p.created_at ? new Date(p.created_at).toLocaleString('zh-CN') : '';
      const replyCount = p.reply_count || 0;
      const isHot = replyCount >= 10;

      // 状态标记
      let statusHtml = '';
      if (p.is_pinned) {
        statusHtml = `<span class="topic-status pinned">📌</span>`;
      }

      // 前缀标签（如果有）
      let prefixHtml = '';
      if (p.prefix_tag) {
        prefixHtml = `<span class="topic-prefix-tag">${escapeHTML(p.prefix_tag)}</span>`;
      }

      // 是否有未读回复（需要未读计数 API 支持，暂时留空）
      const unreadClass = '';

      html += `
        <div class="topic-row${unreadClass}" data-postid="${p.id}">
          <div class="topic-info">
            <div class="topic-title">
              ${prefixHtml}
              <a href="#" onclick="switchToPost('${p.id}'); return false;">${escapeHTML(p.title || '无标题')}</a>
              ${statusHtml}
            </div>
            <div class="topic-meta">
              <span class="topic-author" data-username="${escapeHTML(username)}">${escapeHTML(username)}</span>
              <span class="topic-time">${time}</span>
            </div>
          </div>
          <div class="topic-replies${isHot ? ' high' : ''}">
            ${replyCount}
          </div>
        </div>
      `;
    });

    container.innerHTML = sanitizeHTML(html);

    // 分页
    if (totalPages > 1) {
      let paginationHtml = `
        <div style="display:flex;justify-content:center;align-items:center;gap:6px;padding:16px 0;border-top:1px solid var(--glass-border);flex-wrap:wrap;">
          <button class="page-btn" data-page="${currentPageNum - 1}" ${currentPageNum <= 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}
                  style="padding:6px 12px;border:1px solid var(--glass-border);border-radius:4px;background:var(--glass-bg);color:var(--glass-text);cursor:pointer;font-size:13px;">
            &laquo;
          </button>
      `;

      let startPage = Math.max(1, currentPageNum - 4);
      let endPage = Math.min(totalPages, currentPageNum + 4);

      if (currentPageNum <= 4) {
        endPage = Math.min(totalPages, 9);
      }
      if (currentPageNum > totalPages - 4) {
        startPage = Math.max(1, totalPages - 8);
      }

      if (startPage > 1) {
        paginationHtml += `<button class="page-btn" data-page="1" style="padding:6px 10px;border:1px solid var(--glass-border);border-radius:4px;background:var(--glass-bg);color:var(--glass-text);cursor:pointer;font-size:13px;">1</button>`;
        if (startPage > 2) {
          paginationHtml += `<span style="color:var(--glass-text-light);padding:0 4px;">…</span>`;
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPageNum;
        paginationHtml += `
          <button class="page-btn" data-page="${i}" ${isActive ? 'disabled style="background:var(--primary);color:#fff;cursor:default;border-color:var(--primary);"' : ''}
                  style="padding:6px 10px;border:1px solid var(--glass-border);border-radius:4px;background:${isActive ? 'var(--primary)' : 'var(--glass-bg)'};color:${isActive ? '#fff' : 'var(--glass-text)'};cursor:${isActive ? 'default' : 'pointer'};font-size:13px;min-width:32px;text-align:center;">
            ${i}
          </button>
        `;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          paginationHtml += `<span style="color:var(--glass-text-light);padding:0 4px;">…</span>`;
        }
        paginationHtml += `<button class="page-btn" data-page="${totalPages}" style="padding:6px 10px;border:1px solid var(--glass-border);border-radius:4px;background:var(--glass-bg);color:var(--glass-text);cursor:pointer;font-size:13px;">${totalPages}</button>`;
      }

      paginationHtml += `
          <button class="page-btn" data-page="${currentPageNum + 1}" ${currentPageNum >= totalPages ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}
                  style="padding:6px 12px;border:1px solid var(--glass-border);border-radius:4px;background:var(--glass-bg);color:var(--glass-text);cursor:pointer;font-size:13px;">
            &raquo;
          </button>
          <span style="font-size:13px;color:var(--glass-text-light);margin-left:8px;">
            ${pagination.total} 个主题
          </span>
        </div>
      `;
      container.innerHTML += paginationHtml;

      container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', function() {
          const page = parseInt(this.dataset.page);
          if (page >= 1 && page <= totalPages) {
            currentPageNum = page;
            renderFeed();
          }
        });
      });
    }

    // ===== 事件绑定 =====
    // 点击整行跳转帖子详情（但要排除点击 a 标签的情况）
    container.querySelectorAll('.topic-row').forEach(row => {
      row.addEventListener('click', function(e) {
        if (e.target.closest('a')) return;
        const postId = this.dataset.postid;
        switchToPost(postId);
      });
    });

    // 点击用户名跳转用户主页
    container.querySelectorAll('.topic-author').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        switchPage('user', this.dataset.username);
      });
    });

  }).catch(err => {
    container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:40px 0;">加载失败：' + escapeHTML(err.message) + '</div>';
  });
}

function renderStats() {
  API.getStats().then(stats => {
    const topicsEl = document.getElementById('statTopics');
    const postsEl = document.getElementById('statPosts');
    const usersEl = document.getElementById('statUsers');
    if (topicsEl) topicsEl.textContent = stats.topics || 0;
    if (postsEl) postsEl.textContent = stats.posts || 0;
    if (usersEl) usersEl.textContent = stats.users || 0;

    const topics2El = document.getElementById('statTopics2');
    const posts2El = document.getElementById('statPosts2');
    const users2El = document.getElementById('statUsers2');
    if (topics2El) topics2El.textContent = stats.topics || 0;
    if (posts2El) posts2El.textContent = stats.posts || 0;
    if (users2El) users2El.textContent = stats.users || 0;
  }).catch(() => {});
}

function renderLinks() {
  API.getLinks().then(links => {
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

// 排序切换
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    currentSort = this.dataset.sort;
    currentPageNum = 1;
    renderFeed();
  });
});
