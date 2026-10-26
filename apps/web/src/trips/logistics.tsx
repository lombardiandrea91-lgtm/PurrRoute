import { useEffect, useState } from 'react';
import type { TripList } from '@purrroute/domain';
import type { Locale } from '../preferences.ts';
import { messages } from '../messages.ts';
import type { MessageKey } from '../messages.ts';
import { LocalTripRepository, TripValidationError } from './repository.ts';
import type { TripDetails } from './repository.ts';

const repository = new LocalTripRepository();

function expenseDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch { return 2; }
}

function formatExpense(amountMinor: number, currency: string, locale: Locale): string {
  const digits = expenseDigits(currency);
  return new Intl.NumberFormat(locale, { style: 'currency', currency })
    .format(amountMinor / (10 ** digits));
}

function logisticsError(error: unknown, locale: Locale): string {
  if (error instanceof TripValidationError) {
    const keys: Record<TripValidationError['code'], MessageKey> = {
      title_required: 'titleRequired', invalid_date_range: 'invalidDate', invalid_date: 'invalidDate',
      duplicate_day: 'duplicateDay', invalid_trip: 'invalidTrip', invalid_day: 'invalidDay',
      invalid_stop: 'invalidStop', invalid_list: 'invalidList', invalid_list_item: 'invalidListItem',
      invalid_expense: 'invalidExpense',
    };
    return messages[locale][keys[error.code]];
  }
  return messages[locale].tripSaveError;
}

function LogisticsList({
  list,
  items,
  locale,
  onRename,
  onDelete,
  onAddItem,
  onToggleItem,
  onDeleteItem,
}: {
  list: TripList;
  items: TripDetails['listItems'];
  locale: Locale;
  onRename(title: string): Promise<void>;
  onDelete(): Promise<void>;
  onAddItem(label: string): Promise<void>;
  onToggleItem(id: string, checkedAt: string | null): Promise<void>;
  onDeleteItem(id: string): Promise<void>;
}) {
  const translate = (key: MessageKey) => messages[locale][key];
  const [title, setTitle] = useState(list.title);
  const [label, setLabel] = useState('');
  const [failure, setFailure] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  useEffect(() => setTitle(list.title), [list.id, list.title]);

  const rename = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFailure('');
    try { await onRename(title); }
    catch (error) { setFailure(logisticsError(error, locale)); }
  };
  const add = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFailure(''); setSavingItem(true);
    try { await onAddItem(label); setLabel(''); }
    catch (error) { setFailure(logisticsError(error, locale)); }
    finally { setSavingItem(false); }
  };

  return <article className="logistics-list">
    <form className="logistics-list-heading" onSubmit={(event) => void rename(event)}>
      <label>{translate('logisticsListTitle')}
        <input value={title} maxLength={160} required onChange={(event) => setTitle(event.target.value)} />
      </label>
      <span>{translate(list.kind === 'packing' ? 'logisticsPacking' : 'logisticsChecklist')}</span>
      <button className="trip-button" type="submit">{translate('save')}</button>
      <button className="trip-button trip-button-danger" type="button" onClick={() => void onDelete()}>{translate('logisticsDeleteList')}</button>
    </form>
    <ul className="logistics-items">
      {items.map((item) => <li key={item.id}>
        <label><input type="checkbox" checked={item.checkedAt !== null}
          onChange={(event) => void onToggleItem(item.id, event.target.checked ? new Date().toISOString() : null)} />
          <span className={item.checkedAt ? 'is-checked' : ''}>{item.label}</span>
        </label>
        <button className="logistics-remove" type="button" aria-label={`${translate('logisticsDeleteItem')}: ${item.label}`}
          onClick={() => void onDeleteItem(item.id)}>{translate('logisticsDeleteItem')}</button>
      </li>)}
    </ul>
    <form className="logistics-add-item" onSubmit={(event) => void add(event)}>
      <label>{translate('logisticsItem')}<input required maxLength={240} disabled={savingItem} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <button className="trip-button" type="submit" disabled={savingItem}>{translate('logisticsAddItem')}</button>
    </form>
    {failure && <p className="trip-error" role="alert">{failure}</p>}
  </article>;
}

