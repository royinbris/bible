import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, Fragment } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata, BIBLE_DB_KEY } from '../lib/bibleInfo';
import { useSettings } from '../context/SettingsContext';
import { useBible } from '../context/BibleContext';
import SettingsSheet from '../components/SettingsSheet';
import { useSimpleTTS } from '../hooks/useSimpleTTS';

export default function Reader() {
  const { bookId, chapter } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isPlanMode = searchParams.get('plan') === 'true';
  const planDay = parseInt(searchParams.get('day'), 10);

  const { settings, updateSetting } = useSettings();
  const { 
    addHistoryLog, 
    updateHistoryLog, 
    saveMyVerse,
    isSpeaking,
    isPaused,
    speakingVerseId,
    ttsHandlers,
    isContinueMode,
    setIsContinueMode
  } = useBible();
  
  const [chapters, setChapters] = useState([]);
  const [allBooks, setAllBooks] = useState(null);
  const [activeChapterInfo, setActiveChapterInfo] = useState(null); 
  const [toast, setToast] = useState(null);
  const [isBarsVisible, setIsBarsVisible] = useState(true);

  const lastScannedVerseRef = useRef({ id: null, relativeTop: 120 });
  const prevLanguageRef = useRef(settings.bibleLanguage);
  const lastScrollYRef = useRef(0);
  const isFirstScrollRef = useRef(true);

  useLayoutEffect(() => {
    if (prevLanguageRef.current !== settings.bibleLanguage) {
      const oldLang = prevLanguageRef.current;
      prevLanguageRef.current = settings.bibleLanguage;
      
      const anchor = lastScannedVerseRef.current;
      if (anchor && anchor.id) {
        const element = document.getElementById(anchor.id);
        if (element) {
          const rect = element.getBoundingClientRect();
          const currentScrollY = window.scrollY;
          const targetScrollY = currentScrollY + (rect.top - anchor.relativeTop);
          
          window.scrollTo(0, targetScrollY);
          
          // Re-update the relative top to make sure it's accurate after adjusting scroll
          lastScannedVerseRef.current.relativeTop = element.getBoundingClientRect().top;
        }
      }
    }
  }, [settings.bibleLanguage]);

  const toggleLanguage = () => {
    const currentLang = settings.bibleLanguage;
    let nextLang = 'ko';
    if (currentLang === 'ko') {
      nextLang = 'ko-en';
    } else if (currentLang === 'ko-en') {
      nextLang = 'en';
    } else if (currentLang === 'en') {
      nextLang = 'ko';
    }
    updateSetting('bibleLanguage', nextLang);
  };
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [detectedVerse, setDetectedVerse] = useState('');
  const [ttsItems, setTtsItems] = useState([]);
  const [isScreenDimmed, setIsScreenDimmed] = useState(false);

  const enterScreenDim = async () => {
    setIsScreenDimmed(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen();
      } else if (document.documentElement.mozRequestFullScreen) {
        await document.documentElement.mozRequestFullScreen();
      } else if (document.documentElement.msRequestFullscreen) {
        await document.documentElement.msRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen entry failed (graceful fallback active):', err);
    }
  };

  const exitScreenDim = async () => {
    setIsScreenDimmed(false);
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen exit failed:', err);
    }
  };

  // Auto clear screen dimmer if TTS stops speaking
  useEffect(() => {
    if (!isSpeaking) {
      exitScreenDim();
    }
  }, [isSpeaking]);

  // Add reader-page class to body for stable layout styling
  useEffect(() => {
    document.body.classList.add('reader-page');
    return () => {
      document.body.classList.remove('reader-page');
    };
  }, []);

  // Sync body class when TTS 낭독 is active
  useEffect(() => {
    document.body.classList.toggle('tts-active', isSpeaking);
    return () => {
      document.body.classList.remove('tts-active');
    };
  }, [isSpeaking]);

  // 스크롤 방향에 따라 상/하단 바 숨김 및 표시 처리 (최상단은 항상 노출)
  useEffect(() => {
    isFirstScrollRef.current = true;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // 첫 스크롤 이벤트 발생 시 현재 스크롤 위치를 기준값으로 설정 후 스킵
      if (isFirstScrollRef.current) {
        lastScrollYRef.current = currentScrollY;
        isFirstScrollRef.current = false;
        return;
      }
      
      // 최상단 근처 도달 시 무조건 표시
      if (currentScrollY <= 10) {
        setIsBarsVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }
      
      const diff = currentScrollY - lastScrollYRef.current;
      
      // 8px 미만의 미세 스크롤은 오동작 방지를 위해 필터링
      if (Math.abs(diff) < 8) return;
      
      if (diff > 0) {
        // 아래로 스크롤 (화면이 위로 올라감) -> 숨김
        setIsBarsVisible(false);
      } else {
        // 위로 스크롤 (화면이 아래로 내려옴) -> 표시
        setIsBarsVisible(true);
      }
      
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [bookId, chapter]);

  // TTS Scanned items synchronizer
  useEffect(() => {
    if (!chapters || chapters.length === 0) return;
    const items = [];
    const isEnglishOnly = settings.bibleLanguage === 'en';
    
    chapters.forEach(ch => {
      // Prepend Chapter Title first so the TTS reads it gracefully!
      const bookMeta = bibleMetadata[ch.bookName] || { full: ch.bookName };
      const bookFullName = bookMeta.full || ch.bookName;
      const chapterSuffix = ch.bookName === '시편' ? '편' : '장';
      const chapterTitle = isEnglishOnly 
        ? `${ch.bookEnName || ch.bookName} Chapter ${ch.chapData.c}`
        : `${bookFullName} ${ch.chapData.c}${chapterSuffix}`;
      
      items.push({
        id: `chap-${ch.bookId}-${ch.chapData.c}`,
        text: chapterTitle,
        type: 'chapter'
      });

      ch.chapData.v.forEach(verse => {
        const subheading = ch.chapData.subheadings?.find(s => s.verseId === verse.v);
        if (subheading && !isEnglishOnly) {
          items.push({
            id: `sub-${ch.bookId}-${ch.chapData.c}-${verse.v}`,
            text: subheading.title,
            type: 'subheading'
          });
        }
        items.push({
          id: `v-${ch.bookId}-${ch.chapData.c}-${verse.v}`,
          text: isEnglishOnly ? (verse.en || '') : verse.text,
          type: 'verse'
        });
      });
    });
    setTtsItems(items);
  }, [chapters, settings.bibleLanguage]);

  // Bind Web Speech API Hook
  useSimpleTTS(ttsItems);

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
    localforage.getItem(BIBLE_DB_KEY).then(data => {
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
            results.push({ bookId: book.id, bookName: book.name, bookEnName: book.enName, chapData: book.chapters[nextIdx] });
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
          bookEnName: foundBook.enName,
          chapData: foundChap
        };
        
        // Preload 3 before and 3 after (only if NOT in plan mode)
        const prevChaps = isPlanMode ? [] : getAdjacentChapters(foundBook.id, foundChap.c, -1, 3)
            .map(ch => ({ key: `${ch.bookId}-${ch.chapData.c}`, ...ch }))
            .reverse();
            
        const nextChaps = isPlanMode ? [] : getAdjacentChapters(foundBook.id, foundChap.c, 1, 3)
            .map(ch => ({ key: `${ch.bookId}-${ch.chapData.c}`, ...ch }));

        let initialSubtitle = '';
        if (foundChap.subheadings && foundChap.subheadings.length > 0) {
          const firstSub = foundChap.subheadings[0];
          initialSubtitle = firstSub.title.replace(/\(([^)]+)\)/g, '').replace(/[;\s]+$/, '').trim();
        } else {
          initialSubtitle = `${foundChap.c}장 읽기`;
        }

        scrollAdjustmentRef.current.pending = false;
        scrollToInitialRef.current = initialChap.key;

        setChapters([...prevChaps, initialChap, ...nextChaps]);
        const meta = bibleMetadata[foundBook.name] || { full: foundBook.name, abbrev: foundBook.name };
        setActiveChapterInfo({ 
          bookId: foundBook.id, 
          bookName: foundBook.name, 
          bookEnName: foundBook.enName,
          chapter: foundChap.c,
          full: meta.full,
          abbrev: meta.abbrev
        });
        // Prevent pollution of regular history and lastRead if in plan mode
        if (!isPlanMode) {
          localStorage.setItem('lastRead', JSON.stringify({ bookId: foundBook.id, chapter: foundChap.c }));
          addHistoryLog(foundBook.id, foundBook.name, foundChap.c, 1, '', initialSubtitle);
        }
      }
    }
  }, [allBooks, bookId, chapter, getAdjacentChapters, addHistoryLog]);

  // Scroll to the requested chapter initially
  useEffect(() => {
     if (scrollToInitialRef.current && chapters.length > 0) {
         setTimeout(() => {
             let element = null;
             let headerOffset = 84; // Safe fallback
             const headerEl = document.querySelector('.reader-header-v2');
             if (headerEl) {
                 // Dynamically resolve exact notch + top bar layout height plus 8px breathing margin!
                 headerOffset = headerEl.getBoundingClientRect().height + 8;
             }

              if (location.hash) {
                  const id = location.hash.replace('#', '');
                  element = document.getElementById(id);
                  if (!element) {
                      const bId = parseInt(bookId);
                      const cNum = parseInt(chapter);
                      // Fallback 1: 구절 (예: #v-1-5-18 또는 #v18)
                      const cleanId = id.replace('v-', '').replace('v', '');
                      const fullId = `v-${bId}-${cNum}-${cleanId}`;
                      element = document.getElementById(fullId);
                  }
                  if (!element) {
                      // Fallback 2: 소제목 (예: #sub-1-5-18 또는 #sub18)
                      const cleanId = id.replace('sub-', '').replace('sub', '');
                      const fullId = `sub-${bookId}-${chapter}-${cleanId}`;
                      element = document.getElementById(fullId);
                  }
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
         }, 150); // 150ms delay to ensure heavy async DOM rendering completes beautifully
     }
  }, [chapters, location.hash, bookId, chapter]);

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
    if (isPlanMode) return; // 한권읽기 모드에서는 이전 장 로딩 방지
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
    if (isPlanMode) return; // 한권읽기 모드에서는 다음 장 로딩 방지
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
    if (isPlanMode) return; // 한권읽기 모드에서는 옵저버 비활성화
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

  // Real-time high-speed scroll chapter observer removed in favor of 100ms precise scroll scanner

  // Throttled visual scroll scanner & debounced reading history/URL saver
  useEffect(() => {
    let scrollStopTimer = null;
    let lastScanTime = 0;
    const throttleInterval = 100; // Throttled to run exactly every 100ms during active scrolling

    const handleScrollOrLoad = () => {
      // 1. URL & database reading history updates are strictly debounced to 200ms after scrolling stops
      if (scrollStopTimer) clearTimeout(scrollStopTimer);

      // 2. [Throttled Visual Scanner] Scan closest verse to the upper 120px scanning thread every 100ms during scroll
      const now = Date.now();
      if (now - lastScanTime >= throttleInterval) {
        lastScanTime = now;

        const targetY = 120; // 120px absolute scanner line
        const verses = document.querySelectorAll('.verse');
        let activeVerseElement = null;
        let minDiff = Infinity;

        verses.forEach(el => {
          const rect = el.getBoundingClientRect();
          const diff = Math.abs(rect.top - targetY);

          if (rect.top < window.innerHeight && rect.bottom > 80) {
            if (diff < minDiff) {
              minDiff = diff;
              activeVerseElement = el;
            }
          }
        });

        if (activeVerseElement) {
          const parentWrapper = activeVerseElement.closest('[id^="v-"]');
          if (parentWrapper) {
            lastScannedVerseRef.current = {
              id: parentWrapper.id,
              relativeTop: parentWrapper.getBoundingClientRect().top
            };
            const idParts = parentWrapper.id.split('-'); // ["v", "bId", "cNum", "vNum"]
            const bId = parseInt(idParts[1], 10);
            const cNum = parseInt(idParts[2], 10);
            const vNum = parseInt(idParts[3], 10);

            if (vNum && !isNaN(vNum)) {
              // Find current chapter container to extract applicable subheading
              const ch = loadedChaptersRef.current.find(c => c.bookId === bId && c.chapData.c === cNum);
              let subtitleText = '';
              let subtitleId = ''; // Extract subtitle ID for database update condition
              
              if (ch && ch.chapData.subheadings) {
                // Get all subheadings that appear at or before this verse (Strict numerical comparison using safe parseInt!)
                const applicableSubs = ch.chapData.subheadings.filter(s => parseInt(s.verseId, 10) <= vNum);
                if (applicableSubs.length > 0) {
                  // Select the latest subheading before this verse (Strict numerical sorting)
                  const activeSub = applicableSubs.reduce((max, s) => parseInt(s.verseId, 10) > parseInt(max.verseId, 10) ? s : max, applicableSubs[0]);
                  subtitleText = activeSub.title.replace(/\(([^)]+)\)/g, '').replace(/[;\s]+$/, '').trim();
                  subtitleId = activeSub.verseId.toString();
                }
              }

              if (!subtitleText) {
                subtitleText = `${cNum}장 읽기`;
                subtitleId = `${cNum}-read`;
              }

              // Real-time tracking visual feed update
              setDetectedVerse(`${cNum}:${vNum}`);

              // ⚡ [실시간 헤더 갱신] 스크롤 중에도 0.1초마다 즉시 헤더 글씨를 실시간 업데이트!
              if (ch) {
                const meta = bibleMetadata[ch.bookName] || { full: ch.bookName, abbrev: ch.bookName };
                setActiveChapterInfo(prev => {
                  if (!prev || prev.bookId !== bId || prev.chapter !== cNum) {
                    return {
                      bookId: bId,
                      bookName: ch.bookName,
                      bookEnName: ch.bookEnName,
                      chapter: cNum,
                      full: meta.full,
                      abbrev: meta.abbrev
                    };
                  }
                  return prev;
                });
              }

              // Pass actual subtitleId to successfully pass 'if (subtitleId)' in BibleContext.jsx
              updateHistoryLog(vNum, subtitleId, subtitleText, bId, ch ? ch.bookName : '', cNum);
            }
          }
        }
      }

      // 3. [Debounced URL & DB Anchor Correction] Triggered 200ms after scrolling stops
      scrollStopTimer = setTimeout(() => {
        const targetY = 120; // 120px absolute scanner line
        const verses = document.querySelectorAll('.verse');
        let maxActiveVerseElement = null;
        let maxMinDiff = Infinity;

        verses.forEach(el => {
          const rect = el.getBoundingClientRect();
          const diff = Math.abs(rect.top - targetY);
          if (rect.top < window.innerHeight && rect.bottom > 80) {
            if (diff < maxMinDiff) {
              maxMinDiff = diff;
              maxActiveVerseElement = el;
            }
          }
        });

        if (maxActiveVerseElement) {
          const parentWrapper = maxActiveVerseElement.closest('[id^="v-"]');
          if (parentWrapper) {
            lastScannedVerseRef.current = {
              id: parentWrapper.id,
              relativeTop: parentWrapper.getBoundingClientRect().top
            };
            const idParts = parentWrapper.id.split('-');
            const bId = parseInt(idParts[1], 10);
            const cNum = parseInt(idParts[2], 10);
            const vNum = parseInt(idParts[3], 10);

            if (vNum && !isNaN(vNum)) {
              const ch = loadedChaptersRef.current.find(c => c.bookId === bId && c.chapData.c === cNum);
              
              if (ch) {
                // High-speed inertia bypass protector: match current route parameter with visual scan
                const pathParts = window.location.pathname.split('/'); 
                const routeBId = parseInt(pathParts[2], 10);
                const routeCNum = parseInt(pathParts[3], 10);

                if (routeBId !== bId || routeCNum !== cNum) {
                  const meta = bibleMetadata[ch.bookName] || { full: ch.bookName, abbrev: ch.bookName };
                  setActiveChapterInfo({ 
                    bookId: bId, 
                    bookName: ch.bookName, 
                    bookEnName: ch.bookEnName,
                    chapter: cNum,
                    full: meta.full,
                    abbrev: meta.abbrev
                  });
                  if (!isPlanMode) {
                    localStorage.setItem('lastRead', JSON.stringify({ bookId: bId, chapter: cNum }));
                  }
                  navigate(`/read/${bId}/${cNum}${location.search}`, { replace: true });
                }
                
                let subtitleText = '';
                let subtitleId = ''; // Extract subtitle ID for database update condition
                if (ch.chapData.subheadings) {
                  const applicableSubs = ch.chapData.subheadings.filter(s => parseInt(s.verseId, 10) <= vNum);
                  if (applicableSubs.length > 0) {
                    const activeSub = applicableSubs.reduce((max, s) => parseInt(s.verseId, 10) > parseInt(max.verseId, 10) ? s : max, applicableSubs[0]);
                    subtitleText = activeSub.title.replace(/\(([^)]+)\)/g, '').replace(/[;\s]+$/, '').trim();
                    subtitleId = activeSub.verseId.toString();
                  }
                }

                if (!subtitleText) {
                  subtitleText = `${cNum}장 읽기`;
                  subtitleId = `${cNum}-read`;
                }

                // Real-time tracking visual feed update on scroll end
                setDetectedVerse(`${cNum}:${vNum}`);

                if (!isPlanMode) {
                  updateHistoryLog(vNum, subtitleId, subtitleText, bId, ch.bookName, cNum);
                }
              }
            }
          }
        }
      }, 200);
    };

    // Scan once initially upon reading page load
    handleScrollOrLoad();

    window.addEventListener('scroll', handleScrollOrLoad, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrLoad);
      if (scrollStopTimer) clearTimeout(scrollStopTimer);
    };
  }, [chapters, updateHistoryLog, navigate]);

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
            setIsContinueMode(false);
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
    
    const sortedVerses = Array.from(selectedVerses).sort((a, b) => {
      const partsA = a.split('-').map(Number);
      const partsB = b.split('-').map(Number);
      if (partsA[0] !== partsB[0]) return partsA[0] - partsB[0];
      if (partsA[1] !== partsB[1]) return partsA[1] - partsB[1];
      return partsA[2] - partsB[2];
    });

    let copyText = "";
    let lastBookName = "";
    let lastChapter = -1;
    
    sortedVerses.forEach(id => {
      const [bIdStr, cStr, vStr] = id.split('-');
      const bId = parseInt(bIdStr);
      const chapter = parseInt(cStr);
      const verse = parseInt(vStr);
      
      const chapInfo = loadedChaptersRef.current.find(c => c.bookId == bId && c.chapData.c == chapter);
      if (chapInfo) {
        const verseData = chapInfo.chapData.v.find(v => v.v == verse);
        if (verseData) {
          if (chapInfo.bookName !== lastBookName) {
            if (copyText !== "") copyText += "\n";
            copyText += `${chapInfo.bookName}\n`;
            lastBookName = chapInfo.bookName;
            lastChapter = -1;
          }
          if (chapter !== lastChapter) {
            copyText += `[${chapter}장]\n`;
            lastChapter = chapter;
          }
          if (settings.bibleLanguage === 'en') {
            copyText += `${verse} ${verseData.en || ''}\n`;
          } else if (settings.bibleLanguage === 'ko-en') {
            copyText += `${verse} ${verseData.text}\n   ${verseData.en || ''}\n`;
          } else {
            copyText += `${verse} ${verseData.text}\n`;
          }
        }
      }
    });

    const textToCopy = copyText.trim();
    if (!textToCopy) {
      showToast('복사할 내용을 찾지 못했습니다.');
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('복사 완료 ✨');
        toggleSelectionMode();
      }).catch(err => {
        fallbackCopy(textToCopy);
      });
    } else {
      fallbackCopy(textToCopy);
    }
  };

  const handlePickPlanVerse = () => {
    if (!isPlanMode || selectedVerses.size === 0) return;
    
    // 가장 처음 선택된 구절(혹은 가장 위 구절)을 가져옵니다.
    const sortedVerses = Array.from(selectedVerses).sort((a, b) => {
      const partsA = a.split('-').map(Number);
      const partsB = b.split('-').map(Number);
      if (partsA[0] !== partsB[0]) return partsA[0] - partsB[0];
      if (partsA[1] !== partsB[1]) return partsA[1] - partsB[1];
      return partsA[2] - partsB[2];
    });

    const firstVerseId = sortedVerses[0];
    const [bIdStr, cStr, vStr] = firstVerseId.split('-');
    const bId = parseInt(bIdStr);
    const chapterNum = parseInt(cStr);
    const verse = parseInt(vStr);
    
    let pickedText = "";
    const chapInfo = loadedChaptersRef.current.find(c => c.bookId == bId && c.chapData.c == chapterNum);
    if (chapInfo) {
      const verseData = chapInfo.chapData.v.find(v => v.v == verse);
      if (verseData) {
        pickedText = `${chapInfo.bookName} ${chapterNum},${verse}: ${verseData.text}`;
      }
    }

    if (!pickedText) {
      showToast('구절을 찾을 수 없습니다.');
      return;
    }

    // 🌟 [추가] 클립보드 자동 복사
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pickedText).catch(err => console.error(err));
    } else {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = pickedText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error(err);
      }
    }

    // 로컬 스토리지 업데이트
    const savedPlanStr = localStorage.getItem('bible_reading_plan');
    if (savedPlanStr) {
      try {
        const planObj = JSON.parse(savedPlanStr);
        const daySchedule = planObj.schedule.find(d => d.day === planDay);
        if (daySchedule) {
          const item = daySchedule.items.find(i => i.bookId === bId && i.chapter == chapterNum);
          if (item) {
            item.isCompleted = true;
            item.pickedVerse = pickedText;
            localStorage.setItem('bible_reading_plan', JSON.stringify(planObj));
            showToast('복사 완료 및 통독 구절이 저장되었습니다! 🎉');
            setTimeout(() => {
              navigate('/plan');
            }, 1000);
            return;
          }
        }
      } catch(e) {
        console.error(e);
      }
    }
    
    showToast('스케줄 저장에 실패했습니다.');
  };

  // 🌟 [추가] 통독 장 완료 핸들러
  const handleFinishChapter = (bookId, chapterNum) => {
    const sortedVerses = Array.from(selectedVerses).filter(id => {
      const [bIdStr, cStr] = id.split('-');
      return parseInt(bIdStr) === bookId && parseInt(cStr) === chapterNum;
    });

    if (sortedVerses.length > 0) {
      handlePickPlanVerse();
    } else {
      setIsSelectionMode(true);
      showToast('마음에 와닿는 구절을 하나 선택해 주세요. ✨');
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
      showToast('복사 완료 ✨');
      toggleSelectionMode();
    } catch (err) {
      showToast('복사에 실패했습니다.');
    }
  };

  const handleBookmark = () => {
    if (selectedVerses.size === 0) return;
    
    // Sort selected verses to make range correct
    const sortedSelected = Array.from(selectedVerses).sort((a, b) => {
      const [, , vA] = a.split('-');
      const [, , vB] = b.split('-');
      return parseInt(vA, 10) - parseInt(vB, 10);
    });

    // Extract bookId, chapter, and calculate verse range
    const firstId = sortedSelected[0];
    const [bIdStr, cStr] = firstId.split('-');
    const bId = parseInt(bIdStr, 10);
    const chapter = parseInt(cStr, 10);

    // Get list of verses to assemble content
    const versesList = sortedSelected.map(id => parseInt(id.split('-')[2], 10));
    
    // Calculate verseRange (ex: "5" or "1-3" or "2,4,5" - let's make it beautiful)
    let verseRange = "";
    if (versesList.length === 1) {
      verseRange = String(versesList[0]);
    } else {
      const minV = Math.min(...versesList);
      const maxV = Math.max(...versesList);
      // Check if consecutive
      const isConsecutive = versesList.every((v, index) => index === 0 || v === versesList[index - 1] + 1);
      if (isConsecutive) {
        verseRange = `${minV}-${maxV}`;
      } else {
        verseRange = versesList.join(',');
      }
    }

    // Assemble bookName and content
    const chapInfo = loadedChaptersRef.current.find(c => c.bookId == bId && c.chapData.c == chapter);
    const bookName = chapInfo ? chapInfo.bookName : `성경 ${bId}`;
    
    // Concatenate verse text
    const textPieces = [];
    sortedSelected.forEach(id => {
      const verseNum = parseInt(id.split('-')[2], 10);
      if (chapInfo) {
        const verseData = chapInfo.chapData.v.find(v => v.v == verseNum);
        if (verseData) {
          textPieces.push(verseData.text);
        }
      }
    });
    const content = textPieces.join(' ');

    // Call saveMyVerse from useBible context!
    saveMyVerse({
      bookId: bIdStr,
      bookName,
      chapter,
      verseRange,
      content
    });

    showToast('책갈피에 저장되었습니다. ✨');
    toggleSelectionMode();
  };

  const renderSubheading = (subheadingObj, bookId, chapterNum, currentVerseNum, chapterData) => {
    const activeLanguage = settings.bibleLanguage;
    const rawTitle = activeLanguage === 'en' ? subheadingObj.enTitle : subheadingObj.title;

    if (!rawTitle) return null;

    // 모든 괄호 (...) 내용을 찾아냄
    const matches = [...rawTitle.matchAll(/\(([^)]+)\)/g)];
    const mainTitle = rawTitle.replace(/\(([^)]+)\)/g, '').replace(/[;\s]+$/, '').trim();

    if (!mainTitle) return null;
    
    let allLinks = [];
    matches.forEach(match => {
      const inner = match[1];
      const splitLinks = inner.split(';').map(l => l.trim()).filter(l => l);
      allLinks = [...allLinks, ...splitLinks];
    });

    // Find next subheading verse to know the range
    let endVerse = chapterData.v[chapterData.v.length - 1].v;
    if (chapterData.subheadings) {
       const nextSub = chapterData.subheadings.find(s => parseInt(s.verseId) > parseInt(currentVerseNum));
       if (nextSub) endVerse = parseInt(nextSub.verseId) - 1;
    }

    const subId = `sub-${bookId}-${chapterNum}-${currentVerseNum}`;
    const isSpeakingThis = speakingVerseId === subId;

    return (
      <div 
        id={subId}
        className={`subheading-group ${isSpeakingThis ? 'tts-highlight' : ''}`} 
        onClick={() => toggleGroupSelection(bookId, chapterNum, currentVerseNum, endVerse)} 
        style={{ cursor: isSelectionMode ? 'pointer' : 'default' }}
      >
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

  const isHeaderAndFooterVisible = isBarsVisible || isSelectionMode;

  const readerStyles = {
    fontSize: `${settings.fontSize}px`,
    fontWeight: settings.fontWeight,
    lineHeight: settings.lineHeight,
    paddingLeft: `${settings.horizontalPadding}rem`,
    paddingRight: `${settings.horizontalPadding}rem`,
    fontFamily: settings.fontFamily !== 'System Default' ? settings.fontFamily : 'inherit'
  };

  return (
    <>
      <header className="reader-header-v2" style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'flex-end', 
        padding: 'env(safe-area-inset-top, 0px) 10px 0 10px', 
        height: 'calc(32px + env(safe-area-inset-top, 0px))', 
        width: '100%', 
        position: 'sticky', 
        top: 0, 
        zIndex: 1000, 
        backgroundColor: 'var(--header-bg)', 
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
        boxSizing: 'border-box',
        transition: 'transform 0.3s ease-in-out',
        transform: isHeaderAndFooterVisible ? 'translateY(0)' : 'translateY(-100%)'
      }}>
        {/* 중앙 정렬된 타이틀 (클릭 시 뒤로가기) */}
        <div className="header-title-container" onClick={() => navigate(-1)} style={{ 
          position: 'absolute',
          left: '50%',
          top: 'calc(50% + env(safe-area-inset-top, 0px) / 2)',
          transform: 'translate(-50%, -50%)',
          display: 'flex', 
          alignItems: 'center', 
          textAlign: 'center',
          justifyContent: 'center',
          maxWidth: '65%',
          minWidth: 0,
          cursor: 'pointer',
          zIndex: 1001,
          paddingRight: 0 /* absolute 중앙 정렬을 위해 우측 패딩 제거 */
        }}>
          <h1 className={isContinueMode ? "reader-header-title-continue" : ""} style={{ 
            fontSize: 'min(4.5vw, 1.12rem)', 
            fontWeight: 'bold', 
            color: 'var(--text-color)', 
            margin: 0,
            lineHeight: '1.2',
            letterSpacing: '-0.03em',
            wordBreak: 'keep-all',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {settings.bibleLanguage === 'en' 
              ? `${activeChapterInfo.bookEnName || activeChapterInfo.full} ${activeChapterInfo.chapter}`
              : `${activeChapterInfo.full} ${activeChapterInfo.chapter}`}
          </h1>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', zIndex: 1002, height: '100%' }}>
          {isSelectionMode ? (
            <>
              <button className="action-btn action-copy" onClick={handleCopy} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              {isPlanMode && (
                <button 
                  className="action-btn" 
                  onClick={handlePickPlanVerse} 
                  style={{ width: 'auto', padding: '0 12px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 'bold', border: 'none' }}
                >
                  ✨ 통독 구절로 뽑기
                </button>
              )}
              <button className="action-btn action-cancel" onClick={toggleSelectionMode} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              <button className="action-btn action-bookmark" onClick={handleBookmark} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/><line x1="12" x2="12" y1="7" y2="13"/><line x1="15" x2="9" y1="10" y2="10"/></svg>
              </button>
            </>
          ) : (
            <button className="header-btn" onClick={toggleSelectionMode} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
          )}
        </div>
      </header>
      
      <div className="reader-container" style={{ ...readerStyles, paddingBottom: isSelectionMode ? '20px' : '80px' }}>
        <div ref={topSentinelRef} style={{ height: '1px', width: '100%' }}></div>

        {chapters.map((ch) => (
          <div key={ch.key} className="chapter-container" style={{ paddingBottom: '40px' }}>
            <h2 
              id={`chap-${ch.bookId}-${ch.chapData.c}`}
              className="chapter-title"
              onClick={() => toggleGroupSelection(ch.bookId, ch.chapData.c, 1, ch.chapData.v[ch.chapData.v.length - 1].v)}
              style={{ cursor: isSelectionMode ? 'pointer' : 'default' }}
            >
              {settings.bibleLanguage === 'en'
                  ? `${ch.bookEnName || ch.bookName} Chapter ${ch.chapData.c}`
                  : `${ch.bookName} ${ch.chapData.c}장`}
            </h2>
            
            {ch.chapData.v.map((verse, idx) => {
              const subheading = ch.chapData.subheadings?.find(s => s.verseId === verse.v);
              const verseId = `${ch.bookId}-${ch.chapData.c}-${verse.v}`;
              const isSelected = selectedVerses.has(verseId);
              
              return (
                <div key={idx} id={`v-${verseId}`}>
                  {subheading && renderSubheading(subheading, ch.bookId, ch.chapData.c, verse.v, ch.chapData)}
                    <div 
                      className={`verse ${isSelectionMode ? 'selectable' : ''} ${isSelected ? 'verse-selected' : ''} ${speakingVerseId === `v-${verseId}` ? 'tts-highlight' : ''}`}
                      onClick={() => toggleVerseSelection(verseId)}
                      style={{ 
                        marginBottom: `${settings.verseSpacing}rem`,
                        padding: `${settings.verseSpacing * 4}px 0`
                      }}
                    >
                    <span 
                      className="verse-num" 
                      style={{ 
                        fontSize: `calc(${settings.fontSize}px - 2px)`,
                        color: isSelected ? '#808000' : '#78909c' 
                      }}
                    >
                      {verse.v}
                    </span>
                    {settings.bibleLanguage === 'en' ? (
                      <span className="verse-text">{verse.en || '(No English translation)'}</span>
                    ) : settings.bibleLanguage === 'ko-en' ? (
                      <span className="verse-text-group" style={{ display: 'inline' }}>
                        <span className="verse-text">{verse.text}</span>
                        {verse.en && (
                          <span className="verse-text en-text" style={{ 
                            fontSize: '0.96em', 
                            opacity: 0.75, 
                            display: 'block', 
                            paddingLeft: '8px',
                            marginLeft: '4px',
                            borderLeft: '1px solid rgba(128, 128, 128, 0.45)',
                            marginTop: '4px',
                            lineHeight: '1.4',
                            wordBreak: 'break-word',
                            fontStyle: 'italic',
                            color: 'var(--text-color)'
                          }}>{verse.en}</span>
                        )}
                      </span>
                    ) : (
                      <span className="verse-text">{verse.text}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {isPlanMode && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px', padding: '0 16px' }}>
                <button
                  onClick={() => handleFinishChapter(ch.bookId, ch.chapData.c)}
                  style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: '14px 20px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(166, 75, 42, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'transform 0.2s, opacity 0.2s'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {ch.bookName} {ch.chapData.c}장 읽기 마침
                </button>
              </div>
            )}
          </div>
        ))}

        <div ref={bottomSentinelRef} style={{ height: '1px', width: '100%' }}></div>
      </div>

      {toast && (
        <div className="toast-container">
          <div className="toast">{toast}</div>
        </div>
      )}
      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />






      {/* 📱 OLED Saver & Pocket Lock Overlay Screen */}
      {isScreenDimmed && (
        <div 
          onClick={exitScreenDim}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000000',
            zIndex: 99999, // Super high z-index to cover everything!
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* Subtle OLED-safe elegant icon and guide text */}
          <div style={{ opacity: 0.15, textAlign: 'center', color: '#ffffff' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ marginBottom: '12px', display: 'inline-block' }}>
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            </svg>
            <p style={{ fontSize: '0.85rem', fontWeight: '300', letterSpacing: '0.05em', margin: '4px 0 0 0' }}>
              듣기 전용 화면보호 잠금 상태
            </p>
            <p style={{ fontSize: '0.68rem', opacity: 0.7, marginTop: '6px', margin: 0 }}>
              (아무 곳이나 터치하면 잠금이 해제됩니다)
            </p>
          </div>
        </div>
      )}
    </>
  );
}
