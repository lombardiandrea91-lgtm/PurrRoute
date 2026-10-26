export const messages = {
  it: {
    trips: 'Viaggi', map: 'Mappa', offline: 'Offline', settings: 'Impostazioni',
    navigation: 'Navigazione principale', skip: 'Vai al contenuto', device: 'Questo dispositivo',
    noTrips: 'Nessun viaggio', noSelected: 'Nessun viaggio selezionato', itinerary: 'Itinerario',
    mapUnavailable: 'Mappa non disponibile', network: 'Rete disponibile', noNetwork: 'Senza connessione',
    language: 'Lingua', theme: 'Tema', system: 'Sistema', light: 'Chiaro', dark: 'Scuro',
    cat: 'Il tuo gatto', rosso: 'Gatto rosso', cipria: 'Gatta cipria',
    ready: 'Shell disponibile offline', preparing: 'Preparazione offline', failed: 'Offline non disponibile',
    noDownloads: 'Nessuna mappa scaricata', local: 'Archivio locale', empty: 'Nessun viaggio salvato',
    update: 'Aggiornamento disponibile', refresh: 'Aggiorna', install: 'Installa purrRoute',
    notFound: 'Pagina non trovata', back: 'Torna ai viaggi', saveError: 'Preferenze non salvate sul dispositivo',
  },
  en: {
    trips: 'Trips', map: 'Map', offline: 'Offline', settings: 'Settings',
    navigation: 'Main navigation', skip: 'Skip to content', device: 'This device',
    noTrips: 'No trips', noSelected: 'No trip selected', itinerary: 'Itinerary',
    mapUnavailable: 'Map unavailable', network: 'Network available', noNetwork: 'No connection',
    language: 'Language', theme: 'Theme', system: 'System', light: 'Light', dark: 'Dark',
    cat: 'Your cat', rosso: 'Gatto rosso', cipria: 'Gatta cipria',
    ready: 'App shell available offline', preparing: 'Preparing offline access', failed: 'Offline unavailable',
    noDownloads: 'No downloaded maps', local: 'Local archive', empty: 'No saved trips',
    update: 'Update available', refresh: 'Update', install: 'Install purrRoute',
    notFound: 'Page not found', back: 'Back to trips', saveError: 'Preferences could not be saved on this device',
  },
} as const;

export type MessageKey = keyof typeof messages.it;
const sameKeys: Record<MessageKey, string> = messages.en;
void sameKeys;