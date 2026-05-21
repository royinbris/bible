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

    // Prepend a <base> tag to head and inject Google web fonts to support custom fonts
    const fontLinks = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&family=Noto+Sans+KR:wght@100;300;400;500;700;900&family=Noto+Serif+KR:wght@200;300;400;500;600;700;900&family=IBM+Plex+Sans+KR:wght@200;300;400;500;600;700&display=swap" rel="stylesheet">
    `;
    cleanHtml = cleanHtml.replace('<head>', `<head><base href="${origin}/">${fontLinks}`);

    // Scroll script and style injection that monitors scroll direction and syncs parent fonts/theme
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

          // 부모 앱의 폰트 및 테마 스타일 연동
          function applyParentStyle() {
            try {
              const parentWin = window.parent;
              if (!parentWin) return;
              
              const parentDoc = parentWin.document.documentElement;
              const parentStyle = parentWin.getComputedStyle(parentDoc);
              
              const bgColor = parentStyle.getPropertyValue('--bg-color').trim() || '#ffffff';
              const textColor = parentStyle.getPropertyValue('--text-color').trim() || '#1e293b';
              
              const settingsStr = parentWin.localStorage.getItem('user_settings');
              const settings = settingsStr ? JSON.parse(settingsStr) : {};
              
              let styleEl = document.getElementById('custom-theme-style');
              if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'custom-theme-style';
                document.head.appendChild(styleEl);
              }
              
              let fontFamily = 'inherit';
              if (settings.fontFamily && settings.fontFamily !== 'System Default') {
                fontFamily = settings.fontFamily;
              }
              
              const fontSize = settings.fontSize || 18;
              const lineHeight = settings.lineHeight || 1.7;
              const fontWeight = settings.fontWeight || 400;
              
              let css = "html, body { background-color: " + bgColor + " !important; color: " + textColor + " !important; }";
              css += "body, div, p, span, td, tr, table, th, h1, h2, h3, h4, h5, section, article, ul, ol, li { background-color: transparent !important; color: " + textColor + " !important; }";
              css += "* { font-family: " + fontFamily + " !important; }";
              css += "body { font-size: " + fontSize + "px !important; line-height: " + lineHeight + " !important; font-weight: " + fontWeight + " !important; padding-bottom: 84px !important; }";
              css += "a, a * { color: #3b82f6 !important; }";
              css += ".liturgical-red, [color='red'], [color='#ff0000'] { color: #ef4444 !important; }";
              
              styleEl.innerHTML = css;
            } catch(e) {
              console.error('Failed to sync parent style:', e);
            }
          }

          applyParentStyle();
          window.addEventListener('DOMContentLoaded', applyParentStyle);
          window.addEventListener('focus', applyParentStyle);
        })();
      </script>
    `;

    // Inject the script before </body> (case-insensitive for safety)
    cleanHtml = cleanHtml.replace(/<\/body>/i, `${scriptToInject}</body>`);

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
