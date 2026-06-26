import { useState, useEffect, useRef, useLayoutEffect, useCallback, Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import localforage from 'localforage';
import SettingsSheet from '../components/SettingsSheet';
import { useSettings } from '../context/SettingsContext';
import { BIBLE_DB_KEY } from '../lib/bibleInfo';
import HistorySheet from '../components/HistorySheet';
import { useSimpleTTS } from '../hooks/useSimpleTTS';
import { useBible } from '../context/BibleContext';

// 💡 상단 헤더(뒤로가기, 날짜 조절, 설정 버튼 등)를 다시 활성화하려면 이 값을 true로 변경하세요.
const SHOW_HEADER = true;

const copyTextToClipboard = (text) => {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(err => console.error('Clipboard copy failed:', err));
  } else {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    } catch (err) {
      console.error('Fallback clipboard copy failed:', err);
    }
  }
};

export default function DailyMass() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, updateSetting } = useSettings();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [readings, setReadings] = useState([]);
  const [meditationText, setMeditationText] = useState(null); // 오늘의 묵상 텍스트
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(true);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [iframeHeight, setIframeHeight] = useState(800);
  const iframeRef = useRef(null);

  // ◉ 확장 메뉴 토글 상태
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [ttsItems, setTtsItems] = useState([]);

  // BibleContext에서 미사 공유 상태 setter 가져오기
  const {
    isSpeaking: _isSpeaking, isPaused: _isPaused, ttsSpeed, setTtsSpeed, ttsHandlers,
    massActiveTab, setMassActiveTab, setMassReadings, massOverlay, setMassOverlay, setMassMeditationText,
    speakingVerseId
  } = useBible();
  // activeTab 로컬 별칭 (기존 코드 호환성 유지)
  const activeTab = massActiveTab;
  const setActiveTab = setMassActiveTab;

  // 📖 성경 구절 오버레이 시트 상태 (전역 상태 직접 연동하여 무한 렌더링 루프 방지)
  const selectedOverlayReading = massOverlay;
  const setSelectedOverlayReading = setMassOverlay;

  const [overlayChapters, setOverlayChapters] = useState([]); // [{ bookId, bookName, bookEnName, chapter, verses, subheadings }]
  const [overlayBookName, setOverlayBookName] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [isOpened, setIsOpened] = useState(false);
  const [totalChapters, setTotalChapters] = useState(0);
  
  // 🎙️ TTS 상태 및 훅 바인딩
  const { isSpeaking, isPaused } = { isSpeaking: _isSpeaking, isPaused: _isPaused };
  const ttsHook = useSimpleTTS(ttsItems);

  const changeSpeed = (newSpeed) => {
    setTtsSpeed(newSpeed);
    localStorage.setItem('tts_speed', newSpeed.toString());
  };

  // 미사 상태 업데이트 동기화
  useEffect(() => { setMassReadings(readings); }, [readings, setMassReadings]);
  useEffect(() => { setMassMeditationText(meditationText); }, [meditationText, setMassMeditationText]);

  // 글씨 크기 변경 감시 - iframe 내부 모든 요소 폰트 크기 변경
  useEffect(() => {
    if (!iframeRef.current) return;
    try {
      const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (iframeDoc) {
        const fontSize = settings.fontSize || 18;
        let styleEl = iframeDoc.getElementById('font-size-override');

        if (!styleEl) {
          styleEl = iframeDoc.createElement('style');
          styleEl.id = 'font-size-override';
          iframeDoc.head.appendChild(styleEl);
        }

        styleEl.textContent = `
          * { font-size: ${fontSize}px !important; }
          body { font-size: ${fontSize}px !important; }
        `;
      }
    } catch (err) {
      console.error('iframe 글씨 크기 적용 실패:', err);
    }
  }, [settings.fontSize]);

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




  
  // 🖐️ 드래그 앤 드롭 제스처 상태
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const currentTranslateY = useRef(0);
  const dragHandleRef = useRef(null);
  const lastOverlayScrollTopRef = useRef(0);
  const isAutoScrollingRef = useRef(false);
  const userInteractedRef = useRef(false);

  // 오버레이가 활성화될 때 트랜지션을 위한 감지 Effect
  useEffect(() => {
    if (selectedOverlayReading) {
      // 컴포넌트 마운트 후 스타일 프레임이 완전히 준비된 후 트랜지션이 발동하도록 지연 적용
      const timer = setTimeout(() => {
        setIsOpened(true);
      }, 50);
      
      // 오버레이가 열릴 때 하단 막대와 헤더를 기본적으로 노출 상태로 초기화
      setIsBottomBarVisible(true);
      setIsHeaderVisible(true);
      lastOverlayScrollTopRef.current = 0;
      // 스크롤 위치 즉시 초기화 (이전 오버레이 스크롤 잔류 방지)
      const container = document.getElementById('overlay-scroll-container');
      if (container) container.scrollTop = 0;
      isAutoScrollingRef.current = true; // 자동 정렬 스크롤이 끝날 때까지 스크롤 감지 일시 차단
      userInteractedRef.current = false; // 사용자 직접 조작 여부 초기화

      return () => clearTimeout(timer);
    } else {
      setIsOpened(false);
    }
  }, [selectedOverlayReading]);

  // 오버레이 닫기 핸들러 (슬라이드 애니메이션 적용)
  const handleCloseOverlay = () => {
    setIsClosing(true);
    setIsOpened(false);
    // 닫힐 때 하단 막대와 헤더를 다시 보이도록 복구
    setIsBottomBarVisible(true);
    setIsHeaderVisible(true);
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
    // 초기 정렬 스크롤이 진행 중이거나, 사용자가 직접 화면을 조작(터치/휠)하기 전에는 센서 무시
    if (!hasScrolledRef.current || isAutoScrollingRef.current || !userInteractedRef.current) {
      // 자동 스크롤 또는 조작 전에는 하단 막대와 헤더를 강제 노출 상태로 유지
      setIsBottomBarVisible(true);
      setIsHeaderVisible(true);
      return;
    }

    const container = e.currentTarget;
    updateVisibleChapterInHeader(container);

    const scrollTop = container.scrollTop;

    // 항상 노출 고정
    setIsBottomBarVisible(true);
    setIsHeaderVisible(true);
    lastOverlayScrollTopRef.current = scrollTop;
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
        let chap = parseInt(match[2], 10);
        let verse = parseInt(match[3], 10) || 1;
        
        const targetBook = books.find(b => b.name.startsWith(abbrev) || abbrev.startsWith(b.name));
        if (targetBook) {
          // 1장짜리 성경(오바드야, 필레몬, 요한2서, 요한3서, 유다서) 예외 처리
          const singleChapterBookIds = [38, 64, 70, 71, 72];
          if (singleChapterBookIds.includes(targetBook.id)) {
            if (match[3] === undefined) {
              verse = chap;
            }
            chap = 1;
          }
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
  const renderOverlaySubheading = (subheadingObj, subheadingId) => {
    const rawTitle = (displayLanguage === 'en' ? subheadingObj.enTitle : subheadingObj.title) || subheadingObj.title;
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

    const isTtsHighlight = speakingVerseId === subheadingId;

    return (
      <div 
        id={subheadingId} 
        className="subheading-group" 
        style={{ 
          marginTop: '20px', 
          marginBottom: '10px',
          backgroundColor: isTtsHighlight ? 'rgba(85, 93, 68, 0.08)' : 'transparent',
          borderLeft: isTtsHighlight ? '3.5px solid var(--ot-accent, #555d44)' : 'none',
          padding: isTtsHighlight ? '6px 8px' : '0',
          borderRadius: '4px',
          transition: 'background-color 0.2s'
        }}
      >
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

  const isMassRoute = location.pathname.startsWith('/mass');

  // ⚡ [추가] Keep-Alive 상주 상태에서 미사 탭에 다시 진입(노출)할 때 화면 리셋 및 레이아웃 상태 원상복구
  useEffect(() => {
    if (isMassRoute) {
      const restoreFlag = sessionStorage.getItem('restore_scroll_mass');
      if (restoreFlag === 'true') {
        sessionStorage.removeItem('restore_scroll_mass');
        
        // 부모 창 스크롤 복원 (다단계 복원 적용)
        const savedScroll = localStorage.getItem('scroll_y_mass');
        if (savedScroll) {
          const scrollVal = parseInt(savedScroll, 10);
          const scrollAttempts = [50, 150, 300, 500, 800];
          scrollAttempts.forEach(delay => {
            setTimeout(() => {
              window.scrollTo(0, scrollVal);
              document.documentElement.scrollTop = scrollVal;
              document.body.scrollTop = scrollVal;
            }, delay);
          });
        }
      } else {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }
      setIsBottomBarVisible(true);
      setIsHeaderVisible(true);
    }
  }, [isMassRoute]);

  // Fetch parsed daily mass readings for shortcuts in background (localforage 캐싱 적용 - 오늘 밤 12시 자정 만료)
  useEffect(() => {
    const cacheKey = `daily_mass_cache_${formattedDate}_${activeTab}`;
    
    localforage.getItem(cacheKey).then(cached => {
      const now = Date.now();
      if (cached && cached.expireTime && now < cached.expireTime) {
        // 캐시 데이터가 유효하면 상태 업데이트 (불필요한 비우기 및 깜빡임 방지)
        setReadings(cached.readings);
        setMeditationText(cached.meditation || null);
      } else {
        // 캐시가 없거나 만료되었으면 화면 비우고 새로 fetch 진행
        setReadings([]);
        setMeditationText(null);
        fetch(`/api/mass?date=${formattedDate}&type=${activeTab}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.readings) {
              setReadings(data.readings);
              const med = data.meditation || null;
              setMeditationText(med);
              
              // 오늘 밤 23:59:59 타임스탬프 계산
              const today = new Date();
              const expire = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();
              
              localforage.setItem(cacheKey, {
                readings: data.readings,
                meditation: med,
                expireTime: expire
              }).catch(e => console.error('Failed to save mass cache:', e));
            }
          })
          .catch(err => {
            console.error('Failed to fetch readings:', err);
          });
      }
    }).catch(err => {
      console.error('Failed to read mass cache:', err);
      // 캐시 에러 시 fallback으로 fetch 진행 (로컬 상태 초기화 후 호출)
      setReadings([]);
      setMeditationText(null);
      fetch(`/api/mass?date=${formattedDate}&type=${activeTab}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.readings) {
            setReadings(data.readings);
            setMeditationText(data.meditation || null);
          }
        })
        .catch(e => console.error('Failed fallback fetch readings:', e));
    });
  }, [formattedDate, activeTab]);

  // 탭 전환 또는 날짜 변경 시 브라우저 스크롤 강제 최상단 초기화 (iframe 포커스로 인한 부모 밀림 방지) 및 하단막대/헤더 노출 리셋
  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      localStorage.setItem('scroll_y_mass', '0'); // 날짜/언어 탭 변경 시 스크롤 리셋
    };
    
    resetScroll();
    
    // 탭 및 날짜 전환 시 하단 막대와 헤더를 기본적으로 보임 상태로 강제 리셋
    setIsBottomBarVisible(true);
    setIsHeaderVisible(true);
    
    const timer = setTimeout(resetScroll, 100);
    const timer2 = setTimeout(resetScroll, 500);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [activeTab, formattedDate]);

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
      
      isAutoScrollingRef.current = true;

      setTimeout(() => {
        const targetEl = document.getElementById(targetId);
        const container = document.getElementById('overlay-scroll-container');
        if (targetEl && container) {
          // getBoundingClientRect는 애니메이션 중 transform 값이 섞여 부정확.
          // offsetTop을 container까지 누적하여 transform 독립적으로 계산.
          let top = 0;
          let el = targetEl;
          while (el && el !== container) {
            top += el.offsetTop;
            el = el.offsetParent;
          }
          container.scrollTop = top;
          lastOverlayScrollTopRef.current = container.scrollTop;

          requestAnimationFrame(() => {
            hasScrolledRef.current = true;
            // 자동 정렬 스크롤 이벤트가 전부 해소될 때까지 대기한 후 플래그 해제 및 노출 보정
            setTimeout(() => {
              isAutoScrollingRef.current = false;
              setIsBottomBarVisible(true);
              setIsHeaderVisible(true);
            }, 250);
          });
        } else {
          isAutoScrollingRef.current = false;
        }
      }, 100);
    }
  }, [overlayChapters, selectedOverlayReading]);

  // 오버레이 성경 구절이 로드 완료되었을 때 클립보드에 자동 복사
  useEffect(() => {
    if (overlayChapters.length > 0 && selectedOverlayReading && selectedOverlayReading.type !== '묵상') {
      const { bookId, chapter, verse, range, type } = selectedOverlayReading;
      
      const currentChap = overlayChapters.find(ch => ch.bookId === parseInt(bookId, 10) && ch.chapter === parseInt(chapter, 10));
      if (currentChap) {
        let startV = verse;
        let endV = verse;
        if (range && range.includes('-')) {
          const parts = range.split('-');
          const rightPart = range.includes(',') ? range.split(',')[1] : range;
          const rangeMatch = rightPart.match(/(\d+)\s*-\s*(\d+)/);
          if (rangeMatch) {
            startV = parseInt(rangeMatch[1], 10);
            endV = parseInt(rangeMatch[2], 10);
          }
        }
        
        const targetVerses = currentChap.verses.filter(v => v.v >= startV && v.v <= endV);
        if (targetVerses.length > 0) {
          const headerText = `${type} [${currentChap.bookName} ${chapter}장 ${range}]`;
          const contentText = targetVerses.map(v => `${v.v} ${v.text}`).join('\n');
          const fullTextToCopy = `${headerText}\n\n${contentText}`;
          copyTextToClipboard(fullTextToCopy);
        }
      }
    }
  }, [overlayChapters, selectedOverlayReading]);

  // 프록시 HTML 주소로 변경하여 Same-Origin 상태에서 스크롤 수신
  const cbckLink = `/api/mass-html?type=ko&date=${formattedDate}`;
  const universalisLink = `/api/mass-html?type=en&date=${formattedDate}`;

  // iframe 내 메세지 감지 (스크롤 신호 재발행 및 동적 높이 수신)
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data) {
        if (event.data.type === 'iframeScroll') {
          // 독서/복음/묵상 오버레이가 열려있으면 무시
          if (selectedOverlayReading) return;
          // GlobalBottomBar가 수신할 수 있도록 재발행
          window.dispatchEvent(new CustomEvent('massScrollSignal', {
            detail: { direction: event.data.direction }
          }));
        } else if (event.data.type === 'iframeHeight') {
          // 동적 높이 갱신
          setIframeHeight(event.data.height);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedOverlayReading]);

  // 대안 1 적용에 따른 부모 창 스크롤 감지 및 저장, 하단바 신호 발행
  useEffect(() => {
    if (!isMassRoute || selectedOverlayReading) return;

    let lastScrollTop = window.scrollY || document.documentElement.scrollTop;
    const threshold = 12;

    const handleParentScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;

      // 스크롤 위치 저장
      localStorage.setItem('scroll_y_mass', scrollTop.toString());

      // 최상단 근처는 무조건 'up'
      if (scrollTop <= 10) {
        window.dispatchEvent(new CustomEvent('massScrollSignal', {
          detail: { direction: 'up' }
        }));
        lastScrollTop = scrollTop;
        return;
      }

      const diff = scrollTop - lastScrollTop;
      if (Math.abs(diff) > threshold) {
        const direction = diff > 0 ? 'down' : 'up';
        window.dispatchEvent(new CustomEvent('massScrollSignal', {
          detail: { direction: direction }
        }));
        lastScrollTop = scrollTop;
      }
    };

    window.addEventListener('scroll', handleParentScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleParentScroll);
    };
  }, [isMassRoute, selectedOverlayReading]);

  // 설정이 변경될 때마다 iframe에 applyStyle 신호를 전송하여 폰트/크기/여백 즉시 반영
  useEffect(() => {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ type: 'applyStyle' }, '*');
      } catch (err) {
        // cross-origin 방어
      }
    }
  }, [settings]);

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

  // 🎙️ 현재 화면 상태(오버레이 유무, 묵상 여부, iframe 텍스트)에 맞춰 TTS 아이템 자동 동기화
  useEffect(() => {
    if (selectedOverlayReading) {
      if (selectedOverlayReading.type === '묵상') {
        if (selectedOverlayReading.content) {
          const lines = selectedOverlayReading.content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          const items = lines.map((line, idx) => ({
            id: `mass-overlay-meditation-${idx}`,
            text: line,
            type: 'verse'
          }));
          setTtsItems(items);
        } else {
          setTtsItems([]);
        }
      } else {
        // 독서1, 독서2, 복음 등
        const items = [];
        overlayChapters.forEach(ch => {
          const displayBookTitle = displayLanguage === 'en' ? (ch.bookEnName || ch.bookName) : ch.bookName;
          items.push({
            id: `overlay-chapter-title-${ch.bookId}-${ch.chapter}`,
            text: `${displayBookTitle} ${ch.chapter}장`,
            type: 'chapter'
          });
          
          ch.verses.forEach(verse => {
            const subheading = ch.subheadings.find(s => s.verseId === verse.v);
            if (subheading) {
              const subheadingText = (displayLanguage === 'en' ? subheading.enTitle : subheading.title) || subheading.title || '';
              const cleanSubheading = subheadingText.replace(/\(([^)]+)\)/g, '').trim();
              if (cleanSubheading) {
                items.push({
                  id: `overlay-subheading-${ch.bookId}-${ch.chapter}-${verse.v}`,
                  text: cleanSubheading,
                  type: 'subheading'
                });
              }
            }
            
            let verseText = verse.text;
            if (displayLanguage === 'en') {
              verseText = verse.en || '';
            }
            
            items.push({
              id: `overlay-v-${ch.bookId}-${ch.chapter}-${verse.v}`,
              text: verseText,
              type: 'verse'
            });
          });
        });
        setTtsItems(items);
      }
    } else {
      // 오버레이가 없고 iframe이 활성화 상태일 때 1.2초 후 iframe 내 텍스트 파싱
      const timer = setTimeout(() => {
        const items = getIframeTTSItems();
        setTtsItems(items);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [selectedOverlayReading, overlayChapters, activeTab, formattedDate, displayLanguage]);

  const handlePlayTTS = () => {
    let items = ttsItems;
    if (items.length === 0) {
      if (!selectedOverlayReading) {
        items = getIframeTTSItems();
        setTtsItems(items);
      }
    }
    if (items.length === 0) {
      alert('낭독할 미사 본문 텍스트를 찾을 수 없습니다.');
      return;
    }
    setTimeout(() => {
      if (ttsHandlers && typeof ttsHandlers.play === 'function') {
        ttsHandlers.play();
      }
    }, 100);
  };

  return (
    <div className="search-wrapper" style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden', position: 'relative' }}>
      
      {/* 1. 상단 상태바 가림막 (시간/배터리 표시 영역 확보 - 상시 켜둠) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 'max(47px, env(safe-area-inset-top))',
        backgroundColor: 'var(--status-bar-bg)',
        zIndex: 110
      }} />

      {/* 미사 화면 인페이지 컨트롤 바 (한글/영어 + 독서 선택) — 하단 4탭 바로 위 고정 */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
        left: 0,
        right: 0,
        zIndex: 1290,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}>
        <div style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: '600px',
          display: 'flex',
          gap: '4px',
          overflowX: 'auto',
          padding: '8px 10px',
          backgroundColor: 'var(--subnav-bg)',
          borderTop: '1px solid var(--nav-border)',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: isSpeaking ? 'space-around' : 'center'
        }} onClick={e => e.stopPropagation()}>
          {isSpeaking ? (
            /* TTS 재생 중: 배속 | 이전 | 재생/일시정지(중앙) | 다음 | 정지 — 균등 배치 */
            <>
              {/* 배속 */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '34px', minWidth: '72px', borderRadius: '17px', border: '1px solid var(--nav-border)', overflow: 'hidden' }}>
                  <button onClick={() => changeSpeed(Math.max(0.5, parseFloat((ttsSpeed - 0.05).toFixed(2))))} style={{ flex: 1, height: '100%', background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '11px' }}>
                    <svg width="6" height="15" viewBox="0 0 7 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="5,1 1,9 5,17"/></svg>
                  </button>
                  <button onClick={() => changeSpeed(Math.min(2.0, parseFloat((ttsSpeed + 0.05).toFixed(2))))} style={{ flex: 1, height: '100%', background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '11px' }}>
                    <svg width="6" height="15" viewBox="0 0 7 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,1 6,9 2,17"/></svg>
                  </button>
                  <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--text-color)', pointerEvents: 'none' }}>{ttsSpeed.toFixed(2)}</span>
                </div>
              </div>
              {/* 이전 */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <button onClick={ttsHandlers?.prev} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '34px', borderRadius: '17px', border: '1px solid var(--nav-border)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
                </button>
              </div>
              {/* 재생/일시정지 — 중앙 */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <button onClick={isPaused ? ttsHandlers?.resume : ttsHandlers?.pause} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '38px', borderRadius: '19px', border: 'none', background: 'var(--primary-color)', color: '#fff', cursor: 'pointer' }}>
                  {isPaused ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  )}
                </button>
              </div>
              {/* 다음 */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <button onClick={ttsHandlers?.next} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '34px', borderRadius: '17px', border: '1px solid var(--nav-border)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.9V8.1L8.5 12zM16 6h2v12h-2z"/></svg>
                </button>
              </div>
              {/* 정지 — TTS 버튼과 동일한 알약 크기 */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <button onClick={ttsHandlers?.stop} style={{ padding: '7px 16px', minWidth: '59px', borderRadius: '16px', border: '1px solid var(--nav-border)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="0" y="0" width="15" height="15" rx="2"/></svg>
                </button>
              </div>
            </>
          ) : (
            /* 일반 상태: 탭 목록 */
            [
              { key: 'ko', label: '한글미사', on: () => { setSelectedOverlayReading(null); setActiveTab('ko'); }, active: activeTab === 'ko' && !selectedOverlayReading },
              { key: 'en', label: '영어미사', on: () => { setSelectedOverlayReading(null); setActiveTab('en'); }, active: activeTab === 'en' && !selectedOverlayReading },
              reading1 && { key: 'r1', label: '독서1', on: () => setSelectedOverlayReading({ ...reading1, type: '독서1', lang: activeTab === 'en' ? 'en' : 'ko' }), active: selectedOverlayReading?.type === '독서1' },
              reading2 && { key: 'r2', label: '독서2', on: () => setSelectedOverlayReading({ ...reading2, type: '독서2', lang: activeTab === 'en' ? 'en' : 'ko' }), active: selectedOverlayReading?.type === '독서2' },
              gospel && { key: 'g', label: '복음', on: () => setSelectedOverlayReading({ ...gospel, type: '복음', lang: activeTab === 'en' ? 'en' : 'ko' }), active: selectedOverlayReading?.type === '복음' },
              (meditationText && activeTab === 'ko') && { key: 'm', label: '묵상', on: () => setSelectedOverlayReading({ type: '묵상', content: meditationText }), active: selectedOverlayReading?.type === '묵상' },
              { key: 'tts', label: 'TTS', on: handlePlayTTS, active: false },
            ].filter(Boolean).map(btn => (
              <button
                key={btn.key}
                onClick={btn.on}
                title={btn.label}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  borderRadius: '18px',
                  border: '1px solid var(--nav-border)',
                  background: btn.active ? 'var(--primary-color)' : 'transparent',
                  color: btn.active ? '#fff' : 'var(--text-color)',
                  fontSize: '0.78rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {btn.label}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. 슬라이딩 토글 헤더 (SHOW_HEADER가 true일 때만 노출) */}
      {SHOW_HEADER && (
        <header className="mass-date-header" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: 'calc(34px + env(safe-area-inset-top, 44px))',
          padding: 'env(safe-area-inset-top, 44px) 16px 0 16px',
          transform: isHeaderVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1210,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          backgroundColor: 'var(--bg-color)',
          boxSizing: 'border-box',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {selectedOverlayReading ? (
            /* 독서1/독서2/복음/묵상 열렸을 때 — 성경 정보 표시 */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}>
                {selectedOverlayReading.type === '묵상' ? (
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
                    오늘의 묵상
                  </span>
                ) : (
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
                    {overlayBookName} {selectedOverlayReading.chapter}{selectedOverlayReading.chapter && ','} {selectedOverlayReading.range}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  const el = document.getElementById('overlay-scroll-container');
                  if (el) copyTextToClipboard(el.innerText);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center', position: 'absolute', right: '16px' }}
                title="복사"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </>
          ) : (
            /* 한글/영어미사 기본 상태 — 날짜 표시 */
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          )}
        </header>
      )}

      {/* 3. 중앙 매일미사 iframe 영역 (상태바 높이부터 시작하도록 조정) */}
      <div style={{
        flex: 1,
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        height: 'auto',
        backgroundColor: 'var(--bg-color)',
        overflow: 'visible',
        padding: '0 0',
        marginTop: SHOW_HEADER
          ? 'calc(34px + env(safe-area-inset-top, 44px))'
          : 'max(47px, env(safe-area-inset-top))'
      }}>
        <iframe
          ref={iframeRef}
          key={`${activeTab}-${formattedDate}`} // Forces iframe recreation on tab or date change
          src={activeTab === 'ko' ? cbckLink : universalisLink}
          scrolling="no"
          style={{ 
            position: 'relative',
            width: '100%', 
            height: `${iframeHeight}px`, 
            border: 'none',
            display: 'block',
            overflow: 'hidden'
          }}
          title="매일미사 뷰어"
          onLoad={(e) => {
            const restoreFlag = sessionStorage.getItem('restore_scroll_mass');
            const reset = () => {
              if (restoreFlag === 'true') return; // 스크롤 복원 플래그가 있으면 초기화 스킵
              window.scrollTo(0, 0);
              document.body.scrollTop = 0;
              document.documentElement.scrollTop = 0;
            };
            
            reset();
            setTimeout(reset, 50);
            setTimeout(reset, 200);
            setTimeout(reset, 500);
            setTimeout(reset, 1000);
            
            // iframe 내부 CSS 조정 - 타이틀 여백 축소 + 콘텐츠 폭 확대 + HTML 엔티티 제거
            try {
              const iframeDoc = e.target.contentDocument || e.target.contentWindow?.document;
              if (iframeDoc) {
                // HTML 엔티티를 실제 문자로 대체
                if (iframeDoc.body) {
                  iframeDoc.body.innerHTML = iframeDoc.body.innerHTML
                    .replace(/&lsquo;/g, "'")
                    .replace(/&rsquo;/g, "'")
                    .replace(/&ldquo;/g, '"')
                    .replace(/&rdquo;/g, '"');
                }

                const style = iframeDoc.createElement('style');
                style.textContent = `
                  h2, h3, .title, [class*="title"] { margin-top: 2px !important; }
                  body, html { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
                  div, section, article, main { max-width: none !important; }
                  [style*="max-width"] { max-width: none !important; }
                `;
                iframeDoc.head.appendChild(style);
              }
            } catch (err) {
              console.error('iframe CSS 조정 실패:', err);
            }

            // TTS 아이템 갱신
            setTimeout(() => {
              const items = getIframeTTSItems();
              if (items.length > 0) setTtsItems(items);
            }, 1100);
          }}
        />
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
              height: 'calc(100dvh - 34px - env(safe-area-inset-top, 44px))',
              marginTop: 'calc(34px + env(safe-area-inset-top, 44px))',
              transform: (isClosing || !isOpened) ? 'translateY(100%)' : `translateY(${translateY}px)`,
              transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1201,
              borderRadius: '0',
              padding: '0 0 env(safe-area-inset-bottom, 12px) 0',
              overflow: 'hidden',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.15)',
              backgroundColor: 'var(--bg-color)'
            }}
          >
            {/* 드래그 핸들러 및 헤더 영역 */}
            <div 
              ref={dragHandleRef}
              className="overlay-drag-handle"
              style={{
                cursor: 'grab',
                userSelect: 'none'
              }}
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {selectedOverlayReading.type === '묵상' ? (
                  <span style={{ 
                    fontSize: '0.95rem', 
                    fontWeight: 'bold', 
                    color: 'var(--text-color)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    userSelect: 'none'
                  }}>
                    <span style={{
                      fontSize: '0.82rem',
                      fontWeight: '800',
                      color: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}>
                      묵상
                    </span>
                    오늘의 묵상
                  </span>
                ) : (
                  <>
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
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => {
                    const el = document.getElementById('overlay-scroll-container');
                    if (el) copyTextToClipboard(el.innerText);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="복사"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
                <button
                  onClick={handleCloseOverlay}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>

            {/* 스크롤 가능한 본문 영역 */}
            <div 
              id="overlay-scroll-container"
              onScroll={handleOverlayScroll}
              onTouchStart={() => { userInteractedRef.current = true; }}
              onWheel={() => { userInteractedRef.current = true; }}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '32px 20px 40px 20px',
                backgroundColor: 'var(--bg-color)',
                ...overlayReaderStyles
              }}
            >
              {selectedOverlayReading.type === '묵상' ? (
                <div style={{
                  fontSize: `${settings.fontSize || 18}px`,
                  lineHeight: settings.lineHeight || 1.5,
                  fontWeight: settings.fontWeight || 400,
                  fontFamily: settings.fontFamily !== 'System Default' ? settings.fontFamily : 'inherit',
                  color: 'var(--text-color)',
                  whiteSpace: 'pre-wrap',
                  paddingBottom: '40px',
                  marginTop: '20px'
                }}>
                  {selectedOverlayReading.content.split(/\r?\n/).map((line, idx) => {
                    const lineText = line.trim();
                    if (!lineText) return <br key={idx} />;
                    const isHighlight = speakingVerseId === `mass-overlay-meditation-${idx}`;
                    return (
                      <p 
                        key={idx} 
                        id={`mass-overlay-meditation-${idx}`}
                        style={{
                          marginBottom: '0.8rem',
                          backgroundColor: isHighlight ? 'rgba(85, 93, 68, 0.08)' : 'transparent',
                          borderLeft: isHighlight ? '3.5px solid var(--ot-accent, #555d44)' : 'none',
                          padding: isHighlight ? '6px 8px' : '0 8px',
                          borderRadius: '8px',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        {lineText}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <>
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
                        <h2 id={`overlay-chapter-title-${ch.bookId}-${ch.chapter}`} className="chapter-title" style={{ fontSize: '1.25rem', marginBottom: '20px', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: '8px', fontWeight: 'bold', color: 'var(--text-color)' }}>
                          {displayBookTitle} {ch.chapter}장
                        </h2>
                        
                        {ch.verses.map((verse, idx) => {
                          const subheadingId = `overlay-subheading-${ch.bookId}-${ch.chapter}-${verse.v}`;
                          const subheading = ch.subheadings.find(s => s.verseId === verse.v);
                          const isHighlight = (ch.bookId === parseInt(selectedOverlayReading.bookId) && 
                                              ch.chapter === parseInt(selectedOverlayReading.chapter) && 
                                              verse.v === selectedOverlayReading.verse) ||
                                              speakingVerseId === `overlay-v-${ch.bookId}-${ch.chapter}-${verse.v}`;
                          
                          return (
                            <div key={idx} id={`overlay-v-${ch.bookId}-${ch.chapter}-${verse.v}`}>
                              {subheading && renderOverlaySubheading(subheading, subheadingId)}
                              
                              <div 
                                className="verse"
                                style={{
                                  display: 'block',
                                  marginBottom: `${settings.verseSpacing ?? 0.4}rem`,
                                  padding: `${(settings.verseSpacing ?? 0.4) * 8}px 8px`,
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* 📖 읽기 기록 서재 바텀 시트 */}
      <HistorySheet isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />




    </div>
  );
}
