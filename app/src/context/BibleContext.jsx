import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const BibleContext = createContext();

export function useBible() {
  return useContext(BibleContext);
}

export function BibleProvider({ children }) {
  // Ultra Guard: Self-purging logic to avoid blank screen crashes due to localStorage bloat (12:19 infinite loop aftermath)
  const [historyLogs, setHistoryLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('bible_reading_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Safeguard: If parsed log count exceeds 50 (usually bloated by old bugs), clip it safely to max 30 items
          if (parsed.length > 50) {
            const cleaned = parsed.slice(0, 30);
            localStorage.setItem('bible_reading_history', JSON.stringify(cleaned));
            return cleaned;
          }
          return parsed;
        }
      }
      return [];
    } catch (e) {
      // Fallback & self-purging
      try {
        localStorage.removeItem('bible_reading_history');
      } catch (err) {}
      return [];
    }
  });

  const [continueReadPos, setContinueReadPos] = useState(() => {
    try {
      const saved = localStorage.getItem('continueReadPos');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      try {
        localStorage.removeItem('continueReadPos');
      } catch (err) {}
      return null;
    }
  });

  const [isContinueMode, setIsContinueMode] = useState(false);

  const [myVerses, setMyVerses] = useState(() => {
    try {
      const saved = localStorage.getItem('bible_my_verses');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      try {
        localStorage.removeItem('bible_my_verses');
      } catch (err) {}
      return [];
    }
  });

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem('bible_reading_history', JSON.stringify(historyLogs));
  }, [historyLogs]);

  // Sync continueReadPos to localStorage
  useEffect(() => {
    if (continueReadPos) {
      localStorage.setItem('continueReadPos', JSON.stringify(continueReadPos));
    } else {
      localStorage.removeItem('continueReadPos');
    }
  }, [continueReadPos]);

  // Sync myVerses to localStorage
  useEffect(() => {
    localStorage.setItem('bible_my_verses', JSON.stringify(myVerses));
  }, [myVerses]);

  // 1. Add History Log (useCallback to prevent infinite re-rendering)
  const addHistoryLog = useCallback((bookId, bookName, chapter, verseNum = 1, subtitleId = '', subtitleText = '') => {
    const timestamp = Date.now();
    const newLog = {
      id: `history-${timestamp}`,
      bookId: String(bookId),
      bookName,
      chapter: parseInt(chapter),
      verseNum: parseInt(verseNum),
      subtitleId,
      subtitleText,
      timestamp,
      isPinned: false
    };

    setHistoryLogs(prev => {
      // Create new list
      const filtered = [newLog, ...prev];
      
      // Separate Pinned and Unpinned
      const pinned = filtered.filter(l => l.isPinned);
      const unpinned = filtered.filter(l => !l.isPinned);
      
      // Limit unpinned to 30 items max
      const limitedUnpinned = unpinned.slice(0, 30);
      
      // Combine and keep sorting by timestamp descending
      return [...pinned, ...limitedUnpinned].sort((a, b) => b.timestamp - a.timestamp);
    });

    // Update continueReadPos if in continue mode (한권통독)
    if (isContinueMode) {
      setContinueReadPos({
        bookId: String(bookId),
        bookName,
        chapter: parseInt(chapter),
        verseNum: parseInt(verseNum),
        subtitleId,
        subtitleText,
        timestamp
      });
    }
  }, [isContinueMode]);

  // 2. Update History Log (Real-time tracking on scroll)
  const updateHistoryLog = useCallback((verseNum, subtitleId = '', subtitleText = '', bookId = null, bookName = null, chapter = null) => {
    const timestamp = Date.now();
    
    setHistoryLogs(prev => {
      // Find the active unpinned session (most recent unpinned log)
      const activeIndex = prev.findIndex(l => !l.isPinned);
      
      if (activeIndex === -1) {
        // No active session to update
        return prev;
      }
      
      const updatedLogs = [...prev];
      const activeLog = { ...updatedLogs[activeIndex] };
      
      // Update values
      activeLog.verseNum = parseInt(verseNum);
      if (subtitleId) {
        activeLog.subtitleId = subtitleId;
        activeLog.subtitleText = subtitleText;
      }
      if (bookId) activeLog.bookId = parseInt(bookId);
      if (bookName) activeLog.bookName = bookName;
      if (chapter) activeLog.chapter = parseInt(chapter);
      
      activeLog.timestamp = timestamp;
      
      updatedLogs[activeIndex] = activeLog;
      
      // Update continueReadPos if in continue mode (한권통독)
      if (isContinueMode) {
        setContinueReadPos({
          bookId: String(activeLog.bookId),
          bookName: activeLog.bookName,
          chapter: activeLog.chapter,
          verseNum: parseInt(verseNum),
          subtitleId: activeLog.subtitleId || subtitleId,
          subtitleText: activeLog.subtitleText || subtitleText,
          timestamp
        });
      }
      
      return updatedLogs;
    });
  }, [isContinueMode]);

  // 3. Toggle Pin (with Cloning Mechanism)
  const togglePin = useCallback((id) => {
    let result = { success: false, message: '기록을 찾을 수 없습니다.' };

    setHistoryLogs(prev => {
      const targetLog = prev.find(l => l.id === id);
      if (!targetLog) return prev;

      if (targetLog.isPinned) {
        // Unpin: Remove the pinned log
        result = { success: true, message: '핀 고정이 해제되었습니다.', action: 'unpin' };
        return prev.filter(l => l.id !== id);
      } else {
        // Check duplicate: Don't pin the same book-chapter-verse combo if already pinned
        const isDuplicate = prev.some(
          l => l.isPinned &&
               l.bookId === targetLog.bookId &&
               l.chapter === targetLog.chapter &&
               l.verseNum === targetLog.verseNum
        );
        
        if (isDuplicate) {
          result = { success: false, message: '이미 동일한 구절이 핀 목록에 고정되어 있습니다.', action: 'duplicate' };
          return prev;
        }

        const timestamp = Date.now();
        
        // Cloning Mechanism: If pinning the active session, clone it and set isPinned: true.
        // The original active session remains so it can continue tracking scrolls.
        const activeLog = prev.find(l => !l.isPinned);
        
        if (activeLog && activeLog.id === id) {
          const clonedLog = {
            ...targetLog,
            id: `pin-${timestamp}`,
            isPinned: true,
            timestamp
          };
          
          result = { success: true, message: '책갈피 체크리스트에 고정되었습니다.', action: 'pin_clone' };
          return [clonedLog, ...prev];
        } else {
          // Convert to pinned directly if it's a past history log
          result = { success: true, message: '책갈피 체크리스트에 고정되었습니다.', action: 'pin_convert' };
          return prev.map(l => l.id === id ? { ...l, isPinned: true, timestamp } : l);
        }
      }
    });

    return result;
  }, []);

  // 4. Delete Log
  const deleteHistoryLog = useCallback((id) => {
    setHistoryLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  // 5. Clear Reading History (except Pinned)
  const clearHistory = useCallback(() => {
    setHistoryLogs(prev => prev.filter(l => l.isPinned));
  }, []);

  // 6. Bookmarks (MyVerses) CRUD
  const saveMyVerse = useCallback((verse) => {
    const timestamp = Date.now();
    const newVerse = {
      id: verse.id || `myverse-${timestamp}-${Math.random().toString(36).substring(2, 9)}`,
      bookId: String(verse.bookId),
      bookName: verse.bookName,
      chapter: parseInt(verse.chapter, 10),
      verseRange: verse.verseRange,
      content: verse.content,
      timestamp
    };
    setMyVerses(prev => {
      // Prevent exact duplicates (same book, chapter, range, content)
      const isDuplicate = prev.some(
        v => v.bookId === newVerse.bookId &&
             v.chapter === newVerse.chapter &&
             v.verseRange === newVerse.verseRange &&
             v.content === newVerse.content
      );
      if (isDuplicate) return prev;
      return [newVerse, ...prev];
    });
  }, []);

  const deleteMyVerse = useCallback((id) => {
    setMyVerses(prev => prev.filter(v => v.id !== id));
  }, []);

  const clearAllMyVerses = useCallback(() => {
    setMyVerses([]);
  }, []);

  // 📺 미사(DailyMass) 공유 상태 — GlobalBottomBar와 DailyMass 간 공유
  const [massActiveTab, setMassActiveTab] = useState('ko'); // 'ko' | 'en'
  const [massReadings, setMassReadings] = useState(null); // { reading1, reading2, gospel } | null
  const [massOverlay, setMassOverlay] = useState(null); // selectedOverlayReading 공유
  const [massMeditationText, setMassMeditationText] = useState(null);

  // Global TTS State & Handlers
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speakingVerseId, setSpeakingVerseId] = useState(null);
  const [ttsSpeed, setTtsSpeed] = useState(() => {
    const saved = localStorage.getItem('tts_speed');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => {
    return localStorage.getItem('selected_voice_uri') || '';
  });
  const [hideEnglishVoices, setHideEnglishVoices] = useState(() => {
    const saved = localStorage.getItem('hide_english_voices');
    return saved !== 'false'; // Default to true
  });
  const [ttsHandlers, setTtsHandlers] = useState({});

  // 🎧 Supertonic3 (Mac 서버) 연동 음성
  const [supertonicEnabled, setSupertonicEnabled] = useState(() => {
    return localStorage.getItem('supertonic_enabled') === 'true';
  });
  const [supertonicUrl, setSupertonicUrl] = useState(() => {
    const saved = localStorage.getItem('supertonic_url');
    // 기본값: 사용자 Mac의 Tailscale HTTPS 주소
    return (saved !== null && saved !== undefined) ? saved : 'https://roy-macbookair.tailf4ccb7.ts.net';
  });
  const [supertonicVoice, setSupertonicVoice] = useState(() => {
    return localStorage.getItem('supertonic_voice') || 'M1';
  });
  const [supertonicFmt, setSupertonicFmt] = useState(() => {
    return localStorage.getItem('supertonic_fmt') || 'wav';
  });
  const [supertonicToken, setSupertonicToken] = useState(() => {
    return localStorage.getItem('supertonic_token') || '';
  });
  const [supertonicSpatial, setSupertonicSpatial] = useState(() => {
    return localStorage.getItem('supertonic_spatial') === 'true';
  });
  // 오프라인 다운로드 진행 상태: { status: 'idle'|'downloading'|'ready', done, total }
  const [offlineState, setOfflineState] = useState({ status: 'idle', done: 0, total: 0 });

  // 🌟 기도 카테고리 플로팅 관련 전역 상태
  const [showIntro, setShowIntro] = useState(true);
  const [showPrayerCategories, setShowPrayerCategories] = useState(false);
  const [selectedPrayerCategoryId, setSelectedPrayerCategoryId] = useState(1); // 기본값: 주요 기도 (1)
  const [selectedPrayerId, setSelectedPrayerId] = useState(null);
  const [isPrayerSearchMode, setIsPrayerSearchMode] = useState(false);
  const [isIndividualMenu, setIsIndividualMenu] = useState(false); // false=기본메뉴, true=개별메뉴
  const [isRecManageModalOpen, setIsRecManageModalOpen] = useState(false); // 추천 기도 관리 모달
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); // 읽기 기록 시트 (전역 제어)
  const [isPrayerWriteModalOpen, setIsPrayerWriteModalOpen] = useState(false); // 기도 쓰기/수정 모달

  useEffect(() => {
    localStorage.setItem('tts_speed', ttsSpeed.toString());
  }, [ttsSpeed]);

  useEffect(() => {
    localStorage.setItem('selected_voice_uri', selectedVoiceURI || '');
  }, [selectedVoiceURI]);

  useEffect(() => {
    localStorage.setItem('hide_english_voices', hideEnglishVoices.toString());
  }, [hideEnglishVoices]);

  useEffect(() => { localStorage.setItem('supertonic_enabled', supertonicEnabled.toString()); }, [supertonicEnabled]);
  useEffect(() => { localStorage.setItem('supertonic_url', supertonicUrl || ''); }, [supertonicUrl]);
  useEffect(() => { localStorage.setItem('supertonic_voice', supertonicVoice || 'M1'); }, [supertonicVoice]);
  useEffect(() => { localStorage.setItem('supertonic_fmt', supertonicFmt || 'wav'); }, [supertonicFmt]);
  useEffect(() => { localStorage.setItem('supertonic_token', supertonicToken || ''); }, [supertonicToken]);
  useEffect(() => { localStorage.setItem('supertonic_spatial', supertonicSpatial ? 'true' : 'false'); }, [supertonicSpatial]);

  // ── 완전 자동 동기화 (Dirty Checking & Visibility 센서) ──
  const isSyncingRef = useRef(false);
  const [syncStateHash, setSyncStateHash] = useState('');

  const getLocalSyncHash = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const hist = localStorage.getItem('bible_reading_history') || '';
    const myv = localStorage.getItem('bible_my_verses') || '';
    const plan = localStorage.getItem('bible_reading_plan') || '';
    const planHist = localStorage.getItem('bible_reading_plan_history') || '';
    const sett = localStorage.getItem('bible_settings') || '';
    const usett = localStorage.getItem('user_settings') || '';
    const cpr = localStorage.getItem('custom_prayers') || '';
    const crpr = localStorage.getItem('custom_recommended_prayers') || '';
    return `${hist.length}_${myv.length}_${plan.length}_${planHist.length}_${sett.length}_${usett.length}_${cpr.length}_${crpr.length}`;
  }, []);

  const triggerAutoUpload = useCallback(async () => {
    if (typeof window === 'undefined' || isSyncingRef.current) return;
    const pin = localStorage.getItem('sync_pin');
    if (!pin) return;

    try {
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
        updatedAt: Date.now()
      };

      localStorage.setItem('sync_updated_at', localData.updatedAt.toString());
      setSyncStateHash(getLocalSyncHash());

      await fetch(`/api/sync?pin=${pin}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localData)
      });
    } catch (err) {
      console.error('자동 업로드 실패:', err);
    }
  }, [getLocalSyncHash]);

  const triggerAutoDownload = useCallback(async () => {
    if (typeof window === 'undefined' || isSyncingRef.current) return;
    const pin = localStorage.getItem('sync_pin');
    if (!pin) return;

    isSyncingRef.current = true;
    try {
      const res = await fetch(`/api/sync?pin=${pin}`);
      if (res.ok) {
        const serverData = await res.json();
        const localUpdatedAt = parseInt(localStorage.getItem('sync_updated_at') || '0');

        if (serverData && serverData.updatedAt > localUpdatedAt) {
          if (serverData.historyLogs) {
            localStorage.setItem('bible_reading_history', JSON.stringify(serverData.historyLogs));
            setHistoryLogs(serverData.historyLogs);
          }
          if (serverData.continueReadPos) {
            localStorage.setItem('continueReadPos', JSON.stringify(serverData.continueReadPos));
            setContinueReadPos(serverData.continueReadPos);
          }
          if (serverData.myVerses) {
            localStorage.setItem('bible_my_verses', JSON.stringify(serverData.myVerses));
            setMyVerses(serverData.myVerses);
          }
          
          if (serverData.settings) localStorage.setItem('bible_settings', JSON.stringify(serverData.settings));
          if (serverData.userSettings) localStorage.setItem('user_settings', JSON.stringify(serverData.userSettings));
          
          if (serverData.readingPlan) localStorage.setItem('bible_reading_plan', JSON.stringify(serverData.readingPlan));
          else localStorage.removeItem('bible_reading_plan');
          
          if (serverData.readingPlanHistory) localStorage.setItem('bible_reading_plan_history', JSON.stringify(serverData.readingPlanHistory));
          
          if (serverData.customPrayers) localStorage.setItem('custom_prayers', JSON.stringify(serverData.customPrayers));
          if (serverData.customRecommendedPrayers) localStorage.setItem('custom_recommended_prayers', JSON.stringify(serverData.customRecommendedPrayers));
          
          localStorage.setItem('sync_updated_at', serverData.updatedAt.toString());
          setSyncStateHash(getLocalSyncHash());
        }
      }
    } catch (err) {
      console.error('자동 다운로드 실패:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [getLocalSyncHash]);

  useEffect(() => {
    triggerAutoDownload();
    setSyncStateHash(getLocalSyncHash());

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerAutoDownload();
      }
    };

    const handleFocus = () => {
      triggerAutoDownload();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [triggerAutoDownload, getLocalSyncHash]);

  useEffect(() => {
    const pin = localStorage.getItem('sync_pin');
    if (!pin) return;

    const interval = setInterval(() => {
      if (isSyncingRef.current) return;
      const currentHash = getLocalSyncHash();
      if (syncStateHash && currentHash !== syncStateHash) {
        setSyncStateHash(currentHash);
        triggerAutoUpload();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [syncStateHash, getLocalSyncHash, triggerAutoUpload]);

  return (
    <BibleContext.Provider value={{
      historyLogs,
      continueReadPos,
      isContinueMode,
      setContinueReadPos,
      setIsContinueMode,
      addHistoryLog,
      updateHistoryLog,
      togglePin,
      deleteHistoryLog,
      clearHistory,
      myVerses,
      setMyVerses,
      saveMyVerse,
      deleteMyVerse,
      clearAllMyVerses,

      // 미사 공유 상태
      massActiveTab,
      setMassActiveTab,
      massReadings,
      setMassReadings,
      massOverlay,
      setMassOverlay,
      massMeditationText,
      setMassMeditationText,
      
      // 🌟 기도 관련 공유 상태
      showIntro,
      setShowIntro,
      showPrayerCategories,
      setShowPrayerCategories,
      selectedPrayerCategoryId,
      setSelectedPrayerCategoryId,
      selectedPrayerId,
      setSelectedPrayerId,
      isPrayerSearchMode,
      setIsPrayerSearchMode,
      isIndividualMenu,
      setIsIndividualMenu,
      isRecManageModalOpen,
      isHistoryOpen,
      setIsHistoryOpen,
      setIsRecManageModalOpen,
      isPrayerWriteModalOpen,
      setIsPrayerWriteModalOpen,
      
      // TTS Exported properties
      isSpeaking,
      setIsSpeaking,
      isPaused,
      setIsPaused,
      speakingVerseId,
      setSpeakingVerseId,
      ttsSpeed,
      setTtsSpeed,
      selectedVoiceURI,
      setSelectedVoiceURI,
      hideEnglishVoices,
      setHideEnglishVoices,
      ttsHandlers,
      setTtsHandlers,

      // Supertonic3 연동
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
      setSupertonicSpatial,
      offlineState,
      setOfflineState,

      // 자동 동기화 트리거 노출
      triggerAutoUpload
    }}>
      {children}
    </BibleContext.Provider>
  );
}
