import Type from 'typebox';

export const RegisterRequestSchema = Type.Object({
  email: Type.String({ format: 'email', maxLength: 254 }),
  password: Type.String({ minLength: 12, maxLength: 128 }),
}, { additionalProperties: false });

export type RegisterRequest = Type.Static<typeof RegisterRequestSchema>;

export const LoginRequestSchema = Type.Object({
  email: Type.String({ format: 'email', maxLength: 254 }),
  password: Type.String({ minLength: 1, maxLength: 128 }),
}, { additionalProperties: false });

export type LoginRequest = Type.Static<typeof LoginRequestSchema>;

export const EmailRequestSchema = Type.Object({
  email: Type.String({ format: 'email', maxLength: 254 }),
}, { additionalProperties: false });

export type EmailRequest = Type.Static<typeof EmailRequestSchema>;

export const PasswordResetRequestSchema = Type.Object({
  token: Type.String({ minLength: 32, maxLength: 256 }),
  password: Type.String({ minLength: 12, maxLength: 128 }),
}, { additionalProperties: false });

export type PasswordResetRequest = Type.Static<typeof PasswordResetRequestSchema>;

export const TokenRequestSchema = Type.Object({
  token: Type.String({ minLength: 32, maxLength: 256 }),
}, { additionalProperties: false });

export type TokenRequest = Type.Static<typeof TokenRequestSchema>;

export const DeleteAccountRequestSchema = Type.Object({
  password: Type.String({ minLength: 1, maxLength: 128 }),
}, { additionalProperties: false });

export type DeleteAccountRequest = Type.Static<typeof DeleteAccountRequestSchema>;

export const PlaceSearchRequestSchema = Type.Object({
  query: Type.String({ minLength: 2, maxLength: 200 }),
  locale: Type.Union([Type.Literal('it'), Type.Literal('en')]),
}, { additionalProperties: false });

export type PlaceSearchRequest = Type.Static<typeof PlaceSearchRequestSchema>;

export const PlaceCandidateSchema = Type.Object({
  id: Type.String({ minLength: 1, maxLength: 100 }),
  label: Type.String({ minLength: 1, maxLength: 200 }),
  address: Type.String({ minLength: 1, maxLength: 500 }),
  latitude: Type.Number({ minimum: -90, maximum: 90 }),
  longitude: Type.Number({ minimum: -180, maximum: 180 }),
}, { additionalProperties: false });

export type PlaceCandidate = Type.Static<typeof PlaceCandidateSchema>;

export const PlaceSearchResponseSchema = Type.Object({
  results: Type.Array(PlaceCandidateSchema, { maxItems: 5 }),
  attribution: Type.String(),
}, { additionalProperties: false });

const CoordinateSchema = Type.Tuple([
  Type.Number({ minimum: -180, maximum: 180 }),
  Type.Number({ minimum: -90, maximum: 90 }),
]);

export type Coordinate = Type.Static<typeof CoordinateSchema>;

export const RouteRequestSchema = Type.Object({
  coordinates: Type.Array(CoordinateSchema, { minItems: 2, maxItems: 25 }),
  profile: Type.Union([Type.Literal('driving'), Type.Literal('walking')]),
}, { additionalProperties: false });

export type RouteRequest = Type.Static<typeof RouteRequestSchema>;

export const RouteResponseSchema = Type.Object({
  geometry: Type.Object({
    type: Type.Literal('LineString'),
    coordinates: Type.Array(CoordinateSchema, { minItems: 2 }),
  }, { additionalProperties: false }),
  distanceMeters: Type.Number({ minimum: 0 }),
  durationSeconds: Type.Number({ minimum: 0 }),
  provider: Type.String(),
}, { additionalProperties: false });

const SyncMetadataSchema = {
  id: Type.String({ format: 'uuid' }),
  revision: Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
  deletedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
};

export const SyncTripSchema = Type.Object({
  ...SyncMetadataSchema,
  title: Type.String({ minLength: 1, maxLength: 160 }),
  description: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
  startsOn: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
  endsOn: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
  timeZone: Type.Union([Type.String({ maxLength: 100 }), Type.Null()]),
}, { additionalProperties: false });

export const SyncDaySchema = Type.Object({
  ...SyncMetadataSchema,
  tripId: Type.String({ format: 'uuid' }),
  date: Type.String({ format: 'date' }),
  position: Type.Integer({ minimum: 0, maximum: 1000 }),
}, { additionalProperties: false });

