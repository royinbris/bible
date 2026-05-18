import React, { useRef, useEffect, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useBible } from '../context/BibleContext';

const FONT_FAMILIES = [
  { name: '시스템 기본', value: 'System Default' },
  { name: '고운돋움', value: "'Gowun Dodum', sans-serif" },
  { name: 'IBM Plex Sans', value: "'IBM Plex Sans KR', sans-serif" },
  { name: '나눔명조', value: "'Nanum Myeongjo', serif" },
  { name: '고운바탕', value: "'Gowun Batang', serif" },
  { name: '본명조', value: "'Noto Serif KR', serif" }
];

export default function SettingsSheet({ isOpen, onClose }) {
  const { settings, updateSetting, resetToDefault, saveAsDefault, restoreFromBackup } = useSettings();
  const { 
    myVerses,
    ttsSpeed,
    setTtsSpeed,
    selectedVoiceURI,
    setSelectedVoiceURI,
    hideEnglishVoices,
    setHideEnglishVoices
  } = useBible();
  
  const [activeSubTab, setActiveSubTab] = useState('appearance'); // 'appearance', 'data', 'audio', 'info'
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);
  const fileInputRef = useRef(null);

  const handleExportData = () => {
    try {
      const backupData = {
        version: '1.0',
        timestamp: Date.now(),
        historyLogs: JSON.parse(localStorage.getItem('bible_reading_history') || '[]'),
        continueReadPos: JSON.parse(localStorage.getItem('continueReadPos') || 'null'),
        myVerses: JSON.parse(localStorage.getItem('bible_my_verses') || '[]'),
        settings: JSON.parse(localStorage.getItem('bible_settings') || '{}')
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `catholic_bible_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
    } catch (e) {
      alert('백업 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!imported || typeof imported !== 'object') {
          throw new Error('올바르지 않은 백업 파일 형식입니다.');
        }

        // Merge Bookmarks (MyVerses)
        if (Array.isArray(imported.myVerses)) {
          const currentMyVerses = JSON.parse(localStorage.getItem('bible_my_verses') || '[]');
          const mergedMyVerses = [...currentMyVerses];
          imported.myVerses.forEach(iv => {
            if (!mergedMyVerses.some(v => v.id === iv.id)) {
              mergedMyVerses.push(iv);
            }
          });
          localStorage.setItem('bible_my_verses', JSON.stringify(mergedMyVerses));
        }

        // Merge Reading History
        if (Array.isArray(imported.historyLogs)) {
          const currentHistory = JSON.parse(localStorage.getItem('bible_reading_history') || '[]');
          const mergedHistory = [...currentHistory];
          imported.historyLogs.forEach(ih => {
            if (!mergedHistory.some(h => h.id === ih.id)) {
              mergedHistory.push(ih);
            }
          });
          localStorage.setItem('bible_reading_history', JSON.stringify(mergedHistory));
        }

        // Restore Continue POS & Settings
        if (imported.continueReadPos) {
          localStorage.setItem('continueReadPos', JSON.stringify(imported.continueReadPos));
        }
        if (imported.settings) {
          const currentSettings = JSON.parse(localStorage.getItem('bible_settings') || '{}');
          const mergedSettings = { ...currentSettings, ...imported.settings };
          localStorage.setItem('bible_settings', JSON.stringify(mergedSettings));
        }

        alert('데이터 복원이 성공적으로 완료되었습니다! ⛪');
        window.location.reload();
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-header-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.72V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>설정</span>
          </div>
          <button className="settings-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="settings-tabs">
          <div 
            className={`settings-tab ${activeSubTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('appearance')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.1 2.5-.3 2.3-.6 4.5-2.3 5.5-4.7 1.2-2.8.5-6-1.5-8.3-2-2.3-5-3.3-8.5-3.3Z"/></svg>
            <span>모양</span>
          </div>
          <div 
            className={`settings-tab ${activeSubTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('data')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>데이터</span>
          </div>
          <div 
            className={`settings-tab ${activeSubTab === 'audio' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('audio')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            <span>음성</span>
          </div>
          <div 
            className={`settings-tab ${activeSubTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('info')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span>정보</span>
          </div>
        </div>

        <div className="settings-body">
          {activeSubTab === 'appearance' && (
            <>
              <div className="settings-action-bar">
                <span className="settings-section-label">레이아웃 설정</span>
                <div className="settings-action-buttons">
                  <button onClick={saveAsDefault}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> 기본값설정</button>
                  <button onClick={restoreFromBackup}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 2v6h6"/><path d="M22 11.5A10 10 0 1 0 9.5 20.1"/></svg> 기본값복구</button>
                  <button onClick={resetToDefault} className="reset-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> 초기화</button>
                </div>
              </div>

              <div className="wheel-selectors-container">
                <WheelSelector 
                  label="테마 모드" 
                  value={settings.theme} 
                  options={['light', 'system', 'dark']} 
                  displayOptions={['라이트', '시스템', '다크']}
                  onChange={val => updateSetting('theme', val)} 
                />
                <WheelSelector 
                  label="성경 언어" 
                  value="ko" 
                  options={['ko', 'ko-en']} 
                  displayOptions={['한글', '한영']}
                  onChange={() => {}} 
                />
                <WheelSelector 
                  label="글자 크기" 
                  value={settings.fontSize} 
                  options={Array.from({length: 10}, (_, i) => 14 + i)} 
                  onChange={val => updateSetting('fontSize', val)} 
                />
                <WheelSelector 
                  label="글자 두께" 
                  value={settings.fontWeight / 100} 
                  options={[2, 3, 4, 5, 6, 7, 8]} 
                  onChange={val => updateSetting('fontWeight', val * 100)} 
                />
                <WheelSelector 
                  label="줄 간격" 
                  value={settings.lineHeight} 
                  options={[1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4]} 
                  onChange={val => updateSetting('lineHeight', val)} 
                />
                <WheelSelector 
                  label="구절 간격" 
                  value={settings.verseSpacing} 
                  options={[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0]} 
                  onChange={val => updateSetting('verseSpacing', val)} 
                />
                <WheelSelector 
                  label="좌우 여백" 
                  value={settings.horizontalPadding} 
                  options={[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0]} 
                  onChange={val => updateSetting('horizontalPadding', val)} 
                />
              </div>

              <div className="font-grid">
                {FONT_FAMILIES.map(f => (
                  <div 
                    key={f.value} 
                    className={`font-item ${settings.fontFamily === f.value ? 'active' : ''}`}
                    onClick={() => updateSetting('fontFamily', f.value)}
                    style={{ fontFamily: f.value !== 'System Default' ? f.value : 'inherit' }}
                  >
                    <div className="font-preview">가나다</div>
                    <div className="font-name">{f.name}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSubTab === 'data' && (
            <div className="settings-data-section" style={{ padding: '8px 4px' }}>
              <div style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-color, #1e293b)' }}>
                수동 데이터 백업 및 복원
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6', marginBottom: '24px' }}>
                책갈피, 독서 기록 및 환경 설정 데이터를 파일로 내보내어 안전하게 백업하거나, 기존 백업 파일에서 데이터를 복원(병합)할 수 있습니다.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  onClick={handleExportData}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  백업 파일 생성하기 (.json)
                </button>

                <button 
                  onClick={() => fileInputRef.current.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(128, 128, 0, 0.3)',
                    backgroundColor: '#f7fee7',
                    color: '#4d7c0f',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#ecfccb'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f7fee7'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  백업 파일에서 데이터 복원하기
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImportData} 
                  accept=".json" 
                  style={{ display: 'none' }} 
                />
              </div>
            </div>
          )}

          {activeSubTab === 'audio' && (
            <div className="settings-audio-section" style={{ padding: '8px 4px' }}>
              <div style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-color, #1e293b)' }}>
                낭독 오디오 환경 설정
              </div>
              
              {/* 1. 낭독 속도 조절 */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-color)' }}>낭독 속도 (배속)</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ff4d85' }}>
                    {ttsSpeed.toFixed(2)}x {ttsSpeed === 1.0 ? '(보통)' : ttsSpeed < 1.0 ? '(느림)' : '(빠름)'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    onClick={() => setTtsSpeed(prev => Math.max(0.5, parseFloat((prev - 0.01).toFixed(2))))}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg, #ffffff)',
                      color: 'var(--text-color)',
                      fontSize: '1.2rem',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      outline: 'none',
                      userSelect: 'none'
                    }}
                  >
                    -
                  </button>

                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.05" 
                    value={ttsSpeed} 
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    style={{
                      flex: 1,
                      height: '6px',
                      borderRadius: '3px',
                      outline: 'none',
                      background: 'var(--border-color)',
                      accentColor: '#ff4d85',
                      cursor: 'pointer'
                    }}
                  />

                  <button 
                    onClick={() => setTtsSpeed(prev => Math.min(2.0, parseFloat((prev + 0.01).toFixed(2))))}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg, #ffffff)',
                      color: 'var(--text-color)',
                      fontSize: '1.2rem',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      outline: 'none',
                      userSelect: 'none'
                    }}
                  >
                    +
                  </button>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', marginTop: '4px', padding: '0 44px' }}>
                  <span>0.5x (느림)</span>
                  <span>1.0x (보통)</span>
                  <span>1.5x (빠름)</span>
                  <span>2.0x (매우 빠름)</span>
                </div>
              </div>

              {/* 2. 목소리 필터 및 선택 */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-color)' }}>낭독 목소리 선택</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', color: '#64748b' }}>
                    <input 
                      type="checkbox" 
                      checked={!hideEnglishVoices} 
                      onChange={(e) => setHideEnglishVoices(!e.target.checked)}
                      style={{ accentColor: '#ff4d85' }}
                    />
                    영어 음성 보이기
                  </label>
                </div>

                <select
                  value={selectedVoiceURI}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '2px solid var(--border-color)',
                    backgroundColor: 'var(--secondary-bg)',
                    color: 'var(--text-color)',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    outline: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <option value="">시스템 기본 목소리 (자동 최적화)</option>
                  {voices
                    .filter(v => {
                      if (v.lang.startsWith('ko')) return true;
                      if (!hideEnglishVoices && v.lang.startsWith('en')) return true;
                      return false;
                    })
                    .map(v => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang.startsWith('ko') ? '한국어' : '영어'}, {v.localService ? '로컬' : '네트워크'})
                      </option>
                    ))}
                </select>
                
                <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '8px', lineHeight: '1.4' }}>
                  ※ 기기 내장 음성 합성 엔진(Speech Synthesis)을 사용합니다. Siri, Yuna, Premium 등 고음성 품질 엔진이 리스트에 노출됩니다.
                </p>
              </div>
            </div>
          )}

          {activeSubTab === 'info' && (
            <div className="settings-empty-tab" style={{ padding: '16px 4px', color: '#64748b', fontSize: '0.85rem', lineHeight: '1.6' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⛪</div>
                <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-color, #1e293b)' }}>가톨릭 성경 한권읽기</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>v1.2.0 Premium Gold</div>
              </div>
              <p>본 앱은 매일 주님의 말씀을 묵상하고, 선택한 단 한 권의 성경 완독(통독) 성취를 응원하기 위해 정밀 튜닝된 전용 모바일 웹 앱입니다.</p>
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px', marginTop: '12px' }}>
                <strong>개발 및 제작</strong>: Antigravity AI Pair Programming<br/>
                <strong>성경 번역</strong>: 한국 가톨릭 주교회의 발행 (성경)
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WheelSelector({ label, value, options, displayOptions, onChange }) {
  const containerRef = useRef(null);
  const itemHeight = 32;

  useEffect(() => {
    const index = options.indexOf(value);
    if (index !== -1 && containerRef.current) {
      containerRef.current.scrollTop = index * itemHeight;
    }
  }, [value, options]);

  const handleScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    if (options[index] !== undefined && options[index] !== value) {
      onChange(options[index]);
    }
  };

  // Split label into two lines if it contains a space
  const labelParts = label.split(' ');

  return (
    <div className="wheel-column">
      <div className="wheel-label">
        {labelParts.map((part, i) => <div key={i}>{part}</div>)}
      </div>
      <div className="wheel-picker-wrapper">
        <div className="wheel-picker-gradient-top"></div>
        <div className="wheel-picker-selection"></div>
        <div 
          className="wheel-picker-scroll" 
          ref={containerRef}
          onScroll={handleScroll}
        >
          <div className="wheel-spacer" style={{ height: itemHeight }}></div>
          {options.map((opt, i) => (
            <div 
              key={i} 
              className={`wheel-item ${opt === value ? 'active' : ''}`}
              onClick={() => onChange(opt)}
              style={{ height: itemHeight }}
            >
              {displayOptions ? displayOptions[i] : opt}
            </div>
          ))}
          <div className="wheel-spacer" style={{ height: itemHeight }}></div>
        </div>
        <div className="wheel-picker-gradient-bottom"></div>
      </div>
    </div>
  );
}
