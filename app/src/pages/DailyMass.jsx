import { useState, useEffect, useRef, useLayoutEffect, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import SettingsSheet from '../components/SettingsSheet';
import { useSettings } from '../context/SettingsContext';
import { BIBLE_DB_KEY } from '../lib/bibleInfo';
import HistorySheet from '../components/HistorySheet';
import { useSimpleTTS } from '../hooks/useSimpleTTS';
import { useBible } from '../context/BibleContext';

// 💡 상단 헤더(뒤로가기, 날짜 조절, 설정 버튼 등)를 다시 활성화하려면 이 값을 true로 변경하세요.
const SHOW_HEADER = false;

export default function DailyMass() {
  const navigate = useNavigate();
  const { settings, updateSetting } = useSettings();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [readings, setReadings] = useState([]);
  const [activeTab, setActiveTab] = useState('ko'); // 'ko' = 한글미사, 'en' = 영어미사
  const [isHeaderVisible, setIsHeaderVisible] = useState(true); // 헤더 표시 여부 (SHOW_HEADER가 true일 때 작동)
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(true); // 하단막대 표시 여부

  // ◉ 확장 메뉴 토글 상태
  const [isExpandedMenuOpen, setIsExpandedMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [ttsItems, setTtsItems] = useState([]);

  // 🎙️ TTS 상태 및 훅 바인딩
  const { isSpeaking, isPaused, ttsSpeed, setTtsSpeed, ttsHandlers } = useBible();
  const ttsHook = useSimpleTTS(ttsItems);

  // 🎙️ Iframe 내부 텍스트 추출 함수
  const getIframeTTSItems = () => {
    const iframe = document.querySelector('iframe');
    if (!iframe) return [];
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return [];

    const items = [];
    let index = 0;

    // CBCK(한글미사)와 Universalis(영어미사) 본문 텍스트 추출
    const elements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, td, div.content, div.text');
    
    elements.forEach(el => {
      if (el.offsetParent === null) return;
      
      const text = el.innerText?.trim();
      if (!text || text.length < 2) return;
      
      if (
        text.includes('Universalis') || 
        text.includes('Copyright') || 
        text.includes('cbck.or.kr') ||
        text.includes('주교회의') ||
        text.includes('한국천주교') ||
        text.includes('로그인') ||
        text.includes('마이페이지') ||
        text.includes('설정')
      ) return;

      if (el.closest('header') || el.closest('footer') || el.closest('nav') || el.closest('.menu') || el.closest('#menu') || el.closest('.navigation') || el.closest('.nav')) return;

      if (items.some(item => item.text.includes(text) || text.includes(item.text))) {
        return;
      }

      items.push({
        id: `mass-tts-${index++}`,
        text: text,
        type: el.tagName.toLowerCase().startsWith('h') ? 'subheading' : 'verse'
      });
    });

    return items;
  };

  const handlePlayTTS = () => {
    const items = getIframeTTSItems();
    if (items.length === 0) {
      alert('낭독할 미사 본문 텍스트를 찾을 수 없습니다.');
      return;
    }
    setTtsItems(items);
    setTimeout(() => {
      if (ttsHandlers && typeof ttsHandlers.play === 'function') {
        ttsHandlers.play();
      }
    }, 100);
  };

  // 📖 성경 구절 오버레이 시트 상태
  const [selectedOverlayReading, setSelectedOverlayReading] = useState(null); // { bookId, chapter, verse, bookName, range } | null
  const [overlayChapters, setOverlayChapters] = useState([]); // [{ bookId, bookName, bookEnName, chapter, verses, subheadings }]
  const [overlayBookName, setOverlayBookName] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [isOpened, setIsOpened] = useState(false);
  const [totalChapters, setTotalChapters] = useState(0);
  
  // 🖐️ 드래그 앤 드롭 제스처 상태
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const currentTranslateY = useRef(0);
  const dragHandleRef = useRef(null);

  // 오버레이가 활성화될 때 트랜지션을 위한 감지 Effect
  useEffect(() => {
    if (selectedOverlayReading) {
      requestAnimationFrame(() => {
        setIsOpened(true);
      });
    } else {
      setIsOpened(false);
    }
  }, [selectedOverlayReading]);

  // 오버레이 닫기 핸들러 (슬라이드 애니메이션 적용)
  const handleCloseOverlay = () => {
    setIsClosing(true);
    setIsOpened(false);
    setTimeout(() => {
      setSelectedOverlayReading(null);
      setIsClosing(false);
      setTranslateY(0);
    }, 500); // 500ms 애니메이션 시간 동안 대기 (더 부드러운 전환)
  };

  // 오버레이에서 전체 화면 성경 읽기 모드로 전환
  const handleOpenInReader = () => {
    if (selectedOverlayReading) {
      handleCloseOverlay();
      navigate(`/read/${selectedOverlayReading.bookId}/${selectedOverlayReading.chapter}`);
    }
  };

  const hasScrolledRef = useRef(false);
  const loadingPrevRef = useRef(false);
  const loadingNextRef = useRef(false);
  const pendingScrollTargetRef = useRef(null);
  const scrollAdjustmentRef = useRef({ pending: false, oldScrollHeight: 0, oldScrollTop: 0 });
  const allBooksRef = useRef(null);
  const topSentinelRef = useRef(null);
  const bottomSentinelRef = useRef(null);

  // 최초 진입 시 성경 전체 데이터를 메모리에 프리로드하여 스크롤 중 디스크 I/O 병목 방지
  useEffect(() => {
    localforage.getItem(BIBLE_DB_KEY).then(data => {
      if (data && data.books) {
        allBooksRef.current = data.books;
      }
    }).catch(err => {
      console.error('Failed to preload bible books in memory:', err);
    });
  }, []);

  // 이전 장이 추가되어 DOM이 업데이트된 직후 동기적으로 스크롤을 보정 또는 타겟으로 이동
  useLayoutEffect(() => {
    const container = document.getElementById('overlay-scroll-container');
    if (!container) return;

    if (pendingScrollTargetRef.current) {
      const targetEl = document.getElementById(pendingScrollTargetRef.current);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
      pendingScrollTargetRef.current = null;
    } else if (scrollAdjustmentRef.current.pending) {
      const newScrollHeight = container.scrollHeight;
      const { oldScrollHeight, oldScrollTop } = scrollAdjustmentRef.current;
      const heightDiff = newScrollHeight - oldScrollHeight;
      container.scrollTop = oldScrollTop + heightDiff;
      scrollAdjustmentRef.current.pending = false;
    }
  }, [overlayChapters]);

  // 오버레이 새로 열 때만 스크롤 센서 리셋 (chapter 변경은 스크롤로 인한 것일 수 있으므로 제외)
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [selectedOverlayReading?.bookId, selectedOverlayReading?.type]);

  // 헤더 화살표 클릭 시 이전 장 이동 (로드되어 있으면 스크롤, 미로드 시 상태 변경)
  const handleHeaderPrevChapter = () => {
    if (!selectedOverlayReading) return;
    const currentChapNum = selectedOverlayReading.chapter;
    if (currentChapNum <= 1) return;
    
    const prevChap = overlayChapters.find(ch => ch.chapter === currentChapNum - 1);
    if (prevChap) {
      const targetEl = document.getElementById(`overlay-v-${prevChap.bookId}-${prevChap.chapter}-1`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      // 미로드 장 이동 시에만 초기 스크롤 리셋 (의도적 이동)
      hasScrolledRef.current = false;
      setSelectedOverlayReading(prev => ({
        ...prev,
        chapter: currentChapNum - 1,
        verse: 1,
        range: `${currentChapNum - 1}장`
      }));
    }
  };

  // 헤더 화살표 클릭 시 다음 장 이동
  const handleHeaderNextChapter = () => {
    if (!selectedOverlayReading) return;
    const currentChapNum = selectedOverlayReading.chapter;
    if (currentChapNum >= totalChapters) return;
    
    const nextChap = overlayChapters.find(ch => ch.chapter === currentChapNum + 1);
    if (nextChap) {
      const targetEl = document.getElementById(`overlay-v-${nextChap.bookId}-${nextChap.chapter}-1`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      // 미로드 장 이동 시에만 초기 스크롤 리셋 (의도적 이동)
      hasScrolledRef.current = false;
      setSelectedOverlayReading(prev => ({
        ...prev,
        chapter: currentChapNum + 1,
        verse: 1,
        range: `${currentChapNum + 1}장`
      }));
    }
  };

  // 무한 스크롤 감지 및 비동기 프리로드 트리거
  const handleOverlayScroll = (e) => {
    // 초기 정렬 스크롤이 진행 중일 때는 센서 무시 (레이아웃 틀어짐 방지)
    if (!hasScrolledRef.current) return;

    const container = e.currentTarget;
    updateVisibleChapterInHeader(container);
  };

  // 인접 장들을 한꺼번에 가져오는 헬퍼 함수 (Reader.jsx와 동일한 로직)
  const getAdjacentChapters = useCallback((startBookId, startChapterNum, direction, count) => {
    if (!allBooksRef.current) return [];
    const results = [];
    let currentCNum = startChapterNum;

    const book = allBooksRef.current.find(b => b.id === startBookId);
    if (!book) return [];

    for (let i = 0; i < count; i++) {
      const nextChapterNum = currentCNum + direction;
      if (nextChapterNum >= 1 && nextChapterNum <= book.chapters.length) {
        currentCNum = nextChapterNum;
        const chapData = book.chapters.find(ch => ch.c === nextChapterNum);
        if (chapData) {
          results.push({
            bookId: book.id,
            bookName: book.name,
            bookEnName: book.enName,
            chapter: nextChapterNum,
            verses: chapData.v || [],
            subheadings: chapData.subheadings || []
          });
        }
      } else {
        break; // 한 성경 책 내에서만 이동
      }
    }
    return results;
  }, []);

  const loadPrevious = useCallback(() => {
    if (loadingPrevRef.current || overlayChapters.length === 0) return;
    
    const firstChap = overlayChapters[0];
    const prevChaps = getAdjacentChapters(firstChap.bookId, firstChap.chapter, -1, 3); // 3개 장씩 백그라운드 선제 로드
    
    if (prevChaps.length > 0) {
      loadingPrevRef.current = true;
      
      const container = document.getElementById('overlay-scroll-container');
      if (container) {
        scrollAdjustmentRef.current = {
          pending: true,
          oldScrollHeight: container.scrollHeight,
          oldScrollTop: container.scrollTop
        };
      }
      
      const newChaps = prevChaps.reverse();
      setOverlayChapters(prev => [...newChaps, ...prev]);
      
      setTimeout(() => {
        loadingPrevRef.current = false;
      }, 300);
    }
  }, [overlayChapters, getAdjacentChapters]);

  const loadNext = useCallback(() => {
    if (loadingNextRef.current || overlayChapters.length === 0) return;
    
    const lastChap = overlayChapters[overlayChapters.length - 1];
    const nextChaps = getAdjacentChapters(lastChap.bookId, lastChap.chapter, 1, 3); // 3개 장씩 백그라운드 선제 로드
    
    if (nextChaps.length > 0) {
      loadingNextRef.current = true;
      setOverlayChapters(prev => [...prev, ...nextChaps]);
      
      setTimeout(() => {
        loadingNextRef.current = false;
      }, 300);
    }
  }, [overlayChapters, getAdjacentChapters]);

  // 상단/하단 감지 센티넬을 위한 IntersectionObserver 적용 (Reader.jsx와 동일)
  useEffect(() => {
    const container = document.getElementById('overlay-scroll-container');
    if (!container) return;

    const topObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasScrolledRef.current) {
        loadPrevious();
      }
    }, { 
      root: container,
      rootMargin: '3000px 0px 0px 0px' // Reader.jsx와 동일한 3000px 여유 공간 확보
    });

    const bottomObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasScrolledRef.current) {
        loadNext();
      }
    }, { 
      root: container,
      rootMargin: '0px 0px 3000px 0px' // Reader.jsx와 동일한 3000px 여유 공간 확보
    });

    if (topSentinelRef.current) topObserver.observe(topSentinelRef.current);
    if (bottomSentinelRef.current) bottomObserver.observe(bottomSentinelRef.current);

    return () => {
      topObserver.disconnect();
      bottomObserver.disconnect();
    };
  }, [loadPrevious, loadNext, overlayChapters]);

  // 실시간 헤더 제목 동기화 스캔
  const updateVisibleChapterInHeader = (container) => {
    const chaptersElements = container.querySelectorAll('.chapter-container');
    const containerRect = container.getBoundingClientRect();
    const thresholdY = containerRect.top + 140;
    
    let activeChapterObj = null;
    for (const el of chaptersElements) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > thresholdY) {
        activeChapterObj = {
          bookId: parseInt(el.getAttribute('data-bookid'), 10),
          chapter: parseInt(el.getAttribute('data-chapter'), 10),
          bookName: el.getAttribute('data-bookname'),
          bookEnName: el.getAttribute('data-bookenname')
        };
        break;
      }
    }
    
    if (activeChapterObj && selectedOverlayReading) {
      setSelectedOverlayReading(prev => {
        if (!prev) return null;
        if (prev.bookId === activeChapterObj.bookId && prev.chapter === activeChapterObj.chapter) {
          return prev;
        }
        return {
          ...prev,
          bookId: activeChapterObj.bookId,
          chapter: activeChapterObj.chapter,
          bookName: activeChapterObj.bookName,
          range: `${activeChapterObj.chapter}장`
        };
      });
    }
  };

  // 오버레이 내부 병행 구절 링크 이동 핸들러
  const navigateToOverlayLink = (linkStr) => {
    const processLink = (books) => {
      if (!books) return;
      const match = linkStr.match(/^([\d]*\s*[가-힣]+)\s*(\d+)(?:,(\d+))?/);
      if (match) {
        const abbrev = match[1].trim();
        const chap = parseInt(match[2], 10);
        const verse = parseInt(match[3], 10) || 1;
        
        const targetBook = books.find(b => b.name.startsWith(abbrev) || abbrev.startsWith(b.name));
        if (targetBook) {
          setSelectedOverlayReading({
            bookId: targetBook.id,
            chapter: chap,
            verse: verse,
            type: selectedOverlayReading?.type || '독서1',
            lang: displayLanguage
          });
          setOverlayChapters([]);
        }
      }
    };

    if (allBooksRef.current) {
      processLink(allBooksRef.current);
    } else {
      localforage.getItem(BIBLE_DB_KEY).then(data => {
        const books = data && data.books;
        if (books) {
          allBooksRef.current = books;
        }
        processLink(books);
      }).catch(err => {
        console.error('Failed to navigate to overlay link:', err);
      });
    }
  };

  // 오버레이 전용 소제목 및 병행 구절 렌더러
  const renderOverlaySubheading = (subheadingObj) => {
    const rawTitle = displayLanguage === 'en' ? subheadingObj.enTitle : subheadingObj.title;
    if (!rawTitle) return null;

    const matches = [...rawTitle.matchAll(/\(([^)]+)\)/g)];
    const mainTitle = rawTitle.replace(/\(([^)]+)\)/g, '').replace(/[;\s]+$/, '').trim();

    if (!mainTitle) return null;
    
    let allLinks = [];
    matches.forEach(match => {
      const inner = match[1];
      const splitLinks = inner.split(';').map(l => l.trim()).filter(l => l);
      allLinks = [...allLinks, ...splitLinks];
    });

    return (
      <div className="subheading-group" style={{ marginTop: '20px', marginBottom: '10px' }}>
        <h3 className="reader-subheading" style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--ot-accent, #555d44)' }}>
          {mainTitle}
        </h3>
        {allLinks.length > 0 && (
          <div className="parallel-passages-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {allLinks.map((link, i) => (
              <Fragment key={i}>
                <span 
                  className="subheading-link" 
                  onClick={(e) => { e.stopPropagation(); navigateToOverlayLink(link); }}
                >
                  {link}
                </span>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 오버레이 열려있을 때 뒷배경 스크롤 방지
  useEffect(() => {
    if (selectedOverlayReading) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [selectedOverlayReading]);

  // iOS Safari 등에서의 고유 고무줄 바운스(러버밴딩) 차단을 위한 네이티브 터치 이벤트 바인딩
  useEffect(() => {
    const handle = dragHandleRef.current;
    if (!handle) return;

    const onTouchStart = (e) => {
      setIsDragging(true);
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      dragStartY.current = clientY;
    };

    const onTouchMove = (e) => {
      if (dragStartY.current === 0) return;
      if (e.cancelable) {
        e.preventDefault(); // 뒷화면 튕김/끌림 방지 핵심 코드
      }
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const diff = clientY - dragStartY.current;
      if (diff > 0) {
        setTranslateY(diff);
        currentTranslateY.current = diff;
      }
    };

    const onTouchEnd = () => {
      setIsDragging(false);
      if (currentTranslateY.current > 100) {
        handleCloseOverlay();
      } else {
        setTranslateY(0);
      }
      currentTranslateY.current = 0;
      dragStartY.current = 0;
    };

    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    handle.addEventListener('touchmove', onTouchMove, { passive: false }); // passive: false로 지정해야 preventDefault 작동
    handle.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      handle.removeEventListener('touchstart', onTouchStart);
      handle.removeEventListener('touchmove', onTouchMove);
      handle.removeEventListener('touchend', onTouchEnd);
    };
  }, [selectedOverlayReading]);

  // 언어 변경 핸들러
  const toggleLanguage = () => {
    const currentLang = selectedOverlayReading?.lang || settings.bibleLanguage || 'ko';
    let nextLang = 'ko';
    if (currentLang === 'ko') {
      nextLang = 'ko-en';
    } else if (currentLang === 'ko-en') {
      nextLang = 'en';
    } else if (currentLang === 'en') {
      nextLang = 'ko';
    }
    setSelectedOverlayReading(prev => prev ? { ...prev, lang: nextLang } : null);
  };

  // 날짜 조절 핸들러
  const handlePrevDate = () => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return next;
    });
  };

  const handleNextDate = () => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  // 날짜 텍스트 포맷팅 (5. 18. (월))
  const getFormattedDateString = (date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[date.getDay()];
    return `${month}. ${day}. (${dayOfWeek})`;
  };

  // YYYYMMDD 파싱
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const formattedDate = `${year}${month}${day}`;

  // Fetch parsed daily mass readings for shortcuts in background
  useEffect(() => {
    setReadings([]);
    
    fetch(`/api/mass?date=${formattedDate}&type=${activeTab}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.readings) {
          setReadings(data.readings);
        }
      })
      .catch(err => {
        console.error('Failed to fetch readings:', err);
      });
  }, [formattedDate, activeTab]);

  // 성경 구절 오버레이 로드 (초기 3개 장 병렬 프리로드)
  useEffect(() => {
    if (!selectedOverlayReading) {
      setOverlayChapters([]);
      setOverlayBookName('');
      setTotalChapters(0);
      return;
    }

    const { bookId, chapter } = selectedOverlayReading;
    
    const isAlreadyLoaded = overlayChapters.some(ch => ch.bookId === parseInt(bookId, 10) && ch.chapter === parseInt(chapter, 10));
    if (isAlreadyLoaded) {
      return;
    }

    const processInitialLoad = (books) => {
      if (!books) return;
      const foundBook = books.find(b => b.id === parseInt(bookId, 10));
      if (foundBook) {
        setOverlayBookName(foundBook.name);
        setTotalChapters(foundBook.chapters ? foundBook.chapters.length : 0);
        
        const chapsToLoad = [];
        const currentChapNum = parseInt(chapter, 10);
        
        for (let c = currentChapNum - 1; c <= currentChapNum + 1; c++) {
          if (c >= 1 && c <= foundBook.chapters.length) {
            const chapData = foundBook.chapters.find(ch => ch.c === c);
            if (chapData) {
              chapsToLoad.push({
                bookId: foundBook.id,
                bookName: foundBook.name,
                bookEnName: foundBook.enName,
                chapter: c,
                verses: chapData.v || [],
                subheadings: chapData.subheadings || []
              });
            }
          }
        }
        
        setOverlayChapters(chapsToLoad);
      }
    };

    if (allBooksRef.current) {
      processInitialLoad(allBooksRef.current);
    } else {
      localforage.getItem(BIBLE_DB_KEY).then(data => {
        const books = data && data.books;
        if (books) {
          allBooksRef.current = books;
        }
        processInitialLoad(books);
      }).catch(err => {
        console.error('Failed to load overlay verses:', err);
      });
    }
  }, [selectedOverlayReading]);

  // 오버레이가 로드되면 해당 시작 구절로 자동 스크롤 (상단 정렬)
  useEffect(() => {
    if (overlayChapters.length > 0 && selectedOverlayReading && !hasScrolledRef.current) {
      const { bookId, chapter, verse } = selectedOverlayReading;
      const targetId = `overlay-v-${bookId}-${chapter}-${verse}`;
      
      setTimeout(() => {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
          requestAnimationFrame(() => {
            hasScrolledRef.current = true;
          });
        }
      }, 100);
    }
  }, [overlayChapters, selectedOverlayReading]);

  // 프록시 HTML 주소로 변경하여 Same-Origin 상태에서 스크롤 수신
  const cbckLink = `/api/mass-html?type=ko&date=${formattedDate}`;
  const universalisLink = `/api/mass-html?type=en&date=${formattedDate}`;

  // iframe 내 스크롤 메세지 감지
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'iframeScroll') {
        if (event.data.direction === 'up') {
          setIsHeaderVisible(true);
          setIsBottomBarVisible(true);
        } else if (event.data.direction === 'down') {
          setIsHeaderVisible(false);
          setIsBottomBarVisible(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 🖐️ 오버레이 드래그 제스처 핸들러 (데스크톱 마우스 대응 전용)
  const handleDragStart = (e) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const diff = e.clientY - dragStartY.current;
    if (diff > 0) {
      setTranslateY(diff);
      currentTranslateY.current = diff;
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (currentTranslateY.current > 100) {
      handleCloseOverlay();
    } else {
      setTranslateY(0);
    }
    currentTranslateY.current = 0;
    dragStartY.current = 0;
  };

  // Find individual reading shortcuts
  const reading1 = readings.find(r => r.type === '독서1');
  const reading2 = readings.find(r => r.type === '독서2');
  const gospel = readings.find(r => r.type === '복음');

  // 독서 오버레이 스타일 (성경 읽기 설정 동기화)
  const overlayReaderStyles = {
    fontSize: `${settings.fontSize || 18}px`,
    fontWeight: settings.fontWeight || 400,
    lineHeight: settings.lineHeight || 1.5,
    fontFamily: settings.fontFamily !== 'System Default' ? settings.fontFamily : 'inherit',
    color: 'var(--text-color)'
  };

  // 드래그 높이 및 닫힘 상태에 따른 배경 불투명도 연동 계산
  const backdropOpacity = Math.max(0, 1 - translateY / (window.innerHeight * 0.8));
  const currentBackdropColor = (isClosing || !isOpened)
    ? 'rgba(0, 0, 0, 0)' 
    : `rgba(0, 0, 0, ${0.4 * backdropOpacity})`;

  // 오버레이 표시용 성경 번역 언어 (기본은 사용자 설정, 영어 미사일 때는 영어 우선)
  const displayLanguage = selectedOverlayReading
    ? (selectedOverlayReading.lang || settings.bibleLanguage || 'ko')
    : 'ko';

  return (
    <div className="search-wrapper" style={{ backgroundColor: 'var(--bg-color)', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      
      {/* 1. 상단 상태바 가림막 (시간/배터리 표시 영역 확보 - 상시 켜둠) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 'env(safe-area-inset-top, 20px)',
        backgroundColor: 'var(--bg-color)',
        zIndex: 110
      }} />

      {/* 2. 슬라이딩 토글 헤더 (SHOW_HEADER가 true일 때만 노출) */}
      {SHOW_HEADER && (
        <header className="home-header" style={{
          position: 'absolute',
          top: 'env(safe-area-inset-top, 20px)',
          left: 0,
          width: '100%',
          height: '56px',
          transform: isHeaderVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          backgroundColor: 'var(--bg-color)',
          boxSizing: 'border-box',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }} onClick={() => navigate('/')}>
            <button className="header-back-btn" style={{ pointerEvents: 'none' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>매일미사</span>
          </div>

          {/* 대화형 날짜 슬라이더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(0,0,0,0.04)', padding: '4px 12px', borderRadius: '20px' }}>
            <button onClick={handlePrevDate} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', minWidth: '85px', textAlign: 'center' }}>
              {getFormattedDateString(currentDate)}
            </span>
            <button onClick={handleNextDate} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button className="header-btn" onClick={() => navigate('/')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </button>
            <button className="header-btn" onClick={() => setIsSettingsOpen(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </header>
      )}

      {/* 3. 중앙 매일미사 iframe 영역 (상태바 높이부터 시작하도록 조정) */}
      <div style={{
        flex: 1,
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-color)',
        overflow: 'hidden',
        overflowX: 'hidden',
        marginTop: 'env(safe-area-inset-top, 20px)'
      }}>
        <iframe
          key={`${activeTab}-${formattedDate}`} // Forces iframe recreation on tab or date change
          src={activeTab === 'ko' ? cbckLink : universalisLink}
          style={{ 
            width: '1px', 
            minWidth: '100%', 
            maxWidth: '100%', 
            height: '100%', 
            border: 'none' 
          }}
          title="매일미사 뷰어"
        />
      </div>

      {/* 4. 하단 탭 & 바로가기 바 (옵션 2 기준 클래스 및 스타일) */}
      <div 
        className="global-bottom-bar"
        style={{
          transform: isBottomBarVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1000
        }}
      >
        {isExpandedMenuOpen ? (
          // ◉ 기본 메뉴 모드 (성경, 미사, 기도, 검색, 닫기X)
          <>
            {/* 성경 */}
            <button
              onClick={() => navigate('/')}
              className="global-bottom-btn"
              title="성경 읽기 목록"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 18H18V4H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3z" />
                <path d="M3 17h3a3 3 0 0 1 3 3" />
                <path d="M12 7v6M9.5 9.5h5" />
              </svg>
            </button>

            {/* 미사 (현재 페이지이므로 active 상태 유지, 누르면 개별 메뉴로 돌아감) */}
            <button
              onClick={() => setIsExpandedMenuOpen(false)}
              className="global-bottom-btn active"
              title="매일 미사"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v16M8 9h8" />
              </svg>
            </button>

            {/* 기도 */}
            <button
              onClick={() => navigate('/prayers')}
              className="global-bottom-btn"
              title="가톨릭 기도문"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 12a6 6 0 0 1 12 0" strokeDasharray="1 3.5" strokeLinecap="round" />
                <path d="M10 18c-0.8-1-1.5-3.5-1.5-5.5 0-2.5 2-5.5 3.5-7.5h0.04c1.5 2 3.5 5 3.5 7.5 0 2-0.7 4.5-1.5 5.5" />
                <path d="M8 18l-1.5 3h11l-1.5-3" />
                <path d="M12 5v13" />
              </svg>
            </button>

            {/* 검색 */}
            <button
              onClick={() => navigate('/search')}
              className="global-bottom-btn"
              title="성경 검색"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>

            {/* 닫기 (개별 미사 상세 메뉴로 복귀) */}
            <button
              onClick={() => setIsExpandedMenuOpen(false)}
              className="global-bottom-btn"
              title="미사 상세 메뉴로 돌아가기"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--reading-accent-pink, #d6336c)' }}>
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </>
        ) : (
          // ◉ 매일미사 개별 메뉴 모드 (한글미사, 영어미사, 독서1, 독서2, 복음, 더보기)
          <>
            {/* 한글미사 */}
            <button
              onClick={() => {
                setActiveTab('ko');
                setSelectedOverlayReading(null);
              }}
              className={`global-bottom-btn ${activeTab === 'ko' && !selectedOverlayReading ? 'active' : ''}`}
              style={{ flexDirection: 'column', gap: '2px', padding: '6px 0' }}
              title="한글미사"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>한글미사</span>
            </button>

            {/* 영어미사 */}
            <button
              onClick={() => {
                setActiveTab('en');
                setSelectedOverlayReading(null);
              }}
              className={`global-bottom-btn ${activeTab === 'en' && !selectedOverlayReading ? 'active' : ''}`}
              style={{ flexDirection: 'column', gap: '2px', padding: '6px 0' }}
              title="영어미사"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                <path d="M2 12h20"/>
              </svg>
              <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>영어미사</span>
            </button>

            {/* 세로 구분선 */}
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--nav-border)', opacity: 0.8, margin: '0 2px' }} />

            {/* 독서1 */}
            <button
              onClick={() => {
                if (reading1) {
                  setSelectedOverlayReading({
                    ...reading1,
                    type: '독서1',
                    lang: activeTab === 'en' ? 'en' : (settings.bibleLanguage || 'ko')
                  });
                }
              }}
              disabled={!reading1}
              className={`global-bottom-btn ${selectedOverlayReading?.type === '독서1' ? 'active' : ''}`}
              style={{ flexDirection: 'column', gap: '2px', padding: '6px 0', opacity: reading1 ? 1 : 0.4 }}
              title="독서1"
            >
              <span style={{
                fontSize: '0.55rem',
                fontWeight: '800',
                color: reading1 ? 'var(--ot-accent, #f08c00)' : '#888',
                backgroundColor: reading1 ? 'rgba(240, 140, 0, 0.08)' : 'rgba(0,0,0,0.05)',
                padding: '1px 4px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '45px',
                lineHeight: '1'
              }}>
                {reading1 ? reading1.bookName : '-'}
              </span>
              <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>독서1</span>
            </button>

            {/* 독서2 (있는 경우만 표시) */}
            {reading2 && (
              <button
                onClick={() => {
                  setSelectedOverlayReading({
                    ...reading2,
                    type: '독서2',
                    lang: activeTab === 'en' ? 'en' : (settings.bibleLanguage || 'ko')
                  });
                }}
                className={`global-bottom-btn ${selectedOverlayReading?.type === '독서2' ? 'active' : ''}`}
                style={{ flexDirection: 'column', gap: '2px', padding: '6px 0' }}
                title="독서2"
              >
                <span style={{
                  fontSize: '0.55rem',
                  fontWeight: '800',
                  color: 'var(--ot-accent, #f08c00)',
                  backgroundColor: 'rgba(240, 140, 0, 0.08)',
                  padding: '1px 4px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '45px',
                  lineHeight: '1'
                }}>
                  {reading2.bookName}
                </span>
                <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>독서2</span>
              </button>
            )}

            {/* 복음 */}
            <button
              onClick={() => {
                if (gospel) {
                  setSelectedOverlayReading({
                    ...gospel,
                    type: '복음',
                    lang: activeTab === 'en' ? 'en' : (settings.bibleLanguage || 'ko')
                  });
                }
              }}
              disabled={!gospel}
              className={`global-bottom-btn ${selectedOverlayReading?.type === '복음' ? 'active' : ''}`}
              style={{ flexDirection: 'column', gap: '2px', padding: '6px 0', opacity: gospel ? 1 : 0.4 }}
              title="복음"
            >
              <span style={{
                fontSize: '0.55rem',
                fontWeight: '800',
                color: gospel ? 'var(--reading-accent-pink, #d6336c)' : '#888',
                backgroundColor: gospel ? 'rgba(214, 51, 108, 0.08)' : 'rgba(0,0,0,0.05)',
                padding: '1px 4px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '45px',
                lineHeight: '1'
              }}>
                {gospel ? gospel.bookName : '-'}
              </span>
              <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>복음</span>
            </button>

            {/* 세로 구분선 */}
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--nav-border)', opacity: 0.8, margin: '0 2px' }} />

            {/* 더보기 누르면 기본 메뉴로 스위칭 */}
            <button
              onClick={() => setIsExpandedMenuOpen(true)}
              className="global-bottom-btn"
              title="기본 메뉴 보기"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="18" cy="12" r="1.5" fill="currentColor"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* 📖 성경 구절 바텀 시트 오버레이 */}
      {selectedOverlayReading && (
        <div 
          className="settings-overlay" 
          onClick={handleCloseOverlay}
          style={{ 
            zIndex: 1200, 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'center',
            backgroundColor: currentBackdropColor,
            transition: isDragging ? 'none' : 'background-color 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div 
            className="settings-sheet"
            onClick={e => e.stopPropagation()}
            style={{
              height: '90vh',
              transform: (isClosing || !isOpened) ? 'translateY(100%)' : `translateY(${translateY}px)`,
              transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1201,
              borderRadius: '24px 24px 0 0',
              padding: '0 0 env(safe-area-inset-bottom, 12px) 0',
              overflow: 'hidden',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.15)',
              backgroundColor: 'var(--bg-color)'
            }}
          >
            {/* 드래그 핸들러 및 헤더 영역 */}
            <div 
              ref={dragHandleRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px 18px',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'grab',
                userSelect: 'none',
                backgroundColor: 'var(--secondary-bg)',
                flexShrink: 0
              }}
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
            >
              {/* 시트 접기 손잡이 */}
              <div style={{
                width: '36px',
                height: '4px',
                backgroundColor: 'rgba(128, 128, 128, 0.35)',
                borderRadius: '2px',
                marginBottom: '10px'
              }} />
              
              {/* 헤더 제목 및 닫기 버튼 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {/* 이전 장 이동 버튼 */}
                  <button 
                    onClick={handleHeaderPrevChapter}
                    disabled={selectedOverlayReading.chapter <= 1}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: selectedOverlayReading.chapter > 1 ? 'pointer' : 'not-allowed',
                      color: 'var(--text-color)',
                      opacity: selectedOverlayReading.chapter > 1 ? 0.8 : 0.25,
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="이전 장으로 이동"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                  </button>

                  <span 
                    onClick={toggleLanguage}
                    style={{ 
                      fontSize: '0.95rem', 
                      fontWeight: 'bold', 
                      color: 'var(--text-color)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title="클릭하여 성경 언어 변경 (한글 -> 한영 -> 영어)"
                  >
                    <span style={{
                      fontSize: '0.82rem',
                      fontWeight: '800',
                      color: selectedOverlayReading.type === '복음' ? 'var(--reading-accent-pink, #d6336c)' : 'var(--ot-accent, #555d44)',
                      backgroundColor: selectedOverlayReading.type === '복음' ? 'rgba(214, 51, 108, 0.1)' : 'rgba(85, 93, 68, 0.1)',
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}>
                      {selectedOverlayReading.type}
                    </span>
                    {displayLanguage === 'en' ? (selectedOverlayReading.bookName || overlayBookName) : overlayBookName} {selectedOverlayReading.range}
                  </span>

                  {/* 다음 장 이동 버튼 */}
                  <button 
                    onClick={handleHeaderNextChapter}
                    disabled={selectedOverlayReading.chapter >= totalChapters}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: selectedOverlayReading.chapter < totalChapters ? 'pointer' : 'not-allowed',
                      color: 'var(--text-color)',
                      opacity: selectedOverlayReading.chapter < totalChapters ? 0.8 : 0.25,
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="다음 장으로 이동"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
                <button 
                  onClick={handleCloseOverlay}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-color)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>

            {/* 스크롤 가능한 본문 영역 */}
            <div 
              id="overlay-scroll-container"
              onScroll={handleOverlayScroll}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px 40px 20px',
                backgroundColor: 'var(--bg-color)',
                ...overlayReaderStyles
              }}
            >
              {/* 이전 장 트리거 센티넬 (IntersectionObserver 감지용) */}
              <div ref={topSentinelRef} style={{ height: '1px', width: '100%' }} />

              {overlayChapters.map((ch) => {
                const displayBookTitle = displayLanguage === 'en' ? (ch.bookEnName || ch.bookName) : ch.bookName;
                return (
                  <div 
                    key={`${ch.bookId}-${ch.chapter}`} 
                    className="chapter-container"
                    style={{ marginBottom: '32px' }}
                    data-bookid={ch.bookId}
                    data-chapter={ch.chapter}
                    data-bookname={ch.bookName}
                    data-bookenname={ch.bookEnName}
                  >
                    <h2 className="chapter-title" style={{ fontSize: '1.25rem', marginBottom: '20px', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: '8px', fontWeight: 'bold', color: 'var(--text-color)' }}>
                      {displayBookTitle} {ch.chapter}장
                    </h2>
                    
                    {ch.verses.map((verse, idx) => {
                      const subheading = ch.subheadings.find(s => s.verseId === verse.v);
                      const isHighlight = ch.bookId === parseInt(selectedOverlayReading.bookId) && 
                                          ch.chapter === parseInt(selectedOverlayReading.chapter) && 
                                          verse.v === selectedOverlayReading.verse;
                      
                      return (
                        <div key={idx} id={`overlay-v-${ch.bookId}-${ch.chapter}-${verse.v}`}>
                          {subheading && renderOverlaySubheading(subheading)}
                          
                          <div 
                            className="verse"
                            style={{
                              display: 'block',
                              marginBottom: `${settings.verseSpacing || 0.4}rem`,
                              padding: '6px 8px',
                              borderRadius: '8px',
                              backgroundColor: isHighlight ? 'rgba(85, 93, 68, 0.08)' : 'transparent',
                              borderLeft: isHighlight ? '3.5px solid var(--ot-accent, #555d44)' : 'none',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            <span 
                              className="verse-num"
                              style={{
                                fontSize: '0.85em',
                                color: isHighlight ? 'var(--ot-accent, #555d44)' : '#78909c',
                                fontWeight: 'bold',
                                marginRight: '8px',
                                display: 'inline',
                                userSelect: 'none'
                              }}
                            >
                              {verse.v}
                            </span>
                            
                            {displayLanguage === 'en' ? (
                              <span className="verse-text">{verse.en || '(No English translation)'}</span>
                            ) : displayLanguage === 'ko-en' ? (
                              <span className="verse-text-group" style={{ display: 'inline' }}>
                                <span className="verse-text">{verse.text}</span>
                                {verse.en && (
                                  <span className="verse-text en-text" style={{ 
                                    fontSize: '0.92em', 
                                    opacity: 0.75, 
                                    display: 'block', 
                                    paddingLeft: '8px',
                                    borderLeft: '1px solid rgba(128, 128, 128, 0.45)',
                                    marginTop: '4px',
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
                  </div>
                );
              })}

              {/* 다음 장 트리거 센티넬 (IntersectionObserver 감지용) */}
              <div ref={bottomSentinelRef} style={{ height: '1px', width: '100%' }} />

              {/* 하단 전체 화면 성경 연결 영역 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '24px 0 12px 0',
                borderTop: '1px solid var(--border-color)',
                marginTop: '28px'
              }}>
                <button
                  onClick={handleOpenInReader}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: 'var(--ot-accent, #555d44)',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(85, 93, 68, 0.2)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  성경 전체 화면으로 읽기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* 📖 읽기 기록 서재 바텀 시트 */}
      <HistorySheet isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />

      {/* 🎙️ Premium Floating Morphing Bottom Bar - Only shown when active playing */}
      {isSpeaking && (
        <div className="floating-bottom-bar" style={{
          transform: isBottomBarVisible ? 'translateX(-50%)' : 'translate(-50%, 120px)',
          opacity: isBottomBarVisible ? 1 : 0,
          pointerEvents: isBottomBarVisible ? 'auto' : 'none',
          transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out',
          zIndex: 1000
        }}>
          {/* 정지(Stop) 버튼 */}
          <button 
            className="floating-bar-btn" 
            onClick={ttsHandlers.stop} 
            title="낭독 정지"
            style={{ color: 'var(--reading-accent-pink, #d6336c)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="5" y="5" rx="1" ry="1"/>
            </svg>
          </button>

          {/* 이전 구절 버튼 */}
          <button className="floating-bar-btn" onClick={ttsHandlers.prev} title="이전 구절">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>
          </button>
          
          {/* 재생 / 일시정지 */}
          {isPaused ? (
            <button className="floating-bar-btn btn-play-main" onClick={ttsHandlers.resume} title="다시 재생">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(1px)' }}><polygon points="6 3 20 12 6 21 6 3"/></svg>
            </button>
          ) : (
            <button className="floating-bar-btn btn-play-main" onClick={ttsHandlers.pause} title="일시 정지">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </button>
          )}

          {/* 다음 구절 버튼 */}
          <button className="floating-bar-btn" onClick={ttsHandlers.next} title="다음 구절">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>
          </button>

          {/* 배속 조절 */}
          <button 
            className="floating-bar-btn" 
            onClick={() => {
              const speeds = [0.8, 1.0, 1.2, 1.5, 1.8, 2.0];
              const curIdx = speeds.indexOf(ttsSpeed);
              const nextIdx = (curIdx + 1) % speeds.length;
              setTtsSpeed(speeds[nextIdx]);
            }} 
            title="속도 조절"
            style={{ fontSize: '0.8rem', fontWeight: 'bold' }}
          >
            {ttsSpeed}x
          </button>
        </div>
      )}
    </div>
  );
}
