import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import SettingsSheet from '../components/SettingsSheet';
import { useSettings } from '../context/SettingsContext';
import { BIBLE_DB_KEY } from '../lib/bibleInfo';

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

  // 📖 성경 구절 오버레이 시트 상태
  const [selectedOverlayReading, setSelectedOverlayReading] = useState(null); // { bookId, chapter, verse, bookName, range } | null
  const [overlayVerses, setOverlayVerses] = useState([]);
  const [overlayBookName, setOverlayBookName] = useState('');
  const [overlaySubheadings, setOverlaySubheadings] = useState([]);
  const [isClosing, setIsClosing] = useState(false);
  
  // 🖐️ 드래그 앤 드롭 제스처 상태
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const currentTranslateY = useRef(0);
  const dragHandleRef = useRef(null);

  // 오버레이 닫기 핸들러 (슬라이드 애니메이션 적용)
  const handleCloseOverlay = () => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedOverlayReading(null);
      setIsClosing(false);
      setTranslateY(0);
    }, 500); // 500ms 애니메이션 시간 동안 대기 (더 부드러운 전환)
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

  // 성경 구절 오버레이 로드
  useEffect(() => {
    if (!selectedOverlayReading) {
      setOverlayVerses([]);
      setOverlaySubheadings([]);
      setOverlayBookName('');
      return;
    }

    const { bookId, chapter } = selectedOverlayReading;
    localforage.getItem(BIBLE_DB_KEY).then(data => {
      if (data && data.books) {
        const foundBook = data.books.find(b => b.id === parseInt(bookId, 10));
        if (foundBook) {
          setOverlayBookName(foundBook.name);
          const foundChap = foundBook.chapters.find(ch => ch.c === parseInt(chapter, 10));
          if (foundChap) {
            setOverlayVerses(foundChap.v || []);
            setOverlaySubheadings(foundChap.subheadings || []);
          }
        }
      }
    }).catch(err => {
      console.error('Failed to load overlay verses:', err);
    });
  }, [selectedOverlayReading]);

  // 오버레이가 로드되면 해당 시작 구절로 자동 스크롤
  useEffect(() => {
    if (overlayVerses.length > 0 && selectedOverlayReading) {
      setTimeout(() => {
        const targetEl = document.getElementById(`overlay-v-${selectedOverlayReading.verse}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [overlayVerses, selectedOverlayReading]);

  // 프록시 HTML 주소로 변경하여 Same-Origin 상태에서 스크롤 수신
  const cbckLink = `/api/mass-html?type=ko&date=${formattedDate}`;
  const universalisLink = `/api/mass-html?type=en&date=${formattedDate}`;

  // iframe 내 스크롤 메세지 감지 (헤더 활성화 시에만 동작)
  useEffect(() => {
    if (!SHOW_HEADER) return;

    const handleMessage = (event) => {
      if (event.data && event.data.type === 'iframeScroll') {
        if (event.data.direction === 'up') {
          setIsHeaderVisible(true);
        } else if (event.data.direction === 'down') {
          setIsHeaderVisible(false);
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
  const currentBackdropColor = isClosing 
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
        backgroundColor: '#fff',
        overflow: 'hidden',
        marginTop: 'env(safe-area-inset-top, 20px)'
      }}>
        <iframe
          key={`${activeTab}-${formattedDate}`} // Forces iframe recreation on tab or date change
          src={activeTab === 'ko' ? cbckLink : universalisLink}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="매일미사 뷰어"
        />
      </div>

      {/* 4. 하단 탭 & 바로가기 바 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '8px 12px env(safe-area-inset-bottom, 12px)',
        backgroundColor: 'var(--secondary-bg)',
        borderTop: '1px solid rgba(44,44,44,0.1)',
        flexShrink: 0,
        zIndex: 50,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.02)'
      }}>
        {/* 한글미사 탭 */}
        <button
          onClick={() => setActiveTab('ko')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: activeTab === 'ko' ? 'var(--ot-accent, #555d44)' : 'var(--text-muted, #888)',
            fontWeight: 'bold',
            fontSize: '0.75rem',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '12px',
            backgroundColor: activeTab === 'ko' ? 'rgba(85, 93, 68, 0.08)' : 'transparent',
            transition: 'all 0.2s ease',
            flex: 1,
            maxWidth: '80px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <span style={{ marginTop: '2px' }}>한글미사</span>
        </button>

        {/* 영어미사 탭 */}
        <button
          onClick={() => setActiveTab('en')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: activeTab === 'en' ? 'var(--ot-accent, #555d44)' : 'var(--text-muted, #888)',
            fontWeight: 'bold',
            fontSize: '0.75rem',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '12px',
            backgroundColor: activeTab === 'en' ? 'rgba(85, 93, 68, 0.08)' : 'transparent',
            transition: 'all 0.2s ease',
            flex: 1,
            maxWidth: '80px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
          <span style={{ marginTop: '2px' }}>영어미사</span>
        </button>

        {/* 세로 구분선 */}
        <div style={{ width: '1.5px', height: '28px', backgroundColor: 'rgba(44,44,44,0.1)', margin: '0 4px' }} />

        {/* 독서1 바로가기 */}
        <button
          onClick={() => {
            if (reading1) {
              setSelectedOverlayReading({
                ...reading1,
                lang: activeTab === 'en' ? 'en' : (settings.bibleLanguage || 'ko')
              });
            }
          }}
          disabled={!reading1}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: reading1 ? 'var(--text-color)' : 'var(--text-muted, #ccc)',
            fontWeight: 'bold',
            fontSize: '0.75rem',
            cursor: reading1 ? 'pointer' : 'not-allowed',
            padding: '8px 6px',
            flex: 1,
            maxWidth: '75px',
            opacity: reading1 ? 1 : 0.4,
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{
            fontSize: '0.62rem',
            fontWeight: '800',
            color: reading1 ? 'var(--ot-accent, #555d44)' : '#888',
            backgroundColor: reading1 ? 'rgba(85, 93, 68, 0.1)' : 'rgba(0,0,0,0.05)',
            padding: '2px 6px',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '55px'
          }}>
            {reading1 ? reading1.bookName : '-'}
          </span>
          <span style={{ marginTop: '2px' }}>독서1</span>
        </button>

        {/* 독서2 바로가기 */}
        {reading2 && (
          <button
            onClick={() => {
              setSelectedOverlayReading({
                ...reading2,
                lang: activeTab === 'en' ? 'en' : (settings.bibleLanguage || 'ko')
              });
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: 'var(--text-color)',
              fontWeight: 'bold',
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: '8px 6px',
              flex: 1,
              maxWidth: '75px',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{
              fontSize: '0.62rem',
              fontWeight: '800',
              color: 'var(--ot-accent, #555d44)',
              backgroundColor: 'rgba(85, 93, 68, 0.1)',
              padding: '2px 6px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '55px'
            }}>
              {reading2.bookName}
            </span>
            <span style={{ marginTop: '2px' }}>독서2</span>
          </button>
        )}

        {/* 복음 바로가기 */}
        <button
          onClick={() => {
            if (gospel) {
              setSelectedOverlayReading({
                ...gospel,
                lang: activeTab === 'en' ? 'en' : (settings.bibleLanguage || 'ko')
              });
            }
          }}
          disabled={!gospel}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: gospel ? 'var(--text-color)' : 'var(--text-muted, #ccc)',
            fontWeight: 'bold',
            fontSize: '0.75rem',
            cursor: gospel ? 'pointer' : 'not-allowed',
            padding: '8px 6px',
            flex: 1,
            maxWidth: '75px',
            opacity: gospel ? 1 : 0.4,
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{
            fontSize: '0.62rem',
            fontWeight: '800',
            color: gospel ? 'var(--reading-accent-pink, #d6336c)' : '#888',
            backgroundColor: gospel ? 'rgba(214, 51, 108, 0.1)' : 'rgba(0,0,0,0.05)',
            padding: '2px 6px',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '55px'
          }}>
            {gospel ? gospel.bookName : '-'}
          </span>
          <span style={{ marginTop: '2px' }}>복음</span>
        </button>
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
              height: '80vh',
              transform: isClosing ? 'translateY(100%)' : `translateY(${translateY}px)`,
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
                <span 
                  onClick={toggleLanguage}
                  style={{ 
                    fontSize: '1rem', 
                    fontWeight: 'bold', 
                    color: 'var(--text-color)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                  title="클릭하여 성경 언어 변경 (한글 -> 한영 -> 영어)"
                >
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    color: selectedOverlayReading.type === '복음' ? 'var(--reading-accent-pink, #d6336c)' : 'var(--ot-accent, #555d44)',
                    backgroundColor: selectedOverlayReading.type === '복음' ? 'rgba(214, 51, 108, 0.1)' : 'rgba(85, 93, 68, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {selectedOverlayReading.type}
                  </span>
                  {displayLanguage === 'en' ? (selectedOverlayReading.bookName || overlayBookName) : overlayBookName} {selectedOverlayReading.range}
                </span>
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
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px 40px 20px',
                backgroundColor: 'var(--bg-color)',
                ...overlayReaderStyles
              }}
            >
              <div className="chapter-container">
                <h2 className="chapter-title" style={{ fontSize: '1.25rem', marginBottom: '20px', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: '8px', fontWeight: 'bold', color: 'var(--text-color)' }}>
                  {overlayBookName} {selectedOverlayReading.chapter}장
                </h2>
                
                {overlayVerses.map((verse, idx) => {
                  const subheading = overlaySubheadings.find(s => s.verseId === verse.v);
                  const isHighlight = verse.v === selectedOverlayReading.verse; // 오늘의 미사 시작 구절 강조
                  
                  return (
                    <div key={idx} id={`overlay-v-${verse.v}`}>
                      {subheading && (
                        <div className="subheading-group" style={{ marginTop: '20px', marginBottom: '10px' }}>
                          <h3 className="reader-subheading" style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--ot-accent, #555d44)' }}>
                            {subheading.title}
                          </h3>
                        </div>
                      )}
                      
                      <div 
                        className="verse"
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
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
                            minWidth: '20px',
                            display: 'inline-block'
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
            </div>
          </div>
        </div>
      )}

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
