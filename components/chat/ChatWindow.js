'use client';

// 私信 - 聊天窗口（3 秒轮询新消息）
import { useEffect, useState, useRef, useCallback } from 'react';
import { API } from '@/lib/api';
import { useApp } from '../AppProvider';
import { Icon } from '../Icons';
import { useToast } from '../Toast';
import { useTranslation } from 'react-i18next';

function avatar(username) {
  return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username || 'U') +
    '&background=6366f1&color=fff&size=64';
}

export default function ChatWindow({ conversationId, otherUserId, otherUsername, onClose, onRefreshList }) {
  const { currentUser } = useApp();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState(null);
  const [content, setContent] = useState('');
  const containerRef = useRef(null);
  const waitingForReply = messages && !messages.some((message) => message.sender_id === otherUserId)
    && messages.filter((message) => message.sender_id === currentUser?.id).length >= 3;

  const load = useCallback(async (silent = false) => {
    if (!silent) setMessages(null);
    try {
      const data = await API.getMessages(conversationId);
      setMessages(data || []);
    } catch {
      if (!silent) setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  // 3 秒轮询
  useEffect(() => {
    const t = setInterval(() => load(true), 3000);
    return () => clearInterval(t);
  }, [load]);

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!content.trim() || waitingForReply) return;
    try {
      await API.sendMessage(conversationId, content.trim());
      setContent('');
      load();
      onRefreshList();
    } catch (err) {
      toast(err.status === 429 ? t('chat.limitReached') : err.message, 'error');
      if (err.status === 429) load(true);
    }
  };

  return (
    <div className="modal active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', height: '70vh', maxHeight: '70vh', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span id="chatTitle" style={{ fontWeight: 600, fontSize: 16 }}>{otherUsername}</span>
          <span className="close" onClick={onClose} style={{ cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1 }}><Icon name="close" size={20} /></span>
        </div>
        <div id="chatMessages" ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 0 }}>
          {messages === null ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}><span className="spinner-sm" />加载中...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>还没有消息，打个招呼吧 👋</div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === currentUser?.id;
              const time = m.created_at ? new Date(m.created_at).toLocaleString(i18n.language === 'en' ? 'en-US' : 'zh-CN') : '';
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                  {!isMine && (
                    <img src={m.sender_avatar_url || avatar(m.sender_username)} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', marginRight: 8, flexShrink: 0 }} alt="" />
                  )}
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{
                      background: isMine ? 'var(--primary)' : 'var(--surface)',
                      color: isMine ? '#fff' : 'var(--text)',
                      padding: '10px 14px', borderRadius: 12,
                      border: isMine ? 'none' : '1px solid var(--border)',
                      wordBreak: 'break-word',
                    }}>
                      {m.content}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>
                      {time} {isMine && <Icon name="success" size={10} aria-label={m.is_read ? '已读' : '已发送'} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {waitingForReply && <div className="chat-limit-hint">{t('chat.limitReached')}</div>}
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            type="text"
            id="chatInput"
            placeholder="输入消息..."
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
            value={content}
            disabled={waitingForReply}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          />
          <button className="btn-primary" style={{ padding: '8px 16px' }} disabled={waitingForReply} onClick={send}>发送</button>
        </div>
      </div>
    </div>
  );
}
