import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { LinkPreviewResponse } from '@purrroute/contracts';
import type { StopCategory, Trip } from '@purrroute/domain';
import { stopCategories } from '@purrroute/domain';
import { messages } from '../messages.ts';
import type { MessageKey } from '../messages.ts';
import type { Locale } from '../preferences.ts';
import { LocalTripRepository, TripValidationError } from '../trips/repository.ts';
import { LinkPreviewClientError, previewLink } from './client.ts';

const repository = new LocalTripRepository();
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const categoryLabels: Record<StopCategory, { it: string; en: string }> = {
  departure: { it: 'Partenza', en: 'Departure' }, destination: { it: 'Destinazione', en: 'Destination' },
  waypoint: { it: 'Tappa intermedia', en: 'Waypoint' }, lodging: { it: 'Alloggio', en: 'Accommodation' },
  restaurant: { it: 'Ristorante', en: 'Restaurant' }, cafe: { it: 'Caffè', en: 'Cafe' },
  attraction: { it: 'Attrazione', en: 'Attraction' }, museum: { it: 'Museo', en: 'Museum' },
  train: { it: 'Treno', en: 'Train' }, flight: { it: 'Volo', en: 'Flight' }, car: { it: 'Auto', en: 'Car' },
  nature: { it: 'Natura', en: 'Nature' }, beach: { it: 'Spiaggia', en: 'Beach' },
  shopping: { it: 'Shopping', en: 'Shopping' },
};

type ImportMode = 'link' | 'screenshot';

function errorMessage(error: unknown, locale: Locale): string {
  if (error instanceof LinkPreviewClientError) {
    if (error.code === 'link_preview_rate_limited') return messages[locale].importRateLimited;
    if (error.code === 'link_preview_blocked') return messages[locale].importLinkBlocked;
  }
  if (error instanceof TripValidationError) return messages[locale].invalidStop;
  return messages[locale].importUnavailable;
}

