import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Trip } from '@purrroute/domain';
import type { SyncTripRequest, SyncTripResponse } from '@purrroute/contracts';
import { messages } from '../messages.ts';
import type { Locale } from '../preferences.ts';
import { getAccountSession, subscribeAccountSession } from '../account/session.ts';
import { LocalTripRepository } from '../trips/repository.ts';
import { listSyncedTrips, pushSyncedTrip, SyncClientError } from './client.ts';

const repository = new LocalTripRepository();

export function RemoteTripsPanel({ trips, locale }: { trips: Trip[]; locale: Locale }) {
  const translate = (key: keyof typeof messages.it) => messages[locale][key];
  const session = useSyncExternalStore(subscribeAccountSession, getAccountSession);
  const [remoteTrips, setRemoteTrips] = useState<SyncTripResponse[]>([]);
  const [deletedLocalTrips, setDeletedLocalTrips] = useState<Trip[]>([]);
  const [deletionConflict, setDeletionConflict] = useState<{ tripId: string; current: SyncTripResponse } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyTripId, setBusyTripId] = useState('');
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const localTripIds = trips.map((trip) => trip.id).sort().join('|');

  useEffect(() => {
    if (!session) { setRemoteTrips([]); setDeletedLocalTrips([]); return undefined; }
    let active = true;
    setLoading(true); setFailure('');
    void (async () => {
      const [cloudTrips, candidates] = await Promise.all([
        listSyncedTrips(),
        repository.listSyncCandidates(session.account.id),
      ]);
      const deleted: Trip[] = [];
      for (const trip of candidates) {
        if (trip.deletedAt === null) continue;
        const state = await repository.getSyncState(trip.id);
        if (state?.accountId === session.account.id && state.serverVersion > 0) deleted.push(trip);
      }
      if (active) { setRemoteTrips(cloudTrips); setDeletedLocalTrips(deleted); }
    })().catch(() => {
      if (active) setFailure(translate('syncError'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.account.id, localTripIds]);

  const importTrip = async (remote: SyncTripResponse) => {
    if (!session || !window.confirm(translate('confirmImportCloudTrip'))) return;
    setBusyTripId(remote.trip.id); setFailure(''); setNotice('');
    try {
      await repository.replaceTripFromSync(remote, session.account.id);
      setNotice(translate('syncImportComplete'));
    } catch { setFailure(translate('syncError')); }
    finally { setBusyTripId(''); }
  };

  const deletionRequest = async (tripId: string, expectedVersion: number): Promise<{
    request: SyncTripRequest;
    localRevision: number;
  }> => {
    const local = await repository.getTripForSync(tripId);
    if (!local) throw new Error('sync_trip_missing');
    const { ownerId: _ownerId, ...trip } = local.trip;
    return {
      request: {
        expectedVersion, trip, days: local.days, stops: local.stops,
        lists: local.lists, listItems: local.listItems, expenses: local.expenses,
      },
      localRevision: local.trip.revision,
    };
  };

  const pushDeletion = async (tripId: string, expectedVersion: number) => {
    if (!session) return;
    const payload = await deletionRequest(tripId, expectedVersion);
    const result = await pushSyncedTrip(payload.request);
    await repository.markTripSynced(tripId, session.account.id, result.version, payload.localRevision, result.syncedAt);
    setDeletedLocalTrips((current) => current.filter((trip) => trip.id !== tripId));
    setDeletionConflict(null); setNotice(translate('syncDone')); setFailure('');
  };

  const syncDeletion = async (trip: Trip) => {
    if (!session || !window.confirm(translate('confirmSyncDeleted'))) return;
    const state = await repository.getSyncState(trip.id);
    if (!state || state.accountId !== session.account.id || state.serverVersion < 1) return;
    setBusyTripId(trip.id); setFailure(''); setNotice('');
    try { await pushDeletion(trip.id, state.serverVersion); }
    catch (error) {
      if (error instanceof SyncClientError && error.status === 409 && error.current) {
        setDeletionConflict({ tripId: trip.id, current: error.current });
        setFailure(translate('syncConflict'));
      } else setFailure(translate('syncError'));
    } finally { setBusyTripId(''); }
  };

  const keepDeletion = async () => {
    if (!deletionConflict || !window.confirm(translate('confirmKeepDeletion'))) return;
    setBusyTripId(deletionConflict.tripId); setFailure('');
    try { await pushDeletion(deletionConflict.tripId, deletionConflict.current.version); }
    catch (error) {
      if (error instanceof SyncClientError && error.status === 409 && error.current) {
        setDeletionConflict({ tripId: deletionConflict.tripId, current: error.current });
        setFailure(translate('syncConflict'));
      } else setFailure(translate('syncError'));
    } finally { setBusyTripId(''); }
  };

  const restoreCloudTrip = async () => {
    if (!session || !deletionConflict || !window.confirm(translate('confirmUseCloud'))) return;
    setBusyTripId(deletionConflict.tripId); setFailure('');
    try {
      await repository.replaceTripFromSync(deletionConflict.current, session.account.id);
      setDeletedLocalTrips((current) => current.filter((trip) => trip.id !== deletionConflict.tripId));
      setDeletionConflict(null); setNotice(translate('syncImportComplete'));
    } catch { setFailure(translate('syncError')); }
    finally { setBusyTripId(''); }
  };

  const localIds = new Set(trips.map((trip) => trip.id));
  const deletedIds = new Set(deletedLocalTrips.map((trip) => trip.id));
  const available = remoteTrips.filter((remote) => !localIds.has(remote.trip.id) && !deletedIds.has(remote.trip.id));

  return <section className="trip-cloud-panel" aria-labelledby="trip-cloud-heading">
    <h2 id="trip-cloud-heading">{translate('syncCloudTrips')}</h2>
    {session ? <>
      {loading && <p className="muted" role="status">{translate('tripLoading')}</p>}
      {!loading && !failure && available.length === 0 && <p className="muted">{translate('syncCloudEmpty')}</p>}
      {available.map((remote) => <div className="trip-cloud-row" key={remote.trip.id}>
        <strong>{remote.trip.title}</strong>
        <span className="muted">{remote.days.length} · {remote.stops.length}</span>
        <button className="trip-button" type="button" disabled={Boolean(busyTripId)} onClick={() => void importTrip(remote)}>
          {busyTripId === remote.trip.id ? translate('tripLoading') : translate('syncDownloadTrip')}
        </button>
      </div>)}
      {deletedLocalTrips.map((trip) => <div className="trip-cloud-row" key={trip.id}>
        <strong>{trip.title}</strong>
        <span className="muted">{translate('syncDeletedPending')}</span>
        <button className="trip-button" type="button" disabled={Boolean(busyTripId)} onClick={() => void syncDeletion(trip)}>
          {translate('syncDeletedButton')}
        </button>
        {deletionConflict?.tripId === trip.id && <div className="account-actions">
          <button className="trip-button" type="button" disabled={Boolean(busyTripId)} onClick={() => void restoreCloudTrip()}>{translate('syncUseCloud')}</button>
          <button className="trip-button" type="button" disabled={Boolean(busyTripId)} onClick={() => void keepDeletion()}>{translate('syncKeepDeletion')}</button>
        </div>}
      </div>)}
    </> : <p className="muted">{translate('syncSignIn')}</p>}
    {notice && <p className="muted" role="status">{notice}</p>}
    {failure && <p className="trip-error" role="alert">{failure}</p>}
  </section>;
}