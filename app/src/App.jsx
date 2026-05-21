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
import PrayersList from './pages/PrayersList';
import PrayersDetail from './pages/PrayersDetail';
import HistorySheet from './components/HistorySheet';

function App() {
  const navigate = useNavigate();
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
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/list/:testament" element={<BibleList />} />
            <Route path="/book/:bookId" element={<ChapterList />} />
            <Route path="/read/:bookId/:chapter" element={<Reader />} />
            <Route path="/search" element={<Search />} />
            <Route path="/mass" element={<DailyMass />} />
            <Route path="/prayers" element={<PrayersList />} />
            <Route path="/prayers/:id" element={<PrayersDetail />} />
          </Routes>
          <GlobalHistoryFAB />
        </div>
      </BibleProvider>
    </SettingsProvider>
  );
}

function GlobalHistoryFAB() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBarsVisible, setIsBarsVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  
  const location = useLocation();
  const isReaderPage = location.pathname.startsWith('/read/');
  const isMassPage = location.pathname.startsWith('/mass');

  if (isMassPage) return null;

  // 성경 읽기 화면에서 스크롤 시 기록 버튼도 상/하단 바와 같이 감춤 처리
  useEffect(() => {
    if (!isReaderPage) {
      setIsBarsVisible(true);
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // 최상단 근처 도달 시 무조건 표시
      if (currentScrollY <= 10) {
        setIsBarsVisible(true);
        lastScrollYRef.current = currentScrollY;
        return;
      }
      
      const diff = currentScrollY - lastScrollYRef.current;
      
      // 8px 미만의 미세 스크롤은 필터링
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
  }, [isReaderPage]);

  return (
    <>
      <button 
        className="floating-history-btn" 
        onClick={() => setIsHistoryOpen(true)}
        title="독서 서재"
        style={{
          transform: isBarsVisible ? 'none' : 'translateY(120px)',
          opacity: isBarsVisible ? 1 : 0,
          pointerEvents: isBarsVisible ? 'auto' : 'none',
          transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out'
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/><line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="14"/></svg>
      </button>
      <HistorySheet isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </>
  );
}

export default App;
