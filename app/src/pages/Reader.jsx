import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, Fragment } from 'react';
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
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };
  
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
      entries.forEach(entry => {
        if (entry.isIntersecting) {
            const idParts = entry.target.id.split('-');
            const bId = parseInt(idParts[1]);
            const cNum = parseInt(idParts[2]);
            const ch = loadedChaptersRef.current.find(c => c.bookId === bId && c.chapData.c === cNum);
            if (ch) {
              setActiveChapterInfo({ bookId: ch.bookId, bookName: ch.bookName, chapter: ch.chapData.c });
              localStorage.setItem('lastRead', JSON.stringify({ bookId: bId, chapter: cNum }));
              navigate(`/read/${bId}/${cNum}`, { replace: true });
            }
        }
      });
    }, { rootMargin: '-70px 0px -90% 0px' });

    document.querySelectorAll('.chapter-container').forEach(el => chapterObserver.observe(el));

    return () => chapterObserver.disconnect();
  }, [chapters, navigate]);

  const navigateToLink = (linkStr) => {
    if (!allBooks) return;
    // e.g. "루카 3,23-38" -> [가-힣], [장], [절] 순으로 파싱
    const match = linkStr.match(/^([\d]*\s*[가-힣]+)\s*(\d+)(?:,(\d+))?/);
    if (match) {
        const abbrev = match[1].trim();
        const chap = match[2];
        const verse = match[3];
        
        // 가장 잘 어울리는 성경 찾기 (이름 시작 부분 비교)
        const targetBook = allBooks.find(b => b.name.startsWith(abbrev) || abbrev.startsWith(b.name));
        if (targetBook) {
            // 절 정보가 있으면 해시(#v20)를 붙여서 이동
            const targetUrl = `/read/${targetBook.id}/${chap}${verse ? '#v' + verse : ''}`;
            navigate(targetUrl);
            
            // 기존 데이터 비우고 다시 로드하여 정확한 위치로 스크롤 유도
            setChapters([]);
            loadedChaptersRef.current = [];
        }
    }
  };

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState(new Set());

  // ... (keeping existing hooks and refs, assume they are above this)

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedVerses(new Set());
  };

  const toggleVerseSelection = (id) => {
    if (!isSelectionMode) return;
    const newSelection = new Set(selectedVerses);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedVerses(newSelection);
  };

  const toggleGroupSelection = (bookId, chapterNum, startVerse, endVerse) => {
    if (!isSelectionMode) return;
    const newSelection = new Set(selectedVerses);
    let allSelected = true;

    for (let v = startVerse; v <= endVerse; v++) {
      const id = `${bookId}-${chapterNum}-${v}`;
      if (!newSelection.has(id)) {
        allSelected = false;
        break;
      }
    }

    for (let v = startVerse; v <= endVerse; v++) {
      const id = `${bookId}-${chapterNum}-${v}`;
      if (allSelected) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
    }
    setSelectedVerses(newSelection);
  };

  const handleCopy = () => {
    if (selectedVerses.size === 0) return;
    
    // Sort selected verses logically
    const sortedVerses = Array.from(selectedVerses).sort((a, b) => {
      const partsA = a.split('-').map(Number);
      const partsB = b.split('-').map(Number);
      if (partsA[0] !== partsB[0]) return partsA[0] - partsB[0];
      if (partsA[1] !== partsB[1]) return partsA[1] - partsB[1];
      return partsA[2] - partsB[2];
    });

    let copyText = "";
    sortedVerses.forEach(id => {
      const [bIdStr, cStr, vStr] = id.split('-');
      const bId = parseInt(bIdStr);
      const chapter = parseInt(cStr);
      const verse = parseInt(vStr);
      
      const chapInfo = loadedChaptersRef.current.find(c => c.bookId === bId && c.chapData.c === chapter);
      if (chapInfo) {
        const verseData = chapInfo.chapData.v.find(v => v.v === verse);
        if (verseData) {
          copyText += `[${chapInfo.bookName} ${chapter},${verse}] ${verseData.text}\n`;
        }
      }
    });

    const textToCopy = copyText.trim();
    if (!textToCopy) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('선택한 구절이 복사되었습니다.');
        toggleSelectionMode();
      }).catch(err => {
        // Fallback for clipboard API failure
        fallbackCopy(textToCopy);
      });
    } else {
      fallbackCopy(textToCopy);
    }
  };

  const fallbackCopy = (text) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('선택한 구절이 복사되었습니다.');
      toggleSelectionMode();
    } catch (err) {
      showToast('복사에 실패했습니다.');
    }
  };

  const handleBookmark = () => {
    if (selectedVerses.size === 0) return;
    
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    const newBookmarks = Array.from(selectedVerses).map(id => {
      const [bIdStr, cStr, vStr] = id.split('-');
      const bId = parseInt(bIdStr);
      const chapter = parseInt(cStr);
      const verse = parseInt(vStr);
      
      const chapInfo = loadedChaptersRef.current.find(c => c.bookId === bId && c.chapData.c === chapter);
      let text = "";
      if (chapInfo) {
        const verseData = chapInfo.chapData.v.find(v => v.v === verse);
        if (verseData) text = verseData.text;
      }
      
      return {
        id,
        bookId: bIdStr,
        bookName: chapInfo ? chapInfo.bookName : bIdStr,
        chapter,
        verse,
        text,
        date: new Date().toISOString()
      };
    });

    // Merge without duplicates
    const merged = [...bookmarks];
    newBookmarks.forEach(nb => {
      if (!merged.find(b => b.id === nb.id)) {
        merged.push(nb);
      }
    });

    localStorage.setItem('bookmarks', JSON.stringify(merged));
    showToast('책갈피에 추가되었습니다.');
    toggleSelectionMode();
  };

  const renderSubheading = (title, bookId, chapterNum, currentVerseNum, chapterData) => {
    // 모든 괄호 (...) 내용을 찾아냄
    const matches = [...title.matchAll(/\(([^)]+)\)/g)];
    const mainTitle = title.replace(/\(([^)]+)\)/g, '').replace(/[;\s]+$/, '').trim();
    
    let allLinks = [];
    matches.forEach(match => {
      const inner = match[1];
      const splitLinks = inner.split(';').map(l => l.trim()).filter(l => l);
      allLinks = [...allLinks, ...splitLinks];
    });

    // Find next subheading verse to know the range
    let endVerse = chapterData.v[chapterData.v.length - 1].v;
    if (chapterData.subheadings) {
       const nextSub = chapterData.subheadings.find(s => s.verseId > currentVerseNum);
       if (nextSub) endVerse = nextSub.verseId - 1;
    }

    return (
      <div className="subheading-group" onClick={() => toggleGroupSelection(bookId, chapterNum, currentVerseNum, endVerse)} style={{ cursor: isSelectionMode ? 'pointer' : 'default' }}>
        <h3 className="reader-subheading">{mainTitle}</h3>
        {allLinks.length > 0 && !isSelectionMode && (
          <div className="parallel-passages-container">
            {allLinks.map((link, i) => (
              <Fragment key={i}>
                <span className="subheading-link" onClick={(e) => { e.stopPropagation(); navigateToLink(link); }}>
                  {link}
                </span>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (chapters.length === 0 || !activeChapterInfo) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <>
      <header className="header" style={{ borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'var(--header-bg)', backdropFilter: 'blur(10px)' }}>
        <button className="header-btn" onClick={() => navigate(-1)} style={{ padding: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        
        <h1 style={{ flex: 1, textAlign: 'left', marginLeft: '4px', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
          {activeChapterInfo.bookName} <span style={{ color: '#d12040', marginLeft: '4px' }}>{activeChapterInfo.chapter}</span>
        </h1>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isSelectionMode ? (
            <>
              <button className="action-btn action-copy" onClick={handleCopy}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button className="action-btn action-cancel" onClick={toggleSelectionMode}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              <button className="action-btn action-bookmark" onClick={handleBookmark}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/><line x1="12" x2="12" y1="7" y2="13"/><line x1="15" x2="9" y1="10" y2="10"/></svg>
              </button>
            </>
          ) : (
            <>
              <button className="header-btn" onClick={() => navigate('/')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </button>
              <button className="header-btn" onClick={toggleSelectionMode}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button className="header-btn" onClick={() => navigate('/search')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </button>
              <button className="header-btn" onClick={toggleDarkMode}>
                {isDark ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                )}
              </button>
            </>
          )}
        </div>
      </header>
      
      <div className="reader-container" style={{ paddingBottom: isSelectionMode ? '20px' : '80px' }}>
        <div ref={topSentinelRef} style={{ height: '1px', width: '100%' }}></div>

        {chapters.map((ch) => (
          <div key={ch.key} id={`chap-${ch.bookId}-${ch.chapData.c}`} className="chapter-container" style={{ paddingBottom: '40px' }}>
            <h2 
              onClick={() => toggleGroupSelection(ch.bookId, ch.chapData.c, 1, ch.chapData.v[ch.chapData.v.length - 1].v)}
              style={{ 
                fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '24px', marginTop: '16px', 
                color: 'var(--text-color)', textAlign: 'center', cursor: isSelectionMode ? 'pointer' : 'default' 
              }}
            >
               {ch.bookName} {ch.chapData.c}장
            </h2>
            
            {ch.chapData.v.map((verse, idx) => {
              const subheading = ch.chapData.subheadings?.find(s => s.verseId === verse.v);
              const verseId = `${ch.bookId}-${ch.chapData.c}-${verse.v}`;
              const isSelected = selectedVerses.has(verseId);
              
              return (
                <div key={idx} id={`v-${verseId}`}>
                  {subheading && renderSubheading(subheading.title, ch.bookId, ch.chapData.c, verse.v, ch.chapData)}
                  <div 
                    className={`verse ${isSelectionMode ? 'selectable' : ''} ${isSelected ? 'verse-selected' : ''}`}
                    onClick={() => toggleVerseSelection(verseId)}
                  >
                    <div className="verse-num" style={{ color: isSelected ? 'var(--text-color)' : 'var(--primary-color)' }}>{verse.v}</div>
                    <div className="verse-text">{verse.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={bottomSentinelRef} style={{ height: '1px', width: '100%' }}></div>
      </div>

      {!isSelectionMode && (
        <div className="bottom-nav">
          <div className="settings-panel">
            <div className="font-size-btn" onClick={() => changeFontSize(-2)}>A-</div>
            <div className="font-size-btn" onClick={() => changeFontSize(2)}>A+</div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className="toast">{toast}</div>
        </div>
      )}
    </>
  );
}
