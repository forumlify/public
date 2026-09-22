// ============================================================
//  💀 骨架屏生成器
// ------------------------------------------------------------
//  用与真实内容同构的灰块替代「加载中...」文字，让等待期间就能看出
//  版面结构，内容出现时也不会发生明显的布局跳动。
//
//  所有函数返回 HTML 字符串，由调用方写入容器。
//  数量刻意与首页默认每页条数（20）不同——只画 3~5 条即可，
//  画满 20 条反而增加渲染负担，而用户在下一次绘制前看不完。
// ============================================================

const Skeleton = {
  // 单张帖子卡片：头像 + 用户名 + 标题 + 正文两行
  postCard({ withThumbs = false } = {}) {
    return `
      <div class="skeleton-card">
        <div class="skeleton-header">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-line w-30" style="margin-bottom:0;"></div>
        </div>
        <div class="skeleton-line skeleton-title w-60"></div>
        <div class="skeleton-line w-100"></div>
        <div class="skeleton-line w-80"></div>
        ${withThumbs ? '<div class="skeleton-thumbs"><div class="skeleton-thumb"></div><div class="skeleton-thumb"></div></div>' : ''}
      </div>
    `;
  },

  // 帖子列表
  // 数量不宜过多：骨架卡片是按「理想内容」画的，实际帖子往往更短
  // （标题一行、正文一两行），画太多会在真实内容出现时造成容器高度
  // 骤降，页面内容整体上跳。用 3 张作为折中。
  postList(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
      // 第二张带缩略图占位，更接近真实列表的参差感
      html += this.postCard({ withThumbs: i === 1 });
    }
    return html;
  },

  // 帖子详情：标题 + 多行正文 + 回复区
  postDetail() {
    return `
      <div class="skeleton-card">
        <div class="skeleton-header">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-line w-30" style="margin-bottom:0;"></div>
        </div>
        <div class="skeleton-line skeleton-title w-45"></div>
        <div class="skeleton-line w-100"></div>
        <div class="skeleton-line w-100"></div>
        <div class="skeleton-line w-60"></div>
      </div>
    `;
  },

  // 回复条目
  replyItem() {
    return `
      <div class="skeleton-card" style="padding:14px 18px;">
        <div class="skeleton-header">
          <div class="skeleton-avatar" style="width:28px;height:28px;"></div>
          <div class="skeleton-line w-30" style="margin-bottom:0;"></div>
        </div>
        <div class="skeleton-line w-80"></div>
      </div>
    `;
  },

  // 表格类列表（管理后台的用户 / 日志 / 友链）
  tableRows(count = 6) {
    let html = '';
    for (let i = 0; i < count; i++) {
      // 三列宽度固定，模拟表格的列对齐
      html += `
        <div class="skeleton-row">
          <div class="skeleton-line" style="width:32%;margin-bottom:0;"></div>
          <div class="skeleton-line" style="width:22%;margin-bottom:0;"></div>
          <div class="skeleton-line" style="width:16%;margin-bottom:0;"></div>
        </div>
      `;
    }
    return html;
  },

  // 用户主页
  userProfile() {
    return `
      <div class="skeleton-card" style="text-align:center;padding:28px;">
        <div class="skeleton-avatar" style="width:64px;height:64px;margin:0 auto 14px;"></div>
        <div class="skeleton-line w-30" style="margin:0 auto 10px;"></div>
        <div class="skeleton-line w-45" style="margin:0 auto;"></div>
      </div>
      ${this.postList(2)}
    `;
  },
};

// 挂到 window 供各模块使用（各文件都是普通 script，共享全局作用域）
window.Skeleton = Skeleton;

// ============================================================
//  首屏预置骨架屏
// ------------------------------------------------------------
//  真正的列表渲染要等 i18n 初始化完成后才触发（DOMContentLoaded 之后
//  还有 200ms 延迟）。若不提前占位，用户会先看到一段「加载中...」
//  文字，等骨架屏出现时数据往往已经回来了，等于白做。
//
//  这里在脚本执行时（早于 DOMContentLoaded）就把骨架屏写好，让它在
//  第一帧就可见。renderFeed 拿到数据后会直接覆盖这个容器。
// ============================================================
(function primeSkeleton() {
  function insert() {
    const list = document.getElementById('postList');
    if (list && !list.dataset.loaded) {
      list.innerHTML = Skeleton.postList(3);
    }
  }
  if (document.readyState === 'loading') {
    // DOM 尚未就绪时，解析到 postList 之后再插入；
    // 用 DOMContentLoaded 会偏晚，因此监听 readystatechange 的
    // interactive 阶段。
    document.addEventListener('readystatechange', function onReady() {
      if (document.readyState !== 'loading') {
        document.removeEventListener('readystatechange', onReady);
        insert();
      }
    });
  } else {
    insert();
  }
})();
