export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const { date } = req.query; // Expecting YYYYMMDD
  if (!date || !/^\d{8}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'Invalid date format. Expected YYYYMMDD.' });
  }

  try {
    const url = `https://missa.cbck.or.kr/DailyMissa/${date}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch daily mass page: ${response.status}`);
    }
    const html = await response.text();

    const readings = [];
    const sections = html.split('class="bottompadding-sm"');
    
    // Book metadata mapping for ID and short name resolving
    const bookMetadata = {
      "창세": { id: 1, full: "창세기" },
      "탈출": { id: 2, full: "탈출기" },
      "레위": { id: 3, full: "레위기" },
      "민수": { id: 4, full: "민수기" },
      "신명": { id: 5, full: "신명기" },
      "여호": { id: 6, full: "여호수아기" },
      "판관": { id: 7, full: "판관기" },
      "룻": { id: 8, full: "룻기" },
      "1사무": { id: 9, full: "사무엘기상권" },
      "2사무": { id: 10, full: "사무엘기하권" },
      "1열왕": { id: 11, full: "열왕기상권" },
      "2열왕": { id: 12, full: "열왕기하권" },
      "1역대": { id: 13, full: "역대기상권" },
      "2역대": { id: 14, full: "역대기하권" },
      "에즈": { id: 15, full: "에즈라기" },
      "느헤": { id: 16, full: "느헤미야기" },
      "토빗": { id: 17, full: "토빗기" },
      "유딧": { id: 18, full: "유딧기" },
      "에스": { id: 19, full: "에스텔기" },
      "1마카": { id: 20, full: "마카베오기상권" },
      "2마카": { id: 21, full: "마카베오기하권" },
      "욥": { id: 22, full: "욥기" },
      "시편": { id: 23, full: "시편" },
      "잠언": { id: 24, full: "잠언" },
      "코헬": { id: 25, full: "코헬렛" },
      "아가": { id: 26, full: "아가" },
      "지혜": { id: 27, full: "지혜서" },
      "집회": { id: 28, full: "집회서" },
      "이사": { id: 29, full: "이사야서" },
      "예레": { id: 30, full: "예레미야서" },
      "애가": { id: 31, full: "애가" },
      "바룩": { id: 32, full: "바룩서" },
      "에제": { id: 33, full: "에제키엘서" },
      "다니": { id: 34, full: "다니엘서" },
      "호세": { id: 35, full: "호세아서" },
      "요엘": { id: 36, full: "요엘서" },
      "아모스": { id: 37, full: "아모스서" },
      "오바": { id: 38, full: "오바드야서" },
      "요나": { id: 39, full: "요나서" },
      "미카": { id: 40, full: "미카서" },
      "나훔": { id: 41, full: "나훔서" },
      "하박": { id: 42, full: "하바쿡서" },
      "스바": { id: 43, full: "스바니야서" },
      "학개": { id: 44, full: "학가이서" },
      "스가": { id: 45, full: "즈카르야서" },
      "말라": { id: 46, full: "말라키서" },
      "마태": { id: 47, full: "마태오복음서" },
      "마르": { id: 48, full: "마르코복음서" },
      "루카": { id: 49, full: "루카복음서" },
      "요한": { id: 50, full: "요한복음서" },
      "사도": { id: 51, full: "사도행전" },
      "로마": { id: 52, full: "로마신자들에게보낸서간" },
      "1코린": { id: 53, full: "코린토신자들에게보낸첫째서간" },
      "2코린": { id: 54, full: "코린토신자들에게보낸둘째서간" },
      "갈라": { id: 55, full: "갈라티아신자들에게보낸서간" },
      "에페": { id: 56, full: "에페소신자들에게보낸서간" },
      "필리": { id: 57, full: "필리피신자들에게보낸서간" },
      "콜로": { id: 58, full: "콜로새신자들에게보낸서간" },
      "1테살": { id: 59, full: "테살로니카신자들에게보낸첫째서간" },
      "2테살": { id: 60, full: "테살로니카신자들에게보낸둘째서간" },
      "1티모": { id: 61, full: "티모테오에게보낸첫째서간" },
      "2티모": { id: 62, full: "티모테오에게보낸둘째서간" },
      "티토": { id: 63, full: "티토에게보낸서간" },
      "필레": { id: 64, full: "필레몬에게보낸서간" },
      "히브": { id: 65, full: "히브리인들에게보낸서간" },
      "야고": { id: 66, full: "야고보서간" },
      "1베드": { id: 67, full: "베드로첫째서간" },
      "2베드": { id: 68, full: "베드로둘째서간" },
      "1요한": { id: 69, full: "요한첫째서간" },
      "2요한": { id: 70, full: "요한둘째서간" },
      "3요한": { id: 71, full: "요한셋째서간" },
      "유다": { id: 72, full: "유다서간" },
      "묵시": { id: 73, full: "요한묵시록" }
    };

    function getBookInfo(bookRaw, type) {
      const clean = bookRaw.replace(/\s+/g, '');
      
      if (clean.includes("사도행전")) return { id: 51, abbrev: "사도" };
      
      if (clean.includes("요한")) {
        if (type === "복음") return { id: 50, abbrev: "요한" };
        if (clean.includes("첫째") || clean.includes("1")) return { id: 69, abbrev: "1요한" };
        if (clean.includes("둘째") || clean.includes("2")) return { id: 70, abbrev: "2요한" };
        if (clean.includes("셋째") || clean.includes("3")) return { id: 71, abbrev: "3요한" };
      }
      
      if (clean.includes("베드로")) {
        if (clean.includes("첫째") || clean.includes("1")) return { id: 67, abbrev: "1베드" };
        if (clean.includes("둘째") || clean.includes("2")) return { id: 68, abbrev: "2베드" };
      }
      if (clean.includes("코린토")) {
        if (clean.includes("첫째") || clean.includes("1")) return { id: 53, abbrev: "1코린" };
        if (clean.includes("둘째") || clean.includes("2")) return { id: 54, abbrev: "2코린" };
      }
      if (clean.includes("테살로니카")) {
        if (clean.includes("첫째") || clean.includes("1")) return { id: 59, abbrev: "1테살" };
        if (clean.includes("둘째") || clean.includes("2")) return { id: 60, abbrev: "2테살" };
      }
      if (clean.includes("티모테오")) {
        if (clean.includes("첫째") || clean.includes("1")) return { id: 61, abbrev: "1티모" };
        if (clean.includes("둘째") || clean.includes("2")) return { id: 62, abbrev: "2티모" };
      }
      if (clean.includes("마카베오")) {
        if (clean.includes("첫째") || clean.includes("1")) return { id: 20, abbrev: "1마카" };
        if (clean.includes("둘째") || clean.includes("2")) return { id: 21, abbrev: "2마카" };
      }
      if (clean.includes("사무엘")) {
        if (clean.includes("상권") || clean.includes("1")) return { id: 9, abbrev: "1사무" };
        if (clean.includes("하권") || clean.includes("2")) return { id: 10, abbrev: "2사무" };
      }
      if (clean.includes("열왕기")) {
        if (clean.includes("상권") || clean.includes("1")) return { id: 11, abbrev: "1열왕" };
        if (clean.includes("하권") || clean.includes("2")) return { id: 12, abbrev: "2열왕" };
      }
      if (clean.includes("역대기")) {
        if (clean.includes("상권") || clean.includes("1")) return { id: 13, abbrev: "1역대" };
        if (clean.includes("하권") || clean.includes("2")) return { id: 14, abbrev: "2역대" };
      }

      for (const abbrev in bookMetadata) {
        const meta = bookMetadata[abbrev];
        if (clean.includes(meta.full) || clean.includes(abbrev)) {
          return { id: meta.id, abbrev: abbrev };
        }
      }
      return null;
    }

    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const h4Match = section.match(/<h4>(.*?)<\/h4>/);
      if (!h4Match) continue;
      const type = h4Match[1].trim();
      
      if (type === '제1독서' || type === '제2독서' || type === '복음') {
        const rangeMatch = section.match(/<h5[^>]*>\s*<span>(.*?)<\/span>\s*<\/h5>/);
        if (!rangeMatch) continue;
        const range = rangeMatch[1].trim(); 
        
        let bookRaw = '';
        const docMatch = section.match(/(▥|✠|▥|✠)\s*([^<]+?)(의 말씀입니다|이 전한 거룩한 복음입니다)/);
        if (docMatch) {
          bookRaw = docMatch[2].trim();
        }
        
        if (bookRaw) {
          const bookInfo = getBookInfo(bookRaw, type);
          if (bookInfo) {
            const rangeParts = range.split(',');
            const chapter = parseInt(rangeParts[0], 10);
            const versePart = rangeParts[1] || '1';
            const verseMatch = versePart.match(/^\d+/);
            const verse = verseMatch ? parseInt(verseMatch[0], 10) : 1;

            let displayType = '독서1';
            if (type === '제2독서') displayType = '독서2';
            if (type === '복음') displayType = '복음';

            readings.push({
              type: displayType,
              bookName: bookInfo.abbrev,
              bookId: bookInfo.id,
              chapter,
              verse,
              range,
              label: `${displayType} ${bookInfo.abbrev} ${range}`
            });
          }
        }
      }
    }

    return res.status(200).json({ success: true, date, readings });
  } catch (error) {
    console.error('Error fetching mass readings:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
