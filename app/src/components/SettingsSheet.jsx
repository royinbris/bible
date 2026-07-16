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
    setHideEnglishVoices,
    supertonicEnabled,
    setSupertonicEnabled,
    supertonicUrl,
    setSupertonicUrl,
    supertonicVoice,
    setSupertonicVoice,
    supertonicFmt,
    setSupertonicFmt,
    supertonicToken,
    setSupertonicToken,
    supertonicSpatial,
    setSupertonicSpatial
  } = useBible();
  
  const [activeSubTab, setActiveSubTab] = useState('appearance'); // 'appearance', 'data', 'audio', 'info'
  const [voices, setVoices] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

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

  const fileInputRef = useRef(null);

  // ── 클라우드 동기화 (기기간 동기화) 로직 ──
  const [syncPin, setSyncPin] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sync_pin') || '';
    }
    return '';
  });
  const [inputPin, setInputPin] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const handleGeneratePin = async () => {
    setSyncLoading(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/sync?action=generate');
      const data = await res.json();
      if (data.success && data.pin) {
        localStorage.setItem('sync_pin', data.pin);
        setSyncPin(data.pin);
        setSyncMessage('새로운 동기화 코드가 발급되었습니다! 🎉');
        await runSync(data.pin, true);
      } else {
        setSyncMessage(data.error || '코드 생성에 실패했습니다.');
      }
    } catch (err) {
      setSyncMessage('서버 통신에 실패했습니다.');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleConnectPin = async () => {
    if (!/^\d{6}$/.test(inputPin)) {
      alert('올바른 6자리 숫자를 입력해 주세요.');
      return;
    }
    setSyncLoading(true);
    setSyncMessage('');
    try {
      const res = await fetch(`/api/sync?pin=${inputPin}`);
      if (res.status === 404) {
        // 서버에 없는 신규 번호인 경우 ➡️ 신규 등록 여부 확인 후 생성
        const createNew = window.confirm(
          `입력하신 코드 [${inputPin}]는 아직 등록되지 않은 번호입니다.\n\n이 번호로 새로운 동기화 방을 만들고 현재 기기의 데이터를 업로드하시겠습니까?`
        );
        if (createNew) {
          await runSync(inputPin, true);
          localStorage.setItem('sync_pin', inputPin);
          setSyncPin(inputPin);
          setSyncMessage(`새로운 동기화 코드 [${inputPin}]가 정상 등록 및 연동되었습니다! 🎉`);
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setSyncMessage('연결이 취소되었습니다.');
        }
        setSyncLoading(false);
        return;
      }
      const serverData = await res.json();
      
      applySyncData(serverData);
      
      localStorage.setItem('sync_pin', inputPin);
      setSyncPin(inputPin);
      setSyncMessage('성공적으로 연결 및 동기화되었습니다! 💫');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setSyncMessage('연결 및 동기화에 실패했습니다.');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!syncPin) return;
    setSyncLoading(true);
    setSyncMessage('');
    try {
      await runSync(syncPin, true);
      setSyncMessage('클라우드 동기화 완료! 최신 상태입니다. ✨');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setSyncMessage('동기화에 실패했습니다.');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('동기화 연결을 해제하시겠습니까? 기기의 데이터는 삭제되지 않으나 더 이상 동기화되지 않습니다.')) {
      localStorage.removeItem('sync_pin');
      localStorage.removeItem('sync_updated_at');
      setSyncPin('');
      setInputPin('');
      setSyncMessage('동기화 연결이 해제되었습니다.');
    }
  };

  const runSync = async (pin, isUpload = false) => {
    const localData = {
      version: '2.0',
      historyLogs: JSON.parse(localStorage.getItem('bible_reading_history') || '[]'),
      continueReadPos: JSON.parse(localStorage.getItem('continueReadPos') || 'null'),
      myVerses: JSON.parse(localStorage.getItem('bible_my_verses') || '[]'),
      settings: JSON.parse(localStorage.getItem('bible_settings') || '{}'),
      userSettings: JSON.parse(localStorage.getItem('user_settings') || '{}'),
      readingPlan: JSON.parse(localStorage.getItem('bible_reading_plan') || 'null'),
      readingPlanHistory: JSON.parse(localStorage.getItem('bible_reading_plan_history') || '[]'),
      customPrayers: JSON.parse(localStorage.getItem('custom_prayers') || '[]'),
      customRecommendedPrayers: JSON.parse(localStorage.getItem('custom_recommended_prayers') || '{}'),
      updatedAt: isUpload ? Date.now() : parseInt(localStorage.getItem('sync_updated_at') || '0')
    };

    const res = await fetch(`/api/sync?pin=${pin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localData)
    });
    
    if (!res.ok) {
      throw new Error('Sync server error');
    }
    
    const data = await res.json();
    if (data.success && data.data) {
      applySyncData(data.data);
    }
  };

  const applySyncData = (data) => {
    if (!data) return;
    
    if (data.historyLogs) localStorage.setItem('bible_reading_history', JSON.stringify(data.historyLogs));
    if (data.continueReadPos) localStorage.setItem('continueReadPos', JSON.stringify(data.continueReadPos));
    else localStorage.removeItem('continueReadPos');
    
    if (data.myVerses) localStorage.setItem('bible_my_verses', JSON.stringify(data.myVerses));
    
    if (data.settings) localStorage.setItem('bible_settings', JSON.stringify(data.settings));
    if (data.userSettings) localStorage.setItem('user_settings', JSON.stringify(data.userSettings));
    
    if (data.readingPlan) localStorage.setItem('bible_reading_plan', JSON.stringify(data.readingPlan));
    else localStorage.removeItem('bible_reading_plan');
    
    if (data.readingPlanHistory) localStorage.setItem('bible_reading_plan_history', JSON.stringify(data.readingPlanHistory));
    
    if (data.customPrayers) localStorage.setItem('custom_prayers', JSON.stringify(data.customPrayers));
    if (data.customRecommendedPrayers) localStorage.setItem('custom_recommended_prayers', JSON.stringify(data.customRecommendedPrayers));
    
    if (data.updatedAt) localStorage.setItem('sync_updated_at', data.updatedAt.toString());
  };

  const handleAppUpdate = () => {
    setIsUpdating(true);
    
    // 1. 브라우저 캐시 스토리지의 모든 정적 에셋 데이터 강제 무효화
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      }).catch(err => console.warn('Cache clear failed:', err));
    }

    setTimeout(() => {
      // 2. 서비스 워커 등록 해제가 완전히 완료된 것을 확인한 후 리로드 보장
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          if (registrations.length === 0) {
            window.location.reload(true);
            return;
          }
          Promise.all(registrations.map(r => r.unregister())).then(() => {
            window.location.reload(true);
          }).catch(() => {
            window.location.reload(true);
          });
        }).catch(() => {
          window.location.reload(true);
        });
      } else {
        window.location.reload(true);
      }
    }, 1000);
  };

  const handleExportData = () => {
    try {
      const backupData = {
        version: '2.0',
        timestamp: Date.now(),
        // 독서 기록
        historyLogs: JSON.parse(localStorage.getItem('bible_reading_history') || '[]'),
        continueReadPos: JSON.parse(localStorage.getItem('continueReadPos') || 'null'),
        // 책갈피
        myVerses: JSON.parse(localStorage.getItem('bible_my_verses') || '[]'),
        // 성경 설정
        settings: JSON.parse(localStorage.getItem('bible_settings') || '{}'),
        userSettings: JSON.parse(localStorage.getItem('user_settings') || '{}'),
        // 한권통독
        readingPlan: JSON.parse(localStorage.getItem('bible_reading_plan') || 'null'),
        readingPlanHistory: JSON.parse(localStorage.getItem('bible_reading_plan_history') || '[]'),
        // 나의 기도
        customPrayers: JSON.parse(localStorage.getItem('custom_prayers') || '[]'),
        customRecommendedPrayers: JSON.parse(localStorage.getItem('custom_recommended_prayers') || '{}'),
      };

      // 📱 iOS(아이폰/아이패드) 감지
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS) {
        const proceed = window.confirm(
          "⚠️ 아이폰 백업 안내\n\n확인을 누르면 백업 파일 미리보기 창으로 이동합니다.\n\n이동한 화면 하단의 [공유] 버튼(화살표가 위로 솟은 상자 모양)을 누르고 [파일에 저장]을 선택하셔야 최종 저장이 완료됩니다.\n\n계속 진행하시겠습니까?"
        );
        if (!proceed) return;
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);

      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadAnchor.setAttribute("href", downloadUrl);
      downloadAnchor.setAttribute("download", `catholic_bible_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      
      // 메모리 정리
      setTimeout(() => {
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(downloadUrl);
      }, 100);
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

        // 책갈피 병합
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

        // 독서 기록 병합
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

        // 한권통독 계획 복원
        if (imported.readingPlan) {
          localStorage.setItem('bible_reading_plan', JSON.stringify(imported.readingPlan));
        }

        // 한권통독 이력 병합
        if (Array.isArray(imported.readingPlanHistory)) {
          const currentPlanHistory = JSON.parse(localStorage.getItem('bible_reading_plan_history') || '[]');
          const mergedPlanHistory = [...currentPlanHistory];
          imported.readingPlanHistory.forEach(item => {
            if (!mergedPlanHistory.some(h => h.id === item.id)) {
              mergedPlanHistory.push(item);
            }
          });
          localStorage.setItem('bible_reading_plan_history', JSON.stringify(mergedPlanHistory));
        }

        // 나의 기도 병합
        if (Array.isArray(imported.customPrayers)) {
          const currentPrayers = JSON.parse(localStorage.getItem('custom_prayers') || '[]');
          const mergedPrayers = [...currentPrayers];
          imported.customPrayers.forEach(prayer => {
            if (!mergedPrayers.some(p => p.id === prayer.id)) {
              mergedPrayers.push(prayer);
            }
          });
          localStorage.setItem('custom_prayers', JSON.stringify(mergedPrayers));
        }

        // 기도 추천 커스텀 복원
        if (imported.customRecommendedPrayers && typeof imported.customRecommendedPrayers === 'object') {
          localStorage.setItem('custom_recommended_prayers', JSON.stringify(imported.customRecommendedPrayers));
        }

        // 한권통독 이어읽기 위치 & 설정 복원
        if (imported.continueReadPos) {
          localStorage.setItem('continueReadPos', JSON.stringify(imported.continueReadPos));
        }
        if (imported.settings) {
          const currentSettings = JSON.parse(localStorage.getItem('bible_settings') || '{}');
          const mergedSettings = { ...currentSettings, ...imported.settings };
          localStorage.setItem('bible_settings', JSON.stringify(mergedSettings));
        }
        if (imported.userSettings) {
          const currentUserSettings = JSON.parse(localStorage.getItem('user_settings') || '{}');
          const mergedUserSettings = { ...currentUserSettings, ...imported.userSettings };
          localStorage.setItem('user_settings', JSON.stringify(mergedUserSettings));
        }

        alert('데이터 복원이 성공적으로 완료되었습니다! ⛪\n\n복원된 항목:\n- 독서 기록\n- 책갈피\n- 한권통독 계획/이력\n- 나의 기도\n- 앱 설정');
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
      <div 
        className="settings-sheet" 
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        <div className="settings-header">
          <div className="settings-header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.72V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>설정</span>
            <button
              onClick={handleAppUpdate}
              disabled={isUpdating}
              style={{
                background: 'rgba(166, 75, 42, 0.08)',
                border: '1px solid rgba(166, 75, 42, 0.15)',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '0.7rem',
                fontWeight: '800',
                color: '#A64B2A',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4.5px',
                marginLeft: '4px',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
              title="클릭하여 앱 강제 새로고침 및 최신 업데이트"
            >
              {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v1.0.0'}
              {isUpdating && (
                <svg 
                  width="11" 
                  height="11" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  style={{
                    animation: 'spin 1s linear infinite'
                  }}
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
              )}
            </button>
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

        <div className="settings-body" style={{ paddingBottom: '80px' }}>
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
                  value={settings.bibleLanguage || 'ko'} 
                  options={['ko', 'ko-en', 'en']} 
                  displayOptions={['한글', '한영', '영어']}
                  onChange={val => updateSetting('bibleLanguage', val)} 
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
              <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: '1.7', marginBottom: '8px' }}>
                📌 <strong>홈 화면 아이콘을 삭제하고 재설치하면 모든 기록이 초기화됩니다.</strong>
              </p>
              <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: '1.7', marginBottom: '20px' }}>
                아이콘 삭제 전에 반드시 백업 파일을 생성해 두세요. 재설치 후 "데이터 복원하기"로 모든 기록을 되살릴 수 있습니다.
              </p>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: '1.6', marginBottom: '20px' }}>
                백업 항목: 독서 기록 · 책갈피 · 한권통독 계획/이력 · 나의 기도 · 앱 설정
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

              {/* 구분선 */}
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '24px 0 16px 0' }} />

              <div style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-color, #1e293b)' }}>
                기기 간 데이터 동기화
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: '1.7', marginBottom: '16px' }}>
                6자리 동기화 코드를 사용해 맥북과 아이폰 간에 읽기 기록과 통독 진도, 책갈피를 실시간으로 자동 동기화합니다. 화면을 켜거나 변경 사항이 생기면 백그라운드에서 자동 처리됩니다.
              </p>

              {!syncPin ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <button 
                    onClick={handleGeneratePin}
                    disabled={syncLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: 'var(--primary-color)',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      cursor: syncLoading ? 'default' : 'pointer',
                      opacity: syncLoading ? 0.7 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {syncLoading ? '코드 생성 중...' : '새로운 동기화 코드 발급받기'}
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-color)' }}>이미 다른 기기에서 생성한 코드가 있다면:</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="6자리 숫자 입력" 
                        maxLength={6}
                        value={inputPin}
                        onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-color)',
                          color: 'var(--text-color)',
                          fontSize: '0.9rem',
                          textAlign: 'center',
                          letterSpacing: '2px',
                          fontWeight: 'bold',
                          outline: 'none'
                        }}
                      />
                      <button 
                        onClick={handleConnectPin}
                        disabled={syncLoading}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#3b82f6',
                          color: '#ffffff',
                          fontSize: '0.85rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        연결하기
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--secondary-bg)',
                    border: '1px solid var(--border-color)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>나의 동기화 코드</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: '900', letterSpacing: '4px', color: 'var(--primary-color)' }}>
                      {syncPin}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                      ※ 다른 기기에 이 코드를 입력하여 연결해 주세요.
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={handleManualSync}
                      disabled={syncLoading}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1px solid var(--primary-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--primary-color)',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                      {syncLoading ? '동기화 중...' : '지금 동기화하기'}
                    </button>

                    <button 
                      onClick={handleDisconnect}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '1px solid #ef4444',
                        backgroundColor: 'transparent',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      연결 해제
                    </button>
                  </div>
                </div>
              )}

              {syncMessage && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: syncMessage.includes('실패') || syncMessage.includes('없') ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  color: syncMessage.includes('실패') || syncMessage.includes('없') ? '#ef4444' : '#10b981',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  textAlign: 'center'
                }}>
                  {syncMessage}
                </div>
              )}
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
                    onClick={() => setTtsSpeed(prev => Math.max(0.5, parseFloat((prev - 0.05).toFixed(2))))}
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
                    max="1.5" 
                    step="0.05" 
                    value={ttsSpeed} 
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="premium-speed-slider"
                  />

                  <button 
                    onClick={() => setTtsSpeed(prev => Math.min(1.5, parseFloat((prev + 0.05).toFixed(2))))}
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

              {/* 3. Supertonic3 (Mac 서버) 연동 */}
              <div style={{ marginTop: '8px', padding: '14px', borderRadius: '12px', border: '2px solid var(--border-color)', background: 'var(--secondary-bg)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={supertonicEnabled}
                    onChange={(e) => setSupertonicEnabled(e.target.checked)}
                    style={{ accentColor: '#ff4d85', width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-color)' }}>맥북 Supertonic3로 듣기</span>
                </label>

                {supertonicEnabled && (
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-color)', marginBottom: '6px' }}>서버 주소</div>
                      <input
                        type="url"
                        inputMode="url"
                        placeholder="https://맥이름.tailXXXX.ts.net"
                        value={supertonicUrl}
                        onChange={(e) => setSupertonicUrl(e.target.value.trim())}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '10px', border: '2px solid var(--border-color)', backgroundColor: 'var(--card-bg, #fff)', color: 'var(--text-color)', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-color)', marginBottom: '6px' }}>접속 토큰</div>
                      <input
                        type="text"
                        autoComplete="off"
                        autoCapitalize="off"
                        placeholder="맥 앱 '접속 주소·토큰 보기'의 토큰"
                        value={supertonicToken}
                        onChange={(e) => setSupertonicToken(e.target.value.trim())}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '10px', border: '2px solid var(--border-color)', backgroundColor: 'var(--card-bg, #fff)', color: 'var(--text-color)', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-color)', marginBottom: '6px' }}>목소리</div>
                        <select
                          value={supertonicVoice}
                          onChange={(e) => setSupertonicVoice(e.target.value)}
                          style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '2px solid var(--border-color)', backgroundColor: 'var(--card-bg, #fff)', color: 'var(--text-color)', fontSize: '0.85rem' }}
                        >
                          {['M1','M2','M3','M4','M5','F1','F2','F3','F4','F5'].map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-color)', marginBottom: '6px' }}>형식</div>
                        <select
                          value={supertonicFmt}
                          onChange={(e) => setSupertonicFmt(e.target.value)}
                          style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '2px solid var(--border-color)', backgroundColor: 'var(--card-bg, #fff)', color: 'var(--text-color)', fontSize: '0.85rem' }}
                        >
                          <option value="wav">WAV (집/빠름)</option>
                          <option value="aac">AAC (원격/데이터절약)</option>
                        </select>
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', cursor: 'pointer', padding: '2px 0' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-color)' }}>공간 음향 (3D)</span>
                      <input
                        type="checkbox"
                        checked={supertonicSpatial}
                        onChange={(e) => setSupertonicSpatial(e.target.checked)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    </label>

                    <p style={{ fontSize: '0.72rem', color: '#888', lineHeight: '1.5', margin: 0 }}>
                      ※ 맥북에서 Supertonic3 앱의 '웹 서버'를 켜야 합니다. 낭독 속도는 위의 '낭독 속도' 슬라이더가 그대로 적용됩니다.<br/>
      ※ 이 앱은 HTTPS라서 <b>HTTPS 주소</b>가 필요합니다. 맥에서 <code>tailscale funnel 8080</code>으로 공개 HTTPS 주소를 만들면 아이폰 Tailscale 앱 없이도 접속됩니다. <b>토큰</b>이 없으면 요청이 거부되니 맥 앱의 '접속 주소·토큰 보기'에서 토큰을 확인해 넣으세요.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'info' && (
            <div className="settings-empty-tab" style={{ padding: '16px 4px', color: '#64748b', fontSize: '0.85rem', lineHeight: '1.6' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div 
                  onClick={handleAppUpdate}
                  style={{ 
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: '16px 32px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--secondary-bg, #f1f5f9)',
                    border: '1.5px dashed rgba(166, 75, 42, 0.15)',
                    transition: 'all 0.2s ease',
                    userSelect: 'none',
                    margin: '0 auto'
                  }}
                  onMouseOver={(e) => { 
                    e.currentTarget.style.backgroundColor = 'var(--card-bg, #ffffff)';
                    e.currentTarget.style.borderColor = 'var(--primary-color, #ff4d85)';
                  }}
                  onMouseOut={(e) => { 
                    e.currentTarget.style.backgroundColor = 'var(--secondary-bg, #f1f5f9)';
                    e.currentTarget.style.borderColor = 'rgba(166, 75, 42, 0.15)';
                  }}
                  title="클릭하여 앱 최신 업데이트"
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px', position: 'relative', display: 'inline-block' }}>
                    ⛪
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span 
                      style={{ 
                        fontWeight: '800', 
                        fontSize: '1rem', 
                        color: 'var(--text-color, #1e293b)',
                        textDecoration: 'underline',
                        textDecorationColor: 'var(--primary-color, #ff4d85)',
                        textUnderlineOffset: '4px'
                      }}
                    >
                      가톨릭 성경 한권통독
                    </span>
                    {isUpdating && (
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="var(--primary-color, #ff4d85)" 
                        strokeWidth="3" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        style={{
                          animation: 'spin 1s linear infinite'
                        }}
                      >
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700' }}>
                    {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v1.0.0'}
                  </div>
                </div>
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
  const itemHeight = 38;

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
