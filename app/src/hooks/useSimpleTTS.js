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
    isPaused,
    supertonicEnabled,
    supertonicUrl,
    supertonicVoice,
    supertonicFmt
  } = useBible();

  const sessionRef = useRef(0);
  const itemsRef = useRef(items);
  const currentIndexRef = useRef(0);
  const selectedVoiceURIRef = useRef(selectedVoiceURI);
  const ttsSpeedRef = useRef(ttsSpeed);
  const wakeLockRef = useRef(null);
  const isSpeakingRef = useRef(isSpeaking);  // restartFromCurrent 핸들러에서 참조
  const isPausedRef = useRef(isPaused);

  // 🎧 Supertonic3 연동
  const supertonicEnabledRef = useRef(supertonicEnabled);
  const supertonicUrlRef = useRef(supertonicUrl);
  const supertonicVoiceRef = useRef(supertonicVoice);
  const supertonicFmtRef = useRef(supertonicFmt);
  const audioRef = useRef(null);           // 재생용 HTMLAudioElement
  const audioCacheRef = useRef({});         // index -> objectURL (프리페치)

  useEffect(() => { supertonicEnabledRef.current = supertonicEnabled; }, [supertonicEnabled]);
  useEffect(() => { supertonicUrlRef.current = supertonicUrl; }, [supertonicUrl]);
  useEffect(() => { supertonicVoiceRef.current = supertonicVoice; }, [supertonicVoice]);
  useEffect(() => { supertonicFmtRef.current = supertonicFmt; }, [supertonicFmt]);

  // 오디오 엘리먼트 1회 생성
  useEffect(() => {
    if (typeof Audio !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.setAttribute('playsinline', '');
    }
  }, []);

  const useSupertonic = () => supertonicEnabledRef.current && !!supertonicUrlRef.current;

  const synthUrlFor = (text) => {
    const base = supertonicUrlRef.current.replace(/\/$/, '');
    const v = encodeURIComponent(supertonicVoiceRef.current || 'M1');
    const f = encodeURIComponent(supertonicFmtRef.current || 'wav');
    return `${base}/synth?voice=${v}&fmt=${f}&text=${encodeURIComponent(text)}`;
  };

  const prefetchSupertonic = (index) => {
    const items2 = itemsRef.current;
    if (index < 0 || index >= items2.length) return;
    if (audioCacheRef.current[index]) return;
    const text = cleanTextForSpeech(items2[index].text);
    if (!text) { audioCacheRef.current[index] = Promise.resolve(null); return; }
    audioCacheRef.current[index] = fetch(synthUrlFor(text))
      .then(r => r.ok ? r.blob() : null)
      .then(b => b ? URL.createObjectURL(b) : null)
      .catch(() => null);
  };

  const stopSupertonicAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
    }
  };

  const speakItemSupertonic = async (index, sessionId) => {
    if (sessionId !== sessionRef.current) return;
    if (index < 0 || index >= itemsRef.current.length) { stopSpeech(); return; }

    currentIndexRef.current = index;
    const item = itemsRef.current[index];
    setSpeakingVerseId(item.id);
    const el = document.getElementById(item.id);
    if (el) scrollToActiveVerse(el);

    prefetchSupertonic(index);
    prefetchSupertonic(index + 1);

    const src = await audioCacheRef.current[index];
    if (sessionId !== sessionRef.current) return;
    if (!src) {  // 실패 시 다음 항목으로
      setTimeout(() => { if (sessionId === sessionRef.current) speakItemSupertonic(index + 1, sessionId); }, 150);
      return;
    }
    const audio = audioRef.current;
    audio.src = src;
    audio.playbackRate = ttsSpeedRef.current;
    audio.onended = () => {
      setTimeout(() => {
        if (sessionId === sessionRef.current) speakItemSupertonic(index + 1, sessionId);
      }, item.type === 'subheading' || item.type === 'chapter' ? 400 : 80);
    };
    audio.onerror = () => {
      setTimeout(() => { if (sessionId === sessionRef.current) speakItemSupertonic(index + 1, sessionId); }, 120);
    };
    try { await audio.play(); } catch (e) { /* 사용자 제스처 필요 등 */ }
    prefetchSupertonic(index + 1);
    prefetchSupertonic(index + 2);
  };

  // Sync latest items
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Sync latest properties to avoid re-triggering main mount effect
  useEffect(() => {
    selectedVoiceURIRef.current = selectedVoiceURI;
  }, [selectedVoiceURI]);

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  useEffect(() => {
    ttsSpeedRef.current = ttsSpeed;
    // Supertonic 재생 중이면 배속 즉시 반영
    if (audioRef.current) audioRef.current.playbackRate = ttsSpeed;
  }, [ttsSpeed]);

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
  
  // Smart Viewport-Aware Scroll to avoid sudden jumps when starting and keep reading focused
  const scrollToActiveVerse = (el) => {
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const centerLine = viewportHeight / 2;

    // Find top boundary (below sticky header)
    const headerEl = document.querySelector('.reader-header-v2') || document.querySelector('.home-header');
    const topBoundary = headerEl ? headerEl.getBoundingClientRect().bottom : 80;

    // 1. If the element is hidden or partially hidden above the top boundary, scroll it to the top!
    if (rect.top < topBoundary) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Fine-tune offset to prevent sticky header overlap
      setTimeout(() => {
        const updatedRect = el.getBoundingClientRect();
        if (updatedRect.top < topBoundary) {
          const scrollEl = document.getElementById('page-scroll');
          if (scrollEl) scrollEl.scrollBy({ top: updatedRect.top - topBoundary - 10, behavior: 'smooth' });
        }
      }, 200);
      return;
    }

    // 2. If the element's center or bottom is below the middle of the screen, scroll it to the center!
    const elementCenter = rect.top + rect.height / 2;
    if (elementCenter > centerLine) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 3. Otherwise (it is fully visible between topBoundary and centerLine), do NOT scroll! Let the highlight move down naturally.
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

    // 🎧 Supertonic3 엔진 사용 시 별도 경로
    if (useSupertonic()) {
      window.speechSynthesis.cancel();
      speakItemSupertonic(index, sessionId);
      return;
    }

    if (index < 0 || index >= itemsRef.current.length) {
      stopSpeech();
      return;
    }

    currentIndexRef.current = index;
    const item = itemsRef.current[index];
    setSpeakingVerseId(item.id);

    // Smooth smart auto-scroll tracking
    const el = document.getElementById(item.id);
    if (el) {
      scrollToActiveVerse(el);
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
      
      // Smoothly scroll the highlighted starting verse based on intelligent viewport check
      setTimeout(() => {
        const el = document.getElementById(item.id);
        if (el) {
          scrollToActiveVerse(el);
        }
      }, 50);
    }
  };

  const stopSpeech = () => {
    sessionRef.current += 1;
    window.speechSynthesis.cancel();
    stopSupertonicAudio();
    // 프리페치 캐시 정리 (objectURL 해제)
    Object.values(audioCacheRef.current).forEach(p => {
      Promise.resolve(p).then(u => { if (u) URL.revokeObjectURL(u); }).catch(() => {});
    });
    audioCacheRef.current = {};
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
        // Do NOT pause TTS programmatically to allow background listening on Mac, Windows, and compatible tablets!
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
        if (useSupertonic()) {
          if (audioRef.current) audioRef.current.pause();
        } else {
          window.speechSynthesis.pause();
        }
        setIsPaused(true);
        releaseWakeLock();
      },
      resume: () => {
        if (useSupertonic()) {
          const audio = audioRef.current;
          // 일시정지된 현재 클립이 남아있으면 이어서, 없으면 현재 항목부터 시작
          if (audio && audio.src && audio.currentTime > 0 && !audio.ended) {
            setIsPaused(false);
            requestWakeLock();
            audio.play().catch(() => {});
          } else {
            sessionRef.current += 1;
            setIsPaused(false);
            speakItem(currentIndexRef.current, sessionRef.current);
          }
          return;
        }
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
        stopSupertonicAudio();
        const nextIndex = Math.min(itemsRef.current.length - 1, currentIndexRef.current + 1);
        speakItem(nextIndex, sessionRef.current);
      },
      prev: () => {
        sessionRef.current += 1;
        setIsPaused(false); // Reset pause state
        window.speechSynthesis.resume(); // Unblock the browser engine!
        stopSupertonicAudio();
        const prevIndex = Math.max(0, currentIndexRef.current - 1);
        speakItem(prevIndex, sessionRef.current);
      },
      restartFromCurrent: () => {
        const sid = sessionRef.current + 1;
        sessionRef.current = sid;
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
        stopSupertonicAudio();
        setTimeout(() => speakItem(currentIndexRef.current, sid), 50);
      }
    });
  }, [items, isSpeaking, isPaused]);

  // Cleanup: unmount terminates current audio immediately to prevent lingering voice leaks
  useEffect(() => {
    return () => {
      setTtsHandlers(prev => {
        if (prev.play === playSpeech) {
          return {};
        }
        return prev;
      });
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
  }, []);

  return {
    play: playSpeech,
    stop: stopSpeech
  };
}
