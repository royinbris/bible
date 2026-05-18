import { useEffect, useRef } from 'react';
import { useBible } from '../context/BibleContext';

export function useSimpleTTS(items) {
  const {
    setIsSpeaking,
    setIsPaused,
    setSpeakingVerseId,
    ttsSpeed,
    selectedVoiceURI,
    setTtsHandlers,
    isSpeaking,
    isPaused
  } = useBible();

  const sessionRef = useRef(0);
  const itemsRef = useRef(items);
  const currentIndexRef = useRef(0);
  const selectedVoiceURIRef = useRef(selectedVoiceURI);
  const ttsSpeedRef = useRef(ttsSpeed);
  const wakeLockRef = useRef(null);

  // Sync latest items
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Sync latest properties to avoid re-triggering main mount effect
  useEffect(() => {
    selectedVoiceURIRef.current = selectedVoiceURI;
  }, [selectedVoiceURI]);

  useEffect(() => {
    const prevSpeed = ttsSpeedRef.current;
    ttsSpeedRef.current = ttsSpeed;
    
    // Only restart if the speed actually changed AND we are actively reading out loud (not paused)
    if (isSpeaking && !isPaused && prevSpeed !== ttsSpeed && currentIndexRef.current !== null) {
      sessionRef.current += 1;
      speakItem(currentIndexRef.current, sessionRef.current);
    }
  }, [ttsSpeed, isSpeaking, isPaused]);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('TTS: Screen Wake Lock acquired.');
      }
    } catch (err) {
      console.warn(`TTS: Screen Wake Lock failed: ${err.message}`);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('TTS: Screen Wake Lock released.');
      }
    } catch (err) {
      console.warn(`TTS: Screen Wake Lock release failed: ${err.message}`);
    }
  };

  // Manage Screen Wake Lock based on speaking status
  useEffect(() => {
    if (isSpeaking && !isPaused) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => {
      releaseWakeLock();
    };
  }, [isSpeaking, isPaused]);

  // Clean raw bible text for comfortable TTS listening
  const cleanTextForSpeech = (text) => {
    if (!text) return '';
    // Strip verse number, e.g. [1], 1절, 14:
    let clean = text.replace(/^(?:\[|\()?(?:(?:[0-9]+)(?:\s*:\s*|\s*장\s*))?([0-9]+)(?:\]|\)|\.|절)?\s*/, '');
    // Strip reference lists and brackets: e.g. [[마태 5,3]], (루카 6,20)
    clean = clean.replace(/\[\[.*?\]\]/g, '').replace(/\(.*?\)/g, '');
    // Strip markup symbols
    clean = clean.replace(/[#$\*]/g, '');
    return clean.trim();
  };

  const findItemIndexBelowTopBar = () => {
    const headerEl = document.querySelector('.reader-header-v2');
    const topBoundary = headerEl ? headerEl.getBoundingClientRect().bottom : 80;
    
    for (let i = 0; i < itemsRef.current.length; i++) {
      const item = itemsRef.current[i];
      const el = document.getElementById(item.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        // If bottom coordinate of the element is below the sticky header boundary and the element actually has height!
        if (rect.height > 0 && rect.bottom > topBoundary + 5) {
          return i;
        }
      }
    }
    return 0;
  };

  const speakItem = (index, sessionId) => {
    // If session has changed, abort immediately (prevents duplicate playback overlapping threads)
    if (sessionId !== sessionRef.current) return;
    
    if (index < 0 || index >= itemsRef.current.length) {
      stopSpeech();
      return;
    }

    currentIndexRef.current = index;
    const item = itemsRef.current[index];
    setSpeakingVerseId(item.id);

    // Smooth auto-scroll tracking
    const el = document.getElementById(item.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Crucial Web Speech API fix: resume before cancel resets any browser-level pause lockups!
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();

    let textToSpeak = cleanTextForSpeech(item.text);
    if (item.type === 'subheading' || item.type === 'chapter') {
      textToSpeak += '.'; // Give subheading & chapter titles a natural breathing pause at the end
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'ko-KR';
    utterance.rate = ttsSpeedRef.current;
    utterance.volume = 1.0;

    // Fetch and bind voice
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.voiceURI === selectedVoiceURIRef.current);
    
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    } else {
      // Fallback voice selection heuristic
      const koreanVoices = voices.filter(v => v.lang.startsWith('ko'));
      if (koreanVoices.length > 0) {
        // Prefer premium or enhanced natural voice if available
        const premiumKo = koreanVoices.find(v => v.name.includes('Premium') || v.name.includes('Enhanced') || v.name.includes('Yuna') || v.name.includes('Siri'));
        utterance.voice = premiumKo || koreanVoices[0];
      }
    }

    utterance.onend = () => {
      // Small delay before reading next item to keep audio buffers relaxed
      setTimeout(() => {
        if (sessionId === sessionRef.current) {
          speakItem(index + 1, sessionId);
        }
      }, item.type === 'subheading' || item.type === 'chapter' ? 500 : 100);
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesisUtterance error, auto skipping to prevent freeze:', e);
      setTimeout(() => {
        if (sessionId === sessionRef.current) {
          speakItem(index + 1, sessionId);
        }
      }, 100);
    };

    // Micro-delay timeout trick to prevent iOS speech queue locks
    setTimeout(() => {
      if (sessionId === sessionRef.current) {
        window.speechSynthesis.speak(utterance);
      }
    }, 50);
  };

  const playSpeech = () => {
    sessionRef.current += 1;
    setIsSpeaking(true);
    setIsPaused(true); // Cue up in paused state!
    
    // Find the item right below the top bar dynamically to start reading from there!
    const startIndex = findItemIndexBelowTopBar();
    currentIndexRef.current = startIndex;
    
    if (startIndex >= 0 && startIndex < itemsRef.current.length) {
      const item = itemsRef.current[startIndex];
      setSpeakingVerseId(item.id);
      
      // Smoothly center the highlighted starting verse so the user sees it immediately
      setTimeout(() => {
        const el = document.getElementById(item.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  };

  const stopSpeech = () => {
    sessionRef.current += 1;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setSpeakingVerseId(null);
    currentIndexRef.current = 0;
  };

  // iOS Safari empty-voices wakeup cache generator
  useEffect(() => {
    const wakeupVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
      }
    };
    wakeupVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = wakeupVoices;
    }
  }, []);

  // Handle page visibility change (switching browser tabs, locking screen, hiding app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Automatically pause browser speech and toggle button state when screen is hidden
        window.speechSynthesis.pause();
        setIsPaused(true);
        releaseWakeLock();
      } else {
        // Re-acquire Wake Lock when tab becomes visible again and we are playing
        if (isSpeaking && !isPaused) {
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSpeaking, isPaused]);

  // Sync hook handlers to global state so persistent bottom bar can invoke them
  useEffect(() => {
    setTtsHandlers({
      play: playSpeech,
      stop: stopSpeech,
      pause: () => {
        window.speechSynthesis.pause();
        setIsPaused(true);
        releaseWakeLock();
      },
      resume: () => {
        // If there is no active speech utterance in the browser (due to initial pre-load or cancellation),
        // start speaking from the currently highlighted index!
        if (!window.speechSynthesis.speaking) {
          sessionRef.current += 1;
          setIsPaused(false);
          speakItem(currentIndexRef.current, sessionRef.current);
        } else {
          window.speechSynthesis.resume();
          setIsPaused(false);
          requestWakeLock();
        }
      },
      next: () => {
        sessionRef.current += 1;
        setIsPaused(false); // Reset pause state
        window.speechSynthesis.resume(); // Unblock the browser engine!
        const nextIndex = Math.min(itemsRef.current.length - 1, currentIndexRef.current + 1);
        speakItem(nextIndex, sessionRef.current);
      },
      prev: () => {
        sessionRef.current += 1;
        setIsPaused(false); // Reset pause state
        window.speechSynthesis.resume(); // Unblock the browser engine!
        const prevIndex = Math.max(0, currentIndexRef.current - 1);
        speakItem(prevIndex, sessionRef.current);
      }
    });

    // Cleanup: unmount terminates current audio immediately to prevent lingering voice leaks
    return () => {
      sessionRef.current += 1; // Increment session ID immediately to invalidate all pending timers!
      const wasSpeaking = window.speechSynthesis.speaking;
      window.speechSynthesis.cancel();
      
      // If we were speaking, transition to paused state so that the bottom controller remains visible and ready when we return!
      if (wasSpeaking) {
        setIsSpeaking(true);
        setIsPaused(true);
      } else {
        setIsSpeaking(false);
        setIsPaused(false);
      }
      setSpeakingVerseId(null);
    };
  }, []); // Empty dependency array ensures handlers are only registered once and cleanup only runs on unmount!

  return {
    play: playSpeech,
    stop: stopSpeech
  };
}
