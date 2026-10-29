import assert from 'node:assert/strict';
process.env.DATABASE_URL = 'postgres://x';
process.env.TOKEN_SECRET = 'segredo-de-teste';
const { hashNovo, senhaConfere, hashSenha, msgSegura } = await import('../api/_lib.js');

const h = hashNovo('123456');
assert.ok(h.startsWith('scrypt$') && h !== hashNovo('123456'), 'sal diferente a cada hash');
assert.equal(senhaConfere({ id: 'a', senha_hash: h }, '123456'), true);
assert.equal(senhaConfere({ id: 'a', senha_hash: h }, '123457'), false);
assert.equal(senhaConfere({ id: 'a', senha_hash: hashSenha('a', '123456') }, '123456'), true, 'hash antigo ainda entra (e é migrado no login)');
assert.equal(senhaConfere({ id: 'a', senha_hash: hashSenha('a', '123456') }, 'errada'), false);
assert.equal(msgSegura(Object.assign(new Error('relation "x" does not exist'), { code: '42P01' })), 'Erro interno. Tente novamente em instantes.');
assert.equal(msgSegura(new Error('CPF inválido')), 'CPF inválido');
console.log('OK: scrypt com sal, migração de hash antigo e erros internos escondidos');
