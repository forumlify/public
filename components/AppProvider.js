'use client';

// 全局状态 Provider：用户、主题、论坛名、当前视图（feed/post/new/admin/...）
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { API, getTheme, setToken, getToken } from '@/lib/api';
import { applyFavicon } from '@/lib/favicon';

const AppContext = createContext(null);

const POST_TRANSITION_PARTS = [
  ['.post-avatar', 'post-avatar'],
  ['.post-username', 'post-author'],
  ['.post-title', 'post-heading'],
  ['.post-time', 'post-time'],
  ['.post-content, .topic-preview', 'post-body'],
  ['.post-images', 'post-media'],
  ['.post-pin-state', 'post-pin-state'],
  ['.post-edited-label', 'post-edited-label'],
  ['.post-actions', 'post-feed-actions'],
];

function namePostTransitionParts(card) {
  if (!card) return [];
  return POST_TRANSITION_PARTS.flatMap(([selector, name]) => {
    const element = card.querySelector(selector);
    if (!element) return [];
    element.style.viewTransitionName = name;
    return [element];
  });
}

function clearPostTransitionParts(elements) {
  elements.forEach((element) => {
    element.style.viewTransitionName = '';
  });
}

const SETTINGS_AVATAR_SELECTOR = [
  '.post-avatar',
  '.reply-avatar',
  '.user-profile-avatar',
  '.admin-user-avatar',
].join(', ');

const SETTINGS_NAME_SELECTOR = [
  '.post-username',
  '.reply-username',
  '.user-profile-name',
  '.admin-user-name',
].join(', ');

function visibleAreaRatio(element) {
  if (!element?.isConnected) return 0;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return 0;

  const bounds = element.getBoundingClientRect();
  const totalArea = bounds.width * bounds.height;
  if (totalArea <= 0) return 0;

  let left = Math.max(0, bounds.left);
  let top = Math.max(0, bounds.top);
  let right = Math.min(window.innerWidth, bounds.right);
  let bottom = Math.min(window.innerHeight, bounds.bottom);

  // Account for scroll/clip containers, but deliberately do not treat the
  // translucent navbar as an occluder: content underneath it is still visible.
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const parentStyle = window.getComputedStyle(parent);
    const clipsX = ['auto', 'scroll', 'hidden', 'clip'].includes(parentStyle.overflowX);
    const clipsY = ['auto', 'scroll', 'hidden', 'clip'].includes(parentStyle.overflowY);
    if (!clipsX && !clipsY) continue;
    const parentBounds = parent.getBoundingClientRect();
    if (clipsX) {
      left = Math.max(left, parentBounds.left);
      right = Math.min(right, parentBounds.right);
    }
    if (clipsY) {
      top = Math.max(top, parentBounds.top);
      bottom = Math.min(bottom, parentBounds.bottom);
    }
  }

  return Math.max(0, right - left) * Math.max(0, bottom - top) / totalArea;
}

function randomElement(elements) {
  return elements[Math.floor(Math.random() * elements.length)] || null;
}

function findSettingsTransitionSource(username) {
  const groups = Array.from(document.querySelectorAll('[data-username]')).filter(
    (element) => !element.closest('#navbar') && element.dataset.username === String(username || '')
  );
  const candidates = groups.map((group) => {
    const avatarElement = group.querySelector(SETTINGS_AVATAR_SELECTOR);
    const nameElement = group.querySelector(SETTINGS_NAME_SELECTOR);
    return {
      avatarElement: visibleAreaRatio(avatarElement) >= 0.5 ? avatarElement : null,
      nameElement: visibleAreaRatio(nameElement) >= 0.5 ? nameElement : null,
    };
  });
  const completeCandidates = candidates.filter(({ avatarElement, nameElement }) => avatarElement && nameElement);
  if (completeCandidates.length > 0) return randomElement(completeCandidates);

  return randomElement(candidates.filter(({ avatarElement, nameElement }) => avatarElement || nameElement)) || {
    avatarElement: null,
    nameElement: null,
  };
}

const BUILT_IN_PAGES = new Set(['messages', 'settings', 'admin', 'new']);

function cleanPathSegment(value) {
  return encodeURIComponent(String(value || '').trim());
}

function pathForPage(page) {
  return page === 'feed' ? '/' : `/${cleanPathSegment(page)}`;
}

function pathForUser(username) {
  return `/user/${cleanPathSegment(username)}`;
}

