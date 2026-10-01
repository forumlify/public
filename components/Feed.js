'use client';

// 信息流：帖子列表 + 排序 tab + 发布新帖按钮
import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '@/lib/api';
import { useApp } from './AppProvider';
import { Icon } from './Icons';
import ImageViewer from './ImageViewer';
import { renderMarkdown } from '@/lib/markdown';
import { useToast } from './Toast';

function avatar(username) {
  return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username || '匿名用户') +
    '&background=6366f1&color=fff&size=64';
}

export default function Feed({ onOpenModal, onReport }) {
  const { currentUser, sort, setSort, openPost, openUser, navigate, refreshKey } = useApp();
  const { t, i18n } = useTranslation();
  const { toast, confirmAction } = useToast();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [selectedSort, setSelectedSort] = useState(sort);
  const [searchInput, setSearchInput] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('q') || '');
  const [searchQuery, setSearchQuery] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('q') || '');
  const [drawerPhase, setDrawerPhase] = useState('closed');
  const postListRef = useRef(null);
  const sortTimerRef = useRef(null);
  const pendingSortRef = useRef(null);
  const initialDrawerOpenedRef = useRef(false);
  const requestRef = useRef(0);
  const PAGE_SIZE = 20;

  const load = useCallback(async (targetPage) => {
    const requestId = ++requestRef.current;
    setError(null);
    try {
      const result = searchQuery
        ? await API.searchPosts(searchQuery, targetPage, PAGE_SIZE)
        : await API.getPosts(sort, null, targetPage, PAGE_SIZE);
      if (requestId !== requestRef.current) return;
      setPosts(result.data || []);
      setTotalPages(result.pagination?.totalPages || 1);
      setPage(result.pagination?.page || 1);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err.message);
      setPosts([]);
    } finally {
      if (requestId !== requestRef.current) return;
      if (pendingSortRef.current === sort) {
        requestAnimationFrame(() => {
          setDrawerPhase('opening');
          sortTimerRef.current = setTimeout(() => {
            pendingSortRef.current = null;
            setDrawerPhase('idle');
          }, 360);
        });
      } else if (!initialDrawerOpenedRef.current) {
        // 首次加载：先在收起状态完成列表渲染，再像排序切换一样抽屉式展开。
        // Feed 在 SPA 视图间保持挂载，因此从帖子/用户页返回时不会重复播放。
        initialDrawerOpenedRef.current = true;
        requestAnimationFrame(() => {
          setDrawerPhase('opening');
          sortTimerRef.current = setTimeout(() => setDrawerPhase('idle'), 360);
        });
      }
    }
  }, [sort, searchQuery, refreshKey]);

  useEffect(() => { load(page); }, [load]);

  useEffect(() => {
    const onPopState = () => {
      const query = new URLSearchParams(window.location.search).get('q') || '';
      setSearchInput(query);
      setSearchQuery(query);
      setPage(1);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next === searchQuery) return;
      const url = new URL(window.location.href);
      if (next) url.searchParams.set('q', next);
      else url.searchParams.delete('q');
      window.history.replaceState(window.history.state, '', url);
      setPage(1);
      setSearchQuery(next);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, searchQuery]);

  // 长帖内容：超过 3 行时加 .has-fade（底部渐变遮罩提示还有更多内容）
  useEffect(() => {
    if (!posts || posts.length === 0 || !postListRef.current) return;
    const els = postListRef.current.querySelectorAll('.post-content');
    els.forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 4) {
        el.classList.add('has-fade');
      } else {
        el.classList.remove('has-fade');
      }
    });
  }, [posts]);

  // 排序切换时回第一页
  useEffect(() => { setPage(1); }, [sort]);

  useEffect(() => () => clearTimeout(sortTimerRef.current), []);

  const handleSortChange = (nextSort) => {
    if (searchInput) {
      setSearchInput('');
      setSearchQuery('');
      const url = new URL(window.location.href);
      url.searchParams.delete('q');
      window.history.replaceState(window.history.state, '', url);
    }
    if (nextSort === selectedSort) return;

    setSelectedSort(nextSort);
    clearTimeout(sortTimerRef.current);

    // 快速切回当前排序时，直接重新展开尚未替换的列表。
    if (nextSort === sort) {
      pendingSortRef.current = null;
      setDrawerPhase('opening');
      sortTimerRef.current = setTimeout(() => setDrawerPhase('idle'), 360);
      return;
    }

    setDrawerPhase('closing');
    sortTimerRef.current = setTimeout(() => {
      pendingSortRef.current = nextSort;
      setDrawerPhase('closed');
      setSort(nextSort);
    }, 220);
  };

  const handleDelete = async (postId) => {
    if (!await confirmAction(t('feed.confirmDelete'))) return;
    try {
      await API.deletePost(postId);
      load(page);
    } catch (err) {
      toast(t('feed.deleteFailed', { msg: err.message }), 'error');
    }
  };

  const handleOpenUser = (event, post) => {
    event.stopPropagation();
    const header = event.currentTarget.closest('.post-header');
    openUser(
      post.username,
      {
        avatarElement: header?.querySelector('.post-avatar'),
        nameElement: header?.querySelector('.post-username'),
      },
      {
        username: post.username,
        avatar_url: post.avatar_url || avatar(post.username),
        sourcePostId: post.id,
      }
    );
  };

  return (
    <main id="feed">
      <div className="feed-header">
        <div className="feed-header-left">
          <button className={'tab' + (selectedSort === 'latest' ? ' active' : '')} onClick={() => handleSortChange('latest')}>{t('feed.latest')}</button>
          <button className={'tab' + (selectedSort === 'hot' ? ' active' : '')} onClick={() => handleSortChange('hot')}>{t('feed.hot')}</button>
        </div>
        <button
          className="btn-primary fab-btn"
          onClick={() => {
            if (!currentUser) { toast(t('newPost.pleaseLogin'), 'warning'); return; }
            navigate('new');
          }}
        >
          <Icon name="plus" className="new-post-launch-icon" />
          <span className="new-post-launch-label">{t('feed.newPost')}</span>
        </button>
      </div>
      <div className="feed-search">
        <Icon name="search" size={18} aria-hidden="true" />
        <input
          type="search"
          name="forumlify-post-search"
          autoComplete="off"
          aria-label={t('feed.searchPlaceholder')}
          placeholder={t('feed.searchPlaceholder')}
          value={searchInput}
          maxLength={100}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const next = event.currentTarget.value.trim();
              const url = new URL(window.location.href);
              if (next) url.searchParams.set('q', next);
              else url.searchParams.delete('q');
              window.history.replaceState(window.history.state, '', url);
              setPage(1);
              setSearchQuery(next);
            }
          }}
        />
        {searchInput && <button type="button" aria-label={t('feed.clearSearch')} onClick={() => setSearchInput('')}><Icon name="close" size={16} /></button>}
      </div>
      <div className={'feed-posts-drawer ' + drawerPhase}>
        <div className="feed-posts-drawer-inner">
          <div id="postList" ref={postListRef}>
            {posts === null ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}><span className="spinner-sm" />{t('feed.loading')}</div>
            ) : error ? (
              <div style={{ textAlign: 'center', color: '#ef4444', padding: '40px 0' }}>{t('feed.loadFailed', { msg: error })}</div>
            ) : posts.length === 0 ? (
              <div className="search-empty">{searchQuery ? t('feed.searchEmpty', { query: searchQuery }) : t('feed.empty')}</div>
            ) : (
              posts.map((p) => {
                const time = p.created_at ? new Date(p.created_at).toLocaleString(i18n.language === 'en' ? 'en-US' : 'zh-CN') : '';
                return (
                  <div key={p.id} className="post-card topic-row" data-post-id={p.id} data-post-ref={p.post_number || p.id} data-username={p.username || ''} style={{ cursor: 'pointer' }}
                    onClick={(e) => openPost(p.post_number || p.id, e.currentTarget, p)}>
                <div className="topic-main">
                  <div className="topic-title-line">
                    {p.is_pinned && <span className="post-pin-state"><Icon name="pin" size={12} /> {t('feed.pinned')}</span>}
                    <div className="post-title">{p.title || t('feed.noTitle')}</div>
                  </div>
                <div className="post-header topic-meta">
                  <img
                    src={p.avatar_url || avatar(p.username)}
                    className="post-avatar"
                    alt={p.username || t('feed.anonymous')}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => handleOpenUser(e, p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenUser(e, p);
                      }
                    }}
                  />
                  <span
                    className="post-username"
                    style={{ cursor: 'pointer', color: 'var(--primary)' }}
                    onClick={(e) => handleOpenUser(e, p)}
                  >
                    {p.username || t('feed.anonymous')}
                  </span>
                  <span className="post-time">{time}</span>
                  {p.edited_at && (
                    <span className="post-edited-state" style={{ fontSize: 11, color: 'var(--text-light)', marginLeft: 6 }}>
                      <span className="post-edited-label">{t('feed.deleted')}</span>
                    </span>
                  )}
                </div>
                <div className="topic-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.content) }} />
                {p.images && p.images.length > 0 && (
                  <div className="post-images">
                    {p.images.map((img, i) => (
                      <img key={i} src={img} className="post-image" alt="" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setViewerSrc(img); }} />
                    ))}
                  </div>
                )}
                </div>
                <div className="topic-replies post-replies" aria-label={`${p.reply_count || 0} replies`}>
                  <Icon name="message" size={14} /> {p.reply_count || 0}
                </div>
                <div className="post-actions topic-actions">
                  <button className="action-report" onClick={(e) => {
                    e.stopPropagation();
                    if (!currentUser) { toast(t('newPost.pleaseLogin'), 'warning'); return; }
                    onReport(p.id);
                  }}>
                    <Icon name="flag" size={14} /> {t('feed.report')}
                  </button>
                  {currentUser && (currentUser.id === p.user_id || currentUser.role === 'admin') && (
                    <button className="action-delete" onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.id);
                    }}>
                      <Icon name="trash" size={14} /> {t('feed.delete')}
                    </button>
                  )}
                </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      {totalPages > 1 && posts && posts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '16px 0', marginTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <button
            className="page-btn"
            disabled={page <= 1}
            onClick={() => load(page - 1)}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 13, opacity: page <= 1 ? 0.4 : 1 }}
          >
            &laquo;
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((i) => (
            <button
              key={i}
              className="page-btn"
              disabled={i === page}
              onClick={() => load(i)}
              style={{
                padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, minWidth: 32, textAlign: 'center',
                background: i === page ? 'var(--primary)' : 'var(--surface)',
                color: i === page ? '#fff' : 'var(--text)',
                cursor: i === page ? 'default' : 'pointer',
                borderColor: i === page ? 'var(--primary)' : 'var(--border)',
              }}
            >
              {i}
            </button>
          ))}
          <button
            className="page-btn"
            disabled={page >= totalPages}
            onClick={() => load(page + 1)}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 13, opacity: page >= totalPages ? 0.4 : 1 }}
          >
            &raquo;
            </button>
            </div>
            )}
            {viewerSrc && <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />}
            </main>
            );
            }
