import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import localforage from 'localforage';

export default function Reader({ toggleDarkMode, isDark, changeFontSize, fontSize }) {
  const { bookId, chapter } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [allBooks, setAllBooks] = useState(null);
  
  // Array of loaded chapters for infinite scrolling
  const [chapters, setChapters] = useState([]);
  const [activeChapterInfo, setActiveChapterInfo] = useState(null); 
  
  const loadedChaptersRef = useRef([]);
  const loadingPrevRef = useRef(false);
  const loadingNextRef = useRef(false);
  
  const topSentinelRef = useRef(null);
  const bottomSentinelRef = useRef(null);
  const scrollAdjustmentRef = useRef({ pending: false, oldScrollHeight: 0, oldScrollY: 0 });
  const scrollToInitialRef = useRef(null);

  // Sync ref with state
  useEffect(() => {
     loadedChaptersRef.current = chapters;
  }, [chapters]);

  // Load all books metadata once
  useEffect(() => {
    localforage.getItem('bibleData_v2').then(data => {
      if (data && data.books) {
        setAllBooks(data.books);
      }
    });
  }, []);

  const getAdjacentChapters = useCallback((startBookId, startChapterNum, direction, count) => {
    if (!allBooks) return [];
    const results = [];
    let currentBId = startBookId;
    let currentCNum = startChapterNum;

    for (let i = 0; i < count; i++) {
        const book = allBooks.find(b => b.id === currentBId);
        if (!book) break;
        
        const currentIdx = book.chapters.findIndex(c => c.c === currentCNum);
        const nextIdx = currentIdx + direction;
        
        if (nextIdx >= 0 && nextIdx < book.chapters.length) {
            currentCNum = book.chapters[nextIdx].c;
            results.push({ bookId: book.id, bookName: book.name, chapData: book.chapters[nextIdx] });
        } else {
            // 한 성경 안에서만 스크롤 (다음 또는 이전 책으로 넘어가지 않음)
            break;
        }
    }
    return results;
  }, [allBooks]);

  // Initial load or route change from outside
  useEffect(() => {
    if (!allBooks) return;
    const bId = parseInt(bookId);
    const cNum = parseInt(chapter);
    
    // If the requested chapter is already in our loaded list, don't reset (caused by scrolling)
    if (loadedChaptersRef.current.some(ch => ch.bookId === bId && ch.chapData.c === cNum)) {
        return; 
    }

    const foundBook = allBooks.find(b => b.id === bId);
    if (foundBook) {
      const foundChap = foundBook.chapters.find(ch => ch.c === cNum);
      if (foundChap) {
        const initialChap = {
          key: `${foundBook.id}-${foundChap.c}`,
          bookId: foundBook.id,
          bookName: foundBook.name,
          chapData: foundChap
        };
        
        // Preload 3 before and 3 after
        const prevChaps = getAdjacentChapters(foundBook.id, foundChap.c, -1, 3)
            .map(ch => ({ key: `${ch.bookId}-${ch.chapData.c}`, ...ch }))
            .reverse();
            
        const nextChaps = getAdjacentChapters(foundBook.id, foundChap.c, 1, 3)
            .map(ch => ({ key: `${ch.bookId}-${ch.chapData.c}`, ...ch }));

        scrollAdjustmentRef.current.pending = false;
        scrollToInitialRef.current = initialChap.key;

        setChapters([...prevChaps, initialChap, ...nextChaps]);
        setActiveChapterInfo({ bookId: foundBook.id, bookName: foundBook.name, chapter: foundChap.c });
        localStorage.setItem('lastRead', JSON.stringify({ bookId: foundBook.id, chapter: foundChap.c }));
      }
    }
  }, [allBooks, bookId, chapter, getAdjacentChapters]);

  // Scroll to the requested chapter initially
  useEffect(() => {
     if (scrollToInitialRef.current && chapters.length > 0) {
         setTimeout(() => {
             let element = null;
             let headerOffset = 80;
             if (location.hash) {
                 const id = location.hash.replace('#', '');
                 const bId = parseInt(bookId);
                 const cNum = parseInt(chapter);
                 // 고유 ID 생성 (예: v-1-5-18)
                 const fullId = `v-${bId}-${cNum}-${id.replace('v', '')}`;
                 element = document.getElementById(fullId);
                 if (!element) element = document.getElementById(id); // Fallback
             } 
             
             if (!element) {
                 const idParts = scrollToInitialRef.current.split('-'); // "bId-cNum"
                 const targetId = `chap-${idParts[0]}-${idParts[1]}`;
                 element = document.getElementById(targetId);
             }

             if (element) {
                 const elementPosition = element.getBoundingClientRect().top;
                 const offsetPosition = elementPosition + window.scrollY - headerOffset;
                 window.scrollTo(0, offsetPosition);
             }
             scrollToInitialRef.current = null;
         }, 50); // short delay to ensure DOM is fully rendered
     }
  }, [chapters, location.hash]);

  // Adjust scroll position to prevent jumping when prepending older chapters
  useLayoutEffect(() => {
    if (scrollAdjustmentRef.current.pending) {
      const { oldScrollHeight, oldScrollY } = scrollAdjustmentRef.current;
      const newScrollHeight = document.documentElement.scrollHeight;
      const heightDiff = newScrollHeight - oldScrollHeight;
      window.scrollTo(0, oldScrollY + heightDiff);
      scrollAdjustmentRef.current.pending = false;
    }
  }, [chapters]);

  const loadPrevious = useCallback(() => {
    if (loadingPrevRef.current || chapters.length === 0) return;
    loadingPrevRef.current = true;
    
    const firstChap = chapters[0];
    const prevChaps = getAdjacentChapters(firstChap.bookId, firstChap.chapData.c, -1, 3);
    
    if (prevChaps.length > 0) {
      scrollAdjustmentRef.current = {
        pending: true,
        oldScrollHeight: document.documentElement.scrollHeight,
        oldScrollY: window.scrollY
      };
      
      const newChaps = prevChaps.map(ch => ({
        key: `${ch.bookId}-${ch.chapData.c}`,
        ...ch
      })).reverse();
      
      setChapters(prev => [...newChaps, ...prev]);
    }
    
    setTimeout(() => { loadingPrevRef.current = false; }, 300);
  }, [chapters, getAdjacentChapters]);

  const loadNext = useCallback(() => {
    if (loadingNextRef.current || chapters.length === 0) return;
    loadingNextRef.current = true;
    
    const lastChap = chapters[chapters.length - 1];
    const nextChaps = getAdjacentChapters(lastChap.bookId, lastChap.chapData.c, 1, 3);
    
    if (nextChaps.length > 0) {
      const newChaps = nextChaps.map(ch => ({
        key: `${ch.bookId}-${ch.chapData.c}`,
        ...ch
      }));
      setChapters(prev => [...prev, ...newChaps]);
    }
    
    setTimeout(() => { loadingNextRef.current = false; }, 300);
  }, [chapters, getAdjacentChapters]);

  // Observers for top and bottom to trigger loading more chapters (expanded margin to 3000px)
  useEffect(() => {
    const topObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadPrevious();
      }
    }, { rootMargin: '3000px 0px 0px 0px' });

    const bottomObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadNext();
      }
    }, { rootMargin: '0px 0px 3000px 0px' });

    if (topSentinelRef.current) topObserver.observe(topSentinelRef.current);
    if (bottomSentinelRef.current) bottomObserver.observe(bottomSentinelRef.current);

    return () => {
      topObserver.disconnect();
      bottomObserver.disconnect();
    };
  }, [loadPrevious, loadNext]);

  // Observer to update the header and URL when a chapter enters view
  useEffect(() => {
    const chapterObserver = new IntersectionObserver((entries) => {
      let mostVisibleId = null;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
            mostVisibleId = entry.target.id;
        }
      });
      
      if (mostVisibleId) {
          const idParts = mostVisibleId.split('-'); // e.g. "chap-1-1"
          const bId = parseInt(idParts[1]);
          const cNum = parseInt(idParts[2]);
          const ch = loadedChaptersRef.current.find(c => c.bookId === bId && c.chapData.c === cNum);
          if (ch) {
            setActiveChapterInfo({ bookId: ch.bookId, bookName: ch.bookName, chapter: ch.chapData.c });
            localStorage.setItem('lastRead', JSON.stringify({ bookId: bId, chapter: cNum }));
            navigate(`/read/${bId}/${cNum}`, { replace: true });
          }
      }
    }, { rootMargin: '-40% 0px -40% 0px' });

    document.querySelectorAll('.chapter-container').forEach(el => chapterObserver.observe(el));

    return () => chapterObserver.disconnect();
  }, [chapters, navigate]);

  if (chapters.length === 0 || !activeChapterInfo) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <>
      <header className="header" style={{ borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 100 }}>
        <button className="header-btn" onClick={() => navigate(-1)}>
          <span style={{ fontSize: '1rem', color: '#888' }}>&lt;</span>
        </button>
        <h1 style={{ flex: 1, textAlign: 'left', marginLeft: '10px', fontSize: '1.2rem', fontWeight: 'bold' }}>
          {activeChapterInfo.bookName} {activeChapterInfo.chapter}장
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="header-btn" onClick={() => navigate('/')}>🏠</button>
          <button className="header-btn" onClick={toggleDarkMode}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <button className="header-btn">⚙️</button>
        </div>
      </header>
      
      <div 
        className="reader-container" 
      >
        <div ref={topSentinelRef} style={{ height: '1px', width: '100%' }}></div>

        {chapters.map((ch) => (
          <div key={ch.key} id={`chap-${ch.bookId}-${ch.chapData.c}`} className="chapter-container" style={{ paddingBottom: '40px' }}>
            {/* 장 제목 추가 */}
            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '24px', marginTop: '16px', color: 'var(--text-color)', textAlign: 'center' }}>
               {ch.bookName} {ch.chapData.c}장
            </h2>
            
            {ch.chapData.v.map((verse, idx) => {
              const subheading = ch.chapData.subheadings?.find(s => s.verseId === verse.v);
              return (
                <div key={idx} id={`v-${ch.bookId}-${ch.chapData.c}-${verse.v}`}>
                  {subheading && (
                    <h3 style={{ color: '#d4af37', marginTop: '24px', marginBottom: '12px' }}>
                      {subheading.title}
                    </h3>
                  )}
                  <div className="verse">
                    <div className="verse-num">{verse.v}</div>
                    <div className="verse-text">{verse.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={bottomSentinelRef} style={{ height: '1px', width: '100%' }}></div>
      </div>

      <div className="bottom-nav">
        <div className="settings-panel">
          <div className="font-size-btn" onClick={() => changeFontSize(-2)}>A-</div>
          <div className="font-size-btn" onClick={() => changeFontSize(2)}>A+</div>
        </div>
      </div>
    </>
  );
}
