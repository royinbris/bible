import React, { useRef, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

const FONT_FAMILIES = [
  { name: '시스템 기본', value: 'System Default' },
  { name: '나눔명조', value: "'Nanum Myeongjo', serif" },
  { name: '고운바탕', value: "'Gowun Batang', serif" },
  { name: '고운돋움', value: "'Gowun Dodum', sans-serif" },
  { name: '본고딕', value: "'Noto Sans KR', sans-serif" },
  { name: '본명조', value: "'Noto Serif KR', serif" },
  { name: 'IBM Plex Sans', value: "'IBM Plex Sans KR', sans-serif" }
];

export default function SettingsSheet({ isOpen, onClose }) {
  const { settings, updateSetting, resetToDefault, saveAsDefault, restoreFromBackup } = useSettings();

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
          <div className="settings-tab active">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.1 2.5-.3 2.3-.6 4.5-2.3 5.5-4.7 1.2-2.8.5-6-1.5-8.3-2-2.3-5-3.3-8.5-3.3Z"/></svg>
            <span>모양</span>
          </div>
          <div className="settings-tab">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            <span>낭독 음성</span>
          </div>
          <div className="settings-tab">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11V4h7"/><path d="M4 11l7 7"/><path d="M20 13v7h-7"/><path d="m20 13-7-7"/></svg>
            <span>데이터</span>
          </div>
          <div className="settings-tab">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span>정보</span>
          </div>
          <div className="settings-tab">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span>설명서</span>
          </div>
        </div>

        <div className="settings-body">
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
              options={Array.from({length: 10}, (_, i) => 12 + i)} 
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
        </div>
      </div>
    </div>
  );
}

function WheelSelector({ label, value, options, displayOptions, onChange }) {
  const containerRef = useRef(null);
  const itemHeight = 36;

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

  return (
    <div className="wheel-column">
      <div className="wheel-label">{label}</div>
      <div className="wheel-picker-wrapper">
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
            >
              {displayOptions ? displayOptions[i] : opt}
            </div>
          ))}
          <div className="wheel-spacer" style={{ height: itemHeight }}></div>
        </div>
      </div>
    </div>
  );
}
