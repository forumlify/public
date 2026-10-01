'use client';

// 管理后台：侧边栏布局（对齐上游 main 分支）
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icons';
import AdminReports from './admin/AdminReports';
import AdminUsers from './admin/AdminUsers';
import AdminLogs from './admin/AdminLogs';
import AdminLinks from './admin/AdminLinks';
import AdminForumSettings from './admin/AdminForumSettings';
import AdminCustomPages from './admin/AdminCustomPages';
import AdminCustomCss from './admin/AdminCustomCss';
import AdminMailSettings from './admin/AdminMailSettings';

const NAV = [
  { key: 'reports', labelKey: 'admin.reports', icon: 'shieldAlert' },
  { key: 'users', labelKey: 'admin.users', icon: 'users' },
  { key: 'logs', labelKey: 'admin.logs', icon: 'file' },
  { key: 'links', labelKey: 'admin.links', icon: 'link' },
  { key: 'settings', labelKey: 'admin.forumSettings', icon: 'settings' },
  { key: 'mail', labelKey: 'admin.mail', icon: 'message' },
  { key: 'custom', labelKey: 'admin.customPages', icon: 'file' },
  { key: 'css', labelKey: 'admin.customCss', icon: 'file' },
];

export default function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('reports');
  const [panelPhase, setPanelPhase] = useState('idle');
  const [panelHeight, setPanelHeight] = useState(null);
  const contentRef = useRef(null);
  const panelRef = useRef(null);
  const transitionTimer = useRef(null);
  const transitionFrame = useRef(null);
  const pendingTab = useRef('reports');
  const switching = useRef(false);
  const panelPhaseRef = useRef(panelPhase);

  panelPhaseRef.current = panelPhase;

  const measurePanelHeight = () => {
    if (!contentRef.current || !panelRef.current) return null;

    const style = getComputedStyle(panelRef.current);
    return contentRef.current.scrollHeight
      + parseFloat(style.paddingTop)
      + parseFloat(style.paddingBottom)
      + parseFloat(style.borderTopWidth)
      + parseFloat(style.borderBottomWidth);
  };

  useEffect(() => () => {
    clearTimeout(transitionTimer.current);
    cancelAnimationFrame(transitionFrame.current);
  }, []);

  // Keep the outer frame at a concrete height. Data-heavy tabs such as reports
  // first render a loader, then receive their rows asynchronously. Without
  // this lock, the frame switches from auto height to the loaded height in one
  // frame after the drawer has already opened.
  useLayoutEffect(() => {
    if (panelHeight != null) return;
    const height = measurePanelHeight();
    if (height != null) setPanelHeight(height);
  }, [panelHeight, tab]);

  useEffect(() => {
    if (!contentRef.current || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      if (panelPhaseRef.current !== 'idle') return;
      const height = measurePanelHeight();
      if (height == null) return;
      setPanelHeight((currentHeight) => (
        currentHeight != null && Math.abs(currentHeight - height) < 1 ? currentHeight : height
      ));
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [tab]);

  useLayoutEffect(() => {
    if (!switching.current || panelPhase !== 'hidden' || !contentRef.current || !panelRef.current) return;

    const targetHeight = measurePanelHeight();
    if (targetHeight == null) return;

    transitionFrame.current = requestAnimationFrame(() => {
      setPanelHeight(targetHeight);
      setPanelPhase('opening');
      transitionTimer.current = setTimeout(() => {
        switching.current = false;
        setPanelPhase('idle');
        const settledHeight = measurePanelHeight();
        if (settledHeight != null) setPanelHeight(settledHeight);
        if (pendingTab.current !== tab) {
          const queuedTab = pendingTab.current;
          transitionFrame.current = requestAnimationFrame(() => changeTab(queuedTab));
        }
      }, 360);
    });
  }, [panelPhase, tab]);

  const changeTab = (nextTab) => {
    if (nextTab === tab && panelPhase === 'idle') return;
    pendingTab.current = nextTab;
    if (switching.current) return;

    switching.current = true;
    clearTimeout(transitionTimer.current);
    setPanelHeight(panelRef.current?.getBoundingClientRect().height || null);
    setPanelPhase('closing');
    transitionTimer.current = setTimeout(() => {
      setTab(pendingTab.current);
      setPanelPhase('hidden');
    }, 220);
  };

  const renderPanel = () => {
    if (tab === 'reports') return <AdminReports />;
    if (tab === 'users') return <AdminUsers />;
    if (tab === 'logs') return <AdminLogs />;
    if (tab === 'links') return <AdminLinks />;
    if (tab === 'custom') return <AdminCustomPages />;
    if (tab === 'css') return <AdminCustomCss />;
    if (tab === 'mail') return <AdminMailSettings />;
    return <AdminForumSettings />;
  };

  return (
    <div className="page-slide active">
      <div className="page-header" style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <h2><Icon name="shieldAlert" size={20} /> {t('admin.title')}</h2>
      </div>
      <div className="admin-layout" style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <aside className="admin-sidebar">
          <nav className="admin-nav">
            {NAV.map((n) => (
              <a
                key={n.key}
                href="#"
                className={'admin-nav-item' + (tab === n.key ? ' active' : '')}
                data-tab={n.key}
                onClick={(e) => { e.preventDefault(); changeTab(n.key); }}
              >
                <span className="nav-icon"><Icon name={n.icon} size={18} /></span>
                {t(n.labelKey)}
              </a>
            ))}
          </nav>
        </aside>
        <main
          ref={panelRef}
          className="admin-content"
          id="adminContent"
          style={panelHeight == null ? undefined : { height: panelHeight }}
        >
          <div className={'admin-content-drawer ' + panelPhase}>
            <div ref={contentRef} className="admin-content-drawer-inner">
              {renderPanel()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
