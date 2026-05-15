import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home({ toggleDarkMode, isDark }) {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 400); // 0.4초 동안 회전 애니메이션 보여준 후 리로드
  };

  return (
    <>
      <header className="header" style={{ borderBottom: 'none', background: 'transparent' }}>
        <div>
          <h1 
            style={{ color: 'var(--text-color)', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onClick={handleRefresh}
          >
            가톨릭 성경
            {isRefreshing && <span className="refresh-icon">↻</span>}
          </h1>
          <div style={{ color: '#d4af37', fontSize: '0.9rem', fontWeight: 'bold' }}>
            {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'vDev'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ 
            background: 'var(--secondary-bg)', 
            padding: '4px 16px', 
            borderRadius: '20px', 
            fontSize: '0.9rem',
            color: '#d4af37'
          }}>
            오늘 날짜
          </div>
          <button className="header-btn" onClick={toggleDarkMode}>
            {isDark ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            )}
          </button>
          <button className="header-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.72V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>

      <div className="home-container">
        {/* Top links */}
        <div className="home-links-grid">
          <a href="https://bible.cbck.or.kr/" target="_blank" rel="noreferrer" className="home-link-card" style={{ borderColor: '#8b6f3b' }}>
            <div style={{ color: '#d4af37', fontWeight: 'bold' }}>가톨릭 성경</div>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>한국 천주교 주교회의</div>
          </a>
          <a href="https://bible.cbck.or.kr/" target="_blank" rel="noreferrer" className="home-link-card" style={{ borderColor: '#8b6f3b' }}>
            <div style={{ color: '#d4af37', fontWeight: 'bold' }}>주석 성경</div>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>한국 천주교 주교회의</div>
          </a>
        </div>

        {/* Main Testaments */}
        <div className="home-testament-grid">
          <div className="home-testament-card" style={{ background: 'linear-gradient(135deg, #4a3b1a, #2a220f)', borderColor: '#8b6f3b' }} onClick={() => navigate('/list/구약')}>
            <div className="card-header">
              <span className="card-icon" style={{ borderColor: '#d4af37', color: '#d4af37' }}>📖</span>
              <span className="card-count">46 / 46</span>
            </div>
            <h2 className="card-title">구약 성경</h2>
            <p className="card-desc">창세기부터 말라키서까지</p>
          </div>
          <div className="home-testament-card" style={{ background: 'linear-gradient(135deg, #1a3b4a, #0f222a)', borderColor: '#3b8b8b' }} onClick={() => navigate('/list/신약')}>
            <div className="card-header">
              <span className="card-icon" style={{ borderColor: '#5bc0be', color: '#5bc0be' }}>📖</span>
              <span className="card-count">27 / 27</span>
            </div>
            <h2 className="card-title">신약 성경</h2>
            <p className="card-desc">마태오 복음서부터 요한 묵시록까지</p>
          </div>
        </div>

        {/* 한권통독 */}
        <div className="read-through-card" onClick={() => {
            // 한권읽기 기능 구현 시 연동 (예: 최근 읽은 곳으로 이동)
            alert("한권읽기 기능은 구현 중입니다.");
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚙️</span>
            <span style={{ color: '#d4af37', fontWeight: 'bold' }}>한권통독</span>
          </div>
          <div style={{ color: '#888', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            기록 없음 <span>›</span>
          </div>
        </div>

        {/* Bottom Modules */}
        <div className="home-modules-grid">
          <div className="home-module-card" style={{ background: '#12261e', borderColor: '#26543b' }}>
            <div className="card-icon-round" style={{ background: '#1a3b2e', color: '#5bc0be' }}>📅</div>
            <h3 className="card-title-sm">매일미사</h3>
            <p className="card-desc-sm">오늘의 말씀과 묵상</p>
          </div>
          <div className="home-module-card" style={{ background: '#241a3a', borderColor: '#4a3b75' }}>
            <div className="card-icon-round" style={{ background: '#35245c', color: '#9b72cf' }}>💜</div>
            <h3 className="card-title-sm">가톨릭 기도문</h3>
            <p className="card-desc-sm">가톨릭 신자가 바치는 기도</p>
          </div>
        </div>
      </div>
    </>
  );
}
