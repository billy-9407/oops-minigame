const crypto = require('crypto');

// app-1.py의 GAME_SECRET_KEY와 일치해야 합니다.
const GAME_SECRET_KEY = process.env.GAME_SECRET_KEY || "OOPS_COMMUNITY_SUPER_SECRET_KEY_2026";

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  const { uid, score, startTime } = req.body;

  if (!uid || score === undefined || !startTime) {
    return res.status(400).json({ message: '필수 데이터가 누락되었습니다.' });
  }

  const nowMs = Date.now();
  const playDurationSec = (nowMs - startTime) / 1000;

  // 치트 방지: 최소 25초 이상 플레이하지 않고 들어온 요청 거절
  if (playDurationSec < 25) {
    return res.status(400).json({ message: '비정상적인 플레이 시간이 감지되었습니다.' });
  }

  // 점수별 차등 보상 구간 설정
  let coins = 0;
  if (score >= 600) {
    coins = 5;          // 600점 이상: 5코인
  } else if (score >= 550) {
    coins = 4;          // 550-599점: 4코인
  } else if (score >= 400) {
    coins = 3;          // 400-549점: 3코인
  } else if (score >= 300) {
    coins = 2;          // 300-399점: 2코인
  } else if (score >= 200) {
    coins = 1;          // 200-299점: 1코인
  } else {
    coins = 0;          // 199점 이하: 0코인
  }

  const timestamp = Math.floor(nowMs / 1000);

  // HMAC-SHA256 암호화 서명 생성
  const payload = `${uid}:${coins}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', GAME_SECRET_KEY)
    .update(payload)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();

  const rewardCode = `OOPS-${coins}-${timestamp}-${signature}`;

  return res.status(200).json({
    success: true,
    code: rewardCode,
    coins: coins
  });
}
