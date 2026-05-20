export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const { type, date } = req.query; // type = 'ko' | 'en', date = YYYYMMDD
  if (!date || !/^\d{8}$/.test(date)) {
    return res.status(400).send('Invalid date format. Expected YYYYMMDD.');
  }

  const isEnglish = type === 'en';
  const url = isEnglish
    ? `https://universalis.com/australia.brisbane/${date}/mass.htm`
    : `https://missa.cbck.or.kr/DailyMissa/${date}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch daily mass page: ${response.status}`);
    }
    const html = await response.text();

    const origin = isEnglish ? 'https://universalis.com' : 'https://missa.cbck.or.kr';

    // Rewrite relative URLs to absolute ones
    let cleanHtml = html
      .replace(/(href|src)="(?!https?:\/\/)\/?([^"]+)"/g, `$1="${origin}/$2"`)
      .replace(/(href|src)='(?!https?:\/\/)\/?([^']+)'/g, `$1='${origin}/$2'`);

    // Prepend a <base> tag to head to ensure any unhandled relative resources load correctly
    cleanHtml = cleanHtml.replace('<head>', `<head><base href="${origin}/">`);

    // Scroll script and style injection that monitors scroll direction
    const scriptToInject = `
      <style>
        body { padding-bottom: 84px !important; }
      </style>
      <script>
        (function() {
          let lastScrollTop = 0;
          const threshold = 12; // debounce sensitivity
          window.addEventListener('scroll', function() {
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            // 최상단 근처인 경우(또는 고무줄 바운스로 튕겨 올라갈 때) 무조건 하단바를 표시하도록 'up' 전송
            if (scrollTop <= 10) {
              window.parent.postMessage({ type: 'iframeScroll', direction: 'up' }, '*');
              lastScrollTop = scrollTop;
              return;
            }

            let diff = scrollTop - lastScrollTop;
            if (Math.abs(diff) > threshold) {
              let direction = diff > 0 ? 'down' : 'up';
              window.parent.postMessage({ type: 'iframeScroll', direction: direction }, '*');
              lastScrollTop = scrollTop;
            }
          }, { passive: true });
        })();
      </script>
    `;

    // Inject the script before </body>
    cleanHtml = cleanHtml.replace('</body>', `${scriptToInject}</body>`);

    return res.status(200).send(cleanHtml);
  } catch (error) {
    console.error('Error proxying mass HTML:', error);
    return res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 20px; text-align: center; color: #666; background-color: #f5f5f5;">
          <h3>미사 정보를 불러올 수 없습니다.</h3>
          <p>네트워크 상태를 확인한 후 다시 시도해 주세요.</p>
        </body>
      </html>
    `);
  }
}
