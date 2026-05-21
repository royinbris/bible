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
              
              let css = "* { font-family: " + fontFamily + " !important; }";
              css += "* { background-image: none !important; }";
              css += "html, body { background-color: " + bgColor + " !important; color: " + textColor + " !important; }";
              css += "div, p, span, td, th, table, article, section, h1, h2, h3, h4, h5, h6, li, ul, ol, blockquote { background-color: transparent !important; color: " + textColor + " !important; }";
              const primaryColor = parentStyle.getPropertyValue('--primary-color').trim() || '#a31545';
              css += "a { color: " + primaryColor + " !important; }";
              css += "a * { color: inherit !important; }";
              css += "body { font-size: " + fontSize + "px !important; line-height: " + lineHeight + " !important; font-weight: " + fontWeight + " !important; padding-bottom: 84px !important; }";
              
              // 버튼 텍스트의 글자색이 전역 링크 스타일로 인해 붉어지지 않도록 흰색으로 강제
              css += " #source-link-container a { color: #ffffff !important; }";
              
              if (${isEnglish}) {
                // 상단 영역 중 #mainheading(날짜 및 축일명)은 남겨두고 나머지만 숨김
                css += " #calendar-heading, #hourlinks, #appplug, .hi.rubric, #univPageName, #innertexst > p.rubric, #innertexst > hr.shortrule:first-of-type { display: none !important; }";
                // 양 옆 테두리선 제거
                css += " #texts { border-left: none !important; border-right: none !important; }";
                // 오디오 플레이어 숨김
                css += " .audioclip { display: none !important; }";
                // 복음 본문 뒤 하단 영역 싹 다 숨김 (소셜 미디어 영역, 카피라이트 테이블 포함) 단, 버튼 컨테이너는 가리지 않도록 예외 처리
                css += " #innertexst > p:has(a[href*='/G/']), #innertexst > h2, #innertexst > h2 ~ *:not(#source-link-container), #innertexst ~ *, #texts ~ *, #overallcontainer ~ *, body > table { display: none !important; }";
                css += " #innertexst { padding-top: 0px !important; padding-left: 10px !important; padding-right: 10px !important; }";
              } else {
                // 한글 미사 모바일 메뉴 버튼 및 Nav바 숨김
                css += " .navPanelToggle, #navPanelToggle, a[href='#nav'], #nav { display: none !important; }";
                css += " #header { padding-right: 0px !important; }";
              }
              
              styleEl.innerHTML = css;
            } catch(e) {
              console.error('Failed to sync parent style:', e);
            }
          }

          function appendSourceLinkButton() {
            try {
              let buttonContainer = document.getElementById('source-link-container');
              if (buttonContainer) return;
              
              const targetContainer = document.getElementById('innertexst') || document.getElementById('missa-print') || document.body;
              if (!targetContainer) return;
              
              buttonContainer = document.createElement('div');
              buttonContainer.id = 'source-link-container';
              buttonContainer.style.width = '100%';
              buttonContainer.style.display = 'flex';
              buttonContainer.style.justifyContent = 'center';
              buttonContainer.style.alignItems = 'center';
              buttonContainer.style.marginTop = '40px';
              buttonContainer.style.marginBottom = '30px';
              buttonContainer.style.padding = '10px';
              
              const link = document.createElement('a');
              link.target = '_blank';
              
              const parentWin = window.parent;
              let primaryColor = '#a31545';
              try {
                if (parentWin) {
                  const parentDoc = parentWin.document.documentElement;
                  const parentStyle = parentWin.getComputedStyle(parentDoc);
                  primaryColor = parentStyle.getPropertyValue('--primary-color').trim() || '#a31545';
                }
              } catch(err) {}
              
              link.style.display = 'inline-block';
              link.style.padding = '12px 24px';
              link.style.fontSize = '15px';
              link.style.fontWeight = 'bold';
              link.style.textDecoration = 'none';
              link.style.borderRadius = '30px';
              link.style.backgroundColor = primaryColor;
              link.style.color = '#ffffff';
              link.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)';
              link.style.transition = 'all 0.2s ease-in-out';
              
              if (${isEnglish}) {
                link.href = 'https://universalis.com/australia.brisbane/${date}/mass.htm';
                link.innerText = 'Universalis (English) 웹사이트 열기';
              } else {
                link.href = 'https://missa.cbck.or.kr/DailyMissa/${date}';
                link.innerText = '한국 가톨릭 매일미사 웹사이트 열기';
              }
              
              link.onmouseover = function() {
                link.style.opacity = '0.9';
                link.style.transform = 'translateY(-1px)';
              };
              link.onmouseout = function() {
                link.style.opacity = '1';
                link.style.transform = 'translateY(0)';
              };
              
              buttonContainer.appendChild(link);
              targetContainer.appendChild(buttonContainer);
            } catch(e) {
              console.error('Failed to append source link button:', e);
            }
          }
 
          applyParentStyle();
          appendSourceLinkButton();
          window.addEventListener('DOMContentLoaded', function() {
            applyParentStyle();
            appendSourceLinkButton();
          });
          window.addEventListener('focus', function() {
            applyParentStyle();
            appendSourceLinkButton();
          });
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
