import assert from 'node:assert/strict';
import test from 'node:test';
import { Value } from 'typebox/value';
import {
  EmailRequestSchema,
  LoginRequestSchema,
  PasswordResetRequestSchema,
  RegisterRequestSchema,
} from '../packages/contracts/src/index.ts';

test('registrazione richiede email, password robusta e nessun campo extra', () => {
  assert.equal(Value.Check(RegisterRequestSchema, {
    email: 'gatto@example.test',
    password: 'correct-horse-battery',
  }), true);
  assert.equal(Value.Check(RegisterRequestSchema, {
    email: 'gatto@example.test',
    password: 'short',
  }), false);
  assert.equal(Value.Check(RegisterRequestSchema, {
    email: 'gatto@example.test',
    password: 'correct-horse-battery',
    role: 'owner',
  }), false);
});

test('login, richieste email e reset hanno contratti distinti', () => {
  assert.equal(Value.Check(LoginRequestSchema, { email: 'gatto@example.test', password: 'x' }), true);
  assert.equal(Value.Check(EmailRequestSchema, { email: 'gatto@example.test' }), true);
  assert.equal(Value.Check(PasswordResetRequestSchema, {
    token: 'a'.repeat(32),
    password: 'correct-horse-battery',
  }), true);
  assert.equal(Value.Check(PasswordResetRequestSchema, {
    token: 'short',
    password: 'correct-horse-battery',
  }), false);
});