// ============================================================
//  📋 帖子列表
// ============================================================

let currentSort = 'latest';
let totalPages = 1;
const PAGE_SIZE = 20;

// 当前搜索关键词。为空表示处于普通列表模式。
let currentSearch = '';

// 翻页后滚回列表顶部。分页控件在列表末尾，不回到顶部的话用户看到的
// 仍是新一页的底部。
// 尊重系统的「减少动画」设置：开启时直接跳转，不做平滑滚动。
function scrollFeedToTop() {
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({
    top: 0,
    behavior: reduceMotion ? 'auto' : 'smooth',
  });
}

function renderFeed() {
  const container = document.getElementById('postList');
  const keyword = currentSearch;

  // 骨架屏只在首次加载时显示。翻页时列表已有内容，再画一遍骨架会
  // 造成明显的闪动，反而比直接留白更糟。
  const isFirstLoad = container.dataset.loaded !== '1';
  container.innerHTML = isFirstLoad
    ? Skeleton.postList(3)
    : '<div style="text-align:center;color:#94a3b8;padding:40px 0;">加载中...</div>';

  const request = keyword
    ? API.searchPosts(keyword, currentPageNum, PAGE_SIZE)
    : API.getPosts(currentSort, currentPageNum, PAGE_SIZE);

  request.then(result => {
    container.dataset.loaded = '1';
    const posts = result.data || [];
    const pagination = result.pagination || { total: 0, totalPages: 1, page: 1 };
    totalPages = pagination.totalPages || 1;
    currentPageNum = pagination.page || 1;

    if (posts.length === 0 && currentPageNum === 1) {
      // 空结果提示。关键词单独放在 <strong> 里，让固定文案能作为独立
      // 文本节点被 i18n 匹配到——整句含动态关键词时匹配不上词典。
      container.innerHTML = keyword
        ? '<div class="search-empty">'
          + '<span>没有找到相关帖子</span><br>'
          + '<strong>「' + escapeHTML(keyword) + '」</strong><br>'
          + '<span style="font-size:13px;">试试其他关键词，或检查是否有错别字</span></div>'
        : '<div style="text-align:center;color:#94a3b8;padding:60px 0;">✨ 还没有帖子，快来发布第一条吧！</div>';
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
      const avatar = p.avatar_url ||
        'https://ui-avatars.com/api/?name=' + encodeURIComponent(username) +
        '&background=6366f1&color=fff&size=64';
      const time = p.created_at ? new Date(p.created_at).toLocaleString('zh-CN') : '';
      // 列表里最多展示 3 张图，其余折叠为「+N」。
      // 附件上限是 6 张，若全部铺开会把卡片撑得很高，且与相邻卡片不齐。
      let imagesHtml = '';
      if (p.images && p.images.length > 0) {
        const MAX_THUMBS = 3;
        const shown = p.images.slice(0, MAX_THUMBS);
        const rest = p.images.length - shown.length;

        imagesHtml = '<div class="post-images">';
        shown.forEach(img => {
          imagesHtml += '<img src="' + escapeHTML(safeURL(img, { image: true })) +
            '" class="post-image" style="cursor:pointer;" />';
        });
        // 多于 3 张时，在末张右下角叠加剩余数量
        if (rest > 0) {
          imagesHtml += '<span class="post-image-more">+' + rest + '</span>';
        }
        imagesHtml += '</div>';
      }
      const replyCount = p.reply_count || 0;

      const renderedContent = renderMarkdown(p.content || '');

      // 签名渲染
      let signatureHtml = '';
      if (p.signature) {
        const sigContent = renderMarkdown(p.signature);
        signatureHtml = `
          <div class="post-signature" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border-light);font-size:12px;color:var(--text-secondary);">
            ${sigContent}
          </div>
        `;
      }

      html += `
        <div class="post-card" data-postid="${p.id}" style="cursor:pointer;">
          ${p.is_pinned ? '<div style="font-size:12px;color:var(--primary);font-weight:600;margin-bottom:4px;">📌 置顶</div>' : ''}
          <div class="post-header">
            <img src="${escapeHTML(safeURL(avatar, { image: true }))}" class="post-avatar" />
            <span class="post-username" data-username="${escapeHTML(username)}" style="cursor:pointer;color:var(--primary);">${escapeHTML(username)}</span>
            <span class="post-time">${time}</span>
            ${p.edited_at ? '<span style="font-size:11px;color:var(--text-light);margin-left:6px;">（已编辑）</span>' : ''}
          </div>
          <div class="post-title">${escapeHTML(p.title || '无标题')}</div>
          <div class="post-content">${renderedContent}</div>
          ${imagesHtml}
          <div class="post-actions">
            <span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${replyCount} 条回复
            </span>
          </div>
          ${signatureHtml}
        </div>
      `;
    });
    container.innerHTML = sanitizeHTML(html);

    // 分页控件
    if (totalPages > 1) {
      let paginationHtml = `
        <div style="display:flex;justify-content:center;align-items:center;gap:6px;padding:16px 0;margin-top:8px;border-top:1px solid var(--border);flex-wrap:wrap;">
          <button class="page-btn" data-page="${currentPageNum - 1}" ${currentPageNum <= 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}
                  style="padding:6px 12px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">
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
        paginationHtml += `<button class="page-btn" data-page="1" style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">1</button>`;
        if (startPage > 2) {
          paginationHtml += `<span style="color:var(--text-light);padding:0 4px;">…</span>`;
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPageNum;
        paginationHtml += `
          <button class="page-btn" data-page="${i}" ${isActive ? 'disabled style="background:var(--primary);color:#fff;cursor:default;border-color:var(--primary);"' : ''}
                  style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:${isActive ? 'var(--primary)' : 'var(--surface)'};color:${isActive ? '#fff' : 'var(--text)'};cursor:${isActive ? 'default' : 'pointer'};font-size:13px;min-width:32px;text-align:center;">
            ${i}
          </button>
        `;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          paginationHtml += `<span style="color:var(--text-light);padding:0 4px;">…</span>`;
        }
        paginationHtml += `<button class="page-btn" data-page="${totalPages}" style="padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">${totalPages}</button>`;
      }

      paginationHtml += `
          <button class="page-btn" data-page="${currentPageNum + 1}" ${currentPageNum >= totalPages ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}
                  style="padding:6px 12px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);cursor:pointer;font-size:13px;">
            &raquo;
          </button>
          <span style="font-size:13px;color:var(--text-light);margin-left:8px;">
            ${pagination.total} 帖
          </span>
        </div>
      `;
      // 用 insertAdjacentHTML 追加而非 innerHTML +=：
      // 后者会让浏览器重新解析整个容器，导致已渲染的帖子卡片被重建，
      // 入场动画会重放一遍，视觉上像闪了一下。
      container.insertAdjacentHTML('beforeend', paginationHtml);

      container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', function() {
          const page = parseInt(this.dataset.page);
          if (page >= 1 && page <= totalPages) {
            currentPageNum = page;
            const url = new URL(window.location);
            url.searchParams.set('postpage', page);
            window.history.pushState({}, '', url);
            renderFeed();
            // 分页控件位于列表末尾，翻页后若不回到顶部，用户看到的仍是
            // 新一页的底部，需要手动上滚才能读到第一条。这里平滑滚回顶部。
            scrollFeedToTop();
          }
        });
      });
    }

    container.querySelectorAll('.post-card').forEach(card => {
      card.addEventListener('click', function(e) {
        if (e.target.closest('button')) return;
        const postId = this.dataset.postid;
        switchToPost(postId);
      });
    });

    container.querySelectorAll('.post-username').forEach(username => {
      username.addEventListener('click', function(e) {
        e.stopPropagation();
        switchPage('user', this.dataset.username);
      });
    });

    container.querySelectorAll('.post-image').forEach(image => {
      image.addEventListener('click', function(e) {
        e.stopPropagation();
        openImageViewer(this.src);
      });
    });

    // 卡片上不再放举报与删除按钮：这两个操作针对的是帖子内容本身，
    // 放在卡片上容易被误解为对整张卡片操作，也容易误点。
    // 它们统一放在帖子详情页，用户点进帖子后操作。
    // （卡片的点击跳转绑定在上方，此处无需重复绑定。）
  }).catch(err => {
    container.innerHTML = '<div style="text-align:center;color:#ef4444;padding:40px 0;">加载失败：' + escapeHTML(err.message) +
      '</div>';
  });
}

