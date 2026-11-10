import { createHash, randomUUID } from 'node:crypto';
import { redis } from './redis.js';

export const digest = value => createHash('sha256').update(value).digest('hex');
const userKey = id => `scopecheck:auth:{accounts}:user:${id}`;
const emailKey = email => `scopecheck:auth:{accounts}:email:${digest(email.toLowerCase())}`;
const accountKey = ({ provider, providerAccountId }) => `scopecheck:auth:{accounts}:provider:${provider}:${digest(providerAccountId)}`;
const sessionKey = token => `scopecheck:auth:session:${digest(token)}`;
const tokenKey = ({ identifier, token }) => `scopecheck:auth:verify:${digest(JSON.stringify([identifier, token]))}`;
const parseDates = (raw, property) => {
  if (!raw) return null;
  const record = JSON.parse(raw);
  if (record[property]) record[property] = new Date(record[property]);
  return record;
};

async function getUser(id) {
  return id ? parseDates(await redis().get(userKey(id)), 'emailVerified') : null;
}

export const redisAuth = {
  async createUser({ name, email, emailVerified }) {
    const user = { id: randomUUID(), name, email: email.toLowerCase(), emailVerified };
    const created = await redis().eval(`
      if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
      redis.call('MSET', KEYS[1], ARGV[1], KEYS[2], ARGV[2])
      return 1
    `, 2, emailKey(email), userKey(user.id), user.id, JSON.stringify(user));
    if (!created) throw new Error('An account already uses this email.');
    return user;
  },
  getUser,
  async getUserByEmail(email) {
    return getUser(await redis().get(emailKey(email)));
  },
  async getUserByAccount(account) {
    return getUser(await redis().get(accountKey(account)));
  },
  async updateUser({ id, emailVerified }) {
    const user = await getUser(id);
    if (!user) throw new Error('Account unavailable.');
    const updated = { ...user, emailVerified: emailVerified ?? user.emailVerified };
    await redis().set(userKey(id), JSON.stringify(updated), 'XX');
    return updated;
  },
  async linkAccount(account) {
    const linked = await redis().set(accountKey(account), account.userId, 'NX');
    if (!linked && await redis().get(accountKey(account)) !== account.userId) {
      throw new Error('This sign-in belongs to another account.');
    }
  },
  async createSession({ sessionToken, userId, expires }) {
    await redis().set(sessionKey(sessionToken), JSON.stringify({ userId, expires }), 'PXAT', expires.getTime());
    return { sessionToken, userId, expires };
  },
  async getSessionAndUser(sessionToken) {
    const session = parseDates(await redis().get(sessionKey(sessionToken)), 'expires');
    if (!session || session.expires.getTime() <= Date.now()) return null;
    const user = await getUser(session.userId);
    return user ? { session: { ...session, sessionToken }, user } : null;
  },
  async updateSession({ sessionToken, expires }) {
    const raw = await redis().eval(`
      local raw = redis.call('GET', KEYS[1])
      if not raw then return nil end
      local session = cjson.decode(raw)
      if session.expires < ARGV[1] then
        session.expires = ARGV[1]
        raw = cjson.encode(session)
        redis.call('SET', KEYS[1], raw, 'XX', 'PXAT', ARGV[2])
      end
      return raw
    `, 1, sessionKey(sessionToken), expires.toISOString(), expires.getTime());
    const session = parseDates(raw, 'expires');
    return session ? { ...session, sessionToken } : null;
  },
  async deleteSession(sessionToken) {
    await redis().del(sessionKey(sessionToken));
  },
  async createVerificationToken(verification) {
    await redis().set(tokenKey(verification), JSON.stringify({ expires: verification.expires }), 'PXAT', verification.expires.getTime());
    return verification;
  },
  async useVerificationToken(verification) {
    const record = parseDates(await redis().getdel(tokenKey(verification)), 'expires');
    return record ? { ...verification, ...record } : null;
  },
};
