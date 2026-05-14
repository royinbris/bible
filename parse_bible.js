const fs = require('fs');
const path = require('path');

const biblePath = __dirname;
const outputFilePath = path.join(__dirname, 'bible_data.json');

const testaments = ['구약', '신약'];
const bibleData = {
  books: []
};

// 가톨릭 성경 73권의 전체 목록 (표준 이름 매핑용)
const standardBookNames = {
  "구약": {
    "오경": ["창세", "탈출", "레위", "민수", "신명"],
    "역사서": ["여호", "판관", "룻", "1사무", "2사무", "1열왕", "2열왕", "1역대", "2역대", "에즈", "느헤", "토빗", "유딧", "에스", "1마카", "2마카"],
    "시서와지혜서": ["욥", "시편", "잠언", "코헬", "아가", "지혜", "집회"],
    "예언서": ["이사", "예레", "애가", "바룩", "에제", "다니", "호세", "요엘", "아모스", "오바", "요나", "미카", "나훔", "하박", "스바", "학개", "스가", "말라"]
  },
  "신약": {
    "복음서": ["마태", "마르", "루카", "요한"],
    "사도행전": ["사도"],
    "서간": ["로마", "1코린", "2코린", "갈라", "에페", "필리", "콜로", "1테살", "2테살", "1티모", "2티모", "티토", "필레", "히브", "야고", "1베드", "2베드", "1요한", "2요한", "3요한", "유다"],
    "묵시록": ["묵시"]
  }
};

function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const verses = [];
  const subheadings = [];
  let pendingSubheading = null;
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    if (line.startsWith('### ')) {
      // 소제목 저장 (뒤에 올 절의 번호와 매핑하기 위해 pending)
      let title = line.replace('### ', '').trim();
      pendingSubheading = title;
      continue;
    }
    
    if (line.startsWith('#')) continue; // 다른 헤더(## 1장 등) 제외
    
    // 절 번호와 내용 분리 (예: "1 한처음에", "1-2 하느님께서", "1ㄱ 빛이")
    const match = line.match(/^(\d+[a-zㄱ-ㅎ\-]*)\s+(.*)/);
    
    if (match) {
      const verseNum = match[1];
      verses.push({
        v: verseNum,
        text: match[2]
      });
      
      // 방금 파싱한 절 번호를 보류 중인 소제목에 연결
      if (pendingSubheading) {
        subheadings.push({
          title: pendingSubheading,
          verseId: verseNum
        });
        pendingSubheading = null;
      }
    } else {
      // 절 번호로 시작하지 않는 경우 (단락이 이어진 경우) 이전 절 내용에 추가
      if (verses.length > 0) {
          verses[verses.length - 1].text += ' ' + line;
      }
    }
  }
  return { verses, subheadings };
}

function processDirectory() {
    let globalBookId = 1;

    for (const testament of testaments) {
        const testamentPath = path.join(biblePath, testament);
        if (!fs.existsSync(testamentPath)) continue;

        const categories = fs.readdirSync(testamentPath).filter(f => fs.statSync(path.join(testamentPath, f)).isDirectory());
        // 숫자 접두어로 정렬
        categories.sort((a, b) => parseInt(a.split('_')[0]) - parseInt(b.split('_')[0]));

        for (const category of categories) {
            const categoryPath = path.join(testamentPath, category);
            let categoryName = category.split('_').slice(1).join('_'); // 예: "오경"

            const books = fs.readdirSync(categoryPath).filter(f => fs.statSync(path.join(categoryPath, f)).isDirectory());
            // 숫자 접두어로 정렬
            books.sort((a, b) => parseInt(a.split('_')[0]) - parseInt(b.split('_')[0]));

            for (const book of books) {
                const bookPath = path.join(categoryPath, book);
                let bookNameShort = book.split('_').slice(1).join('_'); // 예: "창세"

                // 폴더명 오타 수정 (예: 10_욥 -> 오바드야)
                if (categoryName === "예언서" && bookNameShort === "욥" && parseInt(book.split('_')[0]) === 10) {
                    bookNameShort = "오바";
                }

                const bookObj = {
                    id: globalBookId++,
                    testament: testament,
                    category: categoryName,
                    name: bookNameShort,
                    chapters: []
                };

                const chapterFiles = fs.readdirSync(bookPath).filter(f => f.endsWith('.md') && f.startsWith('chap'));
                
                // 장 번호로 정렬 (chap1.md, chap2.md ...)
                chapterFiles.sort((a, b) => {
                    const numA = parseInt(a.replace('chap', '').replace('.md', ''));
                    const numB = parseInt(b.replace('chap', '').replace('.md', ''));
                    return numA - numB;
                });

                for (const chapFile of chapterFiles) {
                    const chapPath = path.join(bookPath, chapFile);
                    const chapterNumber = parseInt(chapFile.replace('chap', '').replace('.md', ''));
                    
                    const { verses, subheadings } = parseMarkdown(chapPath);
                    bookObj.chapters.push({
                        c: chapterNumber,
                        v: verses,
                        subheadings: subheadings
                    });
                }
                
                bibleData.books.push(bookObj);
            }
        }
    }
}

processDirectory();

// 용량 최적화를 위해 불필요한 공백 제거 (minify JSON)
fs.writeFileSync(outputFilePath, JSON.stringify(bibleData));
console.log(`성공: 성경 마크다운 데이터를 파싱하여 ${outputFilePath} 파일로 생성했습니다.`);
console.log(`총 ${bibleData.books.length}권의 성경 데이터 처리 완료.`);
