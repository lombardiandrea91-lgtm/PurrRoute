import { useEffect, useState, useSyncExternalStore } from 'react';
import type { TripCollaborator } from '@purrroute/contracts';
import type { Trip } from '@purrroute/domain';
import { messages } from '../messages.ts';
import { getAccountSession, subscribeAccountSession } from '../account/session.ts';
import type { Locale } from '../preferences.ts';
import {
  addTripCollaborator,
  CollaborationClientError,
  getTripCollaborators,
  removeTripCollaborator,
} from './client.ts';

export function TripCollaborationPanel({ trip, locale }: { trip: Trip; locale: Locale }) {
  const translate = (key: keyof typeof messages.it) => messages[locale][key];
  const session = useSyncExternalStore(subscribeAccountSession, getAccountSession);
  const [members, setMembers] = useState<TripCollaborator[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);
  const [notSynced, setNotSynced] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setMembers(null); setFailure(''); setNotice(''); setNotSynced(false);
    if (!session) return undefined;
    let active = true;
    void getTripCollaborators(trip.id).then(({ members: value }) => {
      if (active) setMembers(value);
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof CollaborationClientError && error.status === 404) setNotSynced(true);
      else setFailure(translate('collaborationUnavailable'));
    });
    return () => { active = false; };
  }, [session?.account.id, trip.id, refreshIndex]);

  const owner = members?.some((member) => member.userId === session?.account.id && member.role === 'owner') ?? false;

  const add = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!owner) return;
    setLoading(true); setFailure(''); setNotice('');
    try {
      const member = await addTripCollaborator(trip.id, { email: email.trim(), role });
      setMembers((current) => current
        ? [...current.filter((item) => item.userId !== member.userId), member]
          .sort((left, right) => left.role === 'owner' ? -1 : right.role === 'owner' ? 1 : left.email.localeCompare(right.email))
        : [member]);
      setEmail('');
      setNotice(translate('collaborationAdded'));
    } catch (error) {
      setFailure(error instanceof CollaborationClientError && error.status === 404
        ? translate('collaborationAccountNotFound') : translate('collaborationUnavailable'));
    } finally { setLoading(false); }
  };

  const remove = async (member: TripCollaborator) => {
    if (!owner || member.role === 'owner'
      || !window.confirm(translate('confirmRemoveCollaborator'))) return;
    setLoading(true); setFailure(''); setNotice('');
    try {
      await removeTripCollaborator(trip.id, member.userId);
      setMembers((current) => current?.filter((item) => item.userId !== member.userId) ?? null);
      setNotice(translate('collaborationRemoved'));
    } catch { setFailure(translate('collaborationUnavailable')); }
    finally { setLoading(false); }
  };

  return <section className="trip-collaboration-panel" aria-labelledby="trip-collaboration-heading">
    <h2 id="trip-collaboration-heading">{translate('collaborationTitle')}</h2>
    <p className="muted">{translate('collaborationSubtitle')}</p>
    {!session ? <p className="muted">{translate('collaborationAccountRequired')}</p>
      : notSynced ? <>
        <p className="muted">{translate('collaborationSyncFirst')}</p>
        <button className="trip-button" type="button" onClick={() => setRefreshIndex((value) => value + 1)}>
          {translate('collaborationRefresh')}
        </button>
      </>
        : members && <>
          <ul className="collaborator-list">
            {members.map((member) => <li key={member.userId}>
              <span className="collaborator-email">{member.email}</span>
              <span className="collaborator-role">{translate(member.role === 'owner'
                ? 'collaborationOwner' : member.role === 'editor' ? 'collaborationEditor' : 'collaborationViewer')}</span>
              {owner && member.role !== 'owner' && <button className="trip-button trip-button-danger" type="button"
                disabled={loading} onClick={() => void remove(member)}>{translate('collaborationRemove')}</button>}
            </li>)}
          </ul>
          {owner && <form className="trip-inline-form collaboration-form" onSubmit={(event) => void add(event)}>
            <label className="trip-field">{translate('collaborationEmail')}
              <input type="email" maxLength={254} autoComplete="email" required value={email}
                onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="trip-field">{translate('collaborationRole')}
              <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
                <option value="editor">{translate('collaborationEditor')}</option>
                <option value="viewer">{translate('collaborationViewer')}</option>
              </select>
            </label>
            <button className="trip-button" type="submit" disabled={loading || !email.trim()}>
              {translate('collaborationAdd')}
            </button>
          </form>}
        </>}
    <p className="collaboration-disclosure">{translate('collaborationVerifiedOnly')}</p>
    {notice && <p className="muted" role="status">{notice}</p>}
    {failure && <p className="trip-error" role="alert">{failure}</p>}
  </section>;
}