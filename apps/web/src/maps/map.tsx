import { useEffect, useId, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { renderSvg } from '@purrroute/design-system';
import type { GraphicId } from '@purrroute/design-system';
import type { StopCategory, StopPlanningState, Trip, TripDay, TripStop } from '@purrroute/domain';
import { stopCategories } from '@purrroute/domain';
import { messages } from '../messages.ts';
import type { MessageKey } from '../messages.ts';
import type { Locale } from '../preferences.ts';
import { LocalTripRepository, TripValidationError } from '../trips/repository.ts';
import type { TripDetails } from '../trips/repository.ts';
import {
  createSchematicRoute,
  locationIqDirectionsAdapter,
  locationIqSearchAdapter,
  openFreeMapTiles,
} from './adapters.ts';
import type { Coordinate, PlaceCandidate, RoadRoute, RouteProfile } from './adapters.ts';
import { createOfflineTilePlan, downloadOfflineTilePlan } from './offline.ts';
import type { OfflineBounds } from './offline.ts';
import './map.css';

setWorkerUrl(maplibreWorkerUrl);

const repository = new LocalTripRepository();

const pinForCategory: Record<StopCategory, GraphicId> = {
  departure: 'pin-partenza',
  destination: 'pin-destinazione',
  waypoint: 'pin-tappa',
  lodging: 'pin-alloggio',
  restaurant: 'pin-ristorante',
  cafe: 'pin-caffe',
  attraction: 'pin-attrazione',
  museum: 'pin-museo',
  train: 'pin-treno',
  flight: 'pin-volo',
  car: 'pin-auto',
  nature: 'pin-natura',
  beach: 'pin-spiaggia',
  shopping: 'pin-shopping',
};

const categoryLabels: Record<StopCategory, { it: string; en: string }> = {
  departure: { it: 'Partenza', en: 'Departure' },
  destination: { it: 'Destinazione', en: 'Destination' },
  waypoint: { it: 'Zampata', en: 'Waypoint' },
  lodging: { it: 'Alloggio', en: 'Accommodation' },
  restaurant: { it: 'Ristorante', en: 'Restaurant' },
  cafe: { it: 'Caffè', en: 'Cafe' },
  attraction: { it: 'Attrazione', en: 'Attraction' },
  museum: { it: 'Museo', en: 'Museum' },
  train: { it: 'Treno', en: 'Train' },
  flight: { it: 'Volo', en: 'Flight' },
  car: { it: 'Auto', en: 'Car' },
  nature: { it: 'Natura', en: 'Nature' },
  beach: { it: 'Spiaggia', en: 'Beach' },
  shopping: { it: 'Shopping', en: 'Shopping' },
};

interface MapWorkspaceProps {
  locale: Locale;
}

interface RoadFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: { kind: 'road'; label: string };
    geometry: RoadRoute['geometry'];
  }>;
}

function Icon({ id }: { id: GraphicId }) {
  const instance = `map-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <span className="graphic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderSvg(id, instance) }} />;
}

function dateLabel(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00.000Z`));
}

function stopStateLabel(stop: TripStop, locale: Locale, translate: (key: MessageKey) => string): string[] {
  const states = [translate(stop.planningState === 'optional' ? 'optional' : 'planned')];
  if (stop.isFavorite) states.push(translate('favorite'));
  if (stop.visitedAt) states.push(translate('visited'));
  return states;
}

function mapErrorMessage(error: unknown, translate: (key: MessageKey) => string): string {
  if (error instanceof TripValidationError) return translate('mapStopInvalid');
  if (error instanceof Error && error.message === 'map_service_quota') return translate('mapServiceQuota');
  return translate('mapServiceUnavailable');
}

function coordinatePair(stop: TripStop): Coordinate | null {
  return stop.latitude === null || stop.longitude === null ? null : [stop.longitude, stop.latitude];
}

