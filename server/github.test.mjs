import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { githubConfigured, verifyWebhookSignature } from './github.mjs';

test('accepts a valid GitHub webhook signature', () => {
  const payload = '{"action":"opened"}';
  const secret = 'test-secret';
  const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  assert.equal(verifyWebhookSignature(payload, signature, secret), true);
});

test('rejects invalid or missing webhook signatures', () => {
  assert.equal(verifyWebhookSignature('payload', 'sha256=invalid', 'test-secret'), false);
  assert.equal(verifyWebhookSignature('payload', undefined, 'test-secret'), false);
  assert.equal(verifyWebhookSignature('payload', 'sha256=anything', undefined), false);
});

test('does not claim GitHub is configured without all credentials', () => {
  assert.equal(githubConfigured(), false);
});
