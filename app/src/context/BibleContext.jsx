import React, { createContext, useContext, useState, useEffect } from 'react';

const BibleContext = createContext();

export function useBible() {
  return useContext(BibleContext);
}

export function BibleProvider({ children }) {
  const [historyLogs, setHistoryLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('bible_reading_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [continueReadPos, setContinueReadPos] = useState(() => {
    try {
      const saved = localStorage.getItem('continueReadPos');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
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

  // 1. Add History Log
  const addHistoryLog = (bookId, bookName, chapter, verseNum = 1, subtitleId = '', subtitleText = '') => {
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
  };

  // 2. Update History Log (Real-time tracking on scroll)
  const updateHistoryLog = (verseNum, subtitleId = '', subtitleText = '') => {
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
  };

  // 3. Toggle Pin (with Cloning Mechanism)
  const togglePin = (id) => {
    const targetLog = historyLogs.find(l => l.id === id);
    if (!targetLog) return { success: false, message: '기록을 찾을 수 없습니다.' };

    if (targetLog.isPinned) {
      // Unpin: Remove the pinned log
      setHistoryLogs(prev => prev.filter(l => l.id !== id));
      return { success: true, message: '핀 고정이 해제되었습니다.', action: 'unpin' };
    } else {
      // Check duplicate: Don't pin the same book-chapter-verse combo if already pinned
      const isDuplicate = historyLogs.some(
        l => l.isPinned &&
             l.bookId === targetLog.bookId &&
             l.chapter === targetLog.chapter &&
             l.verseNum === targetLog.verseNum
      );
      
      if (isDuplicate) {
        return { success: false, message: '이미 동일한 구절이 핀 목록에 고정되어 있습니다.', action: 'duplicate' };
      }

      const timestamp = Date.now();
      
      // Cloning Mechanism: If pinning the active session, clone it and set isPinned: true.
      // The original active session remains so it can continue tracking scrolls.
      const activeLog = historyLogs.find(l => !l.isPinned);
      
      if (activeLog && activeLog.id === id) {
        const clonedLog = {
          ...targetLog,
          id: `pin-${timestamp}`,
          isPinned: true,
          timestamp
        };
        
        setHistoryLogs(prev => [clonedLog, ...prev]);
        return { success: true, message: '책갈피 체크리스트에 고정되었습니다.', action: 'pin_clone' };
      } else {
        // Convert to pinned directly if it's a past history log
        setHistoryLogs(prev => prev.map(l => l.id === id ? { ...l, isPinned: true, timestamp } : l));
        return { success: true, message: '책갈피 체크리스트에 고정되었습니다.', action: 'pin_convert' };
      }
    }
  };

  // 4. Delete Log
  const deleteHistoryLog = (id) => {
    setHistoryLogs(prev => prev.filter(l => l.id !== id));
  };

  // 5. Clear Reading History (except Pinned)
  const clearHistory = () => {
    setHistoryLogs(prev => prev.filter(l => l.isPinned));
  };

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
