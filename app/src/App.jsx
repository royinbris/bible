import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import localforage from 'localforage';
import { SettingsProvider } from './context/SettingsContext';
import { BibleProvider } from './context/BibleContext';
import { BIBLE_DB_KEY } from './lib/bibleInfo';
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
        <div className={`app-container ${location.pathname.startsWith('/mass') ? 'mass-page' : ''}`}>
          <Routes>
            <Route path="/" element={<Home />} />
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

function GlobalBottomBar() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBarsVisible, setIsBarsVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const isFirstScrollRef = useRef(true);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  const isReaderPage = location.pathname.startsWith('/read/');
  const isMassPage = location.pathname.startsWith('/mass');

  // 스크롤 시 하단 바 숨김 처리 (Reader 페이지용)
  useEffect(() => {
    isFirstScrollRef.current = true;
    
    if (!isReaderPage) {
      setIsBarsVisible(true);
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // 첫 스크롤 이벤트 발생 시 현재 스크롤 위치를 기준값으로 설정 후 스킵
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
      if (Math.abs(diff) < 8) return;
      
      if (diff > 0) {
        setIsBarsVisible(false);
      } else {
        setIsBarsVisible(true);
      }
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isReaderPage, location.pathname]);

  if (isMassPage) return null;

  const isBibleActive = location.pathname === '/' || 
                        location.pathname.startsWith('/list/') || 
                        location.pathname.startsWith('/book/') || 
                        location.pathname.startsWith('/read/');

  return (
    <>
      <div 
        className="global-bottom-bar"
        style={{
          transform: isBarsVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* 성경 읽기 */}
        <button
          onClick={() => navigate('/list/신약')}
          className={`global-bottom-btn ${isBibleActive ? 'active' : ''}`}
          title="성경 읽기 목록"
        >
          <img src="/icons/bible.png" alt="성경" className="nav-icon" />
          <span className="nav-label">성경</span>
        </button>

        {/* 매일 미사 */}
        <button
          onClick={() => navigate('/mass')}
          className={`global-bottom-btn ${location.pathname.startsWith('/mass') ? 'active' : ''}`}
          title="매일 미사"
        >
          <img src="/icons/mass.png" alt="미사" className="nav-icon" />
          <span className="nav-label">미사</span>
        </button>

        {/* 가톨릭 기도문 */}
        <button
          onClick={() => navigate('/prayers')}
          className={`global-bottom-btn ${location.pathname.startsWith('/prayers') ? 'active' : ''}`}
          title="가톨릭 기도문"
        >
          <img src="/icons/prayer.png" alt="기도" className="nav-icon" />
          <span className="nav-label">기도</span>
        </button>

        {/* 성경 검색 */}
        <button
          onClick={() => navigate('/search')}
          className={`global-bottom-btn ${location.pathname.startsWith('/search') ? 'active' : ''}`}
          title="성경 검색"
        >
          <img src="/icons/search.png" alt="검색" className="nav-icon" />
          <span className="nav-label">검색</span>
        </button>

        {/* 읽기 기록 서재 (더보기) */}
        <button
          onClick={() => setIsHistoryOpen(true)}
          className={`global-bottom-btn ${isHistoryOpen ? 'active' : ''}`}
          title="읽기 기록 서재"
        >
          <img src="/icons/more.png" alt="더보기" className="nav-icon" />
          <span className="nav-label">더보기</span>
        </button>
      </div>
      <HistorySheet isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </>
  );
}

export default App;
