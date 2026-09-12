/* =============================================================================
 *  api/_access.js — who is asking: a seat, a teacher, a cohort link, or nobody
 * =============================================================================
 *  One answer for every endpoint that builds or owns, so `build.js`, `app.js`
 *  and `teacher.js` cannot hold three ideas of who a request is.
 *
 *    { kind: 'seat',    owner: 'seat:<id>',    cohort: 'class:<id>', seat, klass }
 *    { kind: 'teacher', owner: 'teacher:<id>', cohort: 'teacher:<id>', teacher }
 *    { kind: 'key',     owner: null,           cohort: '<label>' }
 *    null
 *
 *  A SEAT WINS OVER A TEACHER when a browser carries both. The teacher who
 *  opens a student's code to see what the student sees is asking to BE that
 *  student on /build; the dashboard sends the teacher code alone.
 *
 *  Both codes are bearer secrets in headers, never in a query string, for the
 *  reason `_keys.js` gives. A seat code is 8 characters from 31, about 8e11: a
 *  class of 40 is one hit in 2e10 guesses, which is why there is no guess
 *  counter. A teacher code is 32 random bytes.
 * ========================================================================== */
'use strict';

const crypto = require('crypto');
const keys = require('./_keys.js');
const log  = require('./_log.js');

const SEAT_HEADER    = 'x-seat-code';
const TEACHER_HEADER = 'x-teacher-code';
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';   // no 0 o 1 i l: read off paper

const mintId = () => crypto.randomBytes(8).toString('base64url');
const hash   = s => crypto.createHash('sha256').update(String(s)).digest('hex');

function mintSeatCode() {
  const b = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length] + (i === 3 ? '-' : '');
  return s;
}
const mintTeacherCode = () => crypto.randomBytes(32).toString('base64url');

/* Forgiving about what a student types: case, spaces, a missing hyphen. */
function normSeat(code) {
  const c = String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : null;
}

function header(req, name) {
  const h = (req && req.headers && req.headers[name]) || '';
  return String(Array.isArray(h) ? h[0] : h).trim();
}

async function seatByCode(code) {
  const c = normSeat(code);
  if (!c || !log.enabled()) return null;
  const [row] = await log.sql()`
    SELECT s.id, s.label, s.revoked_at, c.id AS class_id, c.name AS class_name, c.teacher_id
    FROM seats s JOIN classes c ON c.id = s.class_id WHERE s.code = ${c}`;
  return row || null;
}

async function teacherByCode(code) {
  if (!code || !log.enabled()) return null;
  const [row] = await log.sql()`SELECT id, name FROM teachers WHERE code_hash = ${hash(code)}`;
  return row || null;
}

/* `revoked` is reported rather than folded into null, so /build can say the
   code was turned off instead of calling it wrong. */
async function resolve(req, { seatFirst = true } = {}) {
  const seatCode = header(req, SEAT_HEADER), teacherCode = header(req, TEACHER_HEADER);
  const asSeat = async () => {
    if (!seatCode) return null;
    const s = await seatByCode(seatCode);
    if (!s) return { kind: 'invalid' };
    if (s.revoked_at) return { kind: 'revoked' };
    return { kind: 'seat', owner: 'seat:' + s.id, cohort: 'class:' + s.class_id,
             seat: { id: s.id, label: s.label }, klass: { id: s.class_id, name: s.class_name, teacherId: s.teacher_id } };
  };
  const asTeacher = async () => {
    if (!teacherCode) return null;
    const t = await teacherByCode(teacherCode);
    return t ? { kind: 'teacher', owner: 'teacher:' + t.id, cohort: 'teacher:' + t.id, teacher: t }
             : { kind: 'invalid' };
  };
  const order = seatFirst ? [asSeat, asTeacher] : [asTeacher];
  let refused = null;
  for (const f of order) {
    const r = await f();
    if (!r) continue;
    if (r.kind === 'seat' || r.kind === 'teacher') return r;
    refused = refused || r;
  }
  const label = keys.cohort(req);
  if (label) return { kind: 'key', owner: null, cohort: label };
  return refused;
}

const admitted = who => !!who && (who.kind === 'seat' || who.kind === 'teacher' || who.kind === 'key');

/* The 401 body for a request that is not admitted, worded for what it sent. */
function refusal(who) {
  if (who && who.kind === 'revoked') return { error: 'This class code has been turned off. Ask your teacher for a new one.', code: 'revoked' };
  if (who && who.kind === 'invalid') return { error: 'That code is not right. Check it against your card.', code: 'invalid' };
  return { error: 'the builder is open to invited testers; ask for an access link' };
}

/* What a page may show about who it is. */
function describe(who) {
  if (!admitted(who)) return null;
  if (who.kind === 'seat') return { kind: 'seat', label: who.seat.label, className: who.klass.name };
  if (who.kind === 'teacher') return { kind: 'teacher', name: who.teacher.name };
  return { kind: 'key', cohort: who.cohort };
}

module.exports = { resolve, admitted, refusal, describe, mintId, mintSeatCode, mintTeacherCode, hash, normSeat,
                   SEAT_HEADER, TEACHER_HEADER };
