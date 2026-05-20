import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsSheet from '../components/SettingsSheet';

export default function DailyMass() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [readings, setReadings] = useState([]);
  const [loadingReadings, setLoadingReadings] = useState(false);

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

  // Fetch parsed daily mass readings for shortcuts
  useEffect(() => {
    setLoadingReadings(true);
    setReadings([]);
    
    fetch(`/api/mass?date=${formattedDate}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.readings) {
          setReadings(data.readings);
        }
        setLoadingReadings(false);
      })
      .catch(err => {
        console.error('Failed to fetch readings:', err);
        setLoadingReadings(false);
      });
  }, [formattedDate]);

  const cbckLink = `https://missa.cbck.or.kr/DailyMissa/${formattedDate}`;
  const universalisLink = `https://universalis.com/australia.brisbane/${formattedDate}/mass.htm`;

  return (
    <div className="search-wrapper" style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 스크린샷 완벽 싱크로율 헤더 */}
      <header className="home-header">
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

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: '32px' }}>
        {/* 중앙 캘린더 서클 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '96px', height: '96px', borderRadius: '50%', backgroundColor: 'var(--secondary-bg)', border: '2.5px solid rgba(44,44,44,0.1)', color: 'var(--mass-accent)' }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>

        {/* 텍스트 정보 */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '900', margin: 0 }}>매일미사 외부 연결</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #777)', maxWidth: '280px', margin: '0 auto', lineHeight: '1.5', fontWeight: '500' }}>
            선택하신 날짜의 매일미사는 각 공식 웹사이트에서 직접 확인하실 수 있습니다.
          </p>
        </div>

        {/* 외부 연결 버튼 */}
        <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <a
            href={cbckLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '16px 20px', backgroundColor: '#555d44', color: '#fff', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.95rem', textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          >
            <span>한국 가톨릭 매일미사</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>

          <a
            href={universalisLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '16px 20px', backgroundColor: 'var(--secondary-bg)', color: 'var(--text-color)', border: '2.5px solid rgba(44,44,44,0.1)', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.95rem', textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          >
            <span>Universalis (English)</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>

          {/* 오늘의 말씀 바로가기 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted, #777)', letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: '4px', textAlign: 'left' }}>
              오늘의 말씀 바로가기
            </div>
            
            {loadingReadings && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'var(--secondary-bg)', borderRadius: '16px', border: '2.5px solid rgba(44,44,44,0.1)', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" />
                  <path d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
                </svg>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>구절 정보 불러오는 중...</span>
              </div>
            )}
            
            {!loadingReadings && readings.length > 0 && readings.map((r, idx) => (
              <button
                key={idx}
                onClick={() => {
                  navigate(`/read/${r.bookId}/${r.chapter}#v-${r.bookId}-${r.chapter}-${r.verse}`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '16px 20px',
                  backgroundColor: 'var(--secondary-bg)',
                  color: 'var(--text-color)',
                  border: '2.5px solid rgba(44,44,44,0.1)',
                  borderRadius: '16px',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                  transition: 'transform 0.15s ease, background-color 0.15s ease'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    color: r.type === '복음' ? 'var(--reading-accent-pink, #d6336c)' : 'var(--ot-accent, #555d44)',
                    backgroundColor: r.type === '복음' ? 'rgba(214, 51, 108, 0.1)' : 'rgba(85, 93, 68, 0.1)',
                    padding: '3px 8px',
                    borderRadius: '8px'
                  }}>
                    {r.type}
                  </span>
                  <span>{r.bookName} {r.range}</span>
                </span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><path d="m9 18 6-6-6-6"/></svg>
              </button>
            ))}

            {!loadingReadings && readings.length === 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '14px', backgroundColor: 'var(--secondary-bg)', borderRadius: '16px', border: '2.5px solid rgba(44,44,44,0.1)', fontStyle: 'italic' }}>
                연결된 성경 구절 정보가 없습니다.
              </div>
            )}
          </div>
        </div>
      </main>

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
