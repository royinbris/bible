import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');

  const mainRef = useRef(null);

  // 🌟 [추가] 나의 기도 편집 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [originalSpeed] = useState(ttsSpeed);

  // 🌟 [추가] 시간대 추천 및 TTS 제어 상태
  const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false);
  const [currentRecTzs, setCurrentRecTzs] = useState([]);

  useEffect(() => {
    if (!prayer) return;
    const customRec = JSON.parse(localStorage.getItem('custom_recommended_prayers') || '{}');
    const tzs = [];
    if (customRec['아침']?.includes(prayer.id)) tzs.push('아침');
    if (customRec['낮']?.includes(prayer.id)) tzs.push('낮');
    if (customRec['저녁/밤']?.includes(prayer.id)) tzs.push('저녁/밤');
    setCurrentRecTzs(tzs);
  }, [prayer]);

  const handleToggleRecTz = (tz) => {
    const customRec = JSON.parse(localStorage.getItem('custom_recommended_prayers') || '{}');
    if (!customRec[tz]) customRec[tz] = [];
    
    if (customRec[tz].includes(prayer.id)) {
      customRec[tz] = customRec[tz].filter(id => id !== prayer.id);
      setCurrentRecTzs(prev => prev.filter(t => t !== tz));
    } else {
      customRec[tz].push(prayer.id);
      setCurrentRecTzs(prev => [...prev, tz]);
    }
    localStorage.setItem('custom_recommended_prayers', JSON.stringify(customRec));
    showToast(`'${tz}' 추천 기도에 반영되었습니다.`);
  };

  const handleToggleSpeed = () => {
    let nextSpeed = 1.0;
    if (ttsSpeed < 1.0) nextSpeed = 1.0;
    else if (ttsSpeed < 1.2) nextSpeed = 1.2;
    else nextSpeed = 0.8;
    setTtsSpeed(nextSpeed);
    showToast(`재생 속도: ${nextSpeed.toFixed(1)}x`);
  };

  // 🌟 [추가] 기도 진입 시 전용 TTS 속도로 강제 싱크
  useEffect(() => {
    if (settings.prayerTtsRate) {
      setTtsSpeed(settings.prayerTtsRate);
    }
    return () => {
      setTtsSpeed(originalSpeed);
    };
  }, [settings.prayerTtsRate, setTtsSpeed, originalSpeed]);

  // 🎙️ 단락 및 문장 분리 로직 (마침표, 물음표, 느낌표 기준으로 문장 분리)
  const prayerParagraphs = useMemo(() => {
    if (!prayer || !prayer.body) return [];
    return prayer.body.split('\n').map((line, lineIdx) => {
      if (line.trim() === '') {
        return { line, sentences: [] };
      }
      const rawSentences = line.split(/(?<=[.?!])(?=\s|$)/);
      const sentences = rawSentences
        .map((s, sentIdx) => ({
          id: `sent-${lineIdx}-${sentIdx}`,
          text: s.trim()
        }))
        .filter(s => s.text.length > 0);
      return { line, sentences };
    });
  }, [prayer]);

  // 🎙️ Dynamic useSimpleTTS registration
  const ttsItems = useMemo(() => {
    if (!prayer) return [];
    const items = [
      { id: 'prayer-title', text: prayer.title, lang: 'ko' }
    ];
    prayerParagraphs.forEach(para => {
      para.sentences.forEach(sent => {
        items.push({
          id: sent.id,
          text: sent.text,
          lang: 'ko'
        });
      });
    });
    return items;
  }, [prayer, prayerParagraphs]);

  useSimpleTTS(ttsItems);

  // 기도문 데이터 로드
  useEffect(() => {
    if (id) {
      loadPrayer(parseInt(id));
    }
  }, [id]);

  // 스크롤 최상단 리셋 (DOM 업데이트 직후 동기적으로 실행)
  useLayoutEffect(() => {
    if (id) {
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      const raf = requestAnimationFrame(() => {
        if (mainRef.current) {
          mainRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
      });
      const timer = setTimeout(() => {
        if (mainRef.current) {
          mainRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
      }, 80);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
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
          if (trimmed.startsWith('## ')) {
            if (currentPrayer) {
              currentPrayer.body = bodyLines.join('\n').trim();
              allPrayers.push(currentPrayer);
              currentPrayer = null;
              bodyLines = [];
            }
            const fullTitle = trimmed.replace(/^##\s+/, '').trim();
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

  // 🌟 [추가] 나의 기도 수정 핸들러
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
        backgroundColor: 'var(--bg-color)', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'background-color 0.4s ease'
      }}
    >
      {/* Main Container */}
      <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', padding: '60px 24px 120px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '65vh' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', margin: 'auto 0', width: '100%' }}>
          
          {/* Header Title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            <h2 
              id="prayer-title"
              className={speakingVerseId === 'prayer-title' ? 'tts-highlight' : ''}
              style={{
                fontSize: '1.45rem',
                fontWeight: '900',
                color: 'var(--text-color)',
                margin: 0,
                padding: '4px 12px',
                borderRadius: '8px',
                transition: 'background-color 0.3s ease'
              }}
            >
              {prayer.title}
            </h2>
          </div>

          {/* Prayer Body Text */}
          <div 
            id="prayer-content"
            style={{ 
              fontSize: `${settings.fontSize}px`,
              fontFamily: getFontFamilyStyle(settings.fontFamily),
              fontWeight: settings.fontWeight,
              lineHeight: settings.lineHeight,
              color: 'var(--text-color)',
              padding: '16px 12px',
              borderRadius: '8px',
              transition: 'all 0.4s ease'
            }}
          >
            {prayerParagraphs.map((para, i) => (
              <p 
                key={i} 
                style={{ 
                  margin: 0, 
                  paddingBottom: `${settings.verseSpacing * 1.2}em`,
                  minHeight: para.line.trim() === '' ? '1.2em' : 'auto'
                }}
              >
                {para.sentences.map((sent) => (
                  <span
                    key={sent.id}
                    id={sent.id}
                    className={speakingVerseId === sent.id ? 'tts-highlight' : ''}
                    style={{
                      transition: 'background-color 0.3s ease',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      margin: '0 -4px 0 0',
                      display: 'inline'
                    }}
                  >
                    {sent.text}{' '}
                  </span>
                ))}
                {para.sentences.length === 0 && para.line}
              </p>
            ))}
          </div>

          {/* Bottom Nav Navigation & Action */}
          <div style={{ marginTop: '24px', borderTop: '1.5px solid rgba(44,44,44,0.06)', paddingTop: '32px', display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
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
              onClick={handleToggleSpeed}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: 'none', background: 'none', cursor: 'pointer'
              }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(166, 75, 42, 0.08)', border: '1.5px solid rgba(166, 75, 42, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A64B2A', fontWeight: '900', fontSize: '0.9rem' }}>
                {ttsSpeed.toFixed(1)}x
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#A64B2A' }}>낭독 속도</span>
            </button>

            <button
              onClick={() => setIsRecommendModalOpen(true)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: 'none', background: 'none', cursor: 'pointer'
              }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: currentRecTzs.length > 0 ? 'rgba(234, 179, 8, 0.15)' : 'var(--secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: currentRecTzs.length > 0 ? '1.5px solid rgba(234, 179, 8, 0.5)' : '1.5px solid rgba(44,44,44,0.06)', color: currentRecTzs.length > 0 ? '#ca8a04' : 'var(--text-color)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill={currentRecTzs.length > 0 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: currentRecTzs.length > 0 ? '#ca8a04' : 'var(--text-muted)' }}>추천 설정</span>
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

            {/* 나의 기도 편집 버튼을 하단 네비게이션으로 이동 */}
            {isCustom && (
              <button
                onClick={handleOpenEdit}
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
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981' }}>기도 수정</span>
              </button>
            )}
          </div>
          </div>
        </div>
      </main>

      {/* Toast Popover */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
          <div style={{ padding: '12px 24px', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', borderRadius: '100px', fontSize: '0.9rem', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {toast}
          </div>
        </div>
      )}

      {/* 시간대별 추천 기도 설정 모달 */}
      {isRecommendModalOpen && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}
          onClick={() => setIsRecommendModalOpen(false)}
        >
          <div 
            style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-color)', borderRadius: '24px', padding: '24px', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-color)' }}>시간대 추천 설정</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>이 기도를 어느 시간대에 홈 화면 추천 기도로 띄울지 선택하세요.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              {['아침', '낮', '저녁/밤'].map(tz => (
                <button
                  key={tz}
                  onClick={() => handleToggleRecTz(tz)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px', borderRadius: '12px', border: currentRecTzs.includes(tz) ? '2px solid #ca8a04' : '1px solid rgba(44,44,44,0.1)',
                    backgroundColor: currentRecTzs.includes(tz) ? 'rgba(234, 179, 8, 0.05)' : 'transparent',
                    color: 'var(--text-color)', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer'
                  }}
                >
                  {tz} 추천 기도
                  {currentRecTzs.includes(tz) && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setIsRecommendModalOpen(false)}
              style={{ width: '100%', padding: '16px', marginTop: '8px', borderRadius: '16px', border: 'none', backgroundColor: '#A64B2A', color: 'white', fontSize: '1rem', fontWeight: '800', cursor: 'pointer' }}
            >
              확인
            </button>
          </div>
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
