import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import localforage from 'localforage';
import { SettingsProvider } from './context/SettingsContext';
import { BibleProvider } from './context/BibleContext';
import { BIBLE_DB_KEY } from './lib/bibleInfo';
import { useBible } from './context/BibleContext';
import Home from './pages/Home';
import BibleList from './pages/BibleList';
import ChapterList from './pages/ChapterList';
import Reader from './pages/Reader';
import Search from './pages/Search';
import DailyMass from './pages/DailyMass';
import BibleReadingPlan from './pages/BibleReadingPlan';
import PrayersList from './pages/PrayersList';
import HistorySheet from './components/HistorySheet';
import SettingsSheet from './components/SettingsSheet';

function App() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!location.pathname.startsWith('/read/')) {
      const el = document.getElementById('page-scroll');
      if (el) el.scrollTop = 0;
    }
  }, [location.pathname]);

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

      // 버전 변경 시 매일미사 캐시 일괄 삭제 (캐시 무효화)
      const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v1.0.0';
      const lastVersion = localStorage.getItem('app_version_cache_clear');
      if (lastVersion !== currentVersion) {
        for (const key of keys) {
          if (key.startsWith('daily_mass_cache_')) {
            await localforage.removeItem(key);
          }
        }
        localStorage.setItem('app_version_cache_clear', currentVersion);
        console.log('App version changed. Cleared daily mass cache.');
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

  useEffect(() => {
    setTimeout(() => {
      initDB();
    }, 0);
  }, []);



  // Fullscreen 및 TTS 활성화 상태에 따른 모바일 상단바(Status Bar) 메타 태그 동적 제어
  useEffect(() => {
    const handleMutation = () => {
      const isFullscreenActive = document.body.classList.contains('fullscreen-active');
      const isTtsActive = document.body.classList.contains('tts-active');
      const shouldHideStatusBar = isFullscreenActive || isTtsActive;

      // 1. apple-mobile-web-app-status-bar-style 동적 업데이트
      let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (!appleMeta) {
        appleMeta = document.createElement('meta');
        appleMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
        document.head.appendChild(appleMeta);
      }
      appleMeta.setAttribute('content', shouldHideStatusBar ? 'black-translucent' : 'default');

      // 2. theme-color 동적 업데이트
      let themeMeta = document.querySelector('meta[name="theme-color"]');
      if (!themeMeta) {
        themeMeta = document.createElement('meta');
        themeMeta.setAttribute('name', 'theme-color');
        document.head.appendChild(themeMeta);
      }
      
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (shouldHideStatusBar) {
        // 전체화면 및 낭독 모드에서는 상단바를 검은색으로 처리하여 감춤
        themeMeta.setAttribute('content', '#000000');
      } else {
        // 평상시에는 현재 테마에 맞는 배경색 지정 (라이트: 따뜻한 종이, 다크: 어두운 성소)
        themeMeta.setAttribute('content', isDark ? '#21242B' : '#F4EEE3');
      }
    };

    // Body의 class 변화 감지 (fullscreen-active, tts-active 감지용)
    const bodyObserver = new MutationObserver(handleMutation);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // HTML의 data-theme 변화 감지 (테마 전환 감지용)
    const htmlObserver = new MutationObserver(handleMutation);
    htmlObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // 시스템 풀스크린 해제 이벤트 감지 (하드웨어 뒤로가기, ESC 키 등으로 풀스크린을 탈출한 경우)
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!isCurrentlyFullscreen && document.body.classList.contains('fullscreen-active')) {
        document.body.classList.remove('fullscreen-active');
      }
      handleMutation();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // 초기 실행
    handleMutation();

    return () => {
      bodyObserver.disconnect();
      htmlObserver.disconnect();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
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

  const isMassRoute = location.pathname.startsWith('/mass');

  return (
    <SettingsProvider>
      <BibleProvider>
        <div className={`app-container ${location.pathname.startsWith('/mass') ? 'mass-page' : ''} ${location.pathname === '/' || location.pathname === '/home' ? 'home-page' : ''} ${location.pathname.startsWith('/read/') ? 'reader-page' : ''}`}>
          {/* DailyMass 컴포넌트를 Routes 외부로 분리하고 display 속성으로 제어하여 Keep-Alive 처리 */}
          <div style={{ display: isMassRoute ? 'contents' : 'none' }}>
            <DailyMass />
          </div>
          <div
            id="page-scroll"
            style={{
              flex: 1,
              overflowY: isMassRoute ? 'hidden' : 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
            }}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route path="/list/:testament" element={<BibleList />} />
              <Route path="/book/:bookId" element={<ChapterList />} />
              <Route path="/read/:bookId/:chapter" element={<Reader />} />
              <Route path="/search" element={<Search />} />
              <Route path="/mass" element={null} />
              <Route path="/plan" element={<BibleReadingPlan />} />
              <Route path="/prayers" element={<PrayersList />} />
            </Routes>
          </div>
        </div>
        <GlobalBottomBar />
      </BibleProvider>
    </SettingsProvider>
  );
}

// ──────────────────────────────────────────────
// GlobalBottomBar (고정 4탭)
// ──────────────────────────────────────────────

function GlobalBottomBar() {
  const {
    isSpeaking, ttsHandlers,
    isPaused, ttsSpeed, setTtsSpeed,
    massOverlay, setMassOverlay,
    showPrayerCategories, setShowPrayerCategories,
    selectedPrayerCategoryId, setSelectedPrayerCategoryId,
    selectedPrayerId, setSelectedPrayerId,
    isPrayerSearchMode, setIsPrayerSearchMode,
    setIsIndividualMenu,
    showIntro, setShowIntro,
    isHistoryOpen, setIsHistoryOpen,
    isRecManageModalOpen, setIsRecManageModalOpen,
  } = useBible();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const speedRestartTimer = useRef(null);

  const changeSpeed = (newSpeed) => {
    setTtsSpeed(newSpeed);
    if (isSpeaking && !isPaused) {
      clearTimeout(speedRestartTimer.current);
      speedRestartTimer.current = setTimeout(() => {
        ttsHandlers?.restartFromCurrent?.();
      }, 180);
    }
  };

  const closeAllSheetsAndOverlays = () => {
    setIsHistoryOpen(false);
    setMassOverlay(null);
  };

  const prevDomainRef = useRef('');

  const getCurrentDomain = (path) => {
    if (path.startsWith('/mass')) return 'mass';
    if (path.startsWith('/prayers')) return 'prayer';
    if (
      path.startsWith('/plan') ||
      path.startsWith('/list/') ||
      path.startsWith('/book/') ||
      path.startsWith('/read/') ||
      path.startsWith('/search')
    ) {
      return 'bible';
    }
    return 'home';
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

  // 🧭 하단바를 항상 고정 4탭으로 단순화 — 도메인별 좌우 바로가기/개별 메뉴 제거
  const leftShortcut = null;
  const rightShortcut = null;

  // [수정] 페이지 이동 시 처리: 막대 보임 상태 초기화 및 슬라이드 인 애니메이션 처리
  useEffect(() => {
    setTimeout(() => {
      setIsSettingsOpen(false);
    }, 0);

    const currentDomain = getCurrentDomain(location.pathname);
    prevDomainRef.current = currentDomain;

    if (currentDomain !== 'prayer') {
      if (showIntro) {
        setShowIntro(false);
      }
      if (showPrayerCategories) {
        setShowPrayerCategories(false);
      }
      if (isPrayerSearchMode) {
        setIsPrayerSearchMode(false);
      }
    }

    if (currentDomain !== 'mass') {
      if (massOverlay) {
        setMassOverlay(null);
      }
    }

  }, [
    location.pathname,
    showIntro,
    setShowIntro,
    setIsSettingsOpen,
    showPrayerCategories,
    setShowPrayerCategories,
    isPrayerSearchMode,
    setIsPrayerSearchMode,
    massOverlay,
    setMassOverlay
  ]);



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

  // 도메인별 마지막 경로 기억 로직
  useEffect(() => {
    const path = location.pathname;
    
    // 1. 기도 도메인
    if (path.startsWith('/prayers')) {
      localStorage.setItem('last_prayer_path', path + location.search);
    }
    // 2. 미사 도메인
    else if (path.startsWith('/mass')) {
      localStorage.setItem('last_mass_path', path + location.search);
    }
    // 3. 성경 도메인
    else if (
      path.startsWith('/plan') ||
      path.startsWith('/list/') ||
      path.startsWith('/book/') ||
      path.startsWith('/read/') ||
      path.startsWith('/search')
    ) {
      localStorage.setItem('last_bible_path', path + location.search);
    }
  }, [location.pathname, location.search]);

  // 도메인 이동 처리 헬퍼 함수
  const navigateToDomain = (domain) => {
    const defaultPaths = { prayer: '/prayers', mass: '/mass', bible: '/plan' };
    const storageKeys = { prayer: 'last_prayer_path', mass: 'last_mass_path', bible: 'last_bible_path' };
    const targetPath = localStorage.getItem(storageKeys[domain]) || defaultPaths[domain];
    if (targetPath) {
      sessionStorage.setItem(`restore_scroll_${domain}`, 'true');
      navigate(targetPath);
      setIsIndividualMenu(true);
    }
  };

  // 기본 메뉴 클릭 핸들러 (버튼 클릭 시 해당 대표 화면 이동 및 개별 메뉴 자동 활성화)
  const handleBasicHome = () => {
    closeAllSheetsAndOverlays();
    setIsRecManageModalOpen(false);
    navigate('/home');
    setIsIndividualMenu(false);
    setShowPrayerCategories(false);
    setIsPrayerSearchMode(false);
    if (showIntro) setShowIntro(false);
  };
  const handleBasicPrayer = () => {
    closeAllSheetsAndOverlays();
    setIsRecManageModalOpen(false);
    navigateToDomain('prayer');
    setShowPrayerCategories(false);
    setIsPrayerSearchMode(false);
    if (showIntro) setShowIntro(false);
  };
  const handleBasicMass = () => {
    closeAllSheetsAndOverlays();
    setIsRecManageModalOpen(false);
    navigateToDomain('mass');
    setShowPrayerCategories(false);
    if (showIntro) setShowIntro(false);
  };
  const handleBasicBible = () => {
    closeAllSheetsAndOverlays();
    setIsRecManageModalOpen(false);
    navigateToDomain('bible');
    setShowPrayerCategories(false);
    if (showIntro) setShowIntro(false);
  };
  const handleBasicSettings = () => {
    closeAllSheetsAndOverlays();
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
    { id: 99, title: 'mine' },
    { id: 1, title: '주요' },
    { id: 2, title: '일상' },
    { id: 3, title: '신심' },
    { id: 4, title: '전구' },
    { id: 5, title: '특별' },
  ];


  return (
    <>


      {/* 🎙️ 전역 TTS 미니 플레이어 — position:fixed로 하단막대 바로 위에 독립 배치 */}

      {/* 🌟 카테고리 탭 바 — position:fixed로 하단막대(또는 TTS) 바로 위에 독립 배치 */}
      {showPrayerCategories && selectedPrayerId === null && (
        <div
          style={{
            position: 'fixed',
            bottom: `calc(87px + env(safe-area-inset-bottom, 0px) + ${isSpeaking ? '52px' : '0px'})`,
            left: 0,
            right: 0,
            zIndex: 1298,
            transform: 'translateY(0)',
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
              backgroundColor: 'var(--subsubnav-bg)',
              borderTop: '1px solid var(--nav-border)',
              display: 'flex',
              gap: '2px',
              justifyContent: 'space-around',
              padding: '6px 12px',
              height: '42px',
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
                    fontSize: '0.78rem',
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

      {/* ── 부메뉴 (성경 도메인): 주메뉴 바로 위 ── */}
      {isBiblePage && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
          left: 0, right: 0, zIndex: 1290,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px', padding: '8px 10px',
          backgroundColor: 'var(--subnav-bg)',
          borderTop: '1px solid var(--nav-border)',
          transform: 'translateZ(0)',
          overflowX: 'auto'
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
            /* 일반: 한권통독 | 성경 목록 | 검색 | 읽기기록 | TTS */
            <>
              {[
                { key: 'plan', label: '한권통독', on: () => { setIsHistoryOpen(false); navigate('/plan'); }, active: !isHistoryOpen && location.pathname.startsWith('/plan') },
                { key: 'list', label: '성경 목록', on: () => { setIsHistoryOpen(false); const m = location.pathname.match(/^\/read\/(\d+)/); const t = m ? (parseInt(m[1]) <= 46 ? '구약' : '신약') : '신약'; navigate(`/list/${t}`); }, active: !isHistoryOpen && (location.pathname.startsWith('/list/') || location.pathname.startsWith('/book/')) },
                { key: 'history', label: '읽기기록', on: () => { setIsHistoryOpen(v => !v); }, active: isHistoryOpen },
                { key: 'search', label: '검색', on: () => { setIsHistoryOpen(false); navigate('/search'); }, active: !isHistoryOpen && location.pathname.startsWith('/search') },
              ].map(btn => (
                <button key={btn.key} onClick={btn.on} style={{ flex: '0 0 auto', padding: '8px 16px', borderRadius: '18px', border: '1px solid var(--nav-border)', background: btn.active ? 'var(--primary-color)' : 'transparent', color: btn.active ? '#fff' : 'var(--text-color)', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>{btn.label}</button>
              ))}
              <button onClick={() => { setIsHistoryOpen(false); handleGlobalTtsToggle(); }} disabled={!location.pathname.startsWith('/read/')} style={{ flex: '0 0 auto', padding: '8px 16px', borderRadius: '18px', border: '1px solid var(--nav-border)', background: 'transparent', color: 'var(--text-color)', fontSize: '0.78rem', fontWeight: 'bold', cursor: location.pathname.startsWith('/read/') ? 'pointer' : 'default', opacity: location.pathname.startsWith('/read/') ? 1 : 0.35, whiteSpace: 'nowrap' }}>TTS</button>
            </>
          )}
        </div>
      )}

      {/* ── 하단막대 & 플로팅 바 패키지 (스크롤 시 함께 움직임) ── */}
      <div
        className="bottom-bar-package"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100vw',
          zIndex: 1300,
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none'
        }}
      >
        {/* 주메뉴 상단 터치 차단 레이어 */}
        <div style={{ position: 'fixed', bottom: 'calc(30px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, height: '12px', zIndex: 9999, pointerEvents: 'all', backgroundColor: 'rgba(0, 100, 255, 0.7)' }} />
        {/* ── 하단막대 본체 ── */}
        <div
          className="global-bottom-bar"
          onClick={(e) => {
            // 클릭된 곳이 설정 버튼(title="설정")이 아닌 다른 버튼/영역이면 설정창 닫기
            if (!e.target.closest('[title="설정"]')) {
              setIsSettingsOpen(false);
            }
          }}
          style={{
            pointerEvents: 'auto',
            width: '100%',
            position: 'relative',
            boxSizing: 'border-box',
            paddingLeft: '8px',
            paddingRight: '8px',
            paddingBottom: '4px'
          }}
        >
          {/* ◀ 좌측 바로가기 버튼 */}
          {leftShortcut && (
            <div
              onClick={(e) => { e.stopPropagation(); leftShortcut.action(); }}
              style={{
                position: 'absolute',
                left: '2px',
                top: 0,
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: 'var(--text-color)',
                opacity: 0.8,
                transition: 'opacity 0.2s, transform 0.2s',
                zIndex: 1310,
                pointerEvents: 'auto',
                userSelect: 'none',
                padding: '0 4px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            >
              <svg width="7" height="26" viewBox="0 0 7 26" style={{ display: 'block', color: 'var(--text-color)' }}>
                <polygon points="7,2 0,13 7,24" fill="currentColor" />
              </svg>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                color: 'var(--text-color)'
              }}>
                {leftShortcut.icon}
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: 'bold',
                  letterSpacing: '-0.3px',
                  lineHeight: '1'
                }}>
                  {leftShortcut.label}
                </span>
              </div>
            </div>
          )}

          {/* ▶ 우측 바로가기 버튼 */}
          {rightShortcut && (
            <div
              onClick={(e) => { e.stopPropagation(); rightShortcut.action(); }}
              style={{
                position: 'absolute',
                right: '2px',
                top: 0,
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: 'var(--text-color)',
                opacity: 0.8,
                transition: 'opacity 0.2s, transform 0.2s',
                zIndex: 1310,
                pointerEvents: 'auto',
                userSelect: 'none',
                padding: '0 4px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            >
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                color: 'var(--text-color)'
              }}>
                {rightShortcut.icon}
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: 'bold',
                  letterSpacing: '-0.3px',
                  lineHeight: '1'
                }}>
                  {rightShortcut.label}
                </span>
              </div>
              <svg width="7" height="26" viewBox="0 0 7 26" style={{ display: 'block', color: 'var(--text-color)' }}>
                <polygon points="0,2 7,13 0,24" fill="currentColor" />
              </svg>
            </div>
          )}

            <>
              {/* 홈 */}
              <button
                onClick={handleBasicHome}
                className={`global-bottom-btn ${location.pathname === '/home' ? 'active' : ''}`}
                title="홈"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className="nav-label">홈</span>
              </button>
              {/* 성경 */}
              <button
                onClick={handleBasicBible}
                className={`global-bottom-btn ${isBibleActive ? 'active' : ''}`}
                title="성경"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 7v14" />
                  <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
                </svg>
                <span className="nav-label">성경</span>
              </button>

              {/* 미사 */}
              <button
                onClick={handleBasicMass}
                className={`global-bottom-btn ${isMassActive ? 'active' : ''}`}
                title="매일 미사"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m18 7 4 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9l4-2" />
                  <path d="M14 22v-4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v4" />
                  <path d="M18 22V5l-6-3-6 3v17" />
                  <path d="M12 7v5" />
                  <path d="M10 9h4" />
                </svg>
                <span className="nav-label">미사</span>
              </button>

              {/* 기도 */}
              <button
                onClick={handleBasicPrayer}
                className={`global-bottom-btn ${isPrayerActive ? 'active' : ''}`}
                title="기도"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
                <span className="nav-label">기도</span>
              </button>

              {/* 설정 */}
              <button
                onClick={handleBasicSettings}
                className={`global-bottom-btn ${isSettingsOpen ? 'active' : ''}`}
                title="설정"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.72V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="nav-label">설정</span>
              </button>
            </>

        </div>
      </div>

      <HistorySheet isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}

export default App;
