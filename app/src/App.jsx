import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import localforage from 'localforage';
import { SettingsProvider } from './context/SettingsContext';
import { BibleProvider } from './context/BibleContext';
import { BIBLE_DB_KEY } from './lib/bibleInfo';
import { useBible } from './context/BibleContext';
import { bibleMetadata } from './lib/bibleInfo';
import Home from './pages/Home';
import BibleList from './pages/BibleList';
import ChapterList from './pages/ChapterList';
import Reader from './pages/Reader';
import Search from './pages/Search';
import DailyMass from './pages/DailyMass';
import BibleReadingPlan from './pages/BibleReadingPlan';
import PrayersList from './pages/PrayersList';
import PrayersDetail from './pages/PrayersDetail';
import HistorySheet from './components/HistorySheet';
import SettingsSheet from './components/SettingsSheet';

// 무작위 구절 목록 (myVerses가 없을 때 사용)
const FALLBACK_VERSES = [
  { bookName: '요한', chapter: 3, verseNum: 16, content: '하느님은 세상을 너무나 사랑하신 나머지 외아들을 내주셨다.' },
  { bookName: '시편', chapter: 23, verseNum: 1, content: '주님은 나의 목자, 나는 아쉬울 것 없어라.' },
  { bookName: '마태오', chapter: 5, verseNum: 3, content: '행복하여라, 마음이 가난한 사람들! 하늘 나라가 그들의 것이다.' },
  { bookName: '필리피', chapter: 4, verseNum: 13, content: '나에게 힘을 주시는 분 안에서 나는 모든 것을 할 수 있습니다.' },
  { bookName: '로마', chapter: 8, verseNum: 28, content: '하느님을 사랑하는 이들, 그분의 계획에 따라 부르심을 받은 이들에게는 모든 것이 함께 작용하여 선을 이룬다는 것을 우리는 압니다.' },
];

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initDB();
  }, []);

  // Global Touch Swipe Navigation (Back / Forward) & Triple Tap Fullscreen Toggle
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let tapCount = 0;
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const handleTouchStart = (e) => {
      const currentTime = new Date().getTime();
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;

      const timeDiff = currentTime - lastTapTime;

      // Triple Tap Detection (Interval < 300ms, Distance < 50px)
      if (timeDiff < 300) {
        const distX = currentX - lastTapX;
        const distY = currentY - lastTapY;
        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance < 50) {
          tapCount += 1;
        } else {
          tapCount = 1;
        }
      } else {
        tapCount = 1;
      }

      lastTapTime = currentTime;
      lastTapX = currentX;
      lastTapY = currentY;

      // Trigger fullscreen on the 3rd tap
      if (tapCount === 3) {
        toggleFullscreenMode();
        tapCount = 0;
      }

      // Record starting coordinates for Swipe navigation
      touchStartX = currentX;
      touchStartY = currentY;
    };

    const handleTouchEnd = (e) => {
      if (!touchStartX || !touchStartY) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Strict horizontal guard for Swipe Navigation: horizontal swipe must be at least 1.5x larger than vertical motion
      if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        // 50% screen width threshold
        const threshold = window.innerWidth * 0.5;

        if (Math.abs(deltaX) >= threshold) {
          if (deltaX > 0) {
            // Swipe Left-to-Right (→): Go Back
            navigate(-1);
          } else {
            // Swipe Right-to-Left (←): Go Forward
            navigate(1);
          }
        }
      }

      // Reset coordinates
      touchStartX = 0;
      touchStartY = 0;
    };

    const toggleFullscreenMode = () => {
      const isCurrentlyFullscreenActive = document.body.classList.toggle('fullscreen-active');
      
      if (isCurrentlyFullscreenActive) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (document.documentElement.webkitRequestFullscreen) { // Safari Fallback
          document.documentElement.webkitRequestFullscreen();
        }
      } else {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigate]);

  const initDB = async () => {
    try {
      const keys = await localforage.keys();
      // Safe Purge: Clean up older legacy database caches to free up local storage
      if (keys.includes('bibleData_v3')) {
        await localforage.removeItem('bibleData_v3');
      }
      if (keys.includes('bibleData_v2')) {
        await localforage.removeItem('bibleData_v2');
      }
      if (keys.includes('bibleData')) {
        await localforage.removeItem('bibleData');
      }

      const existingData = keys.includes(BIBLE_DB_KEY);
      if (existingData) {
        setIsFirstRun(false);
        setLoading(false);
        return;
      }
      setIsFirstRun(true);
      const response = await fetch('/data/bible_data.json');
      if (!response.ok) throw new Error('Failed to fetch bible data');
      const data = await response.json();
      await localforage.setItem(BIBLE_DB_KEY, data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("성경 데이터를 불러오는데 실패했습니다.");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(255, 77, 133, 0.1)', borderTopColor: '#ff4d85', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
        <p style={{ fontSize: '1rem', fontWeight: '500', textAlign: 'center', margin: 0, opacity: 0.85 }}>
          {isFirstRun ? (
            <>성경 데이터를 준비하고 있습니다...<br/><span style={{ fontSize: '0.85rem', opacity: 0.7, fontWeight: 'normal' }}>(최초 1회만 다운로드합니다)</span></>
          ) : (
            <>말씀을 불러오고 있습니다...</>
          )}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen">
        <p style={{color: 'red'}}>{error}</p>
        <button onClick={initDB} style={{marginTop: 20, padding: '10px 20px'}}>다시 시도</button>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <BibleProvider>
        <div className={`app-container ${location.pathname.startsWith('/mass') ? 'mass-page' : ''} ${location.pathname === '/' || location.pathname === '/home' ? 'home-page' : ''}`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/list/:testament" element={<BibleList />} />
            <Route path="/book/:bookId" element={<ChapterList />} />
            <Route path="/read/:bookId/:chapter" element={<Reader />} />
            <Route path="/search" element={<Search />} />
            <Route path="/mass" element={<DailyMass />} />
            <Route path="/plan" element={<BibleReadingPlan />} />
            <Route path="/prayers" element={<PrayersList />} />
            <Route path="/prayers/:id" element={<PrayersDetail />} />
          </Routes>
          <GlobalBottomBar />
        </div>
      </BibleProvider>
    </SettingsProvider>
  );
}

// ──────────────────────────────────────────────
// 하단막대 개별 메뉴 아이템 아이콘 컴포넌트
// ──────────────────────────────────────────────

function MassKoIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>;
}
function MassEnIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>;
}

