import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsSheet from '../components/SettingsSheet';

// 💡 상단 헤더(뒤로가기, 날짜 조절, 설정 버튼 등)를 다시 활성화하려면 이 값을 true로 변경하세요.
const SHOW_HEADER = false;

export default function DailyMass() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [readings, setReadings] = useState([]);
  const [activeTab, setActiveTab] = useState('ko'); // 'ko' = 한글미사, 'en' = 영어미사
  const [isHeaderVisible, setIsHeaderVisible] = useState(true); // 헤더 표시 여부 (SHOW_HEADER가 true일 때 작동)

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

  // Fetch parsed daily mass readings for shortcuts in background (No loading screen blocks the user)
  useEffect(() => {
    setReadings([]);
    
    fetch(`/api/mass?date=${formattedDate}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.readings) {
          setReadings(data.readings);
        }
      })
      .catch(err => {
        console.error('Failed to fetch readings:', err);
      });
  }, [formattedDate]);

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

  // Find individual reading shortcuts
  const reading1 = readings.find(r => r.type === '독서1');
  const reading2 = readings.find(r => r.type === '독서2');
  const gospel = readings.find(r => r.type === '복음');

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

      {/* 3. 중앙 매일미사 iframe 영역 (상태바 높이부터 시작하도록 조정, 차단 로딩 마스크 제거) */}
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
              navigate(`/read/${reading1.bookId}/${reading1.chapter}#v-${reading1.bookId}-${reading1.chapter}-${reading1.verse}`);
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

        {/* 독서2 바로가기 (주일 등 있을 때만 노출) */}
        {reading2 && (
          <button
            onClick={() => {
              navigate(`/read/${reading2.bookId}/${reading2.chapter}#v-${reading2.bookId}-${reading2.chapter}-${reading2.verse}`);
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
              navigate(`/read/${gospel.bookId}/${gospel.chapter}#v-${gospel.bookId}-${gospel.chapter}-${gospel.verse}`);
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

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
