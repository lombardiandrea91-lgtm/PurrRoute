import { useEffect, useId, useState } from 'react';
import { renderSvg } from '@purrroute/design-system';
import type { GraphicId } from '@purrroute/design-system';
import type { StopCategory, StopPlanningState, Trip, TripStop } from '@purrroute/domain';
import { stopCategories } from '@purrroute/domain';
import { messages } from './messages.ts';
import type { MessageKey } from './messages.ts';
import type { Locale } from './preferences.ts';
import { LocalTripRepository, TripValidationError } from './trips/repository.ts';
import type { TripInput } from './trips/repository.ts';
import { TripSyncPanel } from './sync/trip-sync-panel.tsx';
import { RemoteTripsPanel } from './sync/remote-trips-panel.tsx';
import { TripLogistics } from './trips/logistics.tsx';

const repository = new LocalTripRepository();

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

function Icon({ id }: { id: GraphicId }) {
  const instance = `trip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <span className="graphic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderSvg(id, instance) }} />;
}

function dateLabel(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00.000Z`));
}

function toLocalInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function errorMessage(error: unknown, translate: (key: MessageKey) => string): string {
  if (error instanceof TripValidationError) {
    const keys: Record<TripValidationError['code'], MessageKey> = {
      title_required: 'titleRequired',
      invalid_date_range: 'invalidDate',
      invalid_date: 'invalidDate',
      duplicate_day: 'duplicateDay',
      invalid_trip: 'invalidTrip',
      invalid_day: 'invalidDay',
      invalid_stop: 'invalidStop',
      invalid_list: 'invalidList',
      invalid_list_item: 'invalidListItem',
      invalid_expense: 'invalidExpense',
    };
    return translate(keys[error.code]);
  }
  return translate('tripSaveError');
}

function TripEditor({
  initial,
  locale,
  onSave,
  onCancel,
}: {
  initial: Trip | null;
  locale: Locale;
  onSave(input: TripInput): Promise<void>;
  onCancel(): void;
}) {
  const translate = (key: MessageKey) => messages[locale][key];
  const titleId = useId();
  const descriptionId = useId();
  const startId = useId();
  const endId = useId();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? '');
  const [failure, setFailure] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure('');
    try {
      await onSave({ title, description, startsOn: startsOn || null, endsOn: endsOn || null, timeZone: initial?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone });
    } catch (error) {
      setFailure(errorMessage(error, translate));
    }
  };

  return <form className="trip-editor" onSubmit={(event) => void submit(event)}>
    <h2>{translate(initial ? 'editTrip' : 'newTrip')}</h2>
    <div className="trip-editor-fields">
      <label className="trip-field trip-field-wide" htmlFor={titleId}>{translate('tripTitle')}
        <input id={titleId} value={title} maxLength={160} required onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="trip-field trip-field-wide" htmlFor={descriptionId}>{translate('description')}
        <textarea id={descriptionId} value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label className="trip-field" htmlFor={startId}>{translate('startDate')}
        <input id={startId} type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
      </label>
      <label className="trip-field" htmlFor={endId}>{translate('endDate')}
        <input id={endId} type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
      </label>
    </div>
    {failure && <p className="trip-error" role="alert">{failure}</p>}
    <div className="trip-form-actions">
      <button className="trip-button" type="submit"><Icon id="ui-aggiungi" />{translate('save')}</button>
      <button className="trip-button" type="button" onClick={onCancel}>{translate('cancel')}</button>
    </div>
  </form>;
}

