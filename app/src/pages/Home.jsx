import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import SettingsSheet from '../components/SettingsSheet';
import { useBible } from '../context/BibleContext';

export default function Home() {
  const navigate = useNavigate();
  const { continueReadPos, setIsContinueMode } = useBible();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [todayDate, setTodayDate] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [totalChapters, setTotalChapters] = useState(0);

  useEffect(() => {
    if (continueReadPos) {
      localforage.getItem('bibleData_v2').then(data => {
        if (data && data.books) {
          const targetBook = data.books.find(b => b.id.toString() === continueReadPos.bookId.toString());
          if (targetBook && targetBook.chapters) {
            setTotalChapters(targetBook.chapters.length);
          }
        }
      });
    }
  }, [continueReadPos]);

  useEffect(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const day = weekDays[now.getDay()];
    setTodayDate(`${month}월 ${date}일 (${day})`);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const handleContinueReading = () => {
    setIsContinueMode(true);
    if (continueReadPos) {
      const { bookId, chapter, verseNum, subtitleId } = continueReadPos;
      let hash = '';
      if (subtitleId) {
        hash = `#sub-${bookId}-${chapter}-${subtitleId}`;
      } else if (verseNum) {
        hash = `#v-${bookId}-${chapter}-${verseNum}`;
      }
      navigate(`/read/${bookId}/${chapter}${hash}`);
    } else {
      // Default to Genesis (Id: 1) Chapter 1 if no history exists
      navigate('/read/1/1');
    }
  };

  const handleConfigureReadThrough = (e) => {
    e.stopPropagation();
    setIsContinueMode(true);
    navigate('/list/신약');
  };

  return (
    <div className="home-wrapper" style={{ backgroundColor: 'var(--home-bg)', minHeight: '100vh' }}>
      <header className="home-header">
        <div className="header-placeholder"></div> {/* For centering balance */}
        <h1 className="home-main-title">가톨릭 성경</h1>
        
        <div className="header-right">
          <button className="header-btn" onClick={() => navigate('/search')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
          <button className="header-btn" onClick={() => setIsSettingsOpen(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.72V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>

      <main className="home-container">
        {/* ... existing content ... */}
        <div className="home-links-grid">
          <a href="https://bible.cbck.or.kr/" target="_blank" rel="noreferrer" className="home-link-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--ot-accent)', fontWeight: '700', fontSize: '0.95rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              가톨릭 성경
            </div>
            <div className="card-desc" style={{ fontSize: '0.75rem' }}>한국 천주교 주교회의</div>
          </a>
          <a href="https://bible.cbck.or.kr/" target="_blank" rel="noreferrer" className="home-link-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--ot-accent)', fontWeight: '700', fontSize: '0.95rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              주석 성경
            </div>
            <div className="card-desc" style={{ fontSize: '0.75rem' }}>한국 천주교 주교회의</div>
          </a>
        </div>

        <div className="home-testament-grid">
          <div className="home-testament-card" style={{ backgroundColor: 'var(--ot-bg)' }} onClick={() => { setIsContinueMode(false); navigate('/list/구약'); }}>
            <div className="card-badge">46 / 46</div>
            <div className="icon-box" style={{ backgroundColor: 'var(--ot-icon-bg)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ot-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <h2 className="card-title">구약 성경</h2>
          </div>
 
          <div className="home-testament-card" style={{ backgroundColor: 'var(--nt-bg)' }} onClick={() => { setIsContinueMode(false); navigate('/list/신약'); }}>
            <div className="card-badge">27 / 27</div>
            <div className="icon-box" style={{ backgroundColor: 'var(--nt-icon-bg)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--nt-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <h2 className="card-title">신약 성경</h2>
          </div>
        </div>

        <div 
          className="read-through-bar" 
          style={{ 
            backgroundColor: 'var(--reading-bg)', 
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            padding: 0
          }}
        >
          {continueReadPos && totalChapters > 0 && (
            <div 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                bottom: 0, 
                width: `${(continueReadPos.chapter / totalChapters) * 100}%`, 
                backgroundColor: 'var(--reading-accent-pink, rgba(214, 51, 108, 0.22))', 
                pointerEvents: 'none',
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 0
              }} 
            />
          )}
          
          <div 
            className="read-through-section-left"
            onClick={handleConfigureReadThrough}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '16px 20px',
              cursor: 'pointer',
              zIndex: 1,
              flexShrink: 0,
              transition: 'background-color 0.2s ease'
            }}
            title="통독 성경 설정 및 변경"
          >
            <div className="log-badge" style={{ margin: 0, position: 'relative', zIndex: 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              한권통독
            </div>
          </div>

          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '12px 0', opacity: 0.5, zIndex: 1 }}></div>

          <div 
            className="read-through-section-right"
            onClick={handleContinueReading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              padding: '16px 20px',
              cursor: 'pointer',
              zIndex: 1,
              flexGrow: 1,
              transition: 'background-color 0.2s ease'
            }}
            title="마지막 읽던 부분 이어읽기"
          >
            <div className="log-info" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', width: 'auto' }}>
              {continueReadPos ? (
                <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end', textAlign: 'right' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-color)' }}>
                    {continueReadPos.bookName} {continueReadPos.chapter}장 {continueReadPos.verseNum || 1}절
                  </span>
                  {continueReadPos.subtitleText ? (
                    <span style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: 'normal', color: 'var(--text-color)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      - {continueReadPos.subtitleText} ({totalChapters > 0 ? Math.round((continueReadPos.chapter / totalChapters) * 100) : 0}%)
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', opacity: 0.8, color: 'var(--text-color)' }}>
                      진행률 {totalChapters > 0 ? Math.round((continueReadPos.chapter / totalChapters) * 100) : 0}%
                    </span>
                  )}
                </span>
              ) : (
                <span style={{ fontSize: '0.92rem', fontWeight: '500', color: 'var(--text-color)' }}>통독을 시작해 보세요</span>
              )}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </div>
        </div>

        <div className="home-modules-grid">
          <div className="home-module-card" style={{ backgroundColor: 'var(--mass-bg)' }}>
            <div className="icon-box" style={{ backgroundColor: 'var(--mass-icon-bg)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--mass-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <h3 className="card-title">매일미사</h3>
          </div>

          <div className="home-module-card" style={{ backgroundColor: 'var(--prayer-bg)' }}>
            <div className="card-badge" style={{ top: 'auto', bottom: '100px', right: '16px' }}>51</div>
            <div className="icon-box" style={{ backgroundColor: 'var(--prayer-icon-bg)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--prayer-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </div>
            <h3 className="card-title">가톨릭 기도문</h3>
          </div>
        </div>

        <div className="home-footer">
          <button 
            className={`footer-refresh-btn ${isRefreshing ? 'refreshing' : ''}`} 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            <span>{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v05.16.1200'}</span>
          </button>
        </div>
      </main>

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
