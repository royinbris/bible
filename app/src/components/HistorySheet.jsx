import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBible } from '../context/BibleContext';

export default function HistorySheet({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { 
    historyLogs, 
    togglePin, 
    setIsContinueMode 
  } = useBible();

  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' or 'bookmark'
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // Prevent background scrolling when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Restructure history log data into 1-column sequence (Mockup Matcher)
  // 1A. Pinned logs (붉은/분홍 박스: 붙박이)
  const pinnedLogs = historyLogs.filter(log => log.isPinned);

  // 1B. Unpinned logs (일반 기록)
  const unpinnedLogs = historyLogs.filter(log => !log.isPinned);

  // 1C. Most recent active reading log (녹색 박스: 가장 최근 읽기 기록)
  const activeLog = unpinnedLogs.length > 0 ? unpinnedLogs[0] : null;

  // 1D. Rest of the normal unpinned logs
  const normalLogs = unpinnedLogs.length > 1 ? unpinnedLogs.slice(1) : [];

  const handleLogClick = (log) => {
    // Disable continue read mode if opening a general history item
    setIsContinueMode(false);
    
    const hash = log.verseNum ? `#v-${log.bookId}-${log.chapter}-${log.verseNum}` : '';
    navigate(`/read/${log.bookId}/${log.chapter}${hash}`);
    onClose();
  };

  const handleTogglePin = (e, log) => {
    e.stopPropagation();
    const result = togglePin(log.id);
    if (result && result.message) {
      showToast(result.message);
    }
  };

  return (
    <div 
      className="history-overlay"
      onClick={onClose}
    >
      <div 
        className="history-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar for visual sheet indicator */}
        <div className="sheet-drag-handle" onClick={onClose}>
          <div className="sheet-drag-bar"></div>
        </div>

        {/* Top Header Row with Capsules & Close Button */}
        <div className="sheet-header-row">
          <div className="sheet-tab-capsule">
            <button 
              className={`sheet-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              읽기 기록
            </button>
            <button 
              className={`sheet-tab-btn ${activeTab === 'bookmark' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookmark')}
            >
              책갈피
            </button>
          </div>
          <button className="sheet-close-btn" onClick={onClose} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Logs Container */}
        <div className="sheet-content-area">
          {activeTab === 'timeline' ? (
            historyLogs.length === 0 ? (
              <div className="sheet-empty-state">
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📖</div>
                독서 기록이 아직 없습니다.<br/>성경 읽기를 시작해 보세요!
              </div>
            ) : (
              <div className="history-cards-list">
                {/* 1. Pinned Cards (붉은 박스: 붙박이) */}
                {pinnedLogs.map(log => (
                  <div 
                    key={log.id} 
                    className="history-card pinned"
                    onClick={() => handleLogClick(log)}
                  >
                    <div className="card-info-group">
                      <div className="card-ref-title pink-theme">
                        {log.bookName} {log.chapter}장
                      </div>
                      <div className="card-subheading">
                        {log.subtitleText || `${log.chapter}장 읽기`}
                      </div>
                    </div>
                    <button 
                      className="card-circle-selector pinned-checked"
                      onClick={(e) => handleTogglePin(e, log)}
                      title="핀 고정 해제"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </button>
                  </div>
                ))}

                {/* 2. Most Recent Reading Card (녹색 박스: 가장 최근 기록) */}
                {activeLog && (
                  <div 
                    key={activeLog.id} 
                    className="history-card active"
                    onClick={() => handleLogClick(activeLog)}
                  >
                    <div className="card-info-group">
                      <div className="card-ref-title">
                        <span className="recent-badge">최근</span>
                        {activeLog.bookName} {activeLog.chapter}장
                      </div>
                      <div className="card-subheading">
                        {activeLog.subtitleText || `${activeLog.chapter}장 읽기`}
                      </div>
                    </div>
                    <button 
                      className="card-circle-selector"
                      onClick={(e) => handleTogglePin(e, activeLog)}
                      title="핀 고정"
                    />
                  </div>
                )}

                {/* 3. Normal Reading Cards */}
                {normalLogs.map(log => (
                  <div 
                    key={log.id} 
                    className="history-card normal"
                    onClick={() => handleLogClick(log)}
                  >
                    <div className="card-info-group">
                      <div className="card-ref-title">
                        {log.bookName} {log.chapter}장
                      </div>
                      <div className="card-subheading">
                        {log.subtitleText || `${log.chapter}장 읽기`}
                      </div>
                    </div>
                    <button 
                      className="card-circle-selector"
                      onClick={(e) => handleTogglePin(e, log)}
                      title="핀 고정"
                    />
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Bookmark Tab - Mocked for copy-paste bookmark feature */
            <div className="sheet-empty-state">
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔖</div>
              <p style={{ fontWeight: '600', margin: '0 0 8px 0', color: 'var(--text-color, #1e293b)' }}>복사한 구절 책갈피 목록</p>
              구절 복사하기에서 추가된 책갈피가<br/>여기에 차곡차곡 쌓일 예정입니다!
            </div>
          )}
        </div>
      </div>

      {/* Floating dynamic custom toast */}
      {toast && (
        <div className="sheet-toast-popup">
          {toast}
        </div>
      )}
    </div>
  );
}