function createMarkerElement(stop: TripStop, selected: boolean, locale: Locale, onSelect: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `map-pin${stop.planningState === 'optional' ? ' is-optional' : ''}${stop.isFavorite ? ' is-favorite' : ''}${stop.visitedAt ? ' is-visited' : ''}${selected ? ' is-selected' : ''}`;
  button.setAttribute('aria-label', `${stop.name}, ${categoryLabels[stop.category][locale]}`);
  button.setAttribute('aria-pressed', String(selected));
  button.innerHTML = renderSvg(pinForCategory[stop.category], `map-pin-${stop.id.replace(/[^a-zA-Z0-9_-]/g, '')}`);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect();
  });
  return button;
}

function createClusterElement(count: number, onSelect: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-cluster';
  button.textContent = String(count);
  button.setAttribute('aria-label', `${count} tappe raggruppate`);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect();
  });
  return button;
}

function clusterStops(map: MapLibreMap, stops: TripStop[]): TripStop[][] {
  const groups: Array<{ center: { x: number; y: number }; stops: TripStop[] }> = [];
  for (const stop of stops) {
    const coordinate = coordinatePair(stop);
    if (!coordinate) continue;
    const point = map.project(coordinate);
    if (point.x < -50 || point.y < -50 || point.x > map.getContainer().clientWidth + 50
      || point.y > map.getContainer().clientHeight + 50) continue;
    const group = groups.find((candidate) => Math.hypot(candidate.center.x - point.x, candidate.center.y - point.y) < 48);
    if (group) {
      const count = group.stops.length;
      group.center.x = (group.center.x * count + point.x) / (count + 1);
      group.center.y = (group.center.y * count + point.y) / (count + 1);
      group.stops.push(stop);
    } else {
      groups.push({ center: { x: point.x, y: point.y }, stops: [stop] });
    }
  }
  return groups.map((group) => group.stops);
}

