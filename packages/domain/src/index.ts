export const stopCategories = [
  'departure',
  'destination',
  'waypoint',
  'lodging',
  'restaurant',
  'cafe',
  'attraction',
  'museum',
  'train',
  'flight',
  'car',
  'nature',
  'beach',
  'shopping',
] as const;

export type StopCategory = (typeof stopCategories)[number];

export const stopPlanningStates = ['planned', 'optional'] as const;
export type StopPlanningState = (typeof stopPlanningStates)[number];
export type StopLocationSource = 'manual' | 'locationiq';

export const tripMemberRoles = ['owner', 'editor', 'viewer'] as const;
export type TripMemberRole = (typeof tripMemberRoles)[number];

export type Timestamp = string;

export interface EntityMetadata {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  revision: number;
  deletedAt: Timestamp | null;
}

export interface UserAccount {
  id: string;
  email: string;
  emailVerifiedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Trip extends EntityMetadata {
  ownerId: string;
  title: string;
  description: string | null;
  startsOn: string | null;
  endsOn: string | null;
  timeZone: string | null;
}

export interface TripDay extends EntityMetadata {
  tripId: string;
  date: string;
  position: number;
}

export interface StopMarkers {
  isFavorite: boolean;
  visitedAt: Timestamp | null;
}

export interface TripStop extends EntityMetadata, StopMarkers {
  tripId: string;
  dayId: string | null;
  name: string;
  category: StopCategory;
  planningState: StopPlanningState;
  position: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduledAt: Timestamp | null;
  durationMinutes: number | null;
  locationSource: StopLocationSource | null;
  sourcePlaceId: string | null;
}

export interface TripMembership extends EntityMetadata {
  tripId: string;
  userId: string;
  role: TripMemberRole;
}

export interface TripNote extends EntityMetadata {
  tripId: string;
  dayId: string | null;
  stopId: string | null;
  title: string | null;
  body: string;
}

export interface TripList extends EntityMetadata {
  tripId: string;
  title: string;
  kind: 'checklist' | 'packing';
}

export interface TripListItem extends EntityMetadata {
  listId: string;
  label: string;
  checkedAt: Timestamp | null;
  position: number;
}

export interface TripExpense extends EntityMetadata {
  tripId: string;
  description: string;
  amountMinor: number;
  currency: string;
  spentAt: Timestamp | null;
  paidByUserId: string | null;
}

export interface TripDocument extends EntityMetadata {
  tripId: string;
  fileName: string;
  mediaType: string;
  byteSize: number;
  storageKey: string | null;
}

export function createStopMarkers(markers: Partial<StopMarkers> = {}): StopMarkers {
  return { isFavorite: false, visitedAt: null, ...markers };
}