import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { ExploreCandidate, NearbyExploreRequest } from '@purrroute/contracts';
import type { StopCategory, Trip, TripStop } from '@purrroute/domain';
import { messages } from '../messages.ts';
import type { MessageKey } from '../messages.ts';
import type { Locale } from '../preferences.ts';
import { LocalTripRepository, TripValidationError } from '../trips/repository.ts';
import { ExploreClientError, searchNearbyPlaces } from './client.ts';

const repository = new LocalTripRepository();
type ExploreCategory = NearbyExploreRequest['category'];
type ExploreRadius = NearbyExploreRequest['radiusKm'];

function distanceLabel(distanceMeters: number, locale: Locale): string {
  const distance = distanceMeters < 1000
    ? `${Math.round(distanceMeters)} m`
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(distanceMeters / 1000)} km`;
  return distance;
}

function messageFor(error: unknown, locale: Locale): string {
  if (error instanceof ExploreClientError) {
    if (error.code === 'explore_rate_limited') return messages[locale].exploreRateLimited;
    if (error.code === 'explore_timeout') return messages[locale].exploreTimeout;
    return messages[locale].exploreUnavailable;
  }
  if (error instanceof TripValidationError) return messages[locale].invalidStop;
  return messages[locale].exploreUnavailable;
}

export function ExploreWorkspace({ locale }: { locale: Locale }) {
  const translate = (key: MessageKey) => messages[locale][key];
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState('');
  const [stops, setStops] = useState<TripStop[]>([]);
  const [stopId, setStopId] = useState('');
  const [category, setCategory] = useState<ExploreCategory>('museum');
  const [radiusKm, setRadiusKm] = useState<ExploreRadius>(3);
  const [results, setResults] = useState<ExploreCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => repository.observeTrips((value) => {
    setTrips(value);
    if (!tripId && value[0]) setTripId(value[0].id);
    if (tripId && !value.some((trip) => trip.id === tripId)) setTripId(value[0]?.id ?? '');
  }, () => setTrips([])), [tripId]);

  useEffect(() => {
    setStops([]); setStopId(''); setResults([]); setError('');
    if (!tripId) return undefined;
    return repository.observeTrip(tripId, (details) => setStops(details?.stops ?? []), () => setStops([]));
  }, [tripId]);

  useEffect(() => {
    if (!stops.length) { setStopId(''); return; }
    if (!stops.some((stop) => stop.id === stopId && stop.latitude !== null)) {
      setStopId(stops.find((stop) => stop.latitude !== null && stop.longitude !== null)?.id ?? '');
    }
  }, [stops, stopId]);

  const selectedStop = stops.find((stop) => stop.id === stopId
    && stop.latitude !== null && stop.longitude !== null) ?? null;
  const selectedTrip = trips.find((trip) => trip.id === tripId) ?? null;
  const existingPlaceIds = new Set(stops
    .filter((stop) => stop.locationSource === 'wikidata' && stop.sourcePlaceId)
    .map((stop) => stop.sourcePlaceId));

  const search = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStop || selectedStop.latitude === null || selectedStop.longitude === null) return;
    setLoading(true); setError(''); setNotice(''); setResults([]);
    try {
      const response = await searchNearbyPlaces({
        latitude: selectedStop.latitude,
        longitude: selectedStop.longitude,
        radiusKm,
        category,
        locale,
      });
      setResults(response.results);
      if (!response.results.length) setNotice(translate('exploreNoResults'));
    } catch (failure) { setError(messageFor(failure, locale)); }
    finally { setLoading(false); }
  };

  const addPlace = async (place: ExploreCandidate) => {
    if (!tripId || existingPlaceIds.has(place.id)) return;
    setError(''); setNotice('');
    try {
      await repository.createStop(tripId, {
        name: place.label,
        category: (place.category === 'museum' ? 'museum' : 'nature') as StopCategory,
        planningState: 'planned',
        dayId: selectedStop?.dayId ?? null,
        latitude: place.latitude,
        longitude: place.longitude,
        locationSource: 'wikidata',
        sourcePlaceId: place.id,
      });
      setNotice(translate('exploreAdded'));
    } catch (failure) { setError(messageFor(failure, locale)); }
  };

  const locatedStops = stops.filter((stop) => stop.latitude !== null && stop.longitude !== null);

  return <section className="explore-workspace">
    <header className="explore-heading">
      <h1 tabIndex={-1}>{translate('explore')}</h1>
      <p>{translate('exploreSubtitle')}</p>
    </header>
    <form className="explore-controls" onSubmit={(event) => void search(event)}>
      <label>{translate('exploreTrip')}
        <select value={tripId} onChange={(event) => setTripId(event.target.value)} disabled={!trips.length}>
          {!trips.length && <option value="">{translate('noTrips')}</option>}
          {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}
        </select>
      </label>
      <label>{translate('exploreNearStop')}
        <select value={stopId} onChange={(event) => setStopId(event.target.value)} disabled={!locatedStops.length}>
          {!locatedStops.length && <option value="">{translate('exploreNeedsCoordinates')}</option>}
          {locatedStops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}
        </select>
      </label>
      <label>{translate('exploreCategory')}
        <select value={category} onChange={(event) => setCategory(event.target.value as ExploreCategory)}>
          <option value="museum">{translate('exploreMuseums')}</option>
          <option value="park">{translate('exploreParks')}</option>
        </select>
      </label>
      <label>{translate('exploreRadius')}
        <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value) as ExploreRadius)}>
          <option value={1}>1 km</option><option value={3}>3 km</option><option value={5}>5 km</option>
        </select>
      </label>
      <button className="trip-button" type="submit" disabled={!selectedStop || loading}>
        {loading ? translate('exploreLoading') : translate('exploreSearch')}
      </button>
    </form>
    <p className="explore-disclosure">{translate('exploreDisclosure')}</p>
    {!selectedTrip && <p className="muted">{translate('noTrips')}</p>}
    {selectedTrip && !locatedStops.length && <p className="muted">
      {translate('exploreNeedsCoordinates')} <Link to="/map">{translate('exploreOpenMap')}</Link>
    </p>}
    {notice && <p role="status" className="muted">{notice}</p>}
    {error && <p role="alert" className="trip-error">{error}</p>}
    {results.length > 0 && <>
      <div className="explore-results-heading"><h2>{translate('exploreResults')}</h2><span>{translate('explorePoweredBy')} <a href="https://www.wikidata.org/" target="_blank" rel="noreferrer">Wikidata</a></span></div>
      <ul className="explore-results">
        {results.map((place) => <li key={place.id}>
          <div className="explore-result-copy">
            <strong>{place.label}</strong>
            <span>{translate(place.category === 'museum' ? 'exploreMuseums' : 'exploreParks')} · {distanceLabel(place.distanceMeters, locale)}</span>
          </div>
          <a className="explore-wikidata-link" href={`https://www.wikidata.org/wiki/${place.id}`} target="_blank" rel="noreferrer">{place.id}</a>
          <button className="trip-button" type="button" disabled={existingPlaceIds.has(place.id)} onClick={() => void addPlace(place)}>
            {translate(existingPlaceIds.has(place.id) ? 'exploreAlreadyAdded' : 'exploreAddToTrip')}
          </button>
        </li>)}
      </ul>
    </>}
  </section>;
}