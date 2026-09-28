import { openDatabase } from '../server/database.mjs';
import { bindLegacyAccount, createAccount, rotateAccount } from '../server/invites.mjs';

const [command, value] = process.argv.slice(2);
if (!((command === 'create' && !value) || (command === 'bind' && value) || (command === 'rotate' && value)) || process.argv.length > (command === 'create' ? 3 : 4)) {
  console.error('用法：npm run invite -- create | bind <旧邮箱> | rotate <账号ID>');
  process.exitCode = 1;
} else {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('请先配置至少 32 字符的 AUTH_SECRET');
  const db = openDatabase(process.env.DB_PATH ?? './data/life.sqlite', { authSecret: secret });
  try {
    const result = command === 'create' ? createAccount(db, secret)
      : command === 'bind' ? bindLegacyAccount(db, value, secret)
        : rotateAccount(db, value, secret);
    // The full code is returned once to the administrator and is never stored in plaintext.
    process.stdout.write(`${JSON.stringify({ accountId: result.accountId, inviteCode: result.code })}\n`);
  } finally { db.close(); }
}