// ◉ 버튼 SVG (전환 버튼)
function CircleBtn({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      {active ? (
        <circle cx="12" cy="12" r="4" fill="currentColor"/>
      ) : (
        <circle cx="12" cy="12" r="4"/>
      )}
    </svg>
  );
}

// ──────────────────────────────────────────────
// GlobalBottomBar (전면 개편)
// ──────────────────────────────────────────────

function GlobalBottomBar() {
  const {
    isSpeaking, ttsHandlers,
    isPaused, ttsSpeed, setTtsSpeed,
    myVerses,
    massActiveTab, setMassActiveTab,
    massReadings, massOverlay, setMassOverlay,
    massMeditationText,
    setIsContinueMode,
    showPrayerCategories, setShowPrayerCategories,
    selectedPrayerCategoryId, setSelectedPrayerCategoryId,
    selectedPrayerId, setSelectedPrayerId,
    isPrayerSearchMode, setIsPrayerSearchMode,
    isIndividualMenu, setIsIndividualMenu,
    showIntro, setShowIntro,
  } = useBible();

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBarsVisible, setIsBarsVisible] = useState(true);
  const [toast, setToast] = useState(null);

  const lastScrollYRef = useRef(0);
  const isFirstScrollRef = useRef(true);
  const prevDomainRef = useRef('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const fallbackCopy = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = 0;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('복사 완료 ✨');
    } catch {
      showToast('복사에 실패했습니다.');
    }
    document.body.removeChild(textarea);
  };

  const handleCopy = () => {
    const match = location.pathname.match(/^\/read\/(\d+)\/(\d+)/);
    if (!match) {
      showToast('성경 읽기 화면에서만 사용 가능합니다.');
      return;
    }
    const bookId = parseInt(match[1]);
    const chapter = parseInt(match[2]);
    localforage.getItem(BIBLE_DB_KEY).then(data => {
      if (!data || !data.books) {
        showToast('데이터를 불러올 수 없습니다.');
        return;
      }
      const book = data.books.find(b => b.id === bookId);
      if (!book) {
        showToast('책 정보를 찾을 수 없습니다.');
        return;
      }
      const chapData = book.chapters.find(c => c.c === chapter);
      if (!chapData) {
        showToast('장 정보를 찾을 수 없습니다.');
        return;
      }
      let text = `${book.name}\n[${chapter}장]\n`;
      chapData.v.forEach(verse => {
        text += `${verse.v} ${verse.text}\n`;
      });
      const textToCopy = text.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast('복사 완료 ✨');
        }).catch(() => {
          fallbackCopy(textToCopy);
        });
      } else {
        fallbackCopy(textToCopy);
      }
    });
  };

  const navigate = useNavigate();
  const location = useLocation();

  const isMassPage = location.pathname.startsWith('/mass');
  const isPrayerPage = location.pathname.startsWith('/prayers');
  // [수정] /plan, /home 등을 성경 페이지로 오인식하지 않도록 명시적으로 정의
  const isBiblePage = location.pathname.startsWith('/list/') ||
                      location.pathname.startsWith('/book/') ||
                      location.pathname.startsWith('/read/') ||
                      location.pathname.startsWith('/search') ||
                      location.pathname.startsWith('/plan');

  // 미사 readings 파생
  const massReading1 = massReadings?.find(r => r.type === '독서1');
  const massReading2 = massReadings?.find(r => r.type === '독서2');
  const massGospel = massReadings?.find(r => r.type === '복음');

  // [수정] 페이지 이동 시 처리: 막대 보임 상태 초기화 + 페이지 성격이 바뀔 때 개별 메뉴도 초기화
  useEffect(() => {
    setIsBarsVisible(true);
    isFirstScrollRef.current = true;
    // 미사/기도/성경 간 큰 페이지 이동 시 개별 메뉴 자동 닫기
    // (같은 섹션 내부 이동은 그대로 유지)
    const isNowMass = location.pathname.startsWith('/mass');
    const isNowPrayer = location.pathname.startsWith('/prayers');
    const isNowBible = location.pathname.startsWith('/list/') ||
                       location.pathname.startsWith('/book/') ||
                       location.pathname.startsWith('/read/') ||
                       location.pathname.startsWith('/search') ||
                       location.pathname.startsWith('/plan');

    let currentDomain = 'other';
    if (isNowMass) currentDomain = 'mass';
    else if (isNowPrayer) currentDomain = 'prayer';
    else if (isNowBible) currentDomain = 'bible';

    // 다른 도메인으로 넘어갈 때 개별 메뉴 닫기
    if (prevDomainRef.current && prevDomainRef.current !== currentDomain) {
      setIsIndividualMenu(false);
    }
    prevDomainRef.current = currentDomain;

    // /plan, /home 같이 특정 섹션에 속하지 않는 페이지에선 개별 메뉴 닫기
    if (!isNowMass && !isNowPrayer && !isNowBible) {
      setIsIndividualMenu(false);
    }
    if (!isNowPrayer && showIntro) {
      setShowIntro(false);
    }
  }, [location.pathname, showIntro]);

  // 스크롤 감지 — 모든 페이지 공통 (미사 페이지는 massScrollSignal 이벤트도 수신)
  useEffect(() => {
    isFirstScrollRef.current = true;

    // 미사 페이지 iframe scroll 신호 수신
    const handleMassScrollSignal = (e) => {
      // 미사 오버레이(독서/복음/묵상)가 열려있으면 무시
      if (massOverlay) return;
      if (e.detail.direction === 'up') {
        setIsBarsVisible(true);
      } else if (e.detail.direction === 'down') {
        setIsBarsVisible(false);
      }
    };

    window.addEventListener('massScrollSignal', handleMassScrollSignal);

    // 일반 페이지 window scroll 감지
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (isFirstScrollRef.current) {
        lastScrollYRef.current = currentScrollY;
        isFirstScrollRef.current = false;
        return;
      }

      if (currentScrollY <= 10) {
        setIsBarsVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      const diff = currentScrollY - lastScrollYRef.current;
      if (Math.abs(diff) < 20) return; // 8에서 20으로 늘려 예민한 스크롤 방지

      if (diff > 0) {
        setIsBarsVisible(false);
      } else {
        setIsBarsVisible(true);
      }
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('massScrollSignal', handleMassScrollSignal);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [location.pathname, massOverlay]);

  // 오버레이가 열리면 하단막대 항상 보임 상태로
  useEffect(() => {
    if (massOverlay) {
      setIsBarsVisible(true);
    }
  }, [massOverlay]);

  // [수정] TTS 가능 여부 계산 (버튼 비활성화 표시에도 사용)
  const isTtsPlayablePage = location.pathname.startsWith('/read/') ||
                            location.pathname.startsWith('/mass') ||
                            location.pathname.startsWith('/prayers') ||
                            location.pathname === '/';

  const handleGlobalTtsToggle = () => {
    if (isSpeaking) {
      if (ttsHandlers && typeof ttsHandlers.stop === 'function') {
        ttsHandlers.stop();
      }
    } else {
      if (!isTtsPlayablePage) return; // 재생 불가 페이지에선 아무 동작 안 함 (alert 없음)
      if (ttsHandlers && typeof ttsHandlers.play === 'function') {
        ttsHandlers.play();
      } else if (ttsHandlers && typeof ttsHandlers.resume === 'function') {
        ttsHandlers.resume();
      }
    }
  };

  // ◉ 버튼 클릭 핸들러 (삭제 대신 필요 시 대비 남겨둠, UI에서 삭제)
  const handleCircleBtn = () => {
    setIsIndividualMenu(prev => !prev);
  };

  // 기본 메뉴 클릭 핸들러 (옵션 A: 해당 페이지 이동 및 재클릭 시 개별 메뉴 모드로 토글)
  const handleBasicHome = () => {
    navigate('/home');
    setIsIndividualMenu(false);
    setShowPrayerCategories(false);
    setIsPrayerSearchMode(false);
    if (showIntro) setShowIntro(false);
  };
  const handleBasicPrayer = () => {
    if (isPrayerActive) {
      setIsIndividualMenu(prev => !prev);
    } else {
      navigate('/prayers');
    }
    setShowPrayerCategories(false);
    setIsPrayerSearchMode(false);
    if (showIntro) setShowIntro(false);
  };
  const handleBasicMass = () => {
    if (isMassActive) {
      setIsIndividualMenu(prev => !prev);
    } else {
      navigate('/mass');
    }
    setShowPrayerCategories(false);
    if (showIntro) setShowIntro(false);
  };
  const handleBasicBible = () => {
    if (isBibleActive) {
      setIsIndividualMenu(prev => !prev);
    } else {
      prevDomainRef.current = 'bible';
      navigate('/plan');
      setIsIndividualMenu(true);
    }
    setShowPrayerCategories(false);
    if (showIntro) setShowIntro(false);
  };
  const handleBasicSettings = () => {
    setIsSettingsOpen(true);
    setShowPrayerCategories(false);
    if (showIntro) setShowIntro(false);
  };

  // 미사 개별 메뉴: DailyMass의 setActiveTab/setSelectedOverlayReading은 BibleContext를 통해 연동
  // → setMassActiveTab을 직접 호출하면 DailyMass의 useEffect가 감지하여 동기화됨
  // (단, DailyMass가 마운트되어 있을 때만 유효)

  // 기본 메뉴 활성화 여부
  const isPrayerActive = isPrayerPage;
  const isMassActive = isMassPage;
  const isBibleActive = isBiblePage;

  // 카테고리 정적 정의
  const PRAYER_CATEGORIES = [
    { id: 1, title: '주요' },
    { id: 2, title: '일상' },
    { id: 3, title: '신심' },
    { id: 4, title: '전구' },
    { id: 5, title: '특별' },
    { id: 99, title: 'mine' }
  ];

  return (
    <>
      {/* 🎙️ 전역 TTS 미니 플레이어 — position:fixed로 하단막대 바로 위에 독립 배치 */}
      {isSpeaking && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            left: 0,
            right: 0,
            zIndex: 1299,
            transform: isBarsVisible ? 'translateY(0)' : 'translateY(calc(100% + 64px + env(safe-area-inset-bottom, 0px)))',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '600px',
              backgroundColor: 'var(--nav-bg)',
              borderTop: '1px solid var(--nav-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              height: '52px',
              animation: 'slideUpFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* 이전 구절 버튼 */}
            <button
              onClick={ttsHandlers?.prev}
              title="이전 구절"
              style={{ flex: 1, height: '100%', background: 'none', border: 'none', color: '#999', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', cursor: 'pointer' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>
              <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>이전</span>
            </button>

            {/* 재생 / 일시정지 */}
            {isPaused ? (
              <button
                onClick={ttsHandlers?.resume}
                title="다시 재생"
                style={{ flex: 1, height: '100%', background: 'none', border: 'none', color: 'var(--primary-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', cursor: 'pointer' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(1px)' }}><polygon points="6 3 20 12 6 21 6 3"/></svg>
                <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>재생</span>
              </button>
            ) : (
              <button
                onClick={ttsHandlers?.pause}
                title="일시 정지"
                style={{ flex: 1, height: '100%', background: 'none', border: 'none', color: 'var(--primary-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', cursor: 'pointer' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>일시정지</span>
              </button>
            )}

            {/* 다음 구절 버튼 */}
            <button
              onClick={ttsHandlers?.next}
              title="다음 구절"
              style={{ flex: 1, height: '100%', background: 'none', border: 'none', color: '#999', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', cursor: 'pointer' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>
              <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>다음</span>
            </button>

            {/* 배속 조절 */}
            <div
              style={{
                flex: 1.2,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
              }}
            >
              <button
                onClick={() => {
                  setTtsSpeed(prev => Math.max(0.5, parseFloat((prev - 0.05).toFixed(2))));
                }}
                title="속도 감소 (-0.05)"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#999',
                  fontSize: '1.2rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                  height: '100%'
                }}
              >
                &lt;
              </button>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '45px',
                  gap: '2px'
                }}
              >
                <span style={{ fontSize: '1.0rem', fontWeight: '700', color: 'var(--text-color, #333)' }}>
                  {ttsSpeed === 1.0 ? '1X' : `${ttsSpeed.toFixed(2)}x`}
                </span>
                <span style={{ fontSize: '0.6rem', fontWeight: 'bold', color: '#999' }}>배속</span>
              </div>

              <button
                onClick={() => {
                  setTtsSpeed(prev => Math.min(2.0, parseFloat((prev + 0.05).toFixed(2))));
                }}
                title="속도 증가 (+0.05)"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#999',
                  fontSize: '1.2rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                  height: '100%'
                }}
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 카테고리 탭 바 — position:fixed로 하단막대(또는 TTS) 바로 위에 독립 배치 */}
      {showPrayerCategories && (
        <div
          style={{
            position: 'fixed',
            bottom: `calc(64px + env(safe-area-inset-bottom, 0px) + ${isSpeaking ? '52px' : '0px'})`,
            left: 0,
            right: 0,
            zIndex: 1298,
            transform: isBarsVisible ? 'translateY(0)' : 'translateY(calc(100% + 150px))',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              pointerEvents: 'auto',
              width: '100%',
              maxWidth: '600px',
              backgroundColor: 'var(--nav-bg)',
              borderTop: '1px solid var(--nav-border)',
              display: 'flex',
              gap: '2px',
              justifyContent: 'space-around',
              padding: '8px 12px',
              height: '48px',
              alignItems: 'center',
              animation: 'slideUpFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {PRAYER_CATEGORIES.map(cat => {
              const isActive = selectedPrayerCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedPrayerCategoryId(cat.id);
                    setSelectedPrayerId(null);
                  }}
                  style={{
                    flex: 1,
                    height: '32px',
                    borderRadius: '16px',
                    border: 'none',
                    backgroundColor: isActive ? '#A64B2A' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-color)',
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 'bold' : '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    padding: '0'
                  }}
                >
                  {cat.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 하단막대 & 플로팅 바 패키지 (스크롤 시 함께 움직임) ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          transform: isBarsVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none'
        }}
      >
        {/* ── 하단막대 본체 ── */}
        <div
          className="global-bottom-bar"
          style={{
            pointerEvents: 'auto',
            width: '100%',
            position: 'relative',
            boxSizing: 'border-box'
          }}
        >
          {isIndividualMenu ? (
            /* ══ 개별 메뉴 ══ */
            <>
              {isMassPage ? (
                /* 미사 개별 메뉴 */
                <>
                  {/* 한글미사 */}
                  <button
                    onClick={() => setMassActiveTab('ko')}
                    className={`global-bottom-btn ${massActiveTab === 'ko' && !massOverlay ? 'active' : ''}`}
                    style={{ flexDirection: 'column', gap: '2px', padding: '6px 0' }}
                    title="한글미사"
                  >
                    <MassKoIcon />
                    <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>한글미사</span>
                  </button>
                  {/* 영어미사 */}
                  <button
                    onClick={() => setMassActiveTab('en')}
                    className={`global-bottom-btn ${massActiveTab === 'en' && !massOverlay ? 'active' : ''}`}
                    style={{ flexDirection: 'column', gap: '2px', padding: '6px 0' }}
                    title="영어미사"
                  >
                    <MassEnIcon />
                    <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>영어미사</span>
                  </button>

                  <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--nav-border)', opacity: 0.8, margin: '0 2px' }} />

                  {/* 독서1 */}
                  <button
                    onClick={() => {
                      if (massReading1) {
                        setMassOverlay({ ...massReading1, type: '독서1', lang: massActiveTab === 'en' ? 'en' : 'ko' });
                      }
                    }}
                    disabled={!massReading1}
                    className={`global-bottom-btn ${massOverlay?.type === '독서1' ? 'active' : ''}`}
                    style={{ flexDirection: 'column', gap: '2px', padding: '6px 0', opacity: massReading1 ? 1 : 0.4 }}
                    title={massReading1 ? '독서1' : (!massReadings || massReadings.length === 0 ? '독서1 (로딩 중...)' : '독서1 (데이터 없음)')}
                  >
                    <span style={{ fontSize: '0.55rem', fontWeight: '800', color: massReading1 ? 'var(--ot-accent, #f08c00)' : '#888', backgroundColor: massReading1 ? 'rgba(240,140,0,0.08)' : 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: '4px', maxWidth: '45px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1' }}>
                      {massReading1 ? massReading1.bookName : '-'}
                    </span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>독서1</span>
                  </button>

                  {/* 독서2 (있는 경우만) */}
                  {massReading2 && (
                    <button
                      onClick={() => setMassOverlay({ ...massReading2, type: '독서2', lang: massActiveTab === 'en' ? 'en' : 'ko' })}
                      className={`global-bottom-btn ${massOverlay?.type === '독서2' ? 'active' : ''}`}
                      style={{ flexDirection: 'column', gap: '2px', padding: '6px 0' }}
                      title="독서2"
                    >
                      <span style={{ fontSize: '0.55rem', fontWeight: '800', color: 'var(--ot-accent,#f08c00)', backgroundColor: 'rgba(240,140,0,0.08)', padding: '1px 4px', borderRadius: '4px', maxWidth: '45px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1' }}>{massReading2.bookName}</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>독서2</span>
                    </button>
                  )}

                  {/* 복음 */}
                  <button
                    onClick={() => { if (massGospel) setMassOverlay({ ...massGospel, type: '복음', lang: massActiveTab === 'en' ? 'en' : 'ko' }); }}
                    disabled={!massGospel}
                    className={`global-bottom-btn ${massOverlay?.type === '복음' ? 'active' : ''}`}
                    style={{ flexDirection: 'column', gap: '2px', padding: '6px 0', opacity: massGospel ? 1 : 0.4 }}
                    title={massGospel ? '복음' : (!massReadings || massReadings.length === 0 ? '복음 (로딩 중...)' : '복음 (데이터 없음)')}
                  >
                    <span style={{ fontSize: '0.55rem', fontWeight: '800', color: massGospel ? 'var(--reading-accent-pink,#d6336c)' : '#888', backgroundColor: massGospel ? 'rgba(214,51,108,0.08)' : 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: '4px', maxWidth: '45px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1' }}>
                      {massGospel ? massGospel.bookName : '-'}
                    </span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>복음</span>
                  </button>

                  {/* 묵상 */}
                  <button
                    onClick={() => { if (massMeditationText && massActiveTab === 'ko') setMassOverlay({ type: '묵상', content: massMeditationText }); }}
                    disabled={!massMeditationText || massActiveTab !== 'ko'}
                    className={`global-bottom-btn ${massOverlay?.type === '묵상' ? 'active' : ''}`}
                    style={{ flexDirection: 'column', gap: '2px', padding: '6px 0', opacity: massMeditationText && massActiveTab === 'ko' ? 1 : 0.4 }}
                    title={massMeditationText && massActiveTab === 'ko' ? '오늘의 묵상' : (!massMeditationText ? '묵상 (로딩 중/데이터 없음)' : '묵상 (영어미사 미제공)')}
                  >
                    <span style={{ fontSize: '0.55rem', fontWeight: '800', color: massMeditationText ? '#10b981' : '#888', backgroundColor: massMeditationText ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: '4px', maxWidth: '45px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1' }}>
                      {massMeditationText ? '묵상' : '-'}
                    </span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>묵상</span>
                  </button>

                  {/* TTS */}
                  <button
                    onClick={handleGlobalTtsToggle}
                    disabled={!isSpeaking && !isTtsPlayablePage}
                    className={`global-bottom-btn ${isSpeaking ? 'active' : ''}`}
                    style={{ flexDirection: 'column', gap: '2px', padding: '6px 0', opacity: (!isSpeaking && !isTtsPlayablePage) ? 0.35 : 1 }}
                    title={isSpeaking ? '낭독 정지' : (isTtsPlayablePage ? 'TTS' : '본문 화면에서 사용 가능')}
                  >
                    {isSpeaking ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
                    )}
                    <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>TTS</span>
                  </button>
                </>
              ) : isPrayerPage ? (
                /* 기도 개별 메뉴 */
                <>
                  <button 
                    onClick={() => { 
                      navigate('/prayers'); 
                      setShowPrayerCategories(false); 
                      setIsPrayerSearchMode(false);
                      setSelectedPrayerId(null);
                      if (showIntro) setShowIntro(false);
                    }} 
                    className={`global-bottom-btn ${(!showPrayerCategories && !isPrayerSearchMode && location.pathname === '/prayers') ? 'active' : ''}`} 
                    title="추천 기도문"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                    <span className="nav-label">추천</span>
                  </button>
                  <button 
                    onClick={() => {
                      navigate('/prayers');
                      setIsPrayerSearchMode(false);
                      setShowPrayerCategories(true);
                      setSelectedPrayerId(null);
                      // 카테고리가 선택되지 않은 경우에만 기본값 1로 설정
                      setSelectedPrayerCategoryId(prev => prev || 1);
                      if (showIntro) setShowIntro(false);
                    }} 
                    className={`global-bottom-btn ${showPrayerCategories ? 'active' : ''}`} 
                    title="기도문 목록"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    <span className="nav-label">목록</span>
                  </button>
                  <button 
                    onClick={() => { 
                      navigate('/prayers'); 
                      setIsPrayerSearchMode(true);
                      setShowPrayerCategories(false); 
                      setSelectedPrayerId(null);
                      if (showIntro) setShowIntro(false);
                    }} 
                    className={`global-bottom-btn ${isPrayerSearchMode ? 'active' : ''}`} 
                    title="기도문 검색"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <span className="nav-label">검색</span>
                  </button>
                  <button 
                    onClick={handleGlobalTtsToggle}
                    disabled={!isSpeaking && !isTtsPlayablePage}
                    className={`global-bottom-btn ${isSpeaking ? 'active' : ''}`}
                    title={isSpeaking ? '낭독 정지' : (isTtsPlayablePage ? 'TTS' : '본문 화면에서 사용 가능')}
                    style={{ opacity: (!isSpeaking && !isTtsPlayablePage) ? 0.35 : 1 }}
                  >
                    {isSpeaking ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
                    )}
                    <span className="nav-label">TTS</span>
                  </button>
                </>
              ) : (
                /* 성경 개별 메뉴 */
                <>
                  <button
                    onClick={() => { navigate('/plan'); setIsIndividualMenu(false); }}
                    className={`global-bottom-btn ${location.pathname.startsWith('/plan') ? 'active' : ''}`}
                    title="한권읽기"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
                    <span className="nav-label">한권읽기</span>
                  </button>
                  <button
                    onClick={() => {
                      const currentPath = location.pathname;
                      if (currentPath.startsWith('/read/') || currentPath.startsWith('/book/') || currentPath.startsWith('/list/')) {
                        const isOtPath = currentPath.includes('/read/') ?
                          parseInt(currentPath.split('/')[2]) <= 46 :
                          currentPath.includes('구약');
                        navigate(isOtPath ? '/list/구약' : '/list/신약');
                      } else {
                        navigate('/list/신약');
                      }
                      setIsIndividualMenu(false);
                    }}
                    className={`global-bottom-btn ${(location.pathname.startsWith('/list/') || location.pathname.startsWith('/book/') || location.pathname.startsWith('/read/')) ? 'active' : ''}`}
                    title="성경목록"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    <span className="nav-label">성경목록</span>
                  </button>
                  <button
                    onClick={() => { setIsHistoryOpen(true); setIsIndividualMenu(false); }}
                    className="global-bottom-btn"
                    title="읽기 기록"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span className="nav-label">읽기 기록</span>
                  </button>
                  <button
                    onClick={() => { navigate('/search'); setIsIndividualMenu(false); }}
                    className={`global-bottom-btn ${location.pathname.startsWith('/search') ? 'active' : ''}`}
                    title="성경 검색"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <span className="nav-label">검색</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className="global-bottom-btn"
                    title="복사하기"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span className="nav-label">복사하기</span>
                  </button>
                  <button
                    onClick={() => { handleGlobalTtsToggle(); setIsIndividualMenu(false); }}
                    disabled={!isSpeaking && !isTtsPlayablePage}
                    className={`global-bottom-btn ${isSpeaking ? 'active' : ''}`}
                    title={isSpeaking ? '낭독 정지' : (isTtsPlayablePage ? 'TTS' : '본문 화면에서 사용 가능')}
                    style={{ opacity: (!isSpeaking && !isTtsPlayablePage) ? 0.35 : 1 }}
                  >
                    {isSpeaking ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
                    )}
                    <span className="nav-label">TTS</span>
                  </button>
                </>
              )}
            </>
          ) : (
            /* ══ 기본 메뉴 ══ */
            <>
              {/* 홈 */}
              <button
                onClick={handleBasicHome}
                className={`global-bottom-btn ${location.pathname === '/home' ? 'active' : ''}`}
                title="홈"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className="nav-label">홈</span>
              </button>
              {/* 기도 */}
              <button
                onClick={handleBasicPrayer}
                className={`global-bottom-btn ${isPrayerActive ? 'active' : ''}`}
                title="기도"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
                <span className="nav-label">기도</span>
              </button>

              {/* 미사 */}
              <button
                onClick={handleBasicMass}
                className={`global-bottom-btn ${isMassActive ? 'active' : ''}`}
                title="매일 미사"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20" />
                  <path d="M5 9h14" />
                </svg>
                <span className="nav-label">미사</span>
              </button>

              {/* 성경 */}
              <button
                onClick={handleBasicBible}
                className={`global-bottom-btn ${isBibleActive ? 'active' : ''}`}
                title="성경"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h10v18H2z" />
                  <path d="M22 3H12v18h10z" />
                </svg>
                <span className="nav-label">성경</span>
              </button>

              {/* 설정 */}
              <button
                onClick={handleBasicSettings}
                className={`global-bottom-btn ${isSettingsOpen ? 'active' : ''}`}
                title="설정"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
                <span className="nav-label">설정</span>
              </button>
            </>
          )}

          {/* ◉ 전환 버튼 — 항상 맨 우측 고정 */}
          <button
            onClick={handleCircleBtn}
            className={`global-bottom-btn ${isIndividualMenu ? 'active' : ''}`}
            title="기본/개별 메뉴 전환"
            style={{ marginLeft: 'auto' }}
          >
            <CircleBtn active={isIndividualMenu} />
            <span className="nav-label">◉</span>
          </button>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: '#fff',
          padding: '8px 20px',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: '600',
          zIndex: 9999,
          whiteSpace: 'nowrap',
          pointerEvents: 'none'
        }}>
          {toast}
        </div>
      )}
      <HistorySheet isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}

export default App;