export function TripLogistics({ details, locale }: { details: TripDetails; locale: Locale }) {
  const translate = (key: MessageKey) => messages[locale][key];
  const [listTitle, setListTitle] = useState('');
  const [listKind, setListKind] = useState<TripList['kind']>('checklist');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [spentOn, setSpentOn] = useState('');
  const [failure, setFailure] = useState('');
  const [savingList, setSavingList] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);

  const perform = async (action: () => Promise<unknown>) => {
    setFailure('');
    try { await action(); }
    catch (error) { setFailure(logisticsError(error, locale)); }
  };

  const createList = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingList(true);
    try {
      await perform(async () => {
        await repository.createTripList(details.trip.id, { title: listTitle, kind: listKind });
        setListTitle('');
      });
    } finally { setSavingList(false); }
  };

  const createExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingExpense(true);
    try {
      await perform(async () => {
        const normalizedCurrency = currency.trim().toUpperCase();
        const digits = expenseDigits(normalizedCurrency);
        const value = Number(amount);
        if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / (10 ** digits)) {
          throw new TripValidationError('invalid_expense');
        }
        await repository.createTripExpense(details.trip.id, {
          description, amountMinor: Math.round(value * (10 ** digits)), currency: normalizedCurrency,
          spentAt: spentOn ? new Date(`${spentOn}T12:00:00.000Z`).toISOString() : null,
        });
        setDescription(''); setAmount(''); setSpentOn('');
      });
    } finally { setSavingExpense(false); }
  };

  const subtotals = new Map<string, number>();
  for (const expense of details.expenses) {
    subtotals.set(expense.currency, (subtotals.get(expense.currency) ?? 0) + expense.amountMinor);
  }

  return <section className="trip-section logistics-section" aria-labelledby="trip-logistics-heading">
    <div className="trip-section-heading"><h2 id="trip-logistics-heading">{translate('logistics')}</h2></div>
    <div className="logistics-columns">
      <section aria-labelledby="logistics-lists-heading">
        <h3 id="logistics-lists-heading">{translate('logisticsLists')}</h3>
        <form className="logistics-create-list" onSubmit={(event) => void createList(event)}>
          <label>{translate('logisticsListTitle')}<input required maxLength={160} disabled={savingList} value={listTitle} onChange={(event) => setListTitle(event.target.value)} /></label>
          <label>{translate('logisticsListType')}<select disabled={savingList} value={listKind} onChange={(event) => setListKind(event.target.value as TripList['kind'])}>
            <option value="checklist">{translate('logisticsChecklist')}</option>
            <option value="packing">{translate('logisticsPacking')}</option>
          </select></label>
          <button className="trip-button" type="submit" disabled={savingList}>{translate('logisticsCreateList')}</button>
        </form>
        <div className="logistics-list-stack">
          {details.lists.map((list) => <LogisticsList
            key={list.id}
            list={list}
            items={details.listItems.filter((item) => item.listId === list.id)}
            locale={locale}
            onRename={(title) => repository.updateTripList(list.id, title).then(() => undefined)}
            onDelete={() => {
              if (window.confirm(translate('confirmDeleteLogisticsList'))) return repository.deleteTripList(list.id);
              return Promise.resolve();
            }}
            onAddItem={(label) => repository.createTripListItem(list.id, label).then(() => undefined)}
            onToggleItem={(id, checkedAt) => repository.updateTripListItem(id, { checkedAt }).then(() => undefined)}
            onDeleteItem={(id) => repository.deleteTripListItem(id)}
          />)}
        </div>
      </section>
      <section aria-labelledby="logistics-expenses-heading">
        <h3 id="logistics-expenses-heading">{translate('logisticsExpenses')}</h3>
        <form className="logistics-expense-form" onSubmit={(event) => void createExpense(event)}>
          <label>{translate('logisticsExpenseDescription')}<input required maxLength={240} disabled={savingExpense} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className="logistics-money-fields">
            <label>{translate('logisticsAmount')}<input type="number" min="0" step={String(1 / (10 ** expenseDigits(currency)))} required disabled={savingExpense} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            <label>{translate('logisticsCurrency')}<input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" disabled={savingExpense} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
          </div>
          <label>{translate('logisticsSpentOn')}<input type="date" disabled={savingExpense} value={spentOn} onChange={(event) => setSpentOn(event.target.value)} /></label>
          <button className="trip-button" type="submit" disabled={savingExpense}>{translate('logisticsAddExpense')}</button>
        </form>
        {subtotals.size > 0 && <div className="logistics-subtotals" aria-label={translate('logisticsSubtotals')}>
          {[...subtotals].map(([code, total]) => <span key={code}>{formatExpense(total, code, locale)}</span>)}
        </div>}
        <ul className="logistics-expense-list">
          {details.expenses.map((expense) => <li key={expense.id}>
            <span><strong>{expense.description}</strong><small>{expense.spentAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(expense.spentAt)) : ''}</small></span>
            <strong>{formatExpense(expense.amountMinor, expense.currency, locale)}</strong>
            <button className="logistics-remove" type="button" aria-label={`${translate('logisticsDeleteExpense')}: ${expense.description}`}
              onClick={() => {
                if (window.confirm(translate('confirmDeleteExpense'))) void perform(() => repository.deleteTripExpense(expense.id));
              }}>{translate('logisticsDeleteExpense')}</button>
          </li>)}
        </ul>
      </section>
    </div>
    {failure && <p className="trip-error" role="alert">{failure}</p>}
  </section>;
}