function StopRow({
  stop,
  days,
  locale,
  onSave,
  onToggleFavorite,
  onToggleVisited,
  onMove,
  onReorder,
  onDelete,
}: {
  stop: TripStop;
  days: Array<{ id: string; date: string }>;
  locale: Locale;
  onSave(changes: Partial<Pick<TripStop, 'name' | 'category' | 'planningState' | 'scheduledAt' | 'durationMinutes'>>): Promise<void>;
  onToggleFavorite(value: boolean): Promise<void>;
  onToggleVisited(value: string | null): Promise<void>;
  onMove(dayId: string | null): Promise<void>;
  onReorder(position: number): Promise<void>;
  onDelete(): Promise<void>;
}) {
  const translate = (key: MessageKey) => messages[locale][key];
  const nameId = useId();
  const categoryId = useId();
  const planningId = useId();
  const scheduleId = useId();
  const durationId = useId();
  const moveId = useId();
  const [name, setName] = useState(stop.name);
  const [category, setCategory] = useState<StopCategory>(stop.category);
  const [planningState, setPlanningState] = useState<StopPlanningState>(stop.planningState);
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(stop.scheduledAt));
  const [duration, setDuration] = useState(stop.durationMinutes?.toString() ?? '');
  const [failure, setFailure] = useState('');

  useEffect(() => {
    setName(stop.name);
    setCategory(stop.category);
    setPlanningState(stop.planningState);
    setScheduledAt(toLocalInput(stop.scheduledAt));
    setDuration(stop.durationMinutes?.toString() ?? '');
  }, [stop.id, stop.updatedAt]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure('');
    try {
      await onSave({
        name,
        category,
        planningState,
        scheduledAt: fromLocalInput(scheduledAt),
        durationMinutes: duration ? Number(duration) : null,
      });
    } catch (error) {
      setFailure(errorMessage(error, translate));
    }
  };

  return <article className="trip-stop">
    <form className="trip-stop-edit" onSubmit={(event) => void save(event)}>
      <label className="trip-field" htmlFor={nameId}>{translate('stopName')}
        <input id={nameId} value={name} maxLength={200} required onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="trip-field" htmlFor={categoryId}>{translate('category')}
        <select id={categoryId} value={category} onChange={(event) => setCategory(event.target.value as StopCategory)}>
          {stopCategories.map((item) => <option key={item} value={item}>{categoryLabels[item][locale]}</option>)}
        </select>
      </label>
      <label className="trip-field" htmlFor={planningId}>{translate('planning')}
        <select id={planningId} value={planningState} onChange={(event) => setPlanningState(event.target.value as StopPlanningState)}>
          <option value="planned">{translate('planned')}</option>
          <option value="optional">{translate('optional')}</option>
        </select>
      </label>
      <label className="trip-field" htmlFor={scheduleId}>{translate('scheduledAt')}
        <input id={scheduleId} type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
      </label>
      <label className="trip-field" htmlFor={durationId}>{translate('durationMinutes')}
        <input id={durationId} type="number" min="0" step="5" value={duration} onChange={(event) => setDuration(event.target.value)} />
      </label>
      <button className="trip-button" type="submit">{translate('saveStop')}</button>
    </form>
    <div className="trip-stop-actions">
      <label className="trip-check"><input type="checkbox" checked={stop.isFavorite} onChange={(event) => void onToggleFavorite(event.target.checked)} /><Icon id="ui-preferiti" />{translate('favorite')}</label>
      <button className="trip-button" type="button" aria-pressed={Boolean(stop.visitedAt)} onClick={() => void onToggleVisited(stop.visitedAt ? null : new Date().toISOString())}>
        {translate(stop.visitedAt ? 'markUnvisited' : 'markVisited')}
      </button>
      <label className="trip-field trip-move-field" htmlFor={moveId}>{translate('moveToDay')}
        <select id={moveId} value={stop.dayId ?? ''} onChange={(event) => void onMove(event.target.value || null)}>
          <option value="">{translate('unassigned')}</option>
          {days.map((day) => <option key={day.id} value={day.id}>{dateLabel(day.date, locale)}</option>)}
        </select>
      </label>
      <button className="trip-button" type="button" disabled={stop.position === 0} onClick={() => void onReorder(stop.position - 1)}>{translate('moveUp')}</button>
      <button className="trip-button" type="button" onClick={() => void onReorder(stop.position + 1)}>{translate('moveDown')}</button>
      <button className="trip-button trip-button-danger" type="button" onClick={() => void onDelete()}>{translate('deleteStop')}</button>
    </div>
    {failure && <p className="trip-error" role="alert">{failure}</p>}
  </article>;
}

