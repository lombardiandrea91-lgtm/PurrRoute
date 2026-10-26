import { useState, useSyncExternalStore } from 'react';
import { messages } from '../messages.ts';
import type { Locale } from '../preferences.ts';
import {
  AccountRequestError,
  developmentVerificationToken,
  getAccountSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  subscribeAccountSession,
  verifyAccountEmail,
} from './session.ts';

export function AccountSettings({ locale }: { locale: Locale }) {
  const translate = (key: keyof typeof messages.it) => messages[locale][key];
  const session = useSyncExternalStore(subscribeAccountSession, getAccountSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  const errorText = (error: unknown) => {
    if (error instanceof AccountRequestError && error.code === 'invalid_credentials') {
      return translate('accountInvalidCredentials');
    }
    if (error instanceof AccountRequestError && error.code === 'email_not_verified') {
      return translate('accountEmailNotVerified');
    }
    if (error instanceof AccountRequestError && error.code === 'invalid_token') {
      return translate('accountInvalidToken');
    }
    return translate('accountGenericError');
  };

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setFailure(''); setNotice('');
    try {
      await loginAccount(email, password);
      setPassword('');
    } catch (error) { setFailure(errorText(error)); }
    finally { setBusy(false); }
  };

  const register = async () => {
    setBusy(true); setFailure(''); setNotice('');
    try {
      await registerAccount(email, password);
      setNotice(translate('accountRegistered'));
      const developmentToken = await developmentVerificationToken(email);
      if (developmentToken) setToken(developmentToken);
    } catch (error) { setFailure(errorText(error)); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setFailure('');
    try {
      await verifyAccountEmail(token);
      await loginAccount(email, password);
      setPassword(''); setToken(''); setNotice(translate('accountReady'));
    } catch (error) { setFailure(errorText(error)); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    setBusy(true); setFailure('');
    try { await logoutAccount(); setNotice(''); }
    catch (error) { setFailure(errorText(error)); }
    finally { setBusy(false); }
  };

  return <fieldset className="account-settings">
    <legend>{translate('account')}</legend>
    {session ? <div className="account-session">
      <p>{session.account.email}</p>
      <p className="muted">{translate('accountReady')}</p>
      <button className="trip-button" type="button" disabled={busy} onClick={() => void logout()}>{translate('accountLogout')}</button>
    </div> : <>
      <form className="account-form" onSubmit={(event) => void login(event)}>
        <label>{translate('accountEmail')}<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>{translate('accountPassword')}<input type="password" autoComplete="current-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <div className="account-actions">
          <button className="trip-button" type="submit" disabled={busy}>{translate('accountLogin')}</button>
          <button className="trip-button" type="button" disabled={busy} onClick={() => void register()}>{translate('accountRegister')}</button>
        </div>
      </form>
      {notice && <p className="muted" role="status">{notice}</p>}
      {notice && <div className="account-verify">
        <label>{translate('accountToken')}<input autoComplete="one-time-code" value={token} onChange={(event) => setToken(event.target.value)} /></label>
        <button className="trip-button" type="button" disabled={busy || token.length < 32 || password.length < 12} onClick={() => void verify()}>{translate('accountVerify')}</button>
      </div>}
    </>}
    {failure && <p className="trip-error" role="alert">{failure}</p>}
  </fieldset>;
}