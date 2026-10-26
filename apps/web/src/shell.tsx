import { Suspense, lazy, useEffect, useId, useState, useSyncExternalStore } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { renderSvg } from '@purrroute/design-system';
import type { GraphicId } from '@purrroute/design-system';
import { messages } from './messages.ts';
import type { MessageKey } from './messages.ts';
import { loadPreferences, savePreferences, preferencesKey, parsePreferences } from './preferences.ts';
import type { Preferences } from './preferences.ts';
import { getPwaState, getNeedsUpdate, subscribePwa, updateApplication } from './pwa.ts';
import { TripsWorkspace } from './trips.tsx';
import { LocalTripRepository } from './trips/repository.ts';

const MapWorkspace = lazy(() => import('./maps/map.tsx'));

function Graphic({ id, className = '' }: { id: GraphicId; className?: string }) {
  const instance = `svg-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <span className={`graphic ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderSvg(id, instance) }} />;
}

const subscribeNetwork = (listener: () => void) => {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
};

type InstallEvent = Event & { prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }> };

function Shell() {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [saveFailed, setSaveFailed] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [localTripCount, setLocalTripCount] = useState(0);
  const online = useSyncExternalStore(subscribeNetwork, () => navigator.onLine);
  const pwa = useSyncExternalStore(subscribePwa, getPwaState);
  const needsUpdate = useSyncExternalStore(subscribePwa, getNeedsUpdate);
  const { pathname } = useLocation();
  const translate = (key: MessageKey) => messages[preferences.locale][key];
  const navigation: { path: string; key: MessageKey; icon: GraphicId }[] = [
    { path: '/trips', key: 'trips', icon: 'ui-viaggi' },
    { path: '/map', key: 'map', icon: 'ui-mappa' },
    { path: '/offline', key: 'offline', icon: 'ui-offline' },
    { path: '/settings', key: 'settings', icon: 'ui-impostazioni' },
  ];

  useEffect(() => {
    document.documentElement.lang = preferences.locale;
    if (preferences.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = preferences.theme;
    document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', `/app-assets/favicon-${preferences.cat}.png`);
  }, [preferences]);

  useEffect(() => new LocalTripRepository().observeTrips(
    (trips) => setLocalTripCount(trips.length),
    () => setLocalTripCount(0),
  ), []);

  useEffect(() => {
    const key = navigation.find((item) => item.path === pathname)?.key;
    document.title = key ? `${messages[preferences.locale][key]} | purrRoute` : 'purrRoute';
    document.querySelector<HTMLElement>('h1')?.focus();
  }, [pathname, preferences.locale]);

  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key === preferencesKey) setPreferences(parsePreferences(event.newValue));
    };
    const install = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    window.addEventListener('storage', receive);
    window.addEventListener('beforeinstallprompt', install);
    return () => { window.removeEventListener('storage', receive); window.removeEventListener('beforeinstallprompt', install); };
  }, []);

  const change = (patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setSaveFailed(!savePreferences(next));
  };
  const heading = (text: string) => <h1 tabIndex={-1}>{text}</h1>;
  const empty = (icon: GraphicId, text: string) => <div className="empty"><Graphic id={icon} className="empty-icon" /><p>{text}</p></div>;

  return <div className="app-shell">
    <a className="skip-link" href="#content">{translate('skip')}</a>
    <aside className="sidebar">
      <Link className="brand" to="/trips" aria-label="purrRoute"><Graphic id="logo" /><span>purrRoute</span></Link>
      <nav aria-label={translate('navigation')}>
        {navigation.map((item) => <NavLink key={item.path} to={item.path}><Graphic id={item.icon} /><span>{translate(item.key)}</span></NavLink>)}
      </nav>
      <div className="sidebar-bottom"><Graphic id={`cat-${preferences.cat}-tappa`} /><span>{translate('device')}</span></div>
    </aside>
    <div className="app-body">
      <header className="topbar"><span className="workspace-label">purrRoute</span><div className="connection" role="status"><span className={`status-dot ${online ? '' : 'disconnected'}`} />{translate(online ? 'network' : 'noNetwork')}</div><Link className="avatar" to="/settings" title={translate('settings')} aria-label={translate('settings')}><Graphic id={`cat-${preferences.cat}-tappa`} /></Link></header>
      {needsUpdate && <div className="update-banner" role="status">{translate('update')}<button onClick={() => void updateApplication()}>{translate('refresh')}</button></div>}
      <main id="content" className="content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Navigate to="/trips" replace />} />
          <Route path="/trips" element={<TripsWorkspace locale={preferences.locale} cat={preferences.cat} />} />
          <Route path="/map" element={<Suspense fallback={<section className="page">{heading(translate('map'))}<p role="status">{translate('mapLoading')}</p></section>}><MapWorkspace locale={preferences.locale} /></Suspense>} />
          <Route path="/offline" element={<section className="page">{heading(translate('offline'))}<div className="status-row"><Graphic id="ui-offline" /><span>{translate(pwa)}</span></div><div className="section-heading"><h2>{translate('local')}</h2><span>{localTripCount}</span></div><p className="muted">{localTripCount === 0 ? translate('empty') : translate('localTripsSaved')}</p><div className="section-heading"><h2>{translate('map')}</h2><span>0</span></div><p className="muted">{translate('noDownloads')}</p></section>} />
          <Route path="/settings" element={<section className="page settings">{heading(translate('settings'))}
            <fieldset><legend>{translate('language')}</legend><div className="segmented">{(['it', 'en'] as const).map((locale) => <label key={locale}><input type="radio" name="language" value={locale} checked={preferences.locale === locale} onChange={() => change({ locale })} /><span>{locale === 'it' ? 'Italiano' : 'English'}</span></label>)}</div></fieldset>
            <fieldset><legend>{translate('theme')}</legend><div className="segmented">{(['system', 'light', 'dark'] as const).map((theme) => <label key={theme}><input type="radio" name="theme" checked={preferences.theme === theme} onChange={() => change({ theme })} /><span>{translate(theme)}</span></label>)}</div></fieldset>
            <fieldset><legend>{translate('cat')}</legend><div className="cat-options">{(['rosso', 'cipria'] as const).map((cat) => <label key={cat}><input type="radio" name="cat" checked={preferences.cat === cat} onChange={() => change({ cat })} /><Graphic id={`app-${cat}`} /><span>{translate(cat)}</span></label>)}</div></fieldset>
            {saveFailed && <p role="alert">{translate('saveError')}</p>}
            {installEvent && <button className="primary" onClick={async () => { await installEvent.prompt(); setInstallEvent(null); }}><Graphic id="ui-offline" />{translate('install')}</button>}
          </section>} />
          <Route path="*" element={<section className="page">{heading(translate('notFound'))}<Link to="/trips">{translate('back')}</Link></section>} />
        </Routes>
      </main>
    </div>
  </div>;
}

export default function App() {
  return <BrowserRouter><Shell /></BrowserRouter>;
}