const { signToken, verifyToken } = require('./authService');

describe('authService', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signToken({ id: 'user-1', email: 'a@b.com', name: 'A' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('a@b.com');
  });

  it.todo('upsertOAuthUser creates a new user when none exists');
  it.todo('upsertOAuthUser updates fields for an existing provider+providerId');
});