export const SyncStopSchema = Type.Object({
  ...SyncMetadataSchema,
  tripId: Type.String({ format: 'uuid' }),
  dayId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  name: Type.String({ minLength: 1, maxLength: 200 }),
  category: Type.Union([
    Type.Literal('departure'), Type.Literal('destination'), Type.Literal('waypoint'),
    Type.Literal('lodging'), Type.Literal('restaurant'), Type.Literal('cafe'),
    Type.Literal('attraction'), Type.Literal('museum'), Type.Literal('train'),
    Type.Literal('flight'), Type.Literal('car'), Type.Literal('nature'),
    Type.Literal('beach'), Type.Literal('shopping'),
  ]),
  planningState: Type.Union([Type.Literal('planned'), Type.Literal('optional')]),
  isFavorite: Type.Boolean(),
  visitedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  position: Type.Integer({ minimum: 0, maximum: 10000 }),
  address: Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
  latitude: Type.Union([Type.Number({ minimum: -90, maximum: 90 }), Type.Null()]),
  longitude: Type.Union([Type.Number({ minimum: -180, maximum: 180 }), Type.Null()]),
  scheduledAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  durationMinutes: Type.Union([Type.Integer({ minimum: 0, maximum: 100000 }), Type.Null()]),
  locationSource: Type.Union([Type.Literal('manual'), Type.Literal('locationiq'), Type.Null()]),
  sourcePlaceId: Type.Union([Type.String({ minLength: 1, maxLength: 100 }), Type.Null()]),
}, { additionalProperties: false });

export const SyncListSchema = Type.Object({
  ...SyncMetadataSchema,
  tripId: Type.String({ format: 'uuid' }),
  title: Type.String({ minLength: 1, maxLength: 160 }),
  kind: Type.Union([Type.Literal('checklist'), Type.Literal('packing')]),
}, { additionalProperties: false });

export const SyncListItemSchema = Type.Object({
  ...SyncMetadataSchema,
  listId: Type.String({ format: 'uuid' }),
  label: Type.String({ minLength: 1, maxLength: 240 }),
  checkedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  position: Type.Integer({ minimum: 0, maximum: 10000 }),
}, { additionalProperties: false });

export const SyncExpenseSchema = Type.Object({
  ...SyncMetadataSchema,
  tripId: Type.String({ format: 'uuid' }),
  description: Type.String({ minLength: 1, maxLength: 240 }),
  amountMinor: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  currency: Type.String({ pattern: '^[A-Z]{3}$' }),
  spentAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  paidByUserId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
}, { additionalProperties: false });

export const SyncTripRequestSchema = Type.Object({
  expectedVersion: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  trip: SyncTripSchema,
  days: Type.Array(SyncDaySchema, { maxItems: 366 }),
  stops: Type.Array(SyncStopSchema, { maxItems: 1000 }),
  lists: Type.Array(SyncListSchema, { maxItems: 100 }),
  listItems: Type.Array(SyncListItemSchema, { maxItems: 10000 }),
  expenses: Type.Array(SyncExpenseSchema, { maxItems: 10000 }),
}, { additionalProperties: false });

export const SyncTripResponseSchema = Type.Object({
  version: Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
  trip: SyncTripSchema,
  days: Type.Array(SyncDaySchema, { maxItems: 366 }),
  stops: Type.Array(SyncStopSchema, { maxItems: 1000 }),
  lists: Type.Array(SyncListSchema, { maxItems: 100 }),
  listItems: Type.Array(SyncListItemSchema, { maxItems: 10000 }),
  expenses: Type.Array(SyncExpenseSchema, { maxItems: 10000 }),
  syncedAt: Type.String({ format: 'date-time' }),
}, { additionalProperties: false });

export const SyncTripListSchema = Type.Array(SyncTripResponseSchema, { maxItems: 1000 });

export const SyncConflictSchema = Type.Object({
  error: Type.Literal('sync_conflict'),
  current: Type.Union([SyncTripResponseSchema, Type.Null()]),
}, { additionalProperties: false });

export type SyncTripRequest = Type.Static<typeof SyncTripRequestSchema>;
export type SyncTripResponse = Type.Static<typeof SyncTripResponseSchema>;

export const AcceptedResponseSchema = Type.Object({
  accepted: Type.Literal(true),
}, { additionalProperties: false });

export const ApiErrorSchema = Type.Object({
  error: Type.String(),
}, { additionalProperties: false });

export const CsrfTokenResponseSchema = Type.Object({
  csrfToken: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export const PublicAccountSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  emailVerifiedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
}, { additionalProperties: false });

export const AuthenticatedAccountSchema = Type.Object({
  account: PublicAccountSchema,
  expiresAt: Type.String({ format: 'date-time' }),
}, { additionalProperties: false });

export const LoginResponseSchema = AuthenticatedAccountSchema;

export const HealthResponseSchema = Type.Object({
  status: Type.Literal('ok'),
}, { additionalProperties: false });

export type HealthResponse = Type.Static<typeof HealthResponseSchema>;