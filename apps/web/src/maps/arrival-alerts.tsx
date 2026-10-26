import { useEffect, useRef, useState } from 'react';
import type { TripStop } from '@purrroute/domain';
import { messages } from '../messages.ts';
import type { Locale } from '../preferences.ts';
import { findNearestUnvisitedStop } from './arrival.ts';

const radiusOptions = [100, 250, 500] as const;

export function ArrivalAlerts({ tripId, stops, locale }: {
  tripId: string;
  stops: TripStop[];
  locale: Locale;
}) {
  const text = messages[locale];
  const [active, setActive] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState<(typeof radiusOptions)[number]>(250);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const stopsRef = useRef(stops);
  const notifiedStopIds = useRef(new Set<string>());
  stopsRef.current = stops;

  useEffect(() => {
    notifiedStopIds.current.clear();
    setNotice('');
  }, [tripId]);

  useEffect(() => {
    if (!active) return undefined;
    let watchId: number | null = null;

    const stopWatching = () => {
      if (watchId === null) return;
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    };

    const onPosition = (position: GeolocationPosition) => {
      const nearest = findNearestUnvisitedStop(
        stopsRef.current,
        position.coords.latitude,
        position.coords.longitude,
        radiusMeters,
        notifiedStopIds.current,
      );
      if (!nearest) return;
      notifiedStopIds.current.add(nearest.stop.id);
      const body = `${text.arrivalNearbyBody}: ${nearest.stop.name}`;
      setNotice(body);
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(text.arrivalNotificationTitle, {
            body,
            tag: `purrroute-arrival-${tripId}-${nearest.stop.id}`,
          });
        } catch {
          setFailure(text.arrivalNotificationUnavailable);
        }
      }
    };

    const onLocationError = (error: GeolocationPositionError) => {
      setFailure(error.code === error.PERMISSION_DENIED
        ? text.arrivalLocationDenied : text.arrivalLocationError);
      setActive(false);
    };

    const startWatching = () => {
      if (watchId !== null || document.visibilityState !== 'visible') return;
      try {
        watchId = navigator.geolocation.watchPosition(onPosition, onLocationError, {
          enableHighAccuracy: false,
          maximumAge: 15_000,
          timeout: 20_000,
        });
      } catch {
        setFailure(text.arrivalLocationError);
        setActive(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') startWatching();
      else stopWatching();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    startWatching();
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stopWatching();
    };
  }, [active, locale, radiusMeters, text, tripId]);

  const eligibleStops = stops.filter((stop) => stop.visitedAt === null
    && stop.latitude !== null && stop.longitude !== null);

  const toggle = () => {
    setFailure('');
    setNotice('');
    if (active) {
      setActive(false);
      return;
    }
    if (!window.isSecureContext || !navigator.geolocation) {
      setFailure(text.arrivalUnsupported);
      return;
    }
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => undefined);
    }
    notifiedStopIds.current.clear();
    setActive(true);
  };

  return <section className="map-arrival-alerts" aria-labelledby="arrival-alerts-heading">
    <div className="map-arrival-heading">
      <h3 id="arrival-alerts-heading">{text.arrivalTitle}</h3>
      <label className="map-arrival-radius">{text.arrivalRadius}
        <select value={radiusMeters} onChange={(event) => setRadiusMeters(Number(event.target.value) as typeof radiusMeters)}>
          {radiusOptions.map((radius) => <option key={radius} value={radius}>{radius} m</option>)}
        </select>
      </label>
    </div>
    <button className="map-action-button" type="button" disabled={!eligibleStops.length} onClick={toggle}>
      {active ? text.arrivalStop : text.arrivalStart}
    </button>
    {!eligibleStops.length && <p className="map-privacy-note">{text.arrivalNoStops}</p>}
    <p className="map-privacy-note">{text.arrivalDisclosure}</p>
    {active && <p className="map-privacy-note" role="status">{text.arrivalMonitoring}</p>}
    {notice && <p className="map-privacy-note" role="status">{notice}</p>}
    {failure && <p className="map-error" role="alert">{failure}</p>}
  </section>;
}