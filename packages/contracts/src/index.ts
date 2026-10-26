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