function pathForPost(postRef) {
  return `/post/${cleanPathSegment(postRef)}`;
}

function pathForCustomPage(pageName) {
  return `/${cleanPathSegment(pageName)}`;
}

function routeFromLocation(location) {
  const parts = location.pathname.split('/').filter(Boolean).map((part) => {
    try { return decodeURIComponent(part); } catch { return part; }
  });
  const legacy = new URLSearchParams(location.search);
  const legacyPost = legacy.get('post');
  const legacyUser = legacy.get('user');
  const legacyPage = legacy.get('page');

  if (parts[0] === 'post' && parts.length === 2) return { page: 'post', postId: parts[1] };
  if (parts[0] === 'user' && parts.length === 2) return { page: 'user', username: parts[1] };
  if (parts.length === 1 && BUILT_IN_PAGES.has(parts[0])) return { page: parts[0] };
  if (parts.length === 1) return { page: 'custom', pageName: parts[0] };

  // Compatibility for links created before path-based navigation.
  if (legacyPost) return { page: 'post', postId: legacyPost, legacy: true };
  if (legacyUser) return { page: 'user', username: legacyUser, legacy: true };
  if (legacyPage && BUILT_IN_PAGES.has(legacyPage)) return { page: legacyPage, legacy: true };
  if (legacyPage) return { page: 'custom', pageName: legacyPage, legacy: true };
  return { page: 'feed' };
}

function pathForRoute(route) {
  if (route.page === 'post') return pathForPost(route.postId);
  if (route.page === 'user') return pathForUser(route.username);
  if (route.page === 'custom') return pathForCustomPage(route.pageName);
  return pathForPage(route.page);
}

function clearLegacyPageParams(url) {
  url.searchParams.delete('page');
  url.searchParams.delete('post');
  url.searchParams.delete('user');
  return url;
}

function postCardMatches(element, postRef) {
  const ref = String(postRef || '');
  return element?.dataset.postRef === ref || element?.dataset.postId === ref;
}

function waitForPostImages(container) {
  const images = Array.from(container?.querySelectorAll('img') || []);
  if (images.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(finish, 1200);
    Promise.all(images.map((image) => image.decode?.().catch(() => {}) || Promise.resolve())).then(finish);
  });
}

function stageSharedGeometry(transition, {
  name,
  duration,
  moveOffset,
  moveEasing = 'cubic-bezier(0.16, 1, 0.3, 1)',
  resizeEasing = 'cubic-bezier(0.4, 0, 0.2, 1)',
  reverse = false,
}) {
  transition.ready.then(() => {
    const groupAnimation = document.getAnimations().find(
      (animation) => animation.effect?.pseudoElement === `::view-transition-group(${name})`
    );
    const frames = groupAnimation?.effect?.getKeyframes();
    if (!groupAnimation || !frames || frames.length < 2) return;

    const start = frames[0];
    const end = frames[frames.length - 1];
    groupAnimation.effect.setKeyframes(reverse ? [
      {
        offset: 0,
        width: start.width,
        height: start.height,
        transform: start.transform,
        easing: resizeEasing,
      },
      {
        offset: 1 - moveOffset,
        width: start.width,
        height: end.height,
        transform: start.transform,
        easing: moveEasing,
      },
      {
        offset: 1,
        width: end.width,
        height: end.height,
        transform: end.transform,
      },
    ] : [
      {
        offset: 0,
        width: start.width,
        height: start.height,
        transform: start.transform,
        easing: moveEasing,
      },
      {
        offset: moveOffset,
        width: end.width,
        height: start.height,
        transform: end.transform,
        easing: resizeEasing,
      },
      {
        offset: 1,
        width: end.width,
        height: end.height,
        transform: end.transform,
      },
    ]);
    groupAnimation.effect.updateTiming({ duration, easing: 'linear', fill: 'both' });
  }).catch(() => {});
}

function stagePostBodyGeometry(transition, {
  duration,
  moveOffset,
  moveEasing = 'cubic-bezier(0.42, 0, 0.58, 1)',
  resizeEasing = 'cubic-bezier(0.42, 0, 0.58, 1)',
}) {
  transition.ready.then(() => {
    const animations = document.getAnimations();
    const cardAnimation = animations.find(
      (animation) => animation.effect?.pseudoElement === '::view-transition-group(post-expand)'
    );
    const bodyAnimation = animations.find(
      (animation) => animation.effect?.pseudoElement === '::view-transition-group(post-body)'
    );
    const cardFrames = cardAnimation?.effect?.getKeyframes();
    const bodyFrames = bodyAnimation?.effect?.getKeyframes();
    if (!bodyAnimation || !cardFrames || cardFrames.length < 2 || !bodyFrames || bodyFrames.length < 2) return;

    const cardStart = cardFrames[0];
    const cardEnd = cardFrames[cardFrames.length - 1];
    const bodyStart = bodyFrames[0];
    const bodyEnd = bodyFrames[bodyFrames.length - 1];
    const cardStartMatrix = new DOMMatrixReadOnly(cardStart.transform);
    const cardEndMatrix = new DOMMatrixReadOnly(cardEnd.transform);
    const bodyStartMatrix = new DOMMatrixReadOnly(bodyStart.transform);
    const bodyEndMatrix = new DOMMatrixReadOnly(bodyEnd.transform);
    const startCardWidth = Number.parseFloat(cardStart.width);
    const endCardWidth = Number.parseFloat(cardEnd.width);
    const startBodyWidth = Number.parseFloat(bodyStart.width);
    if (![startCardWidth, endCardWidth, startBodyWidth].every(Number.isFinite)) return;

    // 第一阶段让正文锁定在卡片内的原始位置；卡片停稳后，正文才调整到详情布局。
    const leftInset = bodyStartMatrix.e - cardStartMatrix.e;
    const topInset = bodyStartMatrix.f - cardStartMatrix.f;
    const rightInset = startCardWidth - leftInset - startBodyWidth;
    const midpointWidth = Math.max(0, endCardWidth - leftInset - rightInset);
    const midpointTransform = new DOMMatrix([
      bodyEndMatrix.a,
      bodyEndMatrix.b,
      bodyEndMatrix.c,
      bodyEndMatrix.d,
      cardEndMatrix.e + leftInset,
      cardEndMatrix.f + topInset,
    ]).toString();

    bodyAnimation.effect.setKeyframes([
      {
        offset: 0,
        width: bodyStart.width,
        height: bodyStart.height,
        transform: bodyStart.transform,
        easing: moveEasing,
      },
      {
        offset: moveOffset,
        width: `${midpointWidth}px`,
        height: bodyStart.height,
        transform: midpointTransform,
        easing: resizeEasing,
      },
      {
        offset: 1,
        width: bodyEnd.width,
        height: bodyEnd.height,
        transform: bodyEnd.transform,
      },
    ]);
    bodyAnimation.effect.updateTiming({ duration, easing: 'linear', fill: 'both' });
  }).catch(() => {});
}

export function useApp() {
  return useContext(AppContext);
}

