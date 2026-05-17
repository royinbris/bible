import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBible } from '../context/BibleContext';

export default function HistorySheet({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { 
    historyLogs, 
    togglePin, 
    deleteHistoryLog, 
    clearHistory, 
    setIsContinueMode 
  } = useBible();

  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' or 'pinned'
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

  // Filter logs
  const timelineLogs = historyLogs.filter(log => !log.isPinned);
  const pinnedLogs = historyLogs.filter(log => log.isPinned);

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

  const handleDelete = (e, id) => {
    e.stopPropagation();
    deleteHistoryLog(id);
    showToast('기록이 삭제되었습니다.');
  };

  const handleClearHistory = () => {
    if (window.confirm('핀 고정된 항목을 제외한 최근 읽기 기록을 모두 삭제하시겠습니까?')) {
      clearHistory();
      showToast('읽기 기록이 정리되었습니다.');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  return (
    <div 
      className="history-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        animation: 'fadeIn 0.25s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        className="history-sheet"
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: 'var(--bg-color, #ffffff)',
          color: 'var(--text-color, #1e293b)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.15)',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar for visual sheet indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px 0', cursor: 'pointer' }} onClick={onClose}>
          <div style={{ width: '40px', height: '5px', borderRadius: '3px', backgroundColor: 'rgba(0, 0, 0, 0.15)' }}></div>
        </div>

        {/* Header */}
        <div style={{ padding: '0 20px 10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>독서 서재</h2>
          {activeTab === 'timeline' && timelineLogs.length > 0 && (
            <button 
              onClick={handleClearHistory}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                opacity: 0.85
              }}
            >
              전체 비우기
            </button>
          )}
        </div>

        {/* Custom Tabs */}
        <div style={{ 
          display: 'flex', 
          margin: '0 20px 16px 20px', 
          backgroundColor: 'var(--secondary-bg, #f1f5f9)', 
          borderRadius: '12px',
          padding: '4px',
          boxSizing: 'border-box'
        }}>
          <button 
            onClick={() => setActiveTab('timeline')}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: activeTab === 'timeline' ? 'var(--bg-color, #ffffff)' : 'transparent',
              color: activeTab === 'timeline' ? 'var(--text-color, #1e293b)' : 'var(--text-color, #64748b)',
              boxShadow: activeTab === 'timeline' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            ⏱️ 최근 읽은 기록
          </button>
          <button 
            onClick={() => setActiveTab('pinned')}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: activeTab === 'pinned' ? 'var(--bg-color, #ffffff)' : 'transparent',
              color: activeTab === 'pinned' ? 'var(--text-color, #1e293b)' : 'var(--text-color, #64748b)',
              boxShadow: activeTab === 'pinned' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            📌 핀 고정 체크리스트
          </button>
        </div>

        {/* Logs Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px 20px' }}>
          {activeTab === 'timeline' ? (
            timelineLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📖</div>
                독서 기록이 아직 없습니다.<br/>성경 읽기를 시작해 보세요!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {timelineLogs.map((log, idx) => {
                  const isActive = idx === 0; // The 0-th element is the active reading session
                  return (
                    <div 
                      key={log.id} 
                      onClick={() => handleLogClick(log)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '14px',
                        border: '1px solid',
                        borderColor: isActive ? '#f59e0b' : 'var(--border-color, #e2e8f0)',
                        backgroundColor: isActive ? 'var(--active-bg, #fef3c7)' : 'var(--secondary-bg, #f8fafc)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        boxShadow: isActive ? '0 4px 12px rgba(245, 158, 11, 0.08)' : 'none',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        position: 'relative'
                      }}
                    >
                      {/* Top Row with Badge & Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isActive && (
                            <span style={{ 
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: 'bold'
                            }}>
                              현재 읽는 중
                            </span>
                          )}
                          <span style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 'bold' }}>
                            {formatTime(log.timestamp)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={(e) => handleTogglePin(e, log)}
                            style={{
                              background: 'rgba(0, 0, 0, 0.04)',
                              border: 'none',
                              borderRadius: '50%',
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#64748b'
                            }}
                            title="핀으로 보관하기"
                          >
                            📌
                          </button>
                          <button 
                            onClick={(e) => handleDelete(e, log.id)}
                            style={{
                              background: 'rgba(0, 0, 0, 0.04)',
                              border: 'none',
                              borderRadius: '50%',
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#ef4444'
                            }}
                            title="삭제"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Bible Reference */}
                      <div style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>
                        {log.bookName} {log.chapter}장 {log.verseNum || 1}절
                      </div>

                      {/* Subheading Context */}
                      {log.subtitleText && (
                        <div style={{ 
                          fontSize: '0.85rem', 
                          opacity: 0.8, 
                          fontStyle: 'italic', 
                          borderLeft: '2px solid #84cc16', 
                          paddingLeft: '8px' 
                        }}>
                          {log.subtitleText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            pinnedLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📌</div>
                핀 고정된 즐겨찾기가 없습니다.<br/>최근 읽은 기록 우상단의 핀 아이콘을 눌러<br/>나만의 성경 체크리스트를 고정해 보세요!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pinnedLogs.map((log) => (
                  <div 
                    key={log.id} 
                    onClick={() => handleLogClick(log)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid #fbcfe8',
                      backgroundColor: 'var(--pinned-bg, #fdf2f8)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      transition: 'transform 0.2s',
                      position: 'relative',
                      borderLeft: '4px solid #f472b6' // 핀 고정 카드의 시그니처 핑크 사이드바 바!
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 'bold' }}>
                        📌 고정됨 ({formatTime(log.timestamp)})
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          onClick={(e) => handleTogglePin(e, log)}
                          style={{
                            background: '#f472b6',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white'
                          }}
                          title="핀 고정 해제"
                        >
                          📌
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, log.id)}
                          style={{
                            background: 'rgba(0, 0, 0, 0.04)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#ef4444'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#db2777' }}>
                      {log.bookName} {log.chapter}장 {log.verseNum || 1}절
                    </div>

                    {log.subtitleText && (
                      <div style={{ 
                        fontSize: '0.85rem', 
                        opacity: 0.8, 
                        fontStyle: 'italic', 
                        borderLeft: '2px solid #ec4899', 
                        paddingLeft: '8px' 
                      }}>
                        {log.subtitleText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Floating dynamic custom toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#334155',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '24px',
          fontSize: '0.9rem',
          fontWeight: '600',
          boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
          zIndex: 3000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
