const crypto = require('crypto');

// Vercel 환경 변수와 봇 서버의 GAME_SECRET_KEY가 반드시 같아야 합니다.
const LINK_SECONDS = 2 * 60 * 60;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDay(nowMs) {
  return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, '');
}

function sign(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload, 'ascii').digest('hex').toUpperCase();
}

function validSignature(actual, expected) {
  if (typeof actual !== 'string' || !/^[A-Fa-f0-9]{64}$/.test(actual)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual.toUpperCase(), 'hex'), Buffer.from(expected, 'hex'));
}

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'POST 요청만 허용됩니다.' });

  const secret = process.env.GAME_SECRET_KEY;
  if (!secret || secret.length < 32) {
    return res.status(503).json({ success: false, message: '게임 보상 서버 설정이 완료되지 않았습니다.' });
  }

  const { uid, exp, sig, score, startTime } = req.body || {};
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const userId = String(uid || '');
  const expiry = Number(exp);
  if (!/^\d{17,20}$/.test(userId) || !Number.isSafeInteger(expiry) ||
      expiry < nowSec || expiry > nowSec + LINK_SECONDS ||
      !validSignature(sig, sign(secret, `link:${userId}:${expiry}`))) {
    return res.status(403).json({ success: false, message: '유효한 디스코드 DM 링크로 다시 접속해 주세요.' });
  }
  if (!Number.isSafeInteger(score) || score < 0 || score > 3000 ||
      !Number.isSafeInteger(startTime) ||
      nowMs - startTime < 25_000 || nowMs - startTime > 90_000) {
    return res.status(400).json({ success: false, message: '게임 점수 또는 플레이 시간을 확인할 수 없습니다.' });
  }

  const coins = score >= 600 ? 5 : score >= 550 ? 4 : score >= 400 ? 3 :
    score >= 300 ? 2 : score >= 200 ? 1 : 0;
  if (!coins) return res.status(200).json({ success: false, coins: 0, message: '보상 기준 점수(200점)에 도달하지 못했습니다.' });

  const day = kstDay(nowMs);
  const issued = nowSec;
  const signature = sign(secret, `reward:${userId}:${coins}:${day}:${issued}`);
  const code = `OOPS2-${userId}-${coins}-${day}-${issued}-${signature}`;
  return res.status(200).json({ success: true, code, coins });
};
