import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useBible } from '../context/BibleContext';
import { useSimpleTTS } from '../hooks/useSimpleTTS';
import SettingsSheet from '../components/SettingsSheet';

export default function PrayersDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { speakingVerseId, isSpeaking, isPaused, ttsHandlers, setTtsSpeed, ttsSpeed } = useBible();
  const [prayer, setPrayer] = useState(null);
  const [prevId, setPrevId] = useState(null);
  const [nextId, setNextId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');

  // 🌟 [추가] 몰입 모드(Zen Mode) 및 나의 기도 편집 상태
  const [isZenMode, setIsZenMode] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [originalSpeed] = useState(ttsSpeed);

  // 🌟 [추가] 기도 진입 시 전용 TTS 속도로 강제 싱크
  useEffect(() => {
    if (settings.prayerTtsRate) {
      setTtsSpeed(settings.prayerTtsRate);
    }
    return () => {
      setTtsSpeed(originalSpeed);
    };
  }, [settings.prayerTtsRate, setTtsSpeed, originalSpeed]);

  // 🎙️ Dynamic useSimpleTTS registration
  useSimpleTTS(useCallback(() => {
    if (!prayer) return [];
    return [
      { id: 'prayer-title', text: prayer.title, lang: 'ko' },
      { id: 'prayer-content', text: prayer.body, lang: 'ko' }
    ];
  }, [prayer]));

  useEffect(() => {
    if (id) {
      loadPrayer(parseInt(id));
    }
  }, [id]);

  const loadPrayer = async (prayerId) => {
    setIsLoading(true);
    try {
      let allPrayers = [];
      const cached = localStorage.getItem('cached_prayers_list');
      const customSaved = localStorage.getItem('custom_prayers');
      
      let customList = [];
      if (customSaved) {
        customList = JSON.parse(customSaved);
      }

      if (cached) {
        allPrayers = JSON.parse(cached);
      } else {
        // Self-healing fallback: Fetch and parse
        const response = await fetch('/data/prayers.md');
        if (!response.ok) throw new Error('기도문 데이터를 불러오는데 실패했습니다.');
        const text = await response.text();
        const lines = text.split('\n');
        
        let currentCategory = null;
        let currentPrayer = null;
        let bodyLines = [];
        let prayerIndex = 1;

        for (let line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('# ') && !trimmed.startsWith('### ')) {
            if (currentPrayer) {
              currentPrayer.body = bodyLines.join('\n').trim();
              allPrayers.push(currentPrayer);
              currentPrayer = null;
              bodyLines = [];
            }
            const fullTitle = trimmed.replace(/^#\s+/, '').trim();
            const match = fullTitle.match(/^(\d+)\.?\s*(.+)/);
            const number = match ? match[1] : String(allPrayers.length + 1);
            currentCategory = { id: parseInt(number) };
            continue;
          }
          if (trimmed.startsWith('### ')) {
            if (currentPrayer) {
              currentPrayer.body = bodyLines.join('\n').trim();
              allPrayers.push(currentPrayer);
              bodyLines = [];
            }
            const title = trimmed.replace(/^###\s+/, '').trim();
            currentPrayer = {
              id: prayerIndex++,
              categoryId: currentCategory ? currentCategory.id : 0,
              title,
              body: '',
              order: allPrayers.length
            };
            continue;
          }
          if (currentPrayer && trimmed !== '') {
            bodyLines.push(line);
          } else if (currentPrayer && trimmed === '' && bodyLines.length > 0) {
            if (bodyLines[bodyLines.length - 1] !== '') {
              bodyLines.push('');
            }
          }
        }
        if (currentPrayer) {
          currentPrayer.body = bodyLines.join('\n').trim();
          allPrayers.push(currentPrayer);
        }
        localStorage.setItem('cached_prayers_list', JSON.stringify(allPrayers));
      }

      // 나의 기도를 목록 앞에 배치하여 순회 가능하게 함
      const combined = [...customList, ...allPrayers];
      const activePrayer = combined.find(p => p.id === prayerId);
      if (activePrayer) {
        setPrayer(activePrayer);
        
        // Find adjacent prayers matching the menu order
        const currentIndex = combined.findIndex(p => p.id === prayerId);
        if (currentIndex !== -1) {
          setPrevId(currentIndex > 0 ? combined[currentIndex - 1].id : null);
          setNextId(currentIndex < combined.length - 1 ? combined[currentIndex + 1].id : null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!prayer) return;
    const text = `${prayer.title}\n\n${prayer.body}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    showToast('기도문 복사 완료!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShare = () => {
    if (!prayer) return;
    if (navigator.share) {
      navigator.share({
        title: prayer.title,
        text: prayer.body,
        url: window.location.href
      }).catch(console.error);
    } else {
      handleCopy();
    }
  };

  // 🌟 [추가] 나의 기도 수정/삭제 핸들러
  const handleOpenEdit = () => {
    if (!prayer) return;
    setEditTitle(prayer.title);
    setEditBody(prayer.body);
    setIsEditModalOpen(true);
  };

  const handleUpdatePrayer = (e) => {
    e.preventDefault();
    if (!editTitle.trim() || !editBody.trim()) {
      alert('제목과 내용을 모두 입력해 주세요.');
      return;
    }
    const customSaved = localStorage.getItem('custom_prayers');
    if (customSaved) {
      const customList = JSON.parse(customSaved);
      const updated = customList.map(p => 
        p.id === prayer.id ? { ...p, title: editTitle, body: editBody } : p
      );
      localStorage.setItem('custom_prayers', JSON.stringify(updated));
      setPrayer({ ...prayer, title: editTitle, body: editBody });
      showToast('기도문이 수정되었습니다.');
    }
    setIsEditModalOpen(false);
  };

  const handleDeletePrayer = () => {
    if (!window.confirm('정말 이 기도를 삭제하시겠습니까?')) return;
    const customSaved = localStorage.getItem('custom_prayers');
    if (customSaved) {
      const customList = JSON.parse(customSaved);
      const updated = customList.filter(p => p.id !== prayer.id);
      localStorage.setItem('custom_prayers', JSON.stringify(updated));
      showToast('기도문이 삭제되었습니다.');
      setTimeout(() => {
        navigate('/prayers');
      }, 800);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const getFontFamilyStyle = (family) => {
    if (family === 'System Default') return 'inherit';
    return family;
  };

  if (isLoading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(166, 75, 42, 0.1)', borderTopColor: '#A64B2A', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
        <p style={{ fontSize: '1rem', fontWeight: '500', opacity: 0.85 }}>기도문을 불러오고 있습니다...</p>
      </div>
    );
  }

  if (!prayer) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>기도문을 찾을 수 없습니다</h3>
        <button onClick={() => navigate('/prayers')} style={{ padding: '12px 24px', backgroundColor: '#A64B2A', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const isCustom = prayer.isCustom || prayer.categoryId === 99;

  return (
    <div 
      className="search-wrapper" 
      style={{ 
        backgroundColor: isZenMode ? '#121212' : 'var(--bg-color)', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'background-color 0.4s ease'
      }}
    >
      {/* Header (몰입 모드일 때는 보이지 않음) */}
      {!isZenMode && (
        <header className="home-header">
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }} onClick={() => navigate('/prayers')}>
            <button className="header-back-btn" style={{ pointerEvents: 'none' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>기도문</span>
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

      {/* 🕯️ 몰입 모드(Zen Mode) 플로팅 종료/조정 버튼 */}
      {isZenMode && (
        <button 
          onClick={() => setIsZenMode(false)}
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            zIndex: 10002,
            backdropFilter: 'blur(4px)'
          }}
          title="몰입 모드 해제"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      )}

      {/* Main Container */}
      <main style={{ flex: 1, overflowY: 'auto', padding: isZenMode ? '60px 24px 120px' : '32px 24px 100px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Header Title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            {!isZenMode && (
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(166, 75, 42, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A64B2A' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
              </div>
            )}
            
            <h2 
              className={speakingVerseId === 'prayer-title' ? 'tts-highlight' : ''}
              style={{
                fontSize: '1.45rem',
                fontWeight: '900',
                color: isZenMode ? '#f8fafc' : 'var(--text-color)',
                margin: 0,
                padding: '4px 12px',
                borderRadius: '8px',
                transition: 'background-color 0.3s ease'
              }}
            >
              {prayer.title}
            </h2>
          </div>

          {/* Action Row (몰입 모드일 때는 보이지 않음) */}
          {!isZenMode && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={handleCopy}
                style={{
                  padding: '12px 18px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--secondary-bg)',
                  border: '2px solid rgba(44,44,44,0.06)',
                  color: 'var(--text-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
              >
                {isCopied ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                )}
                <span>{isCopied ? '복사됨' : '복사하기'}</span>
              </button>

              <button
                onClick={handleShare}
                style={{
                  padding: '12px 18px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--secondary-bg)',
                  border: '2px solid rgba(44,44,44,0.06)',
                  color: 'var(--text-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
                <span>공유하기</span>
              </button>

              {/* 몰입 모드 (Zen Mode) 버튼 */}
              <button
                onClick={() => setIsZenMode(true)}
                style={{
                  padding: '12px 18px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--secondary-bg)',
                  border: '2px solid rgba(44,44,44,0.06)',
                  color: 'var(--text-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
                title="몰입 모드 켜기"
              >
                <span style={{ fontSize: '1.05rem', lineHeight: '1' }}>🕯️</span>
                <span>몰입 모드</span>
              </button>

              {/* 🌟 나의 기도 전용 수정 / 삭제 버튼 */}
              {isCustom && (
                <>
                  <button
                    onClick={handleOpenEdit}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '16px',
                      backgroundColor: 'rgba(16,185,129,0.08)',
                      border: '2px solid rgba(16,185,129,0.2)',
                      color: '#10b981',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.88rem',
                      fontWeight: 'bold'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    <span>수정</span>
                  </button>

                  <button
                    onClick={handleDeletePrayer}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '16px',
                      backgroundColor: 'rgba(239,68,68,0.08)',
                      border: '2px solid rgba(239,68,68,0.2)',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.88rem',
                      fontWeight: 'bold'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    <span>삭제</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Prayer Body Text */}
          <div 
            className={`dynamic-text ${speakingVerseId === 'prayer-content' ? 'tts-highlight' : ''}`}
            style={{ 
              fontSize: `${settings.fontSize}px`,
              fontFamily: getFontFamilyStyle(settings.fontFamily),
              fontWeight: settings.fontWeight,
              lineHeight: settings.lineHeight,
              color: isZenMode ? '#e2e8f0' : 'var(--text-color)',
              padding: isZenMode ? '40px 16px' : '16px 12px',
              borderRadius: '8px',
              transition: 'all 0.4s ease'
            }}
          >
            {prayer.body.split('\n').map((line, i) => (
              <p 
                key={i} 
                style={{ 
                  margin: 0, 
                  paddingBottom: `${settings.verseSpacing * 1.2}em`,
                  minHeight: line.trim() === '' ? '1.2em' : 'auto'
                }}
              >
                {line}
              </p>
            ))}
          </div>

          {/* Bottom Prev / Next Nav Navigation (몰입 모드일 때는 보이지 않음) */}
          {!isZenMode && (
            <div style={{ marginTop: '24px', borderTop: '1.5px solid rgba(44,44,44,0.06)', paddingTop: '32px', display: 'flex', justifyContent: 'center', gap: '32px' }}>
              <button
                onClick={() => prevId && navigate(`/prayers/${prevId}`)}
                disabled={!prevId}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  border: 'none',
                  background: 'none',
                  cursor: prevId ? 'pointer' : 'default',
                  opacity: prevId ? 1 : 0.2,
                  transition: 'opacity 0.2s'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(44,44,44,0.06)', color: 'var(--text-color)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>이전 기도</span>
              </button>

              <button
                onClick={() => navigate('/prayers')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(166, 75, 42, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A64B2A' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#A64B2A' }}>목록 보기</span>
              </button>

              <button
                onClick={() => nextId && navigate(`/prayers/${nextId}`)}
                disabled={!nextId}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  border: 'none',
                  background: 'none',
                  cursor: nextId ? 'pointer' : 'default',
                  opacity: nextId ? 1 : 0.2,
                  transition: 'opacity 0.2s'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(44,44,44,0.06)', color: 'var(--text-color)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>다음 기도</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Toast Popover */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff', padding: '10px 20px', borderRadius: '20px', fontSize: '0.88rem', fontWeight: 'bold', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      {/* 🎙️ Premium Floating TTS Controller Play Buttons */}
      {!isSpeaking && (
        <button 
          className="floating-tts-btn" 
          onClick={ttsHandlers.play}
          title="낭독 시작"
          style={{ cursor: 'pointer', bottom: isZenMode ? '24px' : '40px' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        </button>
      )}

      {isSpeaking && (
        <div className="floating-bottom-bar" style={{ bottom: isZenMode ? '20px' : '30px' }}>
          <button className="floating-bar-btn" onClick={ttsHandlers.prev} title="이전 구절">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>
          </button>
          
          {isPaused ? (
            <button className="floating-bar-btn btn-play-main" onClick={ttsHandlers.resume} title="다시 재생">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(1px)' }}><polygon points="6 3 20 12 6 21 6 3"/></svg>
            </button>
          ) : (
            <button className="floating-bar-btn btn-play-main" onClick={ttsHandlers.pause} title="일시 정지">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="4" y2="20"/><line x1="6" x2="6" y1="4" y2="20"/></svg>
            </button>
          )}

          <button className="floating-bar-btn" onClick={ttsHandlers.next} title="다음 구절">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>
          </button>
          
          <button className="floating-bar-btn btn-close-tts" onClick={ttsHandlers.stop} title="낭독 종료">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      )}

      {/* 🌟 나의 기도 수정 모달 */}
      {isEditModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 10005,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }} onClick={() => setIsEditModalOpen(false)}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            backgroundColor: 'var(--bg-color)',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#A64B2A', margin: 0 }}>나의 기도 수정하기</h3>
              <button onClick={() => setIsEditModalOpen(false)} style={{ border: 'none', background: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleUpdatePrayer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>기도 제목</label>
                <input 
                  type="text"
                  placeholder="예: 가족을 위한 기도"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  style={{
                    height: '46px',
                    padding: '0 16px',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(44,44,44,0.1)',
                    backgroundColor: 'var(--secondary-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>기도 내용</label>
                <textarea 
                  placeholder="기도 내용을 입력하세요..."
                  rows="6"
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(44,44,44,0.1)',
                    backgroundColor: 'var(--secondary-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    resize: 'none',
                    lineHeight: '1.6'
                  }}
                  required
                />
              </div>
              
              <button
                type="submit"
                style={{
                  height: '48px',
                  borderRadius: '24px',
                  backgroundColor: '#A64B2A',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  marginTop: '8px'
                }}
              >
                저장하기
              </button>
            </form>
          </div>
        </div>
      )}

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