// 注：renderStats 定义在 app.js 中（同时更新主页与帖子详情页的统计，
// 且带空值保护）。此处原先有一份同名实现，因 app.js 后加载而被整体
// 覆盖，属于死代码，已删除以免日后改错地方。

function renderLinks() {
  API.getLinks().then(links => {
    const ul = document.getElementById('friendlyLinks');
    if (!links || links.length === 0) {
      ul.innerHTML = '<li style="color:#94a3b8;font-size:13px;">暂无链接</li>';
      return;
    }
    let html = '';
    links.forEach(l => {
      html += '<li><a href="' + escapeHTML(safeURL(l.url, { allowRelative: false })) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(l.title) + '</a></li>';
    });
    ul.innerHTML = sanitizeHTML(html);
  }).catch(() => {});
}

// 排序切换
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    currentSort = this.dataset.sort;
    currentPageNum = 1;
    const url = new URL(window.location);
    url.searchParams.delete('postpage');
    window.history.pushState({}, '', url);
    renderFeed();
  });
});

// ============================================================
//  🔍 搜索
// ============================================================
// 输入时防抖 350ms 自动搜索，回车立即搜索。
// 关键词写入 URL（?q=），刷新与分享可保持搜索状态。

(function initSearch() {
  const input = document.getElementById('postSearchInput');
  const clearBtn = document.getElementById('postSearchClear');
  const wrap = input ? input.closest('.feed-search') : null;
  if (!input) return;

  let debounceTimer = null;

  function syncClearButton() {
    if (clearBtn) clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
  }

  function runSearch(keyword, { updateUrl = true } = {}) {
    const next = (keyword || '').trim();
    // 与当前状态相同则不必重新请求
    if (next === currentSearch && currentPageNum === 1) return;

    currentSearch = next;
    currentPageNum = 1;

    if (updateUrl) {
      const url = new URL(window.location);
      if (next) url.searchParams.set('q', next);
      else url.searchParams.delete('q');
      url.searchParams.delete('postpage');
      window.history.pushState({}, '', url);
    }

    if (wrap) wrap.classList.add('is-searching');
    renderFeed();
    // renderFeed 内部是异步的，这里在下一轮事件循环后移除进度条即可
    // （列表本身会先显示「加载中」，不会长时间空白）
    window.setTimeout(() => {
      if (wrap) wrap.classList.remove('is-searching');
    }, 600);
  }

  input.addEventListener('input', () => {
    syncClearButton();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(input.value), 350);
  });

  // 回车立即搜索，跳过防抖
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimer) clearTimeout(debounceTimer);
      runSearch(input.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.value = '';
      syncClearButton();
      if (debounceTimer) clearTimeout(debounceTimer);
      runSearch('');
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      syncClearButton();
      if (debounceTimer) clearTimeout(debounceTimer);
      runSearch('');
      input.focus();
    });
  }

  // 暴露给外部（初始化时按 URL 恢复搜索状态）
  window.__feedSearch = {
    setKeyword(keyword) {
      input.value = keyword || '';
      currentSearch = (keyword || '').trim();
      syncClearButton();
    },
    run: runSearch,
  };

  syncClearButton();
})();