function MapCanvas({
  tripId,
  tripDataReady,
  stops,
  selectedStopId,
  locale,
  pickMode,
  focusCoordinate,
  roadRoute,
  canAddStops,
  onSelectStop,
  onPickCoordinate,
  onStartPick,
  onDownloadArea,
  offlineProgress,
}: {
  tripId: string;
  tripDataReady: boolean;
  stops: TripStop[];
  selectedStopId: string | null;
  locale: Locale;
  pickMode: boolean;
  focusCoordinate: Coordinate | null;
  roadRoute: RoadRoute | null;
  canAddStops: boolean;
  onSelectStop(stopId: string): void;
  onPickCoordinate(coordinate: Coordinate): void;
  onStartPick(): void;
  onDownloadArea(bounds: OfflineBounds, zoom: number): void;
  offlineProgress: string;
}) {
  const translate = (key: MessageKey) => messages[locale][key];
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initialFitTripRef = useRef('');
  const markerRefs = useRef<Marker[]>([]);
  const currentLocationMarkerRef = useRef<Marker | null>(null);
  const mapLoadedRef = useRef(false);
  const onSelectRef = useRef(onSelectStop);
  const onPickRef = useRef(onPickCoordinate);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailure, setMapFailure] = useState(false);
  const [locateFailure, setLocateFailure] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tileProxyReady, setTileProxyReady] = useState(false);

  useEffect(() => { onSelectRef.current = onSelectStop; }, [onSelectStop]);
  useEffect(() => { onPickRef.current = onPickCoordinate; }, [onPickCoordinate]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let map: MapLibreMap | null = null;
    let cancelled = false;
    let loadedTimeout: number | undefined;
    const initialize = async () => {
      let style: string | StyleSpecification = openFreeMapTiles.styleUrl;
      try {
        const response = await fetch('/api/maps/tiles/style.json');
        if (response.ok) {
          style = await response.json() as StyleSpecification;
          setTileProxyReady(true);
        }
      } catch { setTileProxyReady(false); }
      if (cancelled || !containerRef.current) return;
      const activeMap = new MapLibreMap({
        container: containerRef.current,
        style,
        center: [12.5, 42.5],
        zoom: 5.2,
        minZoom: 3,
        maxZoom: 19,
        cooperativeGestures: true,
        trackResize: true,
        maxTileCacheSize: 64,
      });
      map = activeMap;
      mapRef.current = activeMap;
      loadedTimeout = window.setTimeout(() => {
        if (!mapLoadedRef.current) setMapFailure(true);
      }, 12_000);
      activeMap.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      activeMap.on('load', () => {
        if (loadedTimeout !== undefined) window.clearTimeout(loadedTimeout);
        mapLoadedRef.current = true;
        setMapReady(true);
        setMapLoaded(true);
        setMapFailure(false);
        activeMap.addSource('trip-route-schematic', { type: 'geojson', data: createSchematicRoute([], '') });
        activeMap.addLayer({
          id: 'trip-route-schematic-line',
          type: 'line',
          source: 'trip-route-schematic',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#12B5A3', 'line-width': 4, 'line-dasharray': [2, 2], 'line-opacity': 0.9 },
        });
        activeMap.addSource('trip-route-road', { type: 'geojson', data: emptyRoadFeatureCollection() });
        activeMap.addLayer({
          id: 'trip-route-road-line',
          type: 'line',
          source: 'trip-route-road',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#076A61', 'line-width': 5, 'line-opacity': 0.94 },
        });
      });
      activeMap.on('error', () => {
        if (!mapLoadedRef.current) setMapFailure(true);
      });
    };
    void initialize();
    return () => {
      cancelled = true;
      if (loadedTimeout !== undefined) window.clearTimeout(loadedTimeout);
      mapLoadedRef.current = false;
      currentLocationMarkerRef.current?.remove();
      currentLocationMarkerRef.current = null;
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
      setMapLoaded(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const handleClick = (event: { lngLat: { lng: number; lat: number } }) => {
      if (pickMode) onPickRef.current([event.lngLat.lng, event.lngLat.lat]);
    };
    map.getCanvas().style.cursor = pickMode ? 'crosshair' : '';
    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [pickMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const visibleStops = stops.filter((stop) => coordinatePair(stop) !== null);
    const schematic = createSchematicRoute(
      roadRoute ? [] : visibleStops.map((stop) => coordinatePair(stop) as Coordinate),
      'Collegamento schematico, non stradale',
    );
    (map.getSource('trip-route-schematic') as GeoJSONSource | undefined)?.setData(schematic);
    const roadFeatureCollection: RoadFeatureCollection = roadRoute
      ? {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { kind: 'road', label: 'Percorso stradale' }, geometry: roadRoute.geometry }],
      }
      : emptyRoadFeatureCollection();
    (map.getSource('trip-route-road') as GeoJSONSource | undefined)?.setData(roadFeatureCollection);
  }, [mapReady, roadRoute, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return undefined;
    const refreshMarkers = () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      for (const group of clusterStops(map, stops)) {
        if (group.length > 1) {
          const coordinates = group.map((stop) => coordinatePair(stop) as Coordinate);
          const firstCoordinate = coordinates[0];
          if (!firstCoordinate) continue;
          const bounds = coordinates.reduce((result, coordinate) => result.extend(coordinate),
            new LngLatBounds(firstCoordinate, firstCoordinate));
          const clusterMarker = new Marker({ element: createClusterElement(group.length, () => map.fitBounds(bounds, { padding: 76, maxZoom: 15 })) })
            .setLngLat([bounds.getCenter().lng, bounds.getCenter().lat])
            .addTo(map);
          markerRefs.current.push(clusterMarker);
          continue;
        }
        const stop = group[0];
        if (!stop) continue;
        const coordinate = coordinatePair(stop);
        if (!coordinate) continue;
        const marker = new Marker({ element: createMarkerElement(stop, stop.id === selectedStopId, locale, () => onSelectRef.current(stop.id)), anchor: 'bottom' })
          .setLngLat(coordinate)
          .addTo(map);
        markerRefs.current.push(marker);
      }
    };
    refreshMarkers();
    map.on('moveend', refreshMarkers);
    map.on('zoomend', refreshMarkers);
    return () => {
      map.off('moveend', refreshMarkers);
      map.off('zoomend', refreshMarkers);
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
    };
  }, [locale, mapLoaded, selectedStopId, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoordinate) return;
    map.flyTo({ center: focusCoordinate, zoom: Math.max(map.getZoom(), 14), essential: false });
  }, [focusCoordinate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !tripDataReady || initialFitTripRef.current === tripId) return;
    initialFitTripRef.current = tripId;
    const locatedStops = stops.flatMap((stop) => {
      const coordinate = coordinatePair(stop);
      return coordinate ? [coordinate] : [];
    });
    const firstLocatedStop = locatedStops[0];
    if (locatedStops.length === 1 && firstLocatedStop) map.flyTo({ center: firstLocatedStop, zoom: 13, essential: false });
    else if (locatedStops.length > 1) {
      if (!firstLocatedStop) return;
      const bounds = locatedStops.reduce((result, coordinate) => result.extend(coordinate),
        new LngLatBounds(firstLocatedStop, firstLocatedStop));
      map.fitBounds(bounds, { padding: 72, maxZoom: 13, duration: 450 });
    } else map.flyTo({ center: [12.5, 42.5], zoom: 5.2, duration: 300 });
  }, [tripId, mapReady, stops, tripDataReady]);

  const locate = () => {
    setLocateFailure(false);
    if (!navigator.geolocation) {
      setLocateFailure(true);
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const coordinate: Coordinate = [position.coords.longitude, position.coords.latitude];
      const map = mapRef.current;
      if (!map) return;
      map.flyTo({ center: coordinate, zoom: 14, essential: false });
      currentLocationMarkerRef.current?.remove();
      currentLocationMarkerRef.current = new Marker({ element: createCurrentLocationElement(translate('youAreHere')), anchor: 'center' })
        .setLngLat(coordinate)
        .addTo(map);
    }, () => setLocateFailure(true), { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 });
  };

  const canDownload = tileProxyReady && mapReady && 'serviceWorker' in navigator
    && Boolean(navigator.serviceWorker.controller);

  return <div className={`map-canvas-wrap${pickMode ? ' is-picking' : ''}`}>
    <div className="map-canvas" ref={containerRef} role="region" aria-label={translate('mapCanvas')} />
    <div className="map-canvas-actions">
      <button className="map-tool-button" type="button" disabled={!canAddStops || !mapReady} onClick={onStartPick}><Icon id="ui-aggiungi" />{translate('mapPickNew')}</button>
      <button className="map-tool-button" type="button" disabled={!mapReady} onClick={locate}><Icon id="ui-posizione" />{translate('youAreHere')}</button>
      <button className="map-tool-button" type="button" disabled={!canDownload || Boolean(offlineProgress)} onClick={() => {
        const bounds = mapRef.current?.getBounds().toArray();
        const zoom = mapRef.current?.getZoom();
        if (bounds && zoom !== undefined) {
          onDownloadArea([bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]], zoom);
        }
      }}><Icon id="ui-offline" />{offlineProgress || translate('mapDownloadArea')}</button>
    </div>
    {pickMode && <p className="map-pick-instruction" role="status">{translate('pickMapPointHelp')}</p>}
    {!mapReady && !mapFailure && <div className="map-loading" role="status">{translate('mapLoading')}</div>}
    {mapFailure && <div className="map-fallback" role="status"><Icon id="ui-mappa" /><p>{translate('mapTilesUnavailable')}</p></div>}
    {locateFailure && <p className="map-inline-message" role="status">{translate('locationUnavailable')}</p>}
  </div>;
}

