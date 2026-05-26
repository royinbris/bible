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

// ──────────────────────────────────────────────
// 하단막대 개별 메뉴 아이템 아이콘 컴포넌트
// ──────────────────────────────────────────────

function MassKoIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>;
}
function MassEnIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>;
}

// ──────────────────────────────────────────────
// GlobalBottomBar (전면 개편)
// ──────────────────────────────────────────────

function GlobalBottomBar() {
  const {
    isSpeaking, ttsHandlers,
    myVerses,
    massActiveTab, setMassActiveTab,
    massReadings, massOverlay, setMassOverlay,
    massMeditationText,
    setIsContinueMode,
  } = useBible();

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBarsVisible, setIsBarsVisible] = useState(true);
  const [isIndividualMenu, setIsIndividualMenu] = useState(false); // false=기본메뉴, true=개별메뉴
  const [previewPanel, setPreviewPanel] = useState(null); // null | 'prayer' | 'bible'

  // 내생각(myThought) 상태
  const [myThought, setMyThought] = useState(() => localStorage.getItem('my_thought') || '');
  const [myThoughtDraft, setMyThoughtDraft] = useState('');
  const [isEditingThought, setIsEditingThought] = useState(false);

  // 무작위 구절 상태
  const [randomVerse, setRandomVerse] = useState(null);

  const lastScrollYRef = useRef(0);
  const isFirstScrollRef = useRef(true);

  const navigate = useNavigate();
  const location = useLocation();

  const isMassPage = location.pathname.startsWith('/mass');
  const isPrayerPage = location.pathname.startsWith('/prayers');
  const isBiblePage = !isMassPage && !isPrayerPage;

  // 미사 readings 파생
  const massReading1 = massReadings?.find(r => r.type === '독서1');
  const massReading2 = massReadings?.find(r => r.type === '독서2');
  const massGospel = massReadings?.find(r => r.type === '복음');

  // 페이지 이동 시 기본 메뉴로 초기화 & 미리보기 패널 닫기
  useEffect(() => {
    setIsIndividualMenu(false);
    setPreviewPanel(null);
    setIsBarsVisible(true);
    isFirstScrollRef.current = true;
  }, [location.pathname]);

  // 무작위 구절 뽑기
  const pickRandomVerse = () => {
    if (myVerses && myVerses.length > 0) {
      const picked = myVerses[Math.floor(Math.random() * myVerses.length)];
      setRandomVerse(picked);
    } else {
      const picked = FALLBACK_VERSES[Math.floor(Math.random() * FALLBACK_VERSES.length)];
      setRandomVerse(picked);
    }
  };

  // 성경 미리보기 패널 열 때 무작위 구절 추첨
  useEffect(() => {
    if (previewPanel === 'bible') {
      pickRandomVerse();
    }
  }, [previewPanel]);

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

  // 내생각 저장
  const handleSaveThought = () => {
    const trimmed = myThoughtDraft.trim();
    localStorage.setItem('my_thought', trimmed);
    setMyThought(trimmed);
    setIsEditingThought(false);
  };

  const handleGlobalTtsToggle = () => {
    if (isSpeaking) {
      if (ttsHandlers && typeof ttsHandlers.stop === 'function') {
        ttsHandlers.stop();
      }
    } else {
      const isPlayablePage = location.pathname.startsWith('/read/') ||
                             location.pathname.startsWith('/mass') ||
                             location.pathname.startsWith('/prayers/');
      if (isPlayablePage) {
        if (ttsHandlers && typeof ttsHandlers.play === 'function') {
          ttsHandlers.play();
        } else if (ttsHandlers && typeof ttsHandlers.resume === 'function') {
          ttsHandlers.resume();
        } else {
          alert("낭독을 시작할 수 없습니다. 본문 화면에 있는 재생 버튼을 이용해 주세요.");
        }
      } else {
        alert("성경 읽기, 매일미사 또는 기도문 상세 화면에서 낭독을 시작할 수 있습니다.");
      }
    }
  };

  // ◉ 버튼 클릭
  const handleCircleBtn = () => {
    setIsIndividualMenu(prev => !prev);
    setPreviewPanel(null);
  };

  // 기본 메뉴 클릭 핸들러
  const handleBasicPrayer = () => {
    setPreviewPanel(prev => prev === 'prayer' ? null : 'prayer');
  };
  const handleBasicMass = () => {
    setPreviewPanel(null);
    navigate('/mass');
  };
  const handleBasicBible = () => {
    setPreviewPanel(prev => prev === 'bible' ? null : 'bible');
  };
  const handleBasicSettings = () => {
    setPreviewPanel(null);
    setIsSettingsOpen(true);
  };

  // 미사 개별 메뉴: DailyMass의 setActiveTab/setSelectedOverlayReading은 BibleContext를 통해 연동
  // → setMassActiveTab을 직접 호출하면 DailyMass의 useEffect가 감지하여 동기화됨
  // (단, DailyMass가 마운트되어 있을 때만 유효)

  // ◉ 버튼 SVG
  const CircleBtn = ({ active }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      {active ? (
        <circle cx="12" cy="12" r="4" fill="currentColor"/>
      ) : (
        <circle cx="12" cy="12" r="4"/>
      )}
    </svg>
  );

  // 기본 메뉴 활성화 여부
  const isPrayerActive = isPrayerPage || previewPanel === 'prayer';
  const isMassActive = isMassPage || previewPanel === 'mass';
  const isBibleActive = (isBiblePage && !isPrayerPage) || previewPanel === 'bible';

  return (
    <>
      {/* 미리보기 패널 바깥 클릭 시 닫기 오버레이 */}
      {previewPanel && (
        <div
          onClick={() => setPreviewPanel(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1290,
            backgroundColor: 'transparent'
          }}
        />
      )}

      {/* ── 기도 미리보기 패널 ── */}
      {previewPanel === 'prayer' && (
        <div
          style={{
            position: 'fixed',
            bottom: '62px',
            left: '8px',
            right: '8px',
            zIndex: 1295,
            backgroundColor: 'var(--secondary-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
            animation: 'slideUpFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <img src="/icons/prayer.png" alt="기도" style={{ width: '20px', height: '20px' }} />
            <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-color)' }}>나의 기도</span>
          </div>

          {/* 내생각 영역 */}
          {isEditingThought ? (
            <div style={{ marginBottom: '14px' }}>
              <textarea
                autoFocus
                value={myThoughtDraft}
                onChange={e => setMyThoughtDraft(e.target.value)}
                placeholder="오늘 나의 기도를 적어보세요..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--primary-color)',
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-color)',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={handleSaveThought}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px',
                    backgroundColor: 'var(--primary-color)', color: 'white',
                    border: 'none', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >저장</button>
                <button
                  onClick={() => setIsEditingThought(false)}
                  style={{
                    padding: '10px 16px', borderRadius: '10px',
                    backgroundColor: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)', fontSize: '0.9rem', cursor: 'pointer'
                  }}
                >취소</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => { setMyThoughtDraft(myThought); setIsEditingThought(true); }}
              style={{
                marginBottom: '14px',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-color)',
                border: '1px dashed var(--border-color)',
                cursor: 'pointer',
                minHeight: '56px',
                color: myThought ? 'var(--text-color)' : 'var(--text-muted)',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
              }}
            >
              {myThought || '오늘 나의 기도를 적어보세요... ✏️'}
            </div>
          )}

          {/* 추천기도 바로가기 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setPreviewPanel(null); navigate('/prayers'); }}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px',
                backgroundColor: 'rgba(163, 21, 69, 0.08)',
                color: 'var(--primary-color)',
                border: '1px solid rgba(163, 21, 69, 0.15)',
                fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              기도문 목록
            </button>
            <button
              onClick={() => { setPreviewPanel(null); setIsHistoryOpen(true); }}
              style={{
                padding: '10px 14px', borderRadius: '10px',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              읽기기록
            </button>
          </div>
        </div>
      )}

      {/* ── 성경 미리보기 패널 ── */}
      {previewPanel === 'bible' && (
        <div
          style={{
            position: 'fixed',
            bottom: '62px',
            left: '8px',
            right: '8px',
            zIndex: 1295,
            backgroundColor: 'var(--secondary-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
            animation: 'slideUpFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/icons/bible.png" alt="성경" style={{ width: '20px', height: '20px' }} />
              <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-color)' }}>오늘의 말씀</span>
            </div>
            <button
              onClick={pickRandomVerse}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              새로고침
            </button>
          </div>

          {/* 무작위 구절 카드 */}
          {randomVerse && (
            <div style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-color)',
              border: '1px solid var(--border-color)',
              marginBottom: '14px',
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '6px', opacity: 0.8 }}>
                {randomVerse.bookName} {randomVerse.chapter}:{randomVerse.verseNum || randomVerse.verseRange}
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-color)', lineHeight: '1.65', fontFamily: 'Gowun Batang, Georgia, serif' }}>
                "{randomVerse.content}"
              </div>
            </div>
          )}

          {/* 성경 이동 버튼들 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setPreviewPanel(null); navigate('/list/신약'); }}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px',
                backgroundColor: 'rgba(166, 75, 42, 0.08)',
                color: 'var(--ot-accent)',
                border: '1px solid rgba(166, 75, 42, 0.15)',
                fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer'
              }}
            >📖 성경읽기</button>
            <button
              onClick={() => { setPreviewPanel(null); setIsContinueMode(true); navigate('/plan'); }}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px',
                backgroundColor: 'rgba(163, 21, 69, 0.08)',
                color: 'var(--primary-color)',
                border: '1px solid rgba(163, 21, 69, 0.15)',
                fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer'
              }}
            >📚 한권읽기</button>
            <button
              onClick={() => { setPreviewPanel(null); navigate('/search'); }}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer'
              }}
            >🔍 검색</button>
          </div>
        </div>
      )}

      {/* ── 하단막대 본체 ── */}
      <div
        className="global-bottom-bar"
        style={{
          transform: isBarsVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1300,
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
                  title="독서1"
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
                  title="복음"
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
                  title="오늘의 묵상"
                >
                  <span style={{ fontSize: '0.55rem', fontWeight: '800', color: massMeditationText ? '#10b981' : '#888', backgroundColor: massMeditationText ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: '4px', maxWidth: '45px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1' }}>
                    {massMeditationText ? '묵상' : '-'}
                  </span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 'bold', marginTop: '1px' }}>묵상</span>
                </button>

                {/* TTS */}
                <button
                  onClick={handleGlobalTtsToggle}
                  className={`global-bottom-btn ${isSpeaking ? 'active' : ''}`}
                  style={{ flexDirection: 'column', gap: '2px', padding: '6px 0' }}
                  title={isSpeaking ? '낭독 정지' : '음성 낭독'}
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
                <button onClick={() => { navigate('/prayers'); setIsIndividualMenu(false); }} className={`global-bottom-btn ${location.pathname === '/prayers' ? 'active' : ''}`} title="추천 기도문">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                  <span className="nav-label">추천</span>
                </button>
                <button onClick={() => navigate('/prayers')} className="global-bottom-btn" title="기도문 목록">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                  <span className="nav-label">목록</span>
                </button>
                <button onClick={() => navigate('/search')} className="global-bottom-btn" title="성경 검색">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <span className="nav-label">검색</span>
                </button>
                <button onClick={handleGlobalTtsToggle} className={`global-bottom-btn ${isSpeaking ? 'active' : ''}`} title={isSpeaking ? '낭독 정지' : 'TTS'}>
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
                  onClick={() => { navigate('/list/신약'); setIsIndividualMenu(false); }}
                  className={`global-bottom-btn ${(location.pathname.startsWith('/list/') || location.pathname.startsWith('/book/') || location.pathname.startsWith('/read/')) ? 'active' : ''}`}
                  title="성경읽기"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  <span className="nav-label">성경읽기</span>
                </button>
                <button
                  onClick={() => { setIsContinueMode(true); navigate('/plan'); setIsIndividualMenu(false); }}
                  className={`global-bottom-btn ${location.pathname.startsWith('/plan') ? 'active' : ''}`}
                  title="한권읽기"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
                  <span className="nav-label">한권읽기</span>
                </button>
                <button
                  onClick={() => { navigate('/search'); setIsIndividualMenu(false); }}
                  className={`global-bottom-btn ${location.pathname.startsWith('/search') ? 'active' : ''}`}
                  title="성경 검색"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <span className="nav-label">검색</span>
                </button>
                <button onClick={handleGlobalTtsToggle} className={`global-bottom-btn ${isSpeaking ? 'active' : ''}`} title={isSpeaking ? '낭독 정지' : 'TTS'}>
                  {isSpeaking ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
                  )}
                  <span className="nav-label">TTS</span>
                </button>
              </>
            )}

            {/* ◉ 전환 버튼 — 오른쪽 고정 */}
            <button
              onClick={handleCircleBtn}
              className="global-bottom-btn active"
              title="기본 메뉴로"
              style={{ marginLeft: 'auto' }}
            >
              <CircleBtn active={true} />
              <span className="nav-label" style={{ color: 'var(--primary-color)' }}>기본</span>
            </button>
          </>
        ) : (
          /* ══ 기본 메뉴 ══ */
          <>
            {/* 기도 */}
            <button
              onClick={handleBasicPrayer}
              className={`global-bottom-btn ${isPrayerActive ? 'active' : ''}`}
              title="기도"
            >
              <img src="/icons/prayer.png" alt="기도" className="nav-icon" />
              <span className="nav-label">기도</span>
            </button>

            {/* 미사 */}
            <button
              onClick={handleBasicMass}
              className={`global-bottom-btn ${isMassActive ? 'active' : ''}`}
              title="매일 미사"
            >
              <img src="/icons/mass.png" alt="미사" className="nav-icon" />
              <span className="nav-label">미사</span>
            </button>

            {/* 성경 */}
            <button
              onClick={handleBasicBible}
              className={`global-bottom-btn ${isBibleActive ? 'active' : ''}`}
              title="성경"
            >
              <img src="/icons/bible.png" alt="성경" className="nav-icon" />
              <span className="nav-label">성경</span>
            </button>

            {/* 설정 */}
            <button
              onClick={handleBasicSettings}
              className={`global-bottom-btn ${isSettingsOpen ? 'active' : ''}`}
              title="설정"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.72V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              <span className="nav-label">설정</span>
            </button>

            {/* ◉ 전환 버튼 — 오른쪽 고정 */}
            <button
              onClick={handleCircleBtn}
              className="global-bottom-btn"
              title="개별 메뉴 열기"
              style={{ marginLeft: 'auto' }}
            >
              <CircleBtn active={false} />
              <span className="nav-label">◉</span>
            </button>
          </>
        )}
      </div>

      <HistorySheet isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}

export default App;
