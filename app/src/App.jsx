import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import { SettingsProvider } from './context/SettingsContext';
import Home from './pages/Home';
import BibleList from './pages/BibleList';
import ChapterList from './pages/ChapterList';
import Reader from './pages/Reader';
import Search from './pages/Search';

function App() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initDB();
  }, []);

  // Global Touch Swipe Navigation (Back / Forward) & Double Tap Fullscreen Toggle
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTapTime = 0;

    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      if (!touchStartX || !touchStartY) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // 1. Double Tap Detection (300ms threshold)
      const currentTime = new Date().getTime();
      const tapInterval = currentTime - lastTapTime;
      
      if (tapInterval < 300 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        // Double tap confirmed! Toggle Fullscreen
        toggleFullscreenMode();
        
        // Reset coordinates & time to prevent triple tap
        touchStartX = 0;
        touchStartY = 0;
        lastTapTime = 0;
        return;
      }
      
      lastTapTime = currentTime;

      // 2. Strict horizontal guard for Swipe Navigation: horizontal swipe must be at least 1.5x larger than vertical motion
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

    // Double Click listener (for PC testing convenience)
    const handleDoubleClick = () => {
      toggleFullscreenMode();
    };

    const toggleFullscreenMode = () => {
      const isCurrentlyFullscreenActive = document.body.classList.toggle('fullscreen-active');
      
      if (isCurrentlyFullscreenActive) {
        // Attempt browser native fullscreen if available
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (document.documentElement.webkitRequestFullscreen) { // Safari Fallback
          document.documentElement.webkitRequestFullscreen();
        }
      } else {
        // Exit native fullscreen
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
    window.addEventListener('dblclick', handleDoubleClick);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [navigate]);

  const initDB = async () => {
    try {
      const existingData = await localforage.getItem('bibleData_v2');
      if (existingData) {
        setIsFirstRun(false);
        setLoading(false);
        return;
      }
      setIsFirstRun(true);
      const response = await fetch('/bible_data.json');
      if (!response.ok) throw new Error('Failed to fetch bible data');
      const data = await response.json();
      await localforage.setItem('bibleData_v2', data);
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
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/list/:testament" element={<BibleList />} />
          <Route path="/book/:bookId" element={<ChapterList />} />
          <Route path="/read/:bookId/:chapter" element={<Reader />} />
          <Route path="/search" element={<Search />} />
        </Routes>
      </div>
    </SettingsProvider>
  );
}

export default App;