export function TripsWorkspace({ locale, cat }: { locale: Locale; cat: 'rosso' | 'cipria' }) {
  const translate = (key: MessageKey) => messages[locale][key];
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [details, setDetails] = useState<Awaited<ReturnType<typeof repository.getTrip>>>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null | undefined>(undefined);
  const [tripEditor, setTripEditor] = useState<Trip | null | false>(false);
  const [showDayForm, setShowDayForm] = useState(false);
  const [dayDate, setDayDate] = useState('');
  const [showStopForm, setShowStopForm] = useState(false);
  const [stopName, setStopName] = useState('');
  const [stopCategory, setStopCategory] = useState<StopCategory>('waypoint');
  const [stopPlanning, setStopPlanning] = useState<StopPlanningState>('planned');
  const [stopSchedule, setStopSchedule] = useState('');
  const [stopDuration, setStopDuration] = useState('');
  const [loadFailure, setLoadFailure] = useState(false);
  const [mutationFailure, setMutationFailure] = useState('');
  const [loaded, setLoaded] = useState(false);
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? null;

  useEffect(() => repository.observeTrips(
    (value) => { setTrips(value); setLoaded(true); setLoadFailure(false); },
    () => { setLoaded(true); setLoadFailure(true); },
  ), []);

  useEffect(() => {
    setDetails(null);
    setSelectedDayId(undefined);
    if (!selectedTripId) return undefined;
    return repository.observeTrip(
      selectedTripId,
      (value) => { setDetails(value); setLoadFailure(false); },
      () => setLoadFailure(true),
    );
  }, [selectedTripId]);

  useEffect(() => {
    if (!details) return;
    const firstDayId = details.days[0]?.id;
    if (selectedDayId === undefined) {
      if (firstDayId) setSelectedDayId(firstDayId);
      return;
    }
    if (selectedDayId !== null && !details.days.some((day) => day.id === selectedDayId)
      && firstDayId) {
      setSelectedDayId(firstDayId);
    }
  }, [details, selectedDayId]);

  const perform = async (action: () => Promise<unknown>) => {
    setMutationFailure('');
    try { await action(); }
    catch (error) { setMutationFailure(errorMessage(error, translate)); }
  };

  const deleteTrip = async () => {
    if (!selectedTrip || !window.confirm(translate('confirmDeleteTrip'))) return;
    await perform(async () => {
      await repository.deleteTrip(selectedTrip.id);
      setSelectedTripId(null);
      setTripEditor(false);
    });
  };

  const deleteDay = async (dayId: string) => {
    if (!selectedTrip || !window.confirm(translate('confirmDeleteDay'))) return;
    await perform(async () => {
      await repository.deleteDay(selectedTrip.id, dayId);
      setSelectedDayId(null);
    });
  };

  const addTrip = async (input: TripInput) => {
    const trip = await repository.createTrip(input);
    setSelectedTripId(trip.id);
    setTripEditor(false);
  };

  const saveTrip = async (input: TripInput) => {
    if (!selectedTrip) return;
    await repository.updateTrip(selectedTrip.id, input);
    setTripEditor(false);
  };

  const addDay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTrip) return;
    await perform(async () => {
      const day = await repository.createDay(selectedTrip.id, { date: dayDate });
      setSelectedDayId(day.id);
      setDayDate('');
      setShowDayForm(false);
    });
  };

  const addStop = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTrip) return;
    await perform(async () => {
      await repository.createStop(selectedTrip.id, {
        name: stopName,
        category: stopCategory,
        planningState: stopPlanning,
        dayId: selectedDayId ?? null,
        scheduledAt: fromLocalInput(stopSchedule),
        durationMinutes: stopDuration ? Number(stopDuration) : null,
      });
      setStopName('');
      setStopSchedule('');
      setStopDuration('');
      setShowStopForm(false);
    });
  };

  const currentStops = details?.stops.filter((stop) => stop.dayId === (selectedDayId ?? null)) ?? [];
  const pageTitle = selectedTrip?.title ?? translate('trips');

  return <div className="trip-workspace">
    <section className={`trip-list-panel ${selectedTrip ? 'mobile-hidden' : ''}`} aria-label={translate('tripsHeading')}>
      {!selectedTrip && <h1 tabIndex={-1}>{translate('trips')}</h1>}
      <div className="trip-panel-heading">
        <h2>{translate('tripsHeading')}</h2>
        <span className="trip-count" aria-label={`${trips.length}`}>{trips.length}</span>
        <button className="trip-add-button" type="button" onClick={() => setTripEditor(null)} aria-label={translate('newTrip')}><Icon id="ui-aggiungi" />{translate('newTrip')}</button>
      </div>
      {tripEditor !== false && <TripEditor
        initial={tripEditor}
        locale={locale}
        onSave={tripEditor ? saveTrip : addTrip}
        onCancel={() => setTripEditor(false)}
      />}
      {loadFailure && <p className="trip-error" role="alert">{translate('tripLoadError')}</p>}
      {!loaded && <p className="muted" role="status">{translate('tripLoading')}</p>}
      {loaded && trips.length === 0 && tripEditor === false && <div className="trip-empty"><Icon id={`app-${cat}`} /><p>{translate('noTrips')}</p></div>}
      <div className="trip-list">
        {trips.map((trip) => <button
          className="trip-list-item"
          key={trip.id}
          type="button"
          aria-current={trip.id === selectedTripId}
          onClick={() => { setSelectedTripId(trip.id); setTripEditor(false); }}
        >
          <strong>{trip.title}</strong>
          <span>{trip.startsOn ? dateLabel(trip.startsOn, locale) : translate('noDates')}</span>
        </button>)}
      </div>
      <RemoteTripsPanel trips={trips} locale={locale} />
    </section>

    <section className={`trip-detail-panel ${selectedTrip ? '' : 'mobile-hidden'}`}>
      {!selectedTrip && <div className="trip-empty"><Icon id="ui-itinerario" /><p>{translate('noSelected')}</p></div>}
      {selectedTrip && <>
        <button className="trip-button trip-back" type="button" onClick={() => setSelectedTripId(null)}><Icon id="ui-viaggi" />{translate('back')}</button>
        <div className="trip-detail-heading">
          <div>
            <h1 tabIndex={-1}>{pageTitle}</h1>
            <p className="trip-dates">{selectedTrip.startsOn ? dateLabel(selectedTrip.startsOn, locale) : ''}{selectedTrip.endsOn ? ` – ${dateLabel(selectedTrip.endsOn, locale)}` : ''}</p>
          </div>
          <div className="trip-actions">
            <button className="trip-button" type="button" onClick={() => setTripEditor(selectedTrip)}>{translate('editTrip')}</button>
            <button className="trip-button trip-button-danger" type="button" onClick={() => void deleteTrip()}>{translate('deleteTrip')}</button>
          </div>
        </div>
        {selectedTrip.description && <p className="muted">{selectedTrip.description}</p>}
        {mutationFailure && <p className="trip-error" role="alert">{mutationFailure}</p>}
        {!details && !loadFailure && <p className="muted" role="status">{translate('tripLoading')}</p>}
        {details && <>
          <TripSyncPanel trip={details} locale={locale} />
          <section className="trip-section" aria-labelledby="trip-days-heading">
            <div className="trip-section-heading">
              <h2 id="trip-days-heading">{translate('days')}</h2>
              <button className="trip-button" type="button" onClick={() => setShowDayForm((value) => !value)}><Icon id="ui-date" />{translate('addDay')}</button>
            </div>
            {showDayForm && <form className="trip-inline-form" onSubmit={(event) => void addDay(event)}>
              <label className="trip-field">{translate('dayDate')}<input type="date" required value={dayDate} onChange={(event) => setDayDate(event.target.value)} /></label>
              <button className="trip-button" type="submit">{translate('save')}</button>
              <button className="trip-button" type="button" onClick={() => setShowDayForm(false)}>{translate('cancel')}</button>
            </form>}
            <div className="trip-day-tabs" role="tablist" aria-label={translate('days')}>
              {details.days.map((day, index) => <button
                className="trip-day-tab"
                key={day.id}
                type="button"
                role="tab"
                aria-selected={selectedDayId === day.id}
                onClick={() => setSelectedDayId(day.id)}
              >{index + 1}. {dateLabel(day.date, locale)}</button>)}
              <button className="trip-day-tab" type="button" role="tab" aria-selected={selectedDayId === null} onClick={() => setSelectedDayId(null)}>{translate('unassigned')}</button>
            </div>
            {selectedDayId && <div className="trip-actions"><button className="trip-button trip-button-danger" type="button" onClick={() => void deleteDay(selectedDayId)}>{translate('deleteDay')}</button></div>}
            {details.days.length === 0 && <p className="muted">{translate('noDays')}</p>}
          </section>

          <section className="trip-section" aria-labelledby="trip-stops-heading">
            <div className="trip-section-heading">
              <h2 id="trip-stops-heading">{translate('itinerary')}</h2>
              <button className="trip-button" type="button" onClick={() => setShowStopForm((value) => !value)}><Icon id="ui-aggiungi" />{translate('addStop')}</button>
            </div>
            {showStopForm && <form className="trip-stop-edit trip-new-stop" onSubmit={(event) => void addStop(event)}>
              <label className="trip-field">{translate('stopName')}<input required maxLength={200} value={stopName} onChange={(event) => setStopName(event.target.value)} /></label>
              <label className="trip-field">{translate('category')}<select value={stopCategory} onChange={(event) => setStopCategory(event.target.value as StopCategory)}>
                {stopCategories.map((item) => <option key={item} value={item}>{categoryLabels[item][locale]}</option>)}
              </select></label>
              <label className="trip-field">{translate('planning')}<select value={stopPlanning} onChange={(event) => setStopPlanning(event.target.value as StopPlanningState)}>
                <option value="planned">{translate('planned')}</option><option value="optional">{translate('optional')}</option>
              </select></label>
              <label className="trip-field">{translate('scheduledAt')}<input type="datetime-local" value={stopSchedule} onChange={(event) => setStopSchedule(event.target.value)} /></label>
              <label className="trip-field">{translate('durationMinutes')}<input type="number" min="0" step="5" value={stopDuration} onChange={(event) => setStopDuration(event.target.value)} /></label>
              <button className="trip-button" type="submit">{translate('save')}</button>
            </form>}
            {currentStops.length === 0 && <p className="muted">{translate('noStops')}</p>}
            <div className="trip-stop-list">
              {currentStops.map((stop) => <StopRow
                key={stop.id}
                stop={stop}
                days={details.days}
                locale={locale}
                onSave={(changes) => perform(() => repository.updateStop(stop.id, changes))}
                onToggleFavorite={(value) => perform(() => repository.updateStop(stop.id, { isFavorite: value }))}
                onToggleVisited={(value) => perform(() => repository.updateStop(stop.id, { visitedAt: value }))}
                onMove={(dayId) => perform(() => repository.moveStop(selectedTrip.id, stop.id, dayId, Number.MAX_SAFE_INTEGER))}
                onReorder={(position) => perform(() => repository.moveStop(selectedTrip.id, stop.id, stop.dayId, position))}
                onDelete={() => perform(async () => {
                  if (window.confirm(translate('confirmDeleteStop'))) await repository.deleteStop(selectedTrip.id, stop.id);
                })}
              />)}
            </div>
          </section>
          <TripLogistics details={details} locale={locale} />
        </>}
      </>}
    </section>
  </div>;
}