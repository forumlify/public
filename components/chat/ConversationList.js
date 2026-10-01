'use client';

// 私信 - 会话列表
import { useEffect, useState } from 'react';
import { API } from '@/lib/api';
import { Icon } from '../Icons';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Toast';

function avatar(username) {
  return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username || 'U') +
    '&background=6366f1&color=fff&size=64';
}

export default function ConversationList({ onOpenChat, onClose }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [conversations, setConversations] = useState(null);
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);

  const load = () => {
    API.getConversations()
      .then((data) => setConversations(data || []))
      .catch(() => setConversations([]));
  };

  useEffect(load, []);

  useEffect(() => {
    const keyword = search.trim();
    if (!keyword) { setMatches([]); setSearching(false); return; }
    let canceled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await API.searchUsers(keyword);
        if (!canceled) setMatches(result.data || []);
      } catch (error) {
        if (!canceled) toast(t('chat.openFailed', { msg: error.message }), 'error');
      } finally {
        if (!canceled) setSearching(false);
      }
    }, 300);
    return () => { canceled = true; clearTimeout(timer); };
  }, [search, t, toast]);

  const startChat = async (user) => {
    try {
      const conversation = await API.getOrCreateConversation(user.id);
      onOpenChat(conversation.id, user.id, user.username);
    } catch (error) {
      toast(t('chat.openFailed', { msg: error.message }), 'error');
    }
  };

  return (
    <div className="modal active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', height: '70vh', maxHeight: '70vh', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 18, margin: 0 }}><Icon name="message" size={18} style={{ verticalAlign: -3, marginRight: 6 }} /> {t('chat.title')}</h2>
          <span className="close" onClick={onClose} style={{ cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1 }}><Icon name="close" size={20} /></span>
        </div>
        <div className="chat-user-search">
          <Icon name="search" size={17} aria-hidden="true" />
          <input type="search" name="forumlify-user-search" autoComplete="off" maxLength={50}
            aria-label={t('chat.searchPlaceholder')} placeholder={t('chat.searchPlaceholder')}
            value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div id="messageListContent" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {search.trim() ? (
            searching ? <div className="chat-search-state">{t('chat.loading')}</div>
              : matches.length === 0 ? <div className="chat-search-state">{t('chat.searchEmpty')}</div>
                : matches.map((user) => (
                  <button key={user.id} type="button" className="chat-user-result" onClick={() => startChat(user)}>
                    <img src={user.avatar_url || avatar(user.username)} alt="" />
                    <span>{user.username}</span>
                  </button>
                ))
          ) : (
          <>
          {conversations === null ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}><span className="spinner-sm" />{t('chat.loading')}</div>
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>{t('chat.empty')}</div>
          ) : (
            conversations.map((c) => {
              const unread = c.unread_count || 0;
              const lastMsg = c.last_message || t('chat.noMessage');
              const time = c.last_message_time ? new Date(c.last_message_time).toLocaleString(i18n.language === 'en' ? 'en-US' : 'zh-CN') : '';
              return (
                <div
                  key={c.id}
                  className="message-list-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onClick={() => onOpenChat(c.id, c.other_user_id, c.other_username)}
                >
                  <img src={c.other_avatar_url || avatar(c.other_username)} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{c.other_username}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{time}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{lastMsg}</span>
                      {unread > 0 && (
                        <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
