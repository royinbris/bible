import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBible } from '../context/BibleContext';
import { bibleMetadata } from '../lib/bibleInfo';

export default function HistorySheet({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { 
    historyLogs, 
    togglePin, 
    setIsContinueMode,
    myVerses,
    deleteMyVerse
  } = useBible();

  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' or 'bookmark'
  const [toast, setToast] = useState(null);

  const getAbbreviatedBookName = (bookName) => {
    if (!bookName) return '';
    const found = Object.values(bibleMetadata).find(m => m.full === bookName);
    return found ? found.abbrev : bookName;
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // Prevent background scrolling when sheet is open
  useEffect(() => {
    if (isOpen) {
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

  const handleVerseClick = (verse) => {
    setIsContinueMode(false);
    const firstVerseNum = verse.verseRange.split('-')[0].split(',')[0];
    const hash = `#v-${verse.bookId}-${verse.chapter}-${firstVerseNum}`;
    navigate(`/read/${verse.bookId}/${verse.chapter}${hash}`);
    onClose();
  };

  const handleCopyVerse = (e, verse) => {
    e.stopPropagation();
    const textToCopy = `[${verse.bookName}] ${verse.chapter}장 ${verse.verseRange}절\n${verse.content}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => showToast('클립보드에 복사되었습니다. ✨'))
        .catch(() => fallbackCopy(textToCopy));
    } else {
      fallbackCopy(textToCopy);
    }
  };

  const fallbackCopy = (text) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('클립보드에 복사되었습니다. ✨');
    } catch (err) {
      showToast('복사에 실패했습니다.');
    }
  };

  const handleDeleteVerse = (e, id) => {
    e.stopPropagation();
    deleteMyVerse(id);
    showToast('책갈피가 삭제되었습니다.');
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
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
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
                        {log.bookName} {log.chapter}장{log.verseNum ? ` ${log.verseNum}절` : ''}
                      </div>
                      <div className="card-subheading">
                        {log.subtitleText || `${log.chapter}장 읽기`}
                      </div>
                    </div>
                    <button 
                      className="card-circle-selector pinned-checked"
                      onClick={(e) => { e.stopPropagation(); handleLogClick(log); }}
                      title="성경 구절로 이동"
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
                        {activeLog.bookName} {activeLog.chapter}장{activeLog.verseNum ? ` ${activeLog.verseNum}절` : ''}
                      </div>
                      <div className="card-subheading">
                        {activeLog.subtitleText || `${activeLog.chapter}장 읽기`}
                      </div>
                    </div>
                    <button 
                      className="card-circle-selector"
                      onClick={(e) => { e.stopPropagation(); handleLogClick(activeLog); }}
                      title="성경 구절로 이동"
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
                        {log.bookName} {log.chapter}장{log.verseNum ? ` ${log.verseNum}절` : ''}
                      </div>
                      <div className="card-subheading">
                        {log.subtitleText || `${log.chapter}장 읽기`}
                      </div>
                    </div>
                    <button 
                      className="card-circle-selector"
                      onClick={(e) => { e.stopPropagation(); handleLogClick(log); }}
                      title="성경 구절로 이동"
                    />
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Bookmark Tab - Dynamic MyVerses cards rendering */
            myVerses.length === 0 ? (
              <div className="sheet-empty-state">
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔖</div>
                저장된 책갈피가 없습니다.<br/>은혜로운 구절을 책갈피로 저장해보세요!
              </div>
            ) : (
              <div className="history-cards-list">
                {myVerses.map(verse => (
                  <div 
                    key={verse.id} 
                    className="history-card my-verse"
                    onClick={() => handleVerseClick(verse)}
                  >
                    <div className="card-info-group">
                      <div className="card-ref-title olive-theme">
                        {getAbbreviatedBookName(verse.bookName)} {verse.chapter}장 {verse.verseRange}절
                      </div>
                      <div className="card-subheading">
                        {verse.content}
                      </div>
                    </div>
                    
                    {/* Floating Copy & Trash Action Buttons */}
                    <div className="card-actions-wrapper" onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="card-action-btn copy-btn" 
                        onClick={(e) => handleCopyVerse(e, verse)}
                        title="구절 복사"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                      <button 
                        className="card-action-btn delete-btn" 
                        onClick={(e) => handleDeleteVerse(e, verse.id)}
                        title="책갈피 삭제"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
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
