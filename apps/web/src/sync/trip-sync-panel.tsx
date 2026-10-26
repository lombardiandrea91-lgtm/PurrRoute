import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import type { SyncTripRequest, SyncTripResponse } from '@purrroute/contracts';
import type { TripDetails } from '../trips/repository.ts';
import { LocalTripRepository } from '../trips/repository.ts';
import type { LocalTripSyncState } from '../trips/database.ts';
import { messages } from '../messages.ts';
import type { Locale } from '../preferences.ts';
import { getAccountSession, subscribeAccountSession } from '../account/session.ts';
import { pushSyncedTrip, SyncClientError } from './client.ts';
import { TripCollaborationPanel } from '../collaboration/trip-collaboration-panel.tsx';

const repository = new LocalTripRepository();

export function TripSyncPanel({ trip, locale }: { trip: TripDetails; locale: Locale }) {
  const translate = (key: keyof typeof messages.it) => messages[locale][key];
  const session = useSyncExternalStore(subscribeAccountSession, getAccountSession);
  const [syncState, setSyncState] = useState<LocalTripSyncState | null | undefined>(undefined);
  const [conflict, setConflict] = useState<SyncTripResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    setConflict(null); setFailure('');
    void repository.getSyncState(trip.trip.id).then((value) => setSyncState(value ?? null));
  }, [trip.trip.id, trip.trip.revision]);

  const makeRequest = (source: TripDetails, expectedVersion: number): SyncTripRequest => {
    const { ownerId: _ownerId, ...syncTrip } = source.trip;
    return {
      expectedVersion, trip: syncTrip, days: source.days, stops: source.stops,
      lists: source.lists, listItems: source.listItems, expenses: source.expenses,
    };
  };

  const push = async (expectedVersion: number) => {
    if (!session) return;
    const source = await repository.getTripForSync(trip.trip.id);
    if (!source) throw new Error('sync_trip_missing');
    const response = await pushSyncedTrip(makeRequest(source, expectedVersion));
    await repository.markTripSynced(
      trip.trip.id, session.account.id, response.version, source.trip.revision, response.syncedAt,
    );
    setSyncState({
      id: trip.trip.id,
      accountId: session.account.id,
      serverVersion: response.version,
      localRevision: source.trip.revision,
      syncedAt: response.syncedAt,
    });
    setConflict(null); setFailure('');
  };

  const sync = async () => {
    if (!session) return;
    const sameAccount = syncState?.accountId === session.account.id;
    if (!sameAccount && !window.confirm(translate('confirmTransfer'))) return;
    setBusy(true); setFailure('');
    try {
      await push(sameAccount ? syncState.serverVersion : 0);
    } catch (error) {
      if (error instanceof SyncClientError && error.status === 409) {
        setConflict(error.current);
        setFailure(error.current ? translate('syncConflict') : translate('syncCloudUnavailable'));
      } else if (error instanceof SyncClientError && error.status === 403) {
        setFailure(translate('syncForbidden'));
      } else setFailure(translate('syncError'));
    } finally { setBusy(false); }
  };

  const useCloud = async () => {
    if (!session || !conflict || !window.confirm(translate('confirmUseCloud'))) return;
    setBusy(true); setFailure('');
    try {
      await repository.replaceTripFromSync(conflict, session.account.id);
      setSyncState({
        id: trip.trip.id,
        accountId: session.account.id,
        serverVersion: conflict.version,
        localRevision: conflict.trip.revision,
        syncedAt: conflict.syncedAt,
      });
      setConflict(null);
    } catch { setFailure(translate('syncError')); }
    finally { setBusy(false); }
  };

  const overwriteCloud = async () => {
    if (!session || !conflict || !window.confirm(translate('confirmOverwrite'))) return;
    setBusy(true); setFailure('');
    try { await push(conflict.version); }
    catch (error) {
      if (error instanceof SyncClientError && error.status === 409) {
        setConflict(error.current);
        setFailure(error.current ? translate('syncConflict') : translate('syncCloudUnavailable'));
      } else if (error instanceof SyncClientError && error.status === 403) {
        setFailure(translate('syncForbidden'));
      } else setFailure(translate('syncError'));
    }
    finally { setBusy(false); }
  };

  const pending = !syncState || syncState.accountId !== session?.account.id
    || syncState.localRevision !== trip.trip.revision;

  return <>
    <section className="trip-sync-panel" aria-labelledby="trip-sync-heading">
    <h2 id="trip-sync-heading">{translate('syncTitle')}</h2>
    {!session ? <p className="muted"><Link to="/settings">{translate('syncSignIn')}</Link></p> : <>
      <p className="muted" role="status">{pending ? translate('syncPending') : translate('syncDone')}</p>
      <button className="trip-button" type="button" disabled={busy} onClick={() => void sync()}>
        {translate('syncButton')}
      </button>
      {conflict && <div className="trip-sync-conflict">
        <button className="trip-button" type="button" disabled={busy} onClick={() => void useCloud()}>{translate('syncUseCloud')}</button>
        <button className="trip-button" type="button" disabled={busy} onClick={() => void overwriteCloud()}>{translate('syncOverwrite')}</button>
      </div>}
    </>}
    {failure && <p className="trip-error" role="alert">{failure}</p>}
    </section>
    <TripCollaborationPanel trip={trip.trip} locale={locale} />
  </>;
}