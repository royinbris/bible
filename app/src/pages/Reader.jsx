import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, Fragment } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata } from '../lib/bibleInfo';
import { useSettings } from '../context/SettingsContext';
import { useBible } from '../context/BibleContext';
import SettingsSheet from '../components/SettingsSheet';
import { useSimpleTTS } from '../hooks/useSimpleTTS';

export default function Reader() {
  const { bookId, chapter } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [detectedVerse, setDetectedVerse] = useState('');
  const [ttsItems, setTtsItems] = useState([]);
  const [isScreenDimmed, setIsScreenDimmed] = useState(false);

  // Auto clear screen dimmer if TTS stops speaking
  useEffect(() => {
    if (!isSpeaking) {
      setIsScreenDimmed(false);
    }
  }, [isSpeaking]);

  // Sync body class when TTS 낭독 is active
  useEffect(() => {
    document.body.classList.toggle('tts-active', isSpeaking);
    return () => {
      document.body.classList.remove('tts-active');
    };
  }, [isSpeaking]);

  // TTS Scanned items synchronizer
  useEffect(() => {
    if (!chapters || chapters.length === 0) return;
    const items = [];
    chapters.forEach(ch => {
      // Prepend Chapter Title first so the TTS reads it gracefully!
      const bookMeta = bibleMetadata[ch.bookName] || { full: ch.bookName };
      const bookFullName = bookMeta.full || ch.bookName;
      const chapterSuffix = ch.bookName === '시편' ? '편' : '장';
      const chapterTitle = `${bookFullName} ${ch.chapData.c}${chapterSuffix}`;
      
      items.push({
        id: `chap-${ch.bookId}-${ch.chapData.c}`,
        text: chapterTitle,
        type: 'chapter'
      });

      ch.chapData.v.forEach(verse => {
        const subheading = ch.chapData.subheadings?.find(s => s.verseId === verse.v);
        if (subheading) {
          items.push({
            id: `sub-${ch.bookId}-${ch.chapData.c}-${verse.v}`,
            text: subheading.title,
            type: 'subheading'
          });
        }
        items.push({
          id: `v-${ch.bookId}-${ch.chapData.c}-${verse.v}`,
          text: verse.text,
          type: 'verse'
        });
      });
    });
    setTtsItems(items);
  }, [chapters]);

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
        const meta = bibleMetadata[foundBook.name] || { full: foundBook.name, abbrev: foundBook.name };
        setActiveChapterInfo({ 
          bookId: foundBook.id, 
          bookName: foundBook.name, 
          chapter: foundChap.c,
          full: meta.full,
          abbrev: meta.abbrev
        });
        localStorage.setItem('lastRead', JSON.stringify({ bookId: foundBook.id, chapter: foundChap.c }));
        
        let initialSubtitle = '';
        if (foundChap.subheadings && foundChap.subheadings.length > 0) {
          const firstSub = foundChap.subheadings[0];
          initialSubtitle = firstSub.title.replace(/\(([^)]+)\)/g, '').replace(/[;\s]+$/, '').trim();
        } else {
          initialSubtitle = `${foundChap.c}장 읽기`;
        }

        // Add to reading history log
        addHistoryLog(foundBook.id, foundBook.name, foundChap.c, 1, '', initialSubtitle);
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

  // Observer to update the header and URL when a chapter enters view (Realtime high-speed scroll observer)
  useEffect(() => {
    const chapterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
            const idParts = entry.target.id.split('-');
            const bId = parseInt(idParts[1]);
            const cNum = parseInt(idParts[2]);
            const ch = loadedChaptersRef.current.find(c => c.bookId === bId && c.chapData.c === cNum);
            if (ch) {
              const meta = bibleMetadata[ch.bookName] || { full: ch.bookName, abbrev: ch.bookName };
              setActiveChapterInfo({ 
                bookId: ch.bookId, 
                bookName: ch.bookName, 
                chapter: ch.chapData.c,
                full: meta.full,
                abbrev: meta.abbrev
              });
              localStorage.setItem('lastRead', JSON.stringify({ bookId: bId, chapter: cNum }));
              navigate(`/read/${bId}/${cNum}`, { replace: true });
            }
        }
      });
    }, { rootMargin: '-80px 0px -85% 0px' });

    document.querySelectorAll('.chapter-container').forEach(el => chapterObserver.observe(el));

    return () => chapterObserver.disconnect();
  }, [chapters, navigate]);

  // Observer to update the active verse number in Reading History (Debounced to 1000ms after scrolling stops)
  useEffect(() => {
    let scrollTimer = null;
    let scrollStopTimer = null;

    const handleScrollOrLoad = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      if (scrollStopTimer) clearTimeout(scrollStopTimer);

      const targetY = 120; // 120px absolute scanner line
      const verses = document.querySelectorAll('.verse');
      let activeVerseElement = null;
      let minDiff = Infinity;

      // 1. [Live Debounced Scanner] Scan closest verse to the upper 120px scanning thread while reading smoothly
      scrollTimer = setTimeout(() => {
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

              // Pass actual subtitleId to successfully pass 'if (subtitleId)' in BibleContext.jsx
              updateHistoryLog(vNum, subtitleId, subtitleText, bId, ch ? ch.bookName : '', cNum);
            }
          }
        }
      }, 100); // 100ms quick update for highly responsive reading flow

      // 2. [Ultra-Guard 1s Stop Tracker] Once scrolling has completely ceased for 1 second,
      // strictly verify the active chapter route and force correct any high-speed inertia skips!
      scrollStopTimer = setTimeout(() => {
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
                    chapter: cNum,
                    full: meta.full,
                    abbrev: meta.abbrev
                  });
                  localStorage.setItem('lastRead', JSON.stringify({ bookId: bId, chapter: cNum }));
                  navigate(`/read/${bId}/${cNum}`, { replace: true });
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

                // Pass actual subtitleId to successfully pass 'if (subtitleId)' in BibleContext.jsx
                updateHistoryLog(vNum, subtitleId, subtitleText, bId, ch.bookName, cNum);
              }
            }
          }
        }
      }, 700);
    };

    // Scan once initially upon reading page load
    handleScrollOrLoad();

    window.addEventListener('scroll', handleScrollOrLoad, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrLoad);
      if (scrollTimer) clearTimeout(scrollTimer);
      if (scrollStopTimer) clearTimeout(scrollStopTimer);
    };
  }, [chapters, updateHistoryLog]);

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
          copyText += `${verse} ${verseData.text}\n`;
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
        justifyContent: 'space-between', 
        padding: 'env(safe-area-inset-top, 0px) 10px 0 10px', 
        height: 'calc(75px + env(safe-area-inset-top, 0px))', 
        width: '100%', 
        position: 'sticky', 
        top: 0, 
        zIndex: 1000, 
        backgroundColor: 'var(--header-bg)', 
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
        boxSizing: 'border-box'
      }}>
        <div className="header-left" onClick={() => navigate(-1)} style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'flex-start', 
          gap: '4px', 
          flex: 1, 
          marginRight: '4px', 
          textAlign: 'left',
          cursor: 'pointer', /* Added to indicate clickability */
          minWidth: 0
        }}>
          <button className="header-back-btn" style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            cursor: 'pointer',
            color: 'var(--text-color)',
            pointerEvents: 'none' /* Let the parent handle the click */
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div className="header-title-container" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            textAlign: 'left',
            justifyContent: 'flex-start',
            flex: 1,
            minWidth: 0
          }}>
            <h1 className={isContinueMode ? "reader-header-title-continue" : ""} style={{ 
              fontSize: activeChapterInfo.full && activeChapterInfo.full.length > 15 
                ? 'min(4.3vw, 1.02rem)' 
                : (activeChapterInfo.full && activeChapterInfo.full.length > 8 ? 'min(4.8vw, 1.12rem)' : 'min(5.2vw, 1.2rem)'), 
              fontWeight: 'bold', 
              color: 'var(--text-color)', 
              margin: 0,
              lineHeight: activeChapterInfo.full && activeChapterInfo.full.length > 15 ? '1.2' : '1.25',
              letterSpacing: activeChapterInfo.full && activeChapterInfo.full.length > 15 
                ? '-0.07em' 
                : (activeChapterInfo.full && activeChapterInfo.full.length > 8 ? '-0.04em' : 'normal'),
              wordBreak: 'keep-all',
              whiteSpace: 'normal',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {activeChapterInfo.full}
            </h1>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {isSelectionMode ? (
            <>
              <button className="action-btn action-copy" onClick={handleCopy} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button className="action-btn action-cancel" onClick={toggleSelectionMode} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              <button className="action-btn action-bookmark" onClick={handleBookmark} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/><line x1="12" x2="12" y1="7" y2="13"/><line x1="15" x2="9" y1="10" y2="10"/></svg>
              </button>
            </>
          ) : (
            <>
              {/* 장 숫자 전용 규격 버튼 */}
              <div style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                color: '#e60026', // Vibrant bright liturgic red
                fontSize: '1.25rem',
                flexShrink: 0
              }}>
                {activeChapterInfo.chapter}
              </div>
              <button className="header-btn" onClick={() => navigate('/')} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </button>
              <button className="header-btn" onClick={toggleSelectionMode} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button className="header-btn" onClick={() => navigate('/search')} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </button>
              <button className="header-btn" onClick={() => setIsSettingsOpen(true)} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.72V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </>
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
                      className={`verse ${isSelectionMode ? 'selectable' : ''} ${isSelected ? 'verse-selected' : ''} ${speakingVerseId === `v-${verseId}` ? 'tts-highlight' : ''}`}
                      onClick={() => toggleVerseSelection(verseId)}
                      style={{ 
                        marginBottom: `${settings.verseSpacing}rem`,
                        paddingTop: `${settings.verseSpacing * 4}px`,
                        paddingBottom: `${settings.verseSpacing * 4}px`
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
                    <span className="verse-text">{verse.text}</span>
                  </div>
                </div>
              );
            })}
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


      {/* 🎙️ Symmetrical Floating TTS FAB - Symmetrical to Left History FAB */}
      {!isSpeaking && (
        <button 
          className="floating-tts-btn" 
          onClick={ttsHandlers.play}
          title="낭독 시작"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" x2="12" y1="19" y2="22"/>
          </svg>
        </button>
      )}

      {/* 🎙️ Premium Floating Morphing Bottom Bar - Only shown when active playing */}
      {isSpeaking && (
        <div className="floating-bottom-bar">
          {/* 📱 OLED Screen Saver & Lock Button (Far Left) */}
          <button 
            className="floating-bar-btn" 
            onClick={() => setIsScreenDimmed(true)} 
            title="화면 어둡게 (듣기 전용 화면보호기)"
          >
            {/* Filled square icon - stop shape but inside is completely filled with solid color */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            </svg>
          </button>

          <button className="floating-bar-btn" onClick={ttsHandlers.prev} title="이전 구절">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>
          </button>
          
          {isPaused ? (
            <button className="floating-bar-btn btn-play-main" onClick={ttsHandlers.resume} title="다시 재생">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(1px)' }}><polygon points="6 3 20 12 6 21 6 3"/></svg>
            </button>
          ) : (
            <button className="floating-bar-btn btn-play-main" onClick={ttsHandlers.pause} title="일시 정지">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="4" y2="20"/><line x1="6" x2="6" y1="4" y2="20"/></svg>
            </button>
          )}

          <button className="floating-bar-btn" onClick={ttsHandlers.next} title="다음 구절">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>
          </button>

          <div className="floating-bar-divider"></div>

          <button className="floating-bar-btn" onClick={ttsHandlers.stop} style={{ color: '#ef4444' }} title="낭독 정지">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>
          </button>
        </div>
      )}

      {/* 📱 OLED Saver & Pocket Lock Overlay Screen */}
      {isScreenDimmed && (
        <div 
          onClick={() => setIsScreenDimmed(false)}
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