function createCurrentLocationElement(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-current-location';
  button.setAttribute('aria-label', label);
  return button;
}

function emptyRoadFeatureCollection(): RoadFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

export function MapWorkspace({ locale }: MapWorkspaceProps) {
  const translate = (key: MessageKey) => messages[locale][key];
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState('');
  const [details, setDetails] = useState<TripDetails | null>(null);
  const [dayFilter, setDayFilter] = useState('all');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [pickTargetStopId, setPickTargetStopId] = useState<string | null>(null);
  const [pendingCoordinate, setPendingCoordinate] = useState<Coordinate | null>(null);
  const [focusCoordinate, setFocusCoordinate] = useState<Coordinate | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [places, setPlaces] = useState<PlaceCandidate[]>([]);
  const [placeAttribution, setPlaceAttribution] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceCandidate | null>(null);
  const [mapStopName, setMapStopName] = useState('');
  const [mapStopCategory, setMapStopCategory] = useState<StopCategory>('waypoint');
  const [mapStopState, setMapStopState] = useState<StopPlanningState>('planned');
  const [roadProfile, setRoadProfile] = useState<RouteProfile>('driving');
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);
  const [serviceError, setServiceError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [loading, setLoading] = useState(true);
  const [offlineProgress, setOfflineProgress] = useState('');
  const [offlineNotice, setOfflineNotice] = useState('');
  const [offlineFailure, setOfflineFailure] = useState('');

  useEffect(() => repository.observeTrips((value) => {
    setTrips(value);
    setLoading(false);
    if (!tripId && value[0]) setTripId(value[0].id);
    if (tripId && !value.some((trip) => trip.id === tripId)) setTripId(value[0]?.id ?? '');
  }, () => setLoading(false)), [tripId]);

  useEffect(() => {
    setDetails(null);
    setDayFilter('all');
    setSelectedStopId(null);
    setRoadRoute(null);
    setPlaces([]);
    setSelectedPlace(null);
    setPickMode(false);
    setPickTargetStopId(null);
    setPendingCoordinate(null);
    if (!tripId) return undefined;
    return repository.observeTrip(tripId, setDetails, () => setDetails(null));
  }, [tripId]);

  const allStops = details?.stops ?? [];
  const dayDateById = new Map((details?.days ?? []).map((day) => [day.id, day.date]));
  const dayStops = allStops
    .filter((stop) => dayFilter === 'all' || stop.dayId === (dayFilter || null))
    .sort((left, right) => {
      const leftDate = left.dayId ? dayDateById.get(left.dayId) ?? '9999-12-31' : '9999-12-31';
      const rightDate = right.dayId ? dayDateById.get(right.dayId) ?? '9999-12-31' : '9999-12-31';
      return leftDate.localeCompare(rightDate) || left.position - right.position || left.name.localeCompare(right.name);
    });
  const locatedStops = dayStops.filter((stop) => stop.latitude !== null && stop.longitude !== null);
  const selectedTrip = trips.find((trip) => trip.id === tripId) ?? null;
  const canRoute = locatedStops.length >= 2 && locatedStops.length <= 25;

  const selectStop = (stopId: string) => {
    setSelectedStopId(stopId);
    const stop = allStops.find((item) => item.id === stopId);
    if (stop && stop.latitude !== null && stop.longitude !== null) {
      setFocusCoordinate([stop.longitude, stop.latitude]);
    }
  };

  const handleMapPick = async (coordinate: Coordinate) => {
    setPickMode(false);
    setMutationError('');
    if (pickTargetStopId) {
      const stop = allStops.find((item) => item.id === pickTargetStopId);
      if (!stop) return;
      try {
        await repository.updateStop(stop.id, {
          latitude: coordinate[1], longitude: coordinate[0], locationSource: 'manual', sourcePlaceId: null,
        });
        setSelectedStopId(stop.id);
      } catch (error) {
        setMutationError(mapErrorMessage(error, translate));
      }
      setPickTargetStopId(null);
      return;
    }
    setPendingCoordinate(coordinate);
    setMapStopName('');
  };

  const startPickForStop = (stopId: string) => {
    setPickTargetStopId(stopId);
    setPickMode(true);
    setPendingCoordinate(null);
    setSelectedStopId(stopId);
  };

  const addMapStop = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tripId || !pendingCoordinate) return;
    try {
      const stop = await repository.createStop(tripId, {
        name: mapStopName,
        category: mapStopCategory,
        planningState: mapStopState,
        dayId: dayFilter === 'all' ? null : dayFilter || null,
        longitude: pendingCoordinate[0],
        latitude: pendingCoordinate[1],
      });
      setSelectedStopId(stop.id);
      setFocusCoordinate(pendingCoordinate);
      setPendingCoordinate(null);
    } catch (error) {
      setMutationError(mapErrorMessage(error, translate));
    }
  };

  const addSearchResult = async (place: PlaceCandidate) => {
    if (!tripId) return;
    try {
      const stop = await repository.createStop(tripId, {
        name: place.label,
        category: mapStopCategory,
        planningState: mapStopState,
        dayId: dayFilter === 'all' ? null : dayFilter || null,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        locationSource: 'locationiq',
        sourcePlaceId: place.id,
      });
      setSelectedStopId(stop.id);
      setFocusCoordinate([place.longitude, place.latitude]);
      setSelectedPlace(null);
    } catch (error) {
      setMutationError(mapErrorMessage(error, translate));
    }
  };

  const searchPlaces = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServiceError('');
    setPlaces([]);
    setSelectedPlace(null);
    try {
      const results = await locationIqSearchAdapter.search(placeQuery, locale);
      setPlaces(results);
      setPlaceAttribution('LocationIQ');
      if (!results.length) setServiceError(translate('mapNoSearchResults'));
    } catch (error) {
      setServiceError(error instanceof Error && error.message === 'map_service_quota'
        ? translate('mapServiceQuota')
        : translate('mapSearchUnavailable'));
    }
  };

  const calculateRoute = async () => {
    setServiceError('');
    setRoadRoute(null);
    try {
      const route = await locationIqDirectionsAdapter.route(
        locatedStops.map((stop) => [stop.longitude as number, stop.latitude as number]),
        roadProfile,
      );
      setRoadRoute(route);
    } catch (error) {
      setServiceError(error instanceof Error && error.message === 'map_service_quota'
        ? translate('mapServiceQuota')
        : translate('mapRoutingUnavailable'));
    }
  };

  const downloadArea = async (bounds: OfflineBounds, zoom: number) => {
    setOfflineFailure(''); setOfflineNotice('');
    try {
      const response = await fetch('/api/maps/tiles/style.json');
      if (!response.ok) throw new Error('offline_download_failed');
      const style: unknown = await response.json();
      const tileJsonResponse = await fetch('/api/maps/tiles/planet.json');
      if (!tileJsonResponse.ok) throw new Error('offline_download_failed');
      const tileJson = await tileJsonResponse.json() as { tiles?: unknown };
      const vectorTileTemplate = Array.isArray(tileJson.tiles)
        ? tileJson.tiles.find((url): url is string => typeof url === 'string'
          && url.startsWith('/api/maps/tiles/planet/'))
        : undefined;
      if (!vectorTileTemplate) throw new Error('offline_download_failed');
      const plan = createOfflineTilePlan(bounds, zoom, style, vectorTileTemplate);
      if (!plan) throw new Error('offline_area_too_large');
      const confirmation = translate('confirmMapDownload').replace('{count}', String(plan.tileCount));
      if (!window.confirm(confirmation)) return;
      await downloadOfflineTilePlan(plan, (completed, total) => {
        setOfflineProgress(`${translate('mapDownloadProgress')} ${completed}/${total}`);
      });
      setOfflineNotice(translate('mapDownloadComplete'));
    } catch (error) {
      setOfflineFailure(error instanceof Error && error.message === 'offline_download_too_large'
        ? translate('mapDownloadTooLarge')
        : error instanceof Error && error.message === 'offline_area_too_large'
          ? translate('mapDownloadAreaTooLarge')
          : translate('mapDownloadFailed'));
    } finally { setOfflineProgress(''); }
  };

  return <section className="map-workspace">
    <header className="map-heading">
      <h1 tabIndex={-1}>{translate('map')}</h1>
      <label className="map-trip-select">{translate('selectTripForMap')}
        <select value={tripId} onChange={(event) => setTripId(event.target.value)} disabled={!trips.length}>
          {!trips.length && <option value="">{translate('noTrips')}</option>}
          {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}
        </select>
      </label>
    </header>

    <div className="map-layout">
      <div className="map-main-panel">
        <MapCanvas
          tripId={tripId}
          tripDataReady={!tripId || details !== null}
          stops={dayStops}
          selectedStopId={selectedStopId}
          locale={locale}
          pickMode={pickMode}
          focusCoordinate={focusCoordinate}
          roadRoute={roadRoute}
          canAddStops={Boolean(tripId)}
          onSelectStop={selectStop}
          onPickCoordinate={(coordinate) => void handleMapPick(coordinate)}
          onStartPick={() => {
            setPickTargetStopId(null);
            setPendingCoordinate(null);
            setPickMode(true);
          }}
          onDownloadArea={(bounds, zoom) => void downloadArea(bounds, zoom)}
          offlineProgress={offlineProgress}
        />
      </div>

      <aside className="map-side-panel" aria-label={translate('mapStops')}>
        {!trips.length && <p className="map-empty-note" role="status">{loading ? translate('tripLoading') : translate('noTrips')}</p>}
        {selectedTrip && details && <>
          <div className="map-side-heading">
            <div><h2>{selectedTrip.title}</h2><span>{dayStops.length} {translate('mapStopsCount')}</span></div>
            <label className="map-day-filter">{translate('mapFilterDay')}
              <select value={dayFilter} onChange={(event) => {
                setDayFilter(event.target.value);
                setSelectedStopId(null);
                setRoadRoute(null);
              }}>
                <option value="all">{translate('allDays')}</option>
                <option value="">{translate('unassigned')}</option>
                {details.days.map((day) => <option key={day.id} value={day.id}>{dateLabel(day.date, locale)}</option>)}
              </select>
            </label>
          </div>

          <form className="map-search-form" onSubmit={(event) => void searchPlaces(event)}>
            <label className="map-search-label">{translate('mapSearchPlaces')}
              <input minLength={2} maxLength={200} value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder={translate('mapSearchPlaceholder')} />
            </label>
            <button className="map-action-button" type="submit" disabled={placeQuery.trim().length < 2}><Icon id="ui-cerca" />{translate('search')}</button>
            <p className="map-privacy-note">{translate('mapSearchDisclosure')}</p>
          </form>

          {places.length > 0 && <div className="map-search-results" aria-label={translate('mapSearchResults')}>
            {places.map((place) => <div className={`map-place-result${selectedPlace?.id === place.id ? ' is-selected' : ''}`} key={place.id}>
              <button className="map-place-select" type="button" onClick={() => {
                setSelectedPlace(place);
                setFocusCoordinate([place.longitude, place.latitude]);
              }}>
                <strong>{place.label}</strong><span>{place.address}</span>
              </button>
              <button className="map-place-add" type="button" aria-label={`${translate('mapSelectPlace')}: ${place.label}`} onClick={() => {
                setSelectedPlace(place);
                setFocusCoordinate([place.longitude, place.latitude]);
              }}><Icon id="ui-posizione" /></button>
            </div>)}
            {placeAttribution && <p className="map-privacy-note">Search by <a href="https://locationiq.com/" target="_blank" rel="noreferrer">LocationIQ.com</a></p>}
          </div>}

          {selectedPlace && <div className="map-pick-form">
            <h3>{translate('mapSelectedPlace')}: {selectedPlace.label}</h3>
            <p className="map-privacy-note">{selectedPlace.address}</p>
            <label className="map-search-label">{translate('category')}<select value={mapStopCategory} onChange={(event) => setMapStopCategory(event.target.value as StopCategory)}>
              {stopCategories.map((category) => <option key={category} value={category}>{categoryLabels[category][locale]}</option>)}
            </select></label>
            <label className="map-search-label">{translate('planning')}<select value={mapStopState} onChange={(event) => setMapStopState(event.target.value as StopPlanningState)}>
              <option value="planned">{translate('planned')}</option><option value="optional">{translate('optional')}</option>
            </select></label>
            <div className="map-form-actions">
              <button className="map-action-button" type="button" onClick={() => void addSearchResult(selectedPlace)}><Icon id="ui-aggiungi" />{translate('mapAddPlace')}</button>
              <button className="map-quiet-button" type="button" onClick={() => setSelectedPlace(null)}>{translate('cancel')}</button>
            </div>
          </div>}
          {serviceError && <p className="map-error" role="alert">{serviceError}</p>}
          {mutationError && <p className="map-error" role="alert">{mutationError}</p>}
          {offlineNotice && <p className="map-privacy-note" role="status">{offlineNotice}</p>}
          {offlineFailure && <p className="map-error" role="alert">{offlineFailure}</p>}

          {pendingCoordinate && <form className="map-pick-form" onSubmit={(event) => void addMapStop(event)}>
            <h3>{translate('mapNewPin')}</h3>
            <p className="map-privacy-note">{pendingCoordinate[1].toFixed(5)}, {pendingCoordinate[0].toFixed(5)}</p>
            <label className="map-search-label">{translate('stopName')}<input required maxLength={200} value={mapStopName} onChange={(event) => setMapStopName(event.target.value)} /></label>
            <label className="map-search-label">{translate('category')}<select value={mapStopCategory} onChange={(event) => setMapStopCategory(event.target.value as StopCategory)}>
              {stopCategories.map((category) => <option key={category} value={category}>{categoryLabels[category][locale]}</option>)}
            </select></label>
            <label className="map-search-label">{translate('planning')}<select value={mapStopState} onChange={(event) => setMapStopState(event.target.value as StopPlanningState)}>
              <option value="planned">{translate('planned')}</option><option value="optional">{translate('optional')}</option>
            </select></label>
            <div className="map-form-actions">
              <button className="map-action-button" type="submit"><Icon id="ui-aggiungi" />{translate('save')}</button>
              <button className="map-quiet-button" type="button" onClick={() => setPendingCoordinate(null)}>{translate('cancel')}</button>
            </div>
          </form>}

          <div className="map-route-controls">
            <label className="map-search-label">{translate('mapRouteMode')}
              <select value={roadProfile} onChange={(event) => setRoadProfile(event.target.value as RouteProfile)}>
                <option value="driving">{translate('mapDriving')}</option>
                <option value="walking">{translate('mapWalking')}</option>
              </select>
            </label>
            <button className="map-action-button" type="button" disabled={!canRoute} onClick={() => void calculateRoute()}>
              <Icon id="ui-itinerario" />{translate('mapCalculateRoute')}
            </button>
            <p className="map-privacy-note">{translate('mapRouteDisclosure')}</p>
            <p className="map-privacy-note">{roadRoute
              ? <>{(roadRoute.distanceMeters / 1000).toFixed(1)} km · {Math.round(roadRoute.durationSeconds / 60)} min · <a href="https://locationiq.com/" target="_blank" rel="noreferrer">Search by LocationIQ.com</a></>
              : translate('mapSchematicDisclaimer')}</p>
          </div>

          <div className="map-stop-list">
            {dayStops.length === 0 && <p className="map-empty-note">{translate('mapNoStops')}</p>}
            {dayStops.map((stop) => <article className={`map-stop-row${selectedStopId === stop.id ? ' is-selected' : ''}`} key={stop.id}>
              <button className="map-stop-select" type="button" aria-current={selectedStopId === stop.id} onClick={() => selectStop(stop.id)}>
                <Icon id={pinForCategory[stop.category]} />
                <span><strong>{stop.name}</strong><small>{dayFilter === 'all' && stop.dayId && dayDateById.has(stop.dayId) ? `${dateLabel(dayDateById.get(stop.dayId) as string, locale)} · ` : ''}{categoryLabels[stop.category][locale]} · {stopStateLabel(stop, locale, translate).join(' · ')}</small></span>
              </button>
              {stop.latitude !== null && stop.longitude !== null
                ? <span className="map-stop-coordinates">{stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}</span>
                : <button className="map-set-location" type="button" onClick={() => startPickForStop(stop.id)}>{translate('mapSetLocation')}</button>}
            </article>)}
          </div>
        </>}
      </aside>
    </div>
  </section>;
}

export default MapWorkspace;