export function ImportWorkspace({ locale }: { locale: Locale }) {
  const translate = (key: MessageKey) => messages[locale][key];
  const [searchParams] = useSearchParams();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState(searchParams.get('trip') ?? '');
  const [days, setDays] = useState<{ id: string; date: string }[]>([]);
  const [dayId, setDayId] = useState('');
  const [mode, setMode] = useState<ImportMode>('link');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<LinkPreviewResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<StopCategory>('attraction');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => repository.observeTrips((value) => {
    setTrips(value);
    if (!tripId && value[0]) setTripId(value[0].id);
    if (tripId && !value.some((trip) => trip.id === tripId)) setTripId(value[0]?.id ?? '');
  }, () => setTrips([])), [tripId]);

  useEffect(() => {
    setDays([]);
    setDayId('');
    if (!tripId) return undefined;
    return repository.observeTrip(tripId, (details) => setDays(details?.days ?? []), () => setDays([]));
  }, [tripId]);

  useEffect(() => {
    if (!file) { setImageUrl(''); return undefined; }
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const canReview = mode === 'link' ? preview !== null : file !== null;

  const loadPreview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true); setError(''); setNotice(''); setPreview(null); setName('');
    try {
      const result = await previewLink(url.trim());
      setPreview(result);
      setName(result.title);
    } catch (failure) { setError(errorMessage(failure, locale)); }
    finally { setLoading(false); }
  };

  const chooseImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.files?.[0] ?? null;
    setError(''); setNotice(''); setName(''); setAddress('');
    if (next && (!imageTypes.has(next.type) || next.size > 10 * 1024 * 1024)) {
      setFile(null);
      event.currentTarget.value = '';
      setError(translate('importImageInvalid'));
      return;
    }
    setFile(next);
  };

  const changeMode = (next: ImportMode) => {
    setMode(next); setPreview(null); setFile(null); setImageUrl(''); setName(''); setAddress('');
    setError(''); setNotice('');
  };

  const addStop = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tripId || !canReview) return;
    setError(''); setNotice('');
    try {
      await repository.createStop(tripId, {
        name, category, dayId: dayId || null, address: address || null,
        sourceUrl: mode === 'link' ? preview?.sourceUrl ?? null : null,
      });
      setNotice(translate('importAdded'));
      setPreview(null); setFile(null); setName(''); setAddress(''); setUrl('');
    } catch (failure) { setError(errorMessage(failure, locale)); }
  };

  return <section className="page import-workspace">
    <header className="import-heading">
      <h1 tabIndex={-1}>{translate('importTitle')}</h1>
      <p>{translate('importSubtitle')}</p>
    </header>
    <div className="trip-inline-form import-trip-picker">
      <label className="trip-field">{translate('importTrip')}
        <select value={tripId} onChange={(event) => setTripId(event.target.value)} disabled={!trips.length}>
          {!trips.length && <option value="">{translate('noTrips')}</option>}
          {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}
        </select>
      </label>
      <label className="trip-field">{translate('importDay')}
        <select value={dayId} onChange={(event) => setDayId(event.target.value)} disabled={!days.length}>
          <option value="">{translate('unassigned')}</option>
          {days.map((day) => <option key={day.id} value={day.id}>{day.date}</option>)}
        </select>
      </label>
    </div>
    {!trips.length && <p className="muted">{translate('noTrips')} <Link to="/trips">{translate('back')}</Link></p>}
    <fieldset className="import-modes">
      <legend>{translate('importSource')}</legend>
      <div className="segmented">
        <label><input type="radio" name="import-mode" checked={mode === 'link'} onChange={() => changeMode('link')} /><span>{translate('importLink')}</span></label>
        <label><input type="radio" name="import-mode" checked={mode === 'screenshot'} onChange={() => changeMode('screenshot')} /><span>{translate('importScreenshot')}</span></label>
      </div>
    </fieldset>
    {mode === 'link' ? <>
      <form className="trip-inline-form import-link-form" onSubmit={(event) => void loadPreview(event)}>
        <label className="trip-field trip-field-wide">{translate('importUrl')}
          <input type="url" inputMode="url" autoComplete="url" maxLength={2048} required value={url}
            onChange={(event) => { setUrl(event.target.value); setPreview(null); setName(''); setAddress(''); }} />
        </label>
        <button className="trip-button" type="submit" disabled={loading || !tripId}>
          {loading ? translate('importLoading') : translate('importReadLink')}
        </button>
      </form>
      <p className="import-disclosure">{translate('importLinkDisclosure')}</p>
    </> : <div className="import-screenshot">
      <label className="trip-field trip-field-wide">{translate('importChooseImage')}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseImage} />
      </label>
      <p className="import-disclosure">{translate('importScreenshotDisclosure')}</p>
      {imageUrl && <img className="import-image-preview" src={imageUrl} alt={translate('importImagePreview')} />}
    </div>}
    {canReview && <form className="import-review" onSubmit={(event) => void addStop(event)}>
      <h2>{translate('importReview')}</h2>
      {preview?.description && <p className="import-summary">{preview.description}</p>}
      <div className="trip-inline-form">
        <label className="trip-field">{translate('stopName')}
          <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="trip-field">{translate('category')}
          <select value={category} onChange={(event) => setCategory(event.target.value as StopCategory)}>
            {stopCategories.map((item) => <option key={item} value={item}>{categoryLabels[item][locale]}</option>)}
          </select>
        </label>
        <label className="trip-field">{translate('mapSelectedPlace')}
          <input maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
      </div>
      {preview && <a className="import-source-link" href={preview.sourceUrl} target="_blank" rel="noreferrer">{translate('importSourceLink')}</a>}
      <button className="trip-button" type="submit" disabled={!tripId || !name.trim()}>{translate('importAddToTrip')}</button>
    </form>}
    {notice && <p className="muted" role="status">{notice}</p>}
    {error && <p className="trip-error" role="alert">{error}</p>}
  </section>;
}