
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const KV_REST_API_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(500).json({ error: 'Vercel KV 또는 Upstash 환경 변수가 활성화되지 않았습니다. Vercel Storage 대시보드에서 데이터베이스를 연동해 주세요.' });
  }

  const { action, pin } = req.query;

  // 1. PIN 코드 자동 발급 (action=generate)
  if (action === 'generate') {
    let attempts = 0;
    let newPin = '';
    while (attempts < 15) {
      newPin = Math.floor(100000 + Math.random() * 900000).toString(); // 6자리 랜덤 숫자
      const checkRes = await fetch(`${KV_REST_API_URL}/get/sync:${newPin}`, {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      });
      const checkData = await checkRes.json();
      
      if (!checkData.result) {
        // 중복되지 않는 PIN 발견 시 초기 구조로 DB에 예약 저장
        const initialData = {
          historyLogs: [],
          myVerses: [],
          readingPlan: null,
          readingPlanHistory: [],
          lastRead: null,
          updatedAt: Date.now()
        };
        await fetch(`${KV_REST_API_URL}/set/sync:${newPin}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
          body: JSON.stringify(initialData)
        });
        return res.status(200).json({ success: true, pin: newPin });
      }
      attempts++;
    }
    return res.status(500).json({ error: '고유 동기화 코드 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
  }

  // 6자리 PIN 유효성 검사
  if (!pin || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: '올바른 6자리 PIN 코드가 제공되지 않았습니다.' });
  }

  const kvKey = `sync:${pin}`;

  // 2. GET: 데이터 조회 (다른 기기에서 다운로드)
  if (req.method === 'GET') {
    const getRes = await fetch(`${KV_REST_API_URL}/get/${kvKey}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
    const getData = await getRes.json();
    if (!getData.result) {
      return res.status(404).json({ error: '등록되지 않았거나 유효하지 않은 동기화 코드입니다.' });
    }
    const resultObj = typeof getData.result === 'string' ? JSON.parse(getData.result) : getData.result;
    return res.status(200).json(resultObj);
  }

  // 3. POST: 데이터 업로드 및 동기화 (최신 타임스탬프 기준 자동 병합)
  if (req.method === 'POST') {
    const clientData = req.body;
    if (!clientData || typeof clientData !== 'object') {
      return res.status(400).json({ error: '유효하지 않은 업로드 데이터 형식입니다.' });
    }

    // 서버의 기존 데이터 읽기
    const getRes = await fetch(`${KV_REST_API_URL}/get/${kvKey}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });
    const getData = await getRes.json();
    let serverData = null;
    if (getData.result) {
      serverData = typeof getData.result === 'string' ? JSON.parse(getData.result) : getData.result;
    }

    let finalData = clientData;

    // 만약 서버 데이터가 존재하고, 서버 데이터의 갱신 시각이 클라이언트보다 최신이라면 서버 데이터 유지
    if (serverData && serverData.updatedAt > (clientData.updatedAt || 0)) {
      finalData = serverData;
    } else {
      // 클라이언트 데이터가 더 최신이라면 서버 데이터를 클라이언트 데이터로 업데이트
      finalData.updatedAt = Date.now();
      await fetch(`${KV_REST_API_URL}/set/${kvKey}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
        body: JSON.stringify(finalData)
      });
    }

    return res.status(200).json({ success: true, data: finalData });
  }

  return res.status(405).json({ error: '지원하지 않는 HTTP 메소드입니다.' });
}