export default function AppProvider({ children, cachedName = '' }) {
  const [currentUser, setCurrentUser] = useState(null);
  // 论坛名初始值来自 cookie（SSR 首帧即输出，SSR/客户端一致 → 无 hydration mismatch）
  const [forumName, setForumName] = useState(cachedName || 'Forumlify');
  const [theme, setThemeState] = useState('light');
  const [view, setView] = useState('feed'); // feed | post | new | admin | settings | messages | user | custom
  const [currentPostId, setCurrentPostId] = useState(null);
  const [currentPostPreview, setCurrentPostPreview] = useState(null);
  const [currentPostOrigin, setCurrentPostOrigin] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);
  const [currentUserPreview, setCurrentUserPreview] = useState(null);
  const [currentUserPostsPreview, setCurrentUserPostsPreview] = useState(null);
  const [currentPageName, setCurrentPageName] = useState(null);
  const [sort, setSort] = useState('latest');
  const [refreshKey, setRefreshKey] = useState(0);
  const [ready, setReady] = useState(false); // 初始加载完成标记（控制加载页/淡入）
  // 有 cookie 缓存名即视为已加载（SSR/客户端一致）
  const [forumNameLoaded, setForumNameLoaded] = useState(!!cachedName);
  const loadedRef = useRef(false);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // 论坛名写 cookie（SSR 可读 → 首帧输出，无需内联脚本注入 DOM）
  const syncForumNameCookie = useCallback((name) => {
    try {
      document.cookie = 'forumlify-name=' + encodeURIComponent(name) + '; path=/; max-age=31536000';
    } catch (e) {}
  }, []);

  // 主题
  useEffect(() => {
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    // 系统主题变化时跟随（仅当用户未手动设置过）
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) {
      const onSysChange = () => {
        if (!localStorage.getItem('forumlify-theme')) {
          const next = mq.matches ? 'dark' : 'light';
          setThemeState(next);
          document.documentElement.setAttribute('data-theme', next);
        }
      };
      mq.addEventListener('change', onSysChange);
      return () => mq.removeEventListener('change', onSysChange);
    }
  }, []);

  // 论坛名变化时同步浏览器标题（覆盖初始化/数据库加载/改名三条路径）
  useEffect(() => {
    document.title = forumName;
    const titleEl = document.querySelector('title');
    if (titleEl) titleEl.textContent = forumName;
  }, [forumName]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('forumlify-theme', next);
      return next;
    });
  }, []);

  // 初始化：读取缓存论坛名（立即显示），恢复登录、加载服务器论坛名
  useEffect(() => {
    // 缓存论坛名（hydrate 后立即生效；SSR 首帧已由 cookie 输出）
    try {
      const cached = localStorage.getItem('forumlify-forum-name');
      if (cached) {
        setForumName(cached);
        setForumNameLoaded(true);
        syncForumNameCookie(cached);
      }
    } catch (e) {}

    if (loadedRef.current) return;
    loadedRef.current = true;

    async function init() {
      const token = getToken();
      if (token) {
        try {
          const user = await API.getMe();
          setCurrentUser(user);
            } catch {
          setToken(null);
        }
      }
      try {
        const s = await API.getSettings();
        if (s.forum_name) {
          setForumName(s.forum_name);
          localStorage.setItem('forumlify-forum-name', s.forum_name);
          syncForumNameCookie(s.forum_name);
        }
        if (s.favicon_url) applyFavicon(s.favicon_url, s.favicon_version);
        // 先标记论坛名已收到（加载页原地淡入名字），稍后切换主页
        setForumNameLoaded(true);
        setTimeout(() => setReady(true), 650);
      } catch {
        setForumNameLoaded(true);
        setReady(true);
      }
    }
    init();
  }, []);

  // 页面标题：初始化中轮换 Loading. → Loading.. → Loading...，收到论坛名/完成后显示论坛名
  useEffect(() => {
    // 尚未收到论坛名且未完成初始化：轮换 Loading.
    if (!ready && !forumNameLoaded) {
      const seq = ['Loading.', 'Loading..', 'Loading...'];
      let i = 0;
      document.title = seq[0];
      const t = setInterval(() => {
        i = (i + 1) % seq.length;
        document.title = seq[i];
      }, 1000);
      return () => {
        clearInterval(t);
      };
    }
    // 已收到论坛名或初始化完成：标题显示论坛名（Next 重置 metadata 时也能恢复）
    document.title = forumName;
    const titleEl = document.querySelector('title');
    if (titleEl) titleEl.textContent = forumName;
  }, [ready, forumNameLoaded, forumName]);

  const applyRoute = useCallback((route, state = {}) => {
    setView(route.page);
    setCurrentPostId(route.page === 'post' ? route.postId : null);
    setCurrentPostPreview(null);
    setCurrentPostOrigin(route.page === 'post' ? state.origin || null : null);
    setCurrentUsername(route.page === 'user' ? route.username : null);
    setCurrentUserPreview(null);
    setCurrentUserPostsPreview(null);
    setCurrentPageName(route.page === 'custom' ? route.pageName : null);
  }, []);

  // Initialize from path routes and normalize legacy query-based links.
  useEffect(() => {
    const route = routeFromLocation(window.location);
    applyRoute(route, window.history.state || {});
    if (route.legacy) {
      const normalized = clearLegacyPageParams(new URL(window.location));
      normalized.pathname = pathForRoute(route);
      window.history.replaceState({ ...window.history.state, ...route }, '', normalized);
    }
  }, [applyRoute]);

  // 视图切换：同步 URL (pushState，模拟原 SPA 行为)
  const navigate = useCallback((page) => {
    const url = clearLegacyPageParams(new URL(window.location));
    url.pathname = pathForPage(page);
    const commitNavigation = (refreshFeed = true) => {
      window.history.pushState({ page }, '', url);
      setView(page);
      setCurrentPostId(null);
      setCurrentPostPreview(null);
      setCurrentPostOrigin(null);
      setCurrentUsername(null);
      setCurrentUserPreview(null);
      setCurrentUserPostsPreview(null);
      if (refreshFeed) refresh();
    };

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (page === 'new' && view === 'feed' && document.startViewTransition && !reduceMotion) {
      const root = document.documentElement;
      const sourceIcon = document.querySelector('#feed .fab-btn .new-post-launch-icon');
      const sourceLabel = document.querySelector('#feed .fab-btn .new-post-launch-label');

      if (!sourceIcon || !sourceLabel) {
        commitNavigation();
        return;
      }

      root.classList.add('new-post-view-transition');
      sourceIcon.style.viewTransitionName = 'new-post-plus';
      sourceLabel.style.viewTransitionName = 'new-post-title';

      const transition = document.startViewTransition(() => {
        sourceIcon.style.viewTransitionName = '';
        sourceLabel.style.viewTransitionName = '';
        flushSync(() => commitNavigation(false));
      });
      transition.finished.finally(() => {
        root.classList.remove('new-post-view-transition');
      });
      return;
    }

    if (page === 'feed' && view === 'new' && document.startViewTransition && !reduceMotion) {
      const root = document.documentElement;
      const sourceIcon = document.querySelector('#pageNew .new-post-title-icon');
      const sourceLabel = document.querySelector('#pageNew .new-post-title-label');

      if (!sourceIcon || !sourceLabel) {
        commitNavigation();
        return;
      }

      let targetIcon = null;
      let targetLabel = null;
      root.classList.add('new-post-view-transition', 'returning-new-post-home');
      sourceIcon.style.viewTransitionName = 'new-post-plus';
      sourceLabel.style.viewTransitionName = 'new-post-title';

      const transition = document.startViewTransition(() => {
        sourceIcon.style.viewTransitionName = '';
        sourceLabel.style.viewTransitionName = '';
        flushSync(() => commitNavigation(false));
        targetIcon = document.querySelector('#feed .fab-btn .new-post-launch-icon');
        targetLabel = document.querySelector('#feed .fab-btn .new-post-launch-label');
        if (targetIcon) targetIcon.style.viewTransitionName = 'new-post-plus';
        if (targetLabel) targetLabel.style.viewTransitionName = 'new-post-title';
      });
      const clearTargetNames = () => {
        if (targetIcon) targetIcon.style.viewTransitionName = '';
        if (targetLabel) targetLabel.style.viewTransitionName = '';
      };
      transition.ready.then(clearTargetNames, clearTargetNames);
      transition.finished.finally(() => {
        root.classList.remove('new-post-view-transition', 'returning-new-post-home');
        refresh();
      });
      return;
    }

    if (page === 'settings' && view !== 'settings' && document.startViewTransition && !reduceMotion) {
      const root = document.documentElement;
      const visibleSource = findSettingsTransitionSource(currentUser?.username);
      const navbarAvatar = document.querySelector('#navbar #userDropdown .avatar');
      const sourceAvatar = visibleSource.avatarElement || navbarAvatar;
      const sourceName = visibleSource.nameElement;
      const avatarFromNavbar = sourceAvatar === navbarAvatar;

      if (!sourceAvatar) {
        commitNavigation();
        return;
      }

      root.classList.add('settings-view-transition');
      if (avatarFromNavbar) root.classList.add('settings-avatar-from-navbar');
      if (!sourceName) root.classList.add('settings-name-fade-only');
      sourceAvatar.style.viewTransitionName = 'settings-avatar';
      if (sourceName) sourceName.style.viewTransitionName = 'settings-user-name';

      const transition = document.startViewTransition(() => {
        sourceAvatar.style.viewTransitionName = '';
        if (sourceName) sourceName.style.viewTransitionName = '';
        if (avatarFromNavbar) root.classList.add('settings-navbar-avatar-hidden');
        flushSync(() => commitNavigation(false));
      });
      transition.finished.finally(() => {
        root.classList.remove(
          'settings-view-transition',
          'settings-avatar-from-navbar',
          'settings-name-fade-only',
          'settings-navbar-avatar-hidden'
        );
        if (avatarFromNavbar) {
          root.classList.add('settings-navbar-avatar-reveal');
          window.setTimeout(() => root.classList.remove('settings-navbar-avatar-reveal'), 360);
        }
        refresh();
      });
      return;
    }

    if (page === 'feed' && view === 'settings' && document.startViewTransition && !reduceMotion) {
      const root = document.documentElement;
      const sourceAvatar = document.querySelector('#pageSettings .settings-profile-avatar');
      const sourceName = document.querySelector('#pageSettings .settings-profile-name');

      if (!sourceAvatar) {
        commitNavigation();
        return;
      }

      let targetAvatar = null;
      let targetName = null;
      root.classList.add(
        'settings-view-transition',
        'returning-settings-home',
        'settings-navbar-avatar-hidden'
      );

      const transition = document.startViewTransition(() => {
        flushSync(() => commitNavigation(false));
        const visibleTarget = findSettingsTransitionSource(currentUser?.username);
        const navbarAvatar = document.querySelector('#navbar #userDropdown .avatar');
        targetAvatar = visibleTarget.avatarElement || navbarAvatar;
        targetName = visibleTarget.nameElement;

        // Hide the navbar avatar only in the old snapshot. The new snapshot
        // must expose it as the shared target when no visible feed avatar exists.
        root.classList.remove('settings-navbar-avatar-hidden');

        if (targetAvatar) targetAvatar.style.viewTransitionName = 'settings-avatar';
        if (targetName) {
          targetName.style.viewTransitionName = 'settings-user-name';
        } else {
          root.classList.add('settings-name-return-fade-only');
        }
      });
      const clearTargetNames = () => {
        if (targetAvatar) targetAvatar.style.viewTransitionName = '';
        if (targetName) targetName.style.viewTransitionName = '';
      };
      transition.ready.then(clearTargetNames, clearTargetNames);
      transition.finished.finally(() => {
        root.classList.remove(
          'settings-view-transition',
          'returning-settings-home',
          'settings-name-return-fade-only',
          'settings-navbar-avatar-hidden'
        );
        refresh();
      });
      return;
    }

    if (page !== 'feed' || view === 'feed' || !document.startViewTransition || reduceMotion) {
      commitNavigation();
      return;
    }

    if (view === 'user') {
      const root = document.documentElement;
      const sourceAvatar = document.querySelector('#pageUser .user-profile-avatar');
      const sourceName = document.querySelector('#pageUser .user-profile-name');
      const findTargetCard = () => {
        if (currentUserPreview?.sourcePostId) {
          const exact = Array.from(document.querySelectorAll('[data-post-ref], [data-post-id]')).find(
            (element) => postCardMatches(element, currentUserPreview.sourcePostId)
          );
          if (exact) return exact;
        }
        return Array.from(document.querySelectorAll('[data-username]')).find(
          (element) => element.dataset.username === String(currentUsername || '')
        ) || null;
      };
      let targetCard = findTargetCard();

      if (sourceAvatar && sourceName && targetCard) {
        let targetAvatar = null;
        let targetName = null;
        root.classList.add('user-view-transition', 'returning-user-home');
        const transition = document.startViewTransition(() => {
          flushSync(() => commitNavigation(false));
          targetCard = findTargetCard();
          targetAvatar = targetCard?.querySelector('.post-avatar') || null;
          targetName = targetCard?.querySelector('.post-username') || null;
          if (targetAvatar) targetAvatar.style.viewTransitionName = 'user-avatar';
          if (targetName) targetName.style.viewTransitionName = 'user-name';
        });
        const clearTargetNames = () => {
          if (targetAvatar) targetAvatar.style.viewTransitionName = '';
          if (targetName) targetName.style.viewTransitionName = '';
        };
        transition.ready.then(clearTargetNames, clearTargetNames);
        transition.finished.finally(() => {
          root.classList.remove('user-view-transition', 'returning-user-home');
          refresh();
        });
        return;
      }
    }

    let targetCard = currentPostId
      ? Array.from(document.querySelectorAll('[data-post-ref], [data-post-id]')).find((element) => postCardMatches(element, currentPostId))
      : null;
    let targetParts = [];
    document.documentElement.classList.add('home-view-transition');
    if (targetCard) document.documentElement.classList.add('returning-home');

    const transition = document.startViewTransition(() => {
      flushSync(() => commitNavigation(false));
      targetCard = currentPostId
        ? Array.from(document.querySelectorAll('[data-post-ref], [data-post-id]')).find((element) => postCardMatches(element, currentPostId))
        : null;
      if (targetCard) targetCard.style.viewTransitionName = 'post-expand';
      targetParts = namePostTransitionParts(targetCard);
    });
    stageSharedGeometry(transition, {
      name: 'post-expand',
      duration: 1100,
      moveOffset: 0.73,
      moveEasing: 'cubic-bezier(0.42, 0, 0.58, 1)',
      resizeEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      reverse: true,
    });
    stageSharedGeometry(transition, {
      name: 'post-body',
      duration: 1100,
      moveOffset: 0.73,
      moveEasing: 'cubic-bezier(0.42, 0, 0.58, 1)',
      resizeEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      reverse: true,
    });
    const clearTargetNames = () => {
      if (targetCard) targetCard.style.viewTransitionName = '';
      clearPostTransitionParts(targetParts);
    };
    transition.ready.then(clearTargetNames, clearTargetNames);
    transition.finished.finally(() => {
      document.documentElement.classList.remove('home-view-transition', 'returning-home');
      refresh();
    });
  }, [currentPostId, currentUser, currentUsername, currentUserPreview, refresh, view]);

  const openPost = useCallback((postId, sourceElement = null, preview = null, origin = null) => {
    const postRef = preview?.post_number || postId;
    const url = clearLegacyPageParams(new URL(window.location));
    url.pathname = pathForPost(postRef);
    const resolvedOrigin = origin || { view };
    const historyOrigin = resolvedOrigin?.view === 'user'
      ? { view: 'user', username: resolvedOrigin.username }
      : { view: resolvedOrigin?.view || 'feed' };
    const commitNavigation = () => {
      window.history.pushState({ page: 'post', postId: postRef, origin: historyOrigin }, '', url);
      setView('post');
      setCurrentPostId(postRef);
      setCurrentPostPreview(preview);
      setCurrentPostOrigin(resolvedOrigin);
      setCurrentUserPreview(null);
      setCurrentUserPostsPreview(null);
    };

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!sourceElement || !document.startViewTransition || reduceMotion) {
      commitNavigation();
      return;
    }

    document.documentElement.classList.remove('post-transition-settled');
    sourceElement.style.viewTransitionName = 'post-expand';
    const sourceParts = namePostTransitionParts(sourceElement);
    document.documentElement.classList.add('post-view-transition');
    const transition = document.startViewTransition(async () => {
      flushSync(commitNavigation);
      await waitForPostImages(document.querySelector('#pagePost .post-detail-card'));
    });
    stageSharedGeometry(transition, {
      name: 'post-expand',
      duration: 960,
      moveOffset: 0.62,
      moveEasing: 'cubic-bezier(0.42, 0, 0.58, 1)',
      resizeEasing: 'cubic-bezier(0.42, 0, 0.58, 1)',
    });
    stagePostBodyGeometry(transition, {
      duration: 960,
      moveOffset: 0.62,
      moveEasing: 'cubic-bezier(0.42, 0, 0.58, 1)',
      resizeEasing: 'cubic-bezier(0.42, 0, 0.58, 1)',
    });
    const clearSourceNames = () => {
      sourceElement.style.viewTransitionName = '';
      clearPostTransitionParts(sourceParts);
    };
    transition.ready.then(clearSourceNames, clearSourceNames);
    transition.finished.finally(() => {
      const root = document.documentElement;
      root.classList.remove('post-view-transition');
      root.classList.add('post-transition-settled');
      window.setTimeout(() => root.classList.remove('post-transition-settled'), 220);
    });
  }, [view]);

  const returnFromPost = useCallback(() => {
    if (currentPostOrigin?.view !== 'user' || !currentPostOrigin.username) {
      navigate('feed');
      return;
    }

    const url = clearLegacyPageParams(new URL(window.location));
    url.pathname = pathForUser(currentPostOrigin.username);
    const commitNavigation = () => {
      window.history.pushState({ page: 'user', username: currentPostOrigin.username }, '', url);
      setView('user');
      setCurrentUsername(currentPostOrigin.username);
      setCurrentUserPreview(currentPostOrigin.user || { username: currentPostOrigin.username });
      setCurrentUserPostsPreview(currentPostOrigin.posts || []);
      setCurrentPostId(null);
      setCurrentPostPreview(null);
    };

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const sourceCard = document.querySelector('#pagePost .post-detail-card');
    if (!sourceCard || !document.startViewTransition || reduceMotion) {
      commitNavigation();
      return;
    }

    const root = document.documentElement;
    let targetCard = null;
    let targetParts = [];
    root.classList.add('home-view-transition', 'returning-home', 'returning-user-post');
    const transition = document.startViewTransition(() => {
      flushSync(commitNavigation);
      const userPage = document.getElementById('pageUser');
      if (userPage) userPage.scrollTop = currentPostOrigin.scrollTop || 0;
      targetCard = Array.from(document.querySelectorAll('#userProfileContent [data-post-ref], #userProfileContent [data-post-id]')).find(
        (element) => postCardMatches(element, currentPostId)
      ) || null;
      if (targetCard) targetCard.style.viewTransitionName = 'post-expand';
      targetParts = namePostTransitionParts(targetCard);
    });
    stageSharedGeometry(transition, {
      name: 'post-expand',
      duration: 1100,
      moveOffset: 0.73,
      moveEasing: 'cubic-bezier(0.42, 0, 0.58, 1)',
      resizeEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      reverse: true,
    });
    stageSharedGeometry(transition, {
      name: 'post-body',
      duration: 1100,
      moveOffset: 0.73,
      moveEasing: 'cubic-bezier(0.42, 0, 0.58, 1)',
      resizeEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      reverse: true,
    });
    const clearTargetNames = () => {
      if (targetCard) targetCard.style.viewTransitionName = '';
      clearPostTransitionParts(targetParts);
    };
    transition.ready.then(clearTargetNames, clearTargetNames);
    transition.finished.finally(() => {
      root.classList.remove('home-view-transition', 'returning-home', 'returning-user-post');
      setCurrentPostOrigin(null);
    });
  }, [currentPostId, currentPostOrigin, navigate]);

  const openUser = useCallback((username, source = null, preview = null) => {
    const url = clearLegacyPageParams(new URL(window.location));
    url.pathname = pathForUser(username);
    const commitNavigation = () => {
      window.history.pushState({ page: 'user', username }, '', url);
      setView('user');
      setCurrentUsername(username);
      setCurrentUserPreview(preview || { username });
      setCurrentPostId(null);
      setCurrentPostPreview(null);
      setCurrentPostOrigin(null);
      setCurrentUserPostsPreview(null);
    };

    const avatarElement = source?.avatarElement;
    const nameElement = source?.nameElement;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!avatarElement || !nameElement || !document.startViewTransition || reduceMotion) {
      commitNavigation();
      return;
    }

    const root = document.documentElement;
    root.classList.remove('user-transition-settled');
    root.classList.add('user-view-transition');
    avatarElement.style.viewTransitionName = 'user-avatar';
    nameElement.style.viewTransitionName = 'user-name';

    const transition = document.startViewTransition(() => {
      flushSync(commitNavigation);
    });
    const clearSourceNames = () => {
      avatarElement.style.viewTransitionName = '';
      nameElement.style.viewTransitionName = '';
    };
    transition.ready.then(clearSourceNames, clearSourceNames);
    transition.finished.finally(() => {
      root.classList.remove('user-view-transition');
      root.classList.add('user-transition-settled');
      window.setTimeout(() => root.classList.remove('user-transition-settled'), 320);
    });
  }, []);

  const openCustomPage = useCallback((pageName) => {
    const url = clearLegacyPageParams(new URL(window.location));
    url.pathname = pathForCustomPage(pageName);
    window.history.pushState({ page: 'custom', pageName }, '', url);
    setView('custom');
    setCurrentPageName(pageName);
    setCurrentUserPreview(null);
  }, []);

  // 浏览器前进后退
  useEffect(() => {
    const onPop = (e) => {
      const state = e.state || {};
      applyRoute(routeFromLocation(window.location), state);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyRoute]);

  const login = useCallback(async (email, password) => {
    const result = await API.login(email, password);
    if (result.user) {
      setCurrentUser(result.user);
    }
    return result;
  }, []);

  const register = useCallback(async (email, password, username, captcha, emailCode = '') => {
    const result = await API.register(email, password, username, captcha, emailCode);
    const loginResult = await API.login(email, password);
    if (loginResult.user) {
      setCurrentUser(loginResult.user);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    API.logout();
    setCurrentUser(null);
    navigate('feed');
  }, [navigate]);

  const updateForumName = useCallback((name) => {
    setForumName(name);
    localStorage.setItem('forumlify-forum-name', name);
    syncForumNameCookie(name);
  }, [syncForumNameCookie]);

  const value = {
    currentUser, setCurrentUser,
    forumName, forumNameLoaded, updateForumName,
    theme, toggleTheme,
    view, navigate,
    currentPostId, currentPostPreview, currentPostOrigin, openPost, returnFromPost,
    currentUsername, currentUserPreview, currentUserPostsPreview, openUser,
    currentPageName, openCustomPage,
    sort, setSort,
    refreshKey, refresh,
    ready,
    login, register, logout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
