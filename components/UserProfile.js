'use client';

// 用户主页：资料卡 + 该用户的帖子列表
import { useEffect, useState, useCallback, useRef } from 'react';
import { API } from '@/lib/api';
import { useApp } from './AppProvider';
import { Icon } from './Icons';
import { useOpenPrivateChat } from './chat/ChatManager';
import { renderMarkdown } from '@/lib/markdown';
import { useTranslation } from 'react-i18next';
import { useToast } from './Toast';

function avatar(username, size = 128) {
  return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username || 'U') +
    '&background=6366f1&color=fff&size=' + size;
}

export default function UserProfile({ username, initialUser = null, initialPosts = null }) {
  const { currentUser, openPost } = useApp();
  const { t, i18n } = useTranslation();
  const openPrivateChat = useOpenPrivateChat();
  const { toast, confirmAction } = useToast();
  const [user, setUser] = useState(initialUser);
  const [blockStatus, setBlockStatus] = useState(null);
  const [posts, setPosts] = useState(initialPosts || []);
  const [error, setError] = useState(null);
  const postsRef = useRef(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const u = await API.getUserProfile(username);
      if (u.error || !u.id) {
        setError(u.error || '用户不存在');
        return;
      }
      setUser(u);
      const result = await API.getPosts('latest', u.id);
      setPosts(result.data || []);
    } catch (err) {
      setError(err.message || '加载失败');
    }
  }, [username]);

  useEffect(() => {
    setUser(initialUser);
    setPosts(initialPosts || []);
    load();
  }, [initialPosts, initialUser, load]);

  useEffect(() => {
    if (!currentUser || !user?.id || currentUser.id === user.id) {
      setBlockStatus(null);
      return;
    }
    let canceled = false;
    API.getBlockStatus(user.id)
      .then((status) => { if (!canceled) setBlockStatus(status); })
      .catch(() => { if (!canceled) setBlockStatus(null); });
    return () => { canceled = true; };
  }, [currentUser?.id, user?.id]);

  const toggleBlock = async () => {
    const blocked = !!blockStatus?.blocked_by_me;
    const confirmed = await confirmAction(t(blocked ? 'blocking.unblockConfirm' : 'blocking.blockConfirm', { name: user.username }), {
      title: t(blocked ? 'blocking.unblock' : 'blocking.block'),
      confirmLabel: t(blocked ? 'blocking.unblock' : 'blocking.block'),
      danger: !blocked,
    });
    if (!confirmed) return;
    try {
      if (blocked) await API.unblockUser(user.id);
      else await API.blockUser(user.id);
      setBlockStatus((previous) => ({ ...previous, blocked_by_me: !blocked }));
      setPosts(blocked ? (await API.getPosts('latest', user.id)).data || [] : []);
      toast(t(blocked ? 'blocking.unblocked' : 'blocking.blocked'), 'success');
    } catch (error) {
      toast(t('blocking.failed', { msg: error.message }), 'error');
    }
  };

  useEffect(() => {
    const contents = postsRef.current?.querySelectorAll('.user-post-preview') || [];
    contents.forEach((element) => {
      element.classList.toggle('has-fade', element.scrollHeight > element.clientHeight + 4);
    });
  }, [posts]);

  if (error) {
    return (
      <div id="pageUser" className="page-slide active">
        <div style={{ textAlign: 'center', color: '#ef4444', padding: '40px 0' }}>加载失败：{error}</div>
      </div>
    );
  }
  if (!user) {
    return <div id="pageUser" className="page-slide active" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}><span className="spinner-sm" />加载中...</div>;
  }

  return (
    <div id="pageUser" className="page-slide active">
      <div className="page-header" style={{ maxWidth: 700, margin: '0 auto', width: '100%' }}>
        <h2><Icon name="users" size={20} /> 用户主页</h2>
      </div>
      <div id="userProfileContent" style={{ maxWidth: 700, margin: '0 auto', width: '100%' }}>
        <div className="user-profile-card" data-username={user.username || ''} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 32, textAlign: 'center' }}>
          <img className="user-profile-avatar" src={user.avatar_url || avatar(user.username)} style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} alt={user.username || ''} />
          <h2 className="user-profile-name" style={{ margin: '16px 0 4px', fontSize: 24, color: 'var(--text)' }}>{user.username}</h2>
          {user.id && (
          <div className="user-profile-details">
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{user.bio || '这个人很懒，什么都没写'}</p>
            {currentUser && currentUser.username !== user.username && (
              <div className="user-profile-actions">
              {!blockStatus?.blocked_by_me && (
              <button
                className="btn-primary"
                onClick={() => openPrivateChat(user.id, user.username)}
              >
                <Icon name="message" size={14} /> 发私信
              </button>
              )}
              <button type="button" className="btn-secondary" onClick={toggleBlock}>
                <Icon name="shield" size={14} /> {t(blockStatus?.blocked_by_me ? 'blocking.unblock' : 'blocking.block')}
              </button>
              </div>
            )}
            {blockStatus?.blocked_by_me && <p className="blocked-user-hint">{t('blocking.blockedHint')}</p>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 16, fontSize: 14, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span><Icon name="calendar" size={14} /> 加入于 {user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '未知'}</span>
              <span><Icon name="file" size={14} /> 发了 {posts.length} 个帖子</span>
              {user.role === 'admin' && <span style={{ color: 'var(--primary)', fontWeight: 600 }}><Icon name="shield" size={14} /> 管理员</span>}
            </div>
          </div>
          )}
        </div>
        {user.id && (
        <div className="user-profile-posts" ref={postsRef}>
          <h3 style={{ margin: '24px 0 16px', fontSize: 18 }}><Icon name="file" size={18} /> 发布的帖子</h3>
          {posts.length === 0 ? (
            <div style={{ color: '#94a3b8', padding: '20px 0', textAlign: 'center' }}>还没有发帖</div>
          ) : (
            posts.map((p) => {
              const time = p.created_at ? new Date(p.created_at).toLocaleString(i18n.language === 'en' ? 'en-US' : 'zh-CN') : '';
              return (
                <div
                  key={p.id}
                  className="post-card user-post-card"
                  data-post-id={p.id}
                  data-post-ref={p.post_number || p.id}
                  data-username={user.username || ''}
                  style={{ cursor: 'pointer' }}
                  onClick={(event) => openPost(p.post_number || p.id, event.currentTarget, p, {
                    view: 'user',
                    username: user.username,
                    user,
                    posts,
                    scrollTop: document.getElementById('pageUser')?.scrollTop || 0,
                  })}
                >
                  {p.is_pinned && (
                    <div className="post-pin-state" style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>
                      <Icon name="pin" size={12} /> {t('feed.pinned')}
                    </div>
                  )}
                  <div className="post-header">
                    <img src={p.avatar_url || user.avatar_url || avatar(user.username, 64)} className="post-avatar" alt="" />
                    <span className="post-username" style={{ color: 'var(--primary)' }}>{user.username}</span>
                    <span className="post-time">{time}</span>
                    {p.edited_at && (
                      <span className="post-edited-state" style={{ fontSize: 11, color: 'var(--text-light)', marginLeft: 6 }}>
                        <span className="post-edited-label">{t('feed.deleted')}</span>
                      </span>
                    )}
                  </div>
                  <div className="post-title">{p.title || t('feed.noTitle')}</div>
                  <div className="post-content user-post-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.content) }} />
                  {p.images && p.images.length > 0 && (
                    <div className="post-images">
                      {p.images.map((image, index) => (
                        <img key={image + index} src={image} className="post-image" alt="" />
                      ))}
                    </div>
                  )}
                  <div className="post-actions">
                    <span><Icon name="message" size={14} /> {p.reply_count || 0}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        )}
      </div>
    </div>
  );
}
