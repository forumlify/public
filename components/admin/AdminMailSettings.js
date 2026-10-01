'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '@/lib/api';
import { Icon } from '../Icons';
import { useToast } from '../Toast';

const DEFAULTS = {
  enabled: false, host: '', port: 587, secure: false, user: '', password: '',
  from_name: '', from_email: '', allow_self_signed: false, password_set: false,
};

export default function AdminMailSettings() {
  const { t } = useTranslation();
  const { toast, confirmAction } = useToast();
  const [config, setConfig] = useState(DEFAULTS);
  const [required, setRequired] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [smtp, settings] = await Promise.all([API.adminGetSmtp(), API.getSettings()]);
      setConfig({ ...DEFAULTS, ...smtp, password: '' });
      setRequired(!!settings.email_verify_required);
    } catch (error) {
      toast(t('admin.mailForm.failed', { msg: error.message }), 'error');
    }
  };
  useEffect(() => { load(); }, []);

  const update = (key, value) => setConfig((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setBusy(true);
    try {
      await API.adminSaveSmtp(config);
      await load();
      toast(t('admin.mailForm.saved'), 'success');
    } catch (error) {
      toast(t('admin.mailForm.failed', { msg: error.message }), 'error');
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true);
    try {
      await API.adminTestSmtp(testTo.trim() || undefined);
      toast(t('admin.mailForm.testSent'), 'success');
    } catch (error) {
      toast(t('admin.mailForm.failed', { msg: error.message }), 'error');
    } finally { setBusy(false); }
  };

  const clearPassword = async () => {
    if (!await confirmAction(t('admin.mailForm.clearPasswordConfirm'))) return;
    setBusy(true);
    try {
      await API.adminClearSmtpPassword();
      await load();
      toast(t('admin.mailForm.passwordCleared'), 'success');
    } catch (error) {
      toast(t('admin.mailForm.failed', { msg: error.message }), 'error');
    } finally { setBusy(false); }
  };

  const changeVerification = async (value) => {
    setBusy(true);
    try {
      await API.adminSetEmailVerification(value);
      setRequired(value);
      toast(t('admin.mailForm.saved'), 'success');
    } catch (error) {
      toast(t('admin.mailForm.failed', { msg: error.message }), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="smtp-settings">
      <h3><Icon name="message" size={17} /> {t('admin.mailForm.title')}</h3>
      <p className="admin-forum-hint">{t('admin.mailForm.hint')}</p>
      <label className="smtp-check"><input type="checkbox" checked={config.enabled} onChange={(event) => update('enabled', event.target.checked)} /> {t('admin.mailForm.enabled')}</label>
      <div className="smtp-grid">
        <label>{t('admin.mailForm.host')}<input value={config.host} maxLength={255} onChange={(event) => update('host', event.target.value)} /></label>
        <label>{t('admin.mailForm.port')}<input type="number" min="1" max="65535" value={config.port} onChange={(event) => update('port', event.target.value)} /></label>
        <label>{t('admin.mailForm.user')}<input value={config.user} maxLength={255} autoComplete="off" onChange={(event) => update('user', event.target.value)} /></label>
        <label>{t('admin.mailForm.password')}<input type="password" value={config.password} maxLength={255} autoComplete="new-password" placeholder={config.password_set ? t('admin.mailForm.passwordSaved') : ''} onChange={(event) => update('password', event.target.value)} /></label>
        <label>{t('admin.mailForm.fromName')}<input value={config.from_name} maxLength={100} onChange={(event) => update('from_name', event.target.value)} /></label>
        <label>{t('admin.mailForm.fromEmail')}<input type="email" value={config.from_email} maxLength={255} onChange={(event) => update('from_email', event.target.value)} /></label>
      </div>
      <label className="smtp-check"><input type="checkbox" checked={config.secure} onChange={(event) => update('secure', event.target.checked)} /> {t('admin.mailForm.secure')}</label>
      <label className="smtp-check"><input type="checkbox" checked={config.allow_self_signed} onChange={(event) => update('allow_self_signed', event.target.checked)} /> {t('admin.mailForm.selfSigned')}</label>
      <div className="smtp-actions">
        <button className="btn-primary" disabled={busy} onClick={save}>{t('admin.mailForm.save')}</button>
        {config.password_set && <button className="btn-secondary" disabled={busy} onClick={clearPassword}>{t('admin.mailForm.clearPassword')}</button>}
      </div>
      <div className="admin-forum-divider" />
      <label>{t('admin.mailForm.testTo')}<input type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder={t('admin.mailForm.testToHint')} /></label>
      <div className="smtp-actions"><button className="btn-secondary" disabled={busy} onClick={test}>{t('admin.mailForm.sendTest')}</button></div>
      <div className="admin-forum-divider" />
      <label className="smtp-check"><input type="checkbox" checked={required} disabled={busy} onChange={(event) => changeVerification(event.target.checked)} /> {t('admin.mailForm.requireVerification')}</label>
      <p className="admin-forum-hint">{t('admin.mailForm.verifyHint')}</p>
    </div>
  );
}
