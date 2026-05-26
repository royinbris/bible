export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const { date, type = 'ko' } = req.query; // Expecting YYYYMMDD, type = 'ko' | 'en'
  if (!date || !/^\d{8}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'Invalid date format. Expected YYYYMMDD.' });
  }

  // English Catholic Bible Book Mapping for Universalis
  const englishBookMap = {
    "gen": 1, "genesis": 1,
    "ex": 2, "exodus": 2,
    "lev": 3, "leviticus": 3,
    "num": 4, "numbers": 4,
    "deut": 5, "deuteronomy": 5,
    "josh": 6, "joshua": 6,
    "judg": 7, "judges": 7,
    "ruth": 8,
    "1sam": 9, "1samuel": 9,
    "2sam": 10, "2samuel": 10,
    "1kings": 11,
    "2kings": 12,
    "1chron": 13, "1chronicles": 13,
    "2chron": 14, "2chronicles": 14,
    "ezra": 15,
    "neh": 16, "nehemiah": 16,
    "tob": 17, "tobit": 17,
    "judith": 18,
    "esth": 19, "esther": 19,
    "1macc": 20, "1maccabees": 20,
    "2macc": 21, "2maccabees": 21,
    "job": 22,
    "ps": 23, "psalm": 23, "psalms": 23,
    "prov": 24, "proverbs": 24,
    "eccl": 25, "ecclesiastes": 25,
    "song": 26, "canticle": 26, "songofsongs": 26,
    "wis": 27, "wisdom": 27,
    "sir": 28, "sirach": 28, "ecclus": 28, "ecclesiasticus": 28,
    "isa": 29, "is": 29, "isaiah": 29,
    "jer": 30, "jeremiah": 30,
    "lam": 31, "lamentations": 31,
    "bar": 32, "baruch": 32,
    "ezek": 33, "ezekiel": 33,
    "dan": 34, "daniel": 34,
    "hos": 35, "hosea": 35,
    "joel": 36,
    "amos": 37,
    "obad": 38, "obadiah": 38,
    "jonah": 39,
    "mic": 40, "micah": 40,
    "nahum": 41,
    "hab": 42, "habakkuk": 42,
    "zeph": 43, "zephaniah": 43,
    "haggai": 44,
    "zech": 45, "zechariah": 45,
    "mal": 46, "malachi": 46,
    "mt": 47, "matt": 47, "matthew": 47,
    "mk": 48, "mark": 48,
    "lk": 49, "luke": 49,
    "jn": 50, "john": 50,
    "acts": 51, "actsoftheapostles": 51,
    "rom": 52, "romans": 52,
    "1cor": 53, "1corinthians": 53,
    "2cor": 54, "2corinthians": 54,
    "gal": 55, "galatians": 55,
    "eph": 56, "ephesians": 56,
    "phil": 57, "philippians": 57,
    "col": 58, "colossians": 58,
    "1thess": 59, "1thessalonians": 59,
    "2thess": 60, "2thessalonians": 60,
    "1tim": 61, "1timothy": 61,
    "2tim": 62, "2timothy": 62,
    "titus": 63,
    "philem": 64, "philemon": 64,
    "heb": 65, "hebrews": 65,
    "jas": 66, "james": 66,
    "1pet": 67, "1peter": 67,
    "2pet": 68, "2peter": 68,
    "1jn": 69, "1john": 69,
    "2jn": 70, "2john": 70,
    "3jn": 71, "3john": 71,
    "jude": 72,
    "rev": 73, "revelation": 73, "apocalypse": 73
  };

  try {
    if (type === 'en') {
      const url = `https://universalis.com/australia.brisbane/${date}/mass.htm`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch daily mass page: ${response.status}`);
      }
      const html = await response.text();
      const readings = [];

      // Extract tables with class="each" which contain reading references
      const tableRegex = /<table class="each"[^>]*>([\s\S]*?)<\/table>/gi;
      let match;
      while ((match = tableRegex.exec(html)) !== null) {
        const tableHtml = match[1];
        
        // Find header left cell text (type of reading) and right cell text (reference)
        // Check for <tr><th align="left">First reading</th><th align="right">Acts 20:28-38</th></tr>
        // or separated by <tr>: <tr><th align="left">First reading</th></tr><tr><th align="right">Acts 20:28-38</th></tr>
        const leftMatch = tableHtml.match(/<th align="left">([^<]+)<\/th>/i);
        const rightMatch = tableHtml.match(/<th align="right">([^<]+)<\/th>/i);
        
        if (leftMatch && rightMatch) {
          const rawType = leftMatch[1].trim();
          const ref = rightMatch[1].trim();
          const lowerType = rawType.toLowerCase();
          
          if (lowerType === 'first reading' || lowerType === 'second reading' || lowerType === 'gospel') {
            let displayType = '독서1';
            if (lowerType === 'second reading') displayType = '독서2';
            if (lowerType === 'gospel') displayType = '복음';
            
            // Match book, chapter, and verse range, e.g. "Acts 20:28-38" or "1 John 1:1-4"
            const refMatch = ref.match(/^(\d?\s*[a-zA-Z\s\.\u00a0]+)\s+(\d+)\s*:\s*(.*)$/);
            if (refMatch) {
              const bookRaw = refMatch[1].replace(/\u00a0/g, ' ').trim();
              const chapter = parseInt(refMatch[2], 10);
              const range = refMatch[3].trim();
              const firstVerse = parseInt(range.split(/[\-\,]/)[0].trim(), 10) || 1;
              
              // Normalize bookName for lookup in englishBookMap
              const cleanBookName = bookRaw.toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
              const bookId = englishBookMap[cleanBookName];
              
              if (bookId) {
                readings.push({
                  type: displayType,
                  bookName: bookRaw, // Keep original English name (e.g., Acts, John)
                  bookId,
                  chapter,
                  verse: firstVerse,
                  range,
                  label: `${displayType} ${bookRaw} ${chapter}:${range}`
                });
              }
            }
          }
        }
      }
      return res.status(200).json({ success: true, date, readings });
    }

    // Default Korean CBKC mass parsing
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
        if (clean.includes("둘째") || clean.includes("2")) return { id: 60, abbrev: "2thess" }; // Wait, let's keep abbreviation same
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
        const docMatch = section.match(/(▥|✠)\s*([^<]+)/);
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

    // 묵상 부분 파싱
    let meditation = null;
    const medHeaderMatch = html.match(/<h4>오늘의\s*묵상[\s\S]*?<\/h4>/i);
    if (medHeaderMatch) {
      const medHeaderIndex = medHeaderMatch.index;
      const medHtmlPart = html.substring(medHeaderIndex);
      const contentMatch = medHtmlPart.match(/<div class="row tjustify"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i) ||
                           medHtmlPart.match(/<div class="content[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
      let rawHtml = '';
      if (contentMatch) {
        rawHtml = contentMatch[1];
      } else {
        rawHtml = medHtmlPart.split('<div class="sns-go">')[0].split('<div class="btn_box">')[0];
      }
      
      let rawMed = rawHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&ldquo;/g, '“')
        .replace(/&rdquo;/g, '”')
        .replace(/&hellip;/g, '…')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      rawMed = rawMed.replace(/^오늘의 묵상\s*/, '').trim();

      if (rawMed.length > 20) {
        meditation = rawMed;
      }
    }

    return res.status(200).json({ success: true, date, readings, meditation });
  } catch (error) {
    console.error('Error fetching mass readings:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
