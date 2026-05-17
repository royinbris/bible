import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

    // Update continueReadPos if in continue mode (한권읽기)
    if (isContinueMode) {
      setContinueReadPos({
        bookId: String(bookId),
        bookName,
        chapter: parseInt(chapter),
        verseNum: parseInt(verseNum),
        timestamp
      });
    }
  }, [isContinueMode]);

  // 2. Update History Log (Real-time tracking on scroll)
  const updateHistoryLog = useCallback((verseNum, subtitleId = '', subtitleText = '') => {
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
      activeLog.timestamp = timestamp;
      
      updatedLogs[activeIndex] = activeLog;
      
      // Update continueReadPos if in continue mode (한권읽기)
      if (isContinueMode) {
        setContinueReadPos({
          bookId: activeLog.bookId,
          bookName: activeLog.bookName,
          chapter: activeLog.chapter,
          verseNum: parseInt(verseNum),
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
      clearHistory
    }}>
      {children}
    </BibleContext.Provider>
  );
}
