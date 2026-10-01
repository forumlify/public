'use client';

// 登录/注册/举报 模态框
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '@/lib/api';
import { useApp } from './AppProvider';
import { Icon } from './Icons';
import CaptchaImage from './CaptchaImage';
import { useToast } from './Toast';

export default function Modals({ modal, onClose, reportPostId }) {
  const { login, register, currentUser, refresh } = useApp();
  const { t } = useTranslation();
  const { toast } = useToast();

  // 登录表单
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetRecoveryCode, setResetRecoveryCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetMethod, setResetMethod] = useState('recovery');
  const [mailReady, setMailReady] = useState(false);
  const [emailCodeRequired, setEmailCodeRequired] = useState(false);
  const [regEmailCode, setRegEmailCode] = useState('');
  const [regCodeCooldown, setRegCodeCooldown] = useState(0);
  const [resetCodeCooldown, setResetCodeCooldown] = useState(0);

  // 注册表单
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCaptcha, setRegCaptcha] = useState(null);
  const [regCaptchaInput, setRegCaptchaInput] = useState('');

  // 举报表单
  const [reportReason, setReportReason] = useState('spam');

  // 打开注册弹窗时从服务器获取验证码挑战（HMAC 签名）
  useEffect(() => {
    if (modal === 'login' || modal === 'register') {
      API.getSettings().then((settings) => {
        setMailReady(!!settings.smtp_ready);
        setEmailCodeRequired(!!settings.email_verify_required);
      }).catch(() => { setMailReady(false); setEmailCodeRequired(false); });
    }
    if (modal === 'register') {
      API.getCaptcha().then((c) => setRegCaptcha(c)).catch(() => {});
    }
    if (modal !== 'login') {
      setAuthMode('login');
      setResetEmail('');
      setResetRecoveryCode('');
      setResetPassword('');
      setResetPasswordConfirm('');
      setResetMethod('recovery');
    }
  }, [modal]);

  useEffect(() => {
    if (!regCodeCooldown && !resetCodeCooldown) return;
    const timer = setInterval(() => {
      setRegCodeCooldown((seconds) => Math.max(0, seconds - 1));
      setResetCodeCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [regCodeCooldown > 0, resetCodeCooldown > 0]);

  if (!modal) return null;

  const close = (e) => {
    if (e && e.target !== e.currentTarget) return;
    onClose();
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) { toast('请填写完整信息', 'warning'); return; }
    try {
      const result = await login(loginEmail.trim(), loginPassword);
      if (result.user) {
        onClose();
        setLoginEmail('');
        setLoginPassword('');
        refresh();
      }
    } catch (err) {
      toast('登录失败：' + err.message, 'error');
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim() || !resetRecoveryCode.trim() || !resetPassword || !resetPasswordConfirm) {
      toast(t('auth.resetFillAll'), 'warning');
      return;
    }
    if (resetPassword.length < 6) {
      toast(t('auth.passwordTooShort'), 'warning');
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      toast(t('auth.passwordMismatch'), 'warning');
      return;
    }
    try {
      if (resetMethod === 'email') {
        await API.resetPasswordByEmail(resetEmail.trim(), resetRecoveryCode.trim(), resetPassword);
      } else {
        await API.resetPassword(resetEmail.trim(), resetRecoveryCode.trim(), resetPassword);
      }
      setAuthMode('login');
      setLoginEmail(resetEmail.trim());
      setLoginPassword('');
      setResetEmail('');
      setResetRecoveryCode('');
      setResetPassword('');
      setResetPasswordConfirm('');
      toast(t('auth.resetSuccess'), 'success');
    } catch (err) {
      toast(t('auth.resetFailed', { msg: err.message }), 'error');
    }
  };

  const sendCode = async (purpose) => {
    const email = purpose === 'register' ? regEmail.trim() : resetEmail.trim();
    if (!email) { toast(t('auth.emailRequired'), 'warning'); return; }
    try {
      if (purpose === 'register') {
        await API.sendRegisterCode(email);
        setRegCodeCooldown(60);
      } else {
        await API.sendResetCode(email);
        setResetCodeCooldown(60);
      }
      toast(t('auth.emailCodeSent'), 'success');
    } catch (error) {
      toast(t('auth.emailCodeFailed', { msg: error.message }), 'error');
    }
  };

  const returnToLogin = () => {
    setAuthMode('login');
    setResetEmail('');
    setResetRecoveryCode('');
    setResetPassword('');
    setResetPasswordConfirm('');
  };

  const handleRegister = async () => {
    if (!regUsername.trim() || !regEmail.trim() || !regPassword) { toast('请填写完整信息', 'warning'); return; }
    if (regPassword.length < 6) { toast('密码至少6位', 'warning'); return; }
    if (emailCodeRequired && !regEmailCode.trim()) { toast(t('auth.emailCodeRequired'), 'warning'); return; }
    if (!regCaptcha || !regCaptchaInput.trim()) {
      toast('请填写验证码', 'warning');
      return;
    }
    try {
      // 答案由服务端 HMAC 校验，前端不对比答案
      await register(regEmail.trim(), regPassword, regUsername.trim(), { id: regCaptcha.id, answer: regCaptchaInput.trim(), sig: regCaptcha.sig }, regEmailCode.trim());
      onClose();
      setRegUsername('');
      setRegEmail('');
      setRegPassword('');
      setRegCaptchaInput('');
      setRegEmailCode('');
      toast('注册成功！', 'success');
      refresh();
    } catch (err) {
      toast('注册失败：' + err.message, 'error');
      // 失败后刷新验证码
      API.getCaptcha().then((c) => setRegCaptcha(c)).catch(() => {});
      setRegCaptchaInput('');
    }
  };

  const handleReport = async () => {
    if (!reportPostId) return;
    try {
      await API.createReport(reportPostId, reportReason);
      onClose();
      toast('举报已提交，管理员将尽快处理', 'success');
    } catch (err) {
      toast('举报失败：' + err.message, 'error');
    }
  };

  return (
    <>
      {modal === 'login' && authMode === 'login' && (
        <div className="modal active" onClick={close}>
          <div className="modal-content">
            <span className="close" onClick={onClose}><Icon name="close" size={20} /></span>
            <h2 style={{ marginBottom: 16 }}>{t('auth.login')}</h2>
            <form onSubmit={(event) => { event.preventDefault(); handleLogin(); }}>
            <input type="email" placeholder={t('auth.email')} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            <input type="password" placeholder={t('auth.password')} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>{t('auth.login')}</button>
            </form>
            <button
              type="button"
              className="auth-forgot-link"
              onClick={() => {
                setResetEmail(loginEmail);
                setAuthMode('forgot');
              }}
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
        </div>
      )}

      {modal === 'login' && authMode === 'forgot' && (
        <div className="modal active" onClick={close}>
          <div className="modal-content">
            <span className="close" onClick={onClose}><Icon name="close" size={20} /></span>
            <h2 style={{ marginBottom: 16 }}>{t(resetMethod === 'email' ? 'auth.resetEmailTitle' : 'auth.resetTitle')}</h2>
            {mailReady && (
              <div className="auth-reset-methods">
                <button type="button" className={resetMethod === 'recovery' ? 'active' : ''} onClick={() => { setResetMethod('recovery'); setResetRecoveryCode(''); }}>{t('auth.recoveryMethod')}</button>
                <button type="button" className={resetMethod === 'email' ? 'active' : ''} onClick={() => { setResetMethod('email'); setResetRecoveryCode(''); }}>{t('auth.emailMethod')}</button>
              </div>
            )}
            <p className="auth-reset-hint">{t(resetMethod === 'email' ? 'auth.resetEmailHint' : 'auth.resetHint')}</p>
            <form onSubmit={(event) => { event.preventDefault(); handleResetPassword(); }}>
            <input type="email" placeholder={t('auth.email')} value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
            {resetMethod === 'email' && <button type="button" className="auth-send-code" disabled={resetCodeCooldown > 0} onClick={() => sendCode('reset')}>{resetCodeCooldown || t('auth.sendCode')}</button>}
            <input type="text" placeholder={t(resetMethod === 'email' ? 'auth.emailCode' : 'auth.recoveryCode')} value={resetRecoveryCode} onChange={(e) => setResetRecoveryCode(e.target.value)} />
            <input type="password" placeholder={t('auth.newPassword')} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
            <input
              type="password"
              placeholder={t('auth.confirmPassword')}
              value={resetPasswordConfirm}
              onChange={(e) => setResetPasswordConfirm(e.target.value)}
            />
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>{t('auth.resetPassword')}</button>
            </form>
            <button type="button" className="auth-forgot-link" onClick={returnToLogin}>
              {t('auth.backToLogin')}
            </button>
          </div>
        </div>
      )}

      {modal === 'register' && (
        <div className="modal active" onClick={close}>
          <div className="modal-content">
            <span className="close" onClick={onClose}><Icon name="close" size={20} /></span>
            <h2 style={{ marginBottom: 16 }}>{t('auth.register')}</h2>
            <form onSubmit={(event) => { event.preventDefault(); handleRegister(); }}>
            <input type="text" placeholder={t('auth.username')} value={regUsername} onChange={(e) => setRegUsername(e.target.value)} />
            <input type="email" placeholder={t('auth.email')} value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
            {emailCodeRequired && (
              <div className="auth-email-code-row">
                <input type="text" inputMode="numeric" maxLength={6} placeholder={t('auth.emailCode')} value={regEmailCode} onChange={(e) => setRegEmailCode(e.target.value)} />
                <button type="button" disabled={regCodeCooldown > 0} onClick={() => sendCode('register')}>{regCodeCooldown || t('auth.sendCode')}</button>
              </div>
            )}
            <input type="password" placeholder={t('auth.passwordHint')} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
            <div className="captcha-row" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
              {regCaptcha ? (
                <CaptchaImage captcha={regCaptcha} onRefresh={() => { API.getCaptcha().then((c) => setRegCaptcha(c)).catch(() => {}); setRegCaptchaInput(''); }} />
              ) : (
                <span style={{ color: 'var(--text-light)' }}>{t('newPost.captchaLoading')}</span>
              )}
              <input type="text" placeholder="答案" style={{ width: 80, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 4 }} value={regCaptchaInput} onChange={(e) => setRegCaptchaInput(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>{t('auth.register')}</button>
            </form>
          </div>
        </div>
      )}

      {modal === 'report' && currentUser && (
        <div className="modal active" onClick={close}>
          <div className="modal-content">
            <span className="close" onClick={onClose}><Icon name="close" size={20} /></span>
            <h2 style={{ marginBottom: 16 }}><Icon name="shieldAlert" size={20} /> {t('post.reportTitle')}</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>{t('post.reportReason')}</p>
            <select
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, marginBottom: 16, background: 'var(--bg)', color: 'var(--text)' }}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            >
              <option value="spam">{t('report.spam')}</option>
              <option value="abuse">{t('report.abuse')}</option>
              <option value="illegal">{t('report.illegal')}</option>
              <option value="nsfw">{t('report.nsfw')}</option>
              <option value="other">{t('report.other')}</option>
            </select>
            <button className="btn-primary" style={{ width: '100%' }} onClick={handleReport}>{t('post.submitReport')}</button>
          </div>
        </div>
      )}
    </>
  );
}
