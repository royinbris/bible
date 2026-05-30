import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsSheet from '../components/SettingsSheet';
import { useBible } from '../context/BibleContext';
import { useSimpleTTS } from '../hooks/useSimpleTTS';
import { useSettings } from '../context/SettingsContext';

const SHOW_HEADER = false;

export default function PrayersList() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const {
    showPrayerCategories,
    setShowPrayerCategories,
    selectedPrayerCategoryId,
    setSelectedPrayerCategoryId,
    selectedPrayerId,
    setSelectedPrayerId,
    speakingVerseId,
    isPrayerSearchMode,
    setIsPrayerSearchMode,
    setIsIndividualMenu,
    showIntro,
    setShowIntro
  } = useBible();

  const mainRef = useRef(null);
  const isRestoringRef = useRef(false);

  const [categories, setCategories] = useState([]);
  const [prayers, setPrayers] = useState({});
  const [selectedCategoryId, setSelectedCategoryId] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // 카테고리 이름을 축약 매핑하는 헬퍼 함수
  const getShortCategoryName = (title, id) => {
    if (id === 99) return 'mine';
    if (title.includes('주요')) return '주요';
    if (title.includes('일상')) return '일상';
    if (title.includes('신심')) return '신심';
    if (title.includes('전구')) return '전구';
    if (title.includes('특별')) return '특별';
    return title;
  };

  const getFontFamilyStyle = (family) => {
    if (family === 'System Default') return 'inherit';
    return family;
  };
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [visitedPrayerIds, setVisitedPrayerIds] = useState(() => {
    try {
      const saved = localStorage.getItem('visited_prayer_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 🌟 [추가] 나의 기도 & 감성 인트로 & 추천 기도 상태
  const [customPrayers, setCustomPrayers] = useState(() => {
    try {
      const saved = localStorage.getItem('custom_prayers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPrayerTitle, setNewPrayerTitle] = useState('');
  const [newPrayerBody, setNewPrayerBody] = useState('');
  const [editingPrayer, setEditingPrayer] = useState(null);
  const [recommendedPrayers, setRecommendedPrayers] = useState([]);
  const [timeZoneName, setTimeZoneName] = useState('하루');

  const [isRecManageModalOpen, setIsRecManageModalOpen] = useState(false);
  const [recManageTab, setRecManageTab] = useState('아침');
  const [customRecMap, setCustomRecMap] = useState(() => {
    try {
      const saved = localStorage.getItem('custom_recommended_prayers');
      return saved ? JSON.parse(saved) : { '아침': [], '낮': [], '저녁/밤': [] };
    } catch {
      return { '아침': [], '낮': [], '저녁/밤': [] };
    }
  });
  const [recSearchQuery, setRecSearchQuery] = useState('');

  // 🌟 [수정] 모바일 스크롤 버그를 유발하는 Drag & Drop 대신 안전한 화살표 이동 로직 사용
  const handleMoveOrder = (id, direction) => {
    const currentList = customRecMap[recManageTab] || [];
    const index = currentList.indexOf(id);
    if (index < 0) return;

    const newList = [...currentList];
    if (direction === 'up' && index > 0) {
      const temp = newList[index - 1];
      newList[index - 1] = newList[index];
      newList[index] = temp;
    } else if (direction === 'down' && index < newList.length - 1) {
      const temp = newList[index + 1];
      newList[index + 1] = newList[index];
      newList[index] = temp;
    } else {
      return;
    }

    const newMap = { ...customRecMap, [recManageTab]: newList };
    setCustomRecMap(newMap);
    localStorage.setItem('custom_recommended_prayers', JSON.stringify(newMap));
  };

  // 🎙️ 개별 기도문 텍스트를 문장 리스트로 쪼개주는 헬퍼
  const splitBodyIntoParagraphs = useCallback((bodyText, idPrefix) => {
    if (!bodyText) return [];
    return bodyText.split('\n').map((line, lineIdx) => {
      if (line.trim() === '') {
        return { line, sentences: [] };
      }
      const rawSentences = line.split(/(?<=[.?!])(?=\s|$)/);
      const sentences = rawSentences
        .map((s, sentIdx) => ({
          id: `${idPrefix}-${lineIdx}-${sentIdx}`,
          text: s.trim()
        }))
        .filter(s => s.text.length > 0);
      return { line, sentences };
    });
  }, []);

  // 🎙️ 추천 기도 리스트 TTS 연동 (상태 변수가 모두 안전하게 초기화된 후 호출)
  const ttsItems = useMemo(() => {
    // 1. 카테고리 모드에서 특정 기도문을 선택한 경우 (열린 기도문 상세 뷰)
    if (showPrayerCategories && selectedPrayerId !== null) {
      const allPrayers = Object.values(prayers).flat();
      const selected = allPrayers.find(p => p.id === selectedPrayerId);
      if (selected) {
        const items = [
          { id: `detail-title-${selected.id}`, text: selected.title, lang: 'ko' }
        ];
        const paragraphs = splitBodyIntoParagraphs(selected.body, `detail-sent-${selected.id}`);
        paragraphs.forEach(para => {
          para.sentences.forEach(sent => {
            items.push({ id: sent.id, text: sent.text, lang: 'ko' });
          });
        });
        return items;
      }
      return [];
    }
    
    // 2. 카테고리 모드이긴 하지만 목록인 경우 (선택 안됨) - 읽을 내용 없음
    if (showPrayerCategories) return [];

    // 3. 기본 추천 기도 리스트 (홈 화면)
    if (!recommendedPrayers || recommendedPrayers.length === 0) return [];
    const items = [];
    recommendedPrayers.forEach(prayer => {
      items.push({ id: `rec-title-${prayer.id}`, text: prayer.title, lang: 'ko' });
      const paragraphs = splitBodyIntoParagraphs(prayer.body, `rec-sent-${prayer.id}`);
      paragraphs.forEach(para => {
        para.sentences.forEach(sent => {
          items.push({ id: sent.id, text: sent.text, lang: 'ko' });
        });
      });
    });
    return items;
  }, [showPrayerCategories, selectedPrayerId, prayers, recommendedPrayers, splitBodyIntoParagraphs]);

  useSimpleTTS(ttsItems);

  useEffect(() => {
    fetchPrayers();
  }, []);

  // 🌟 [수정] 개별 기도문을 선택해 상세 보기 뷰로 전환될 때 스크롤을 최상단으로 리셋
  // useLayoutEffect로 DOM 업데이트 직후 동기적으로 리셋 (화면 깜빡임 방지)
  useLayoutEffect(() => {
    // 다른 탭에서 복귀하여 스크롤 복원 시나리오인 경우 최상단 리셋을 스킵하여 충돌 방지
    const restoreFlag = sessionStorage.getItem('restore_scroll_prayer');
    if (restoreFlag === 'true') {
      return;
    }

    if (selectedPrayerId !== null) {
      // main 컨테이너와 window/document 양쪽 모두 리셋
      // (실제 스크롤 컨테이너가 어느 쪽이든 커버)
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      // 렌더링 완료 후 한번 더 강제 리셋 (브라우저 scroll anchoring 방지)
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
  }, [selectedPrayerId]);

  // 🌟 [추가] 모달이 열릴 때 로컬스토리지 추천 설정을 불러와 동기화
  // 🌟 [추가] 나의 기도 목록이 바뀔 때 prayers 맵의 99번 카테고리 실시간 업데이트
  useEffect(() => {
    setPrayers(prev => ({
      ...prev,
      99: customPrayers
    }));
  }, [customPrayers]);



  // 🌟 [추가] 시간대별 추천 기도 세팅 및 초기화
  useEffect(() => {
    if (isLoading || categories.length === 0) return;
    
    const allPrayersList = Object.values(prayers).flat();
    if (allPrayersList.length === 0) return;

    // 최초 실행 시 기본 추천 기도를 찾아 초기값으로 저장 (키워드 기반 4개)
    const hasInit = localStorage.getItem('has_init_rec_prayers');
    let activeMap = customRecMap;

    if (!hasInit) {
      const initMap = { '아침': [], '낮': [], '저녁/밤': [] };
      const configs = [
        { tz: '아침', keywords: ['아침', '삼종', '시작', '주님의 기도', '성모송'] },
        { tz: '낮', keywords: ['식사', '삼종', '삼종기도', '낮', '영광송'] },
        { tz: '저녁/밤', keywords: ['저녁', '성찰', '마치는', '하루를 마치는', '삼종', '성모송', '영광송'] }
      ];
      configs.forEach(conf => {
        const matching = allPrayersList.filter(p => 
          conf.keywords.some(k => p.title.toLowerCase().includes(k))
        ).slice(0, 4);
        initMap[conf.tz] = matching.map(p => p.id);
      });
      
      activeMap = initMap;
      setCustomRecMap(initMap);
      localStorage.setItem('custom_recommended_prayers', JSON.stringify(initMap));
      localStorage.setItem('has_init_rec_prayers', 'true');
    }

    const hour = new Date().getHours();
    let tz = '하루';
    if (hour >= 5 && hour < 11) {
      tz = '아침';
    } else if (hour >= 11 && hour < 17) {
      tz = '낮';
    } else {
      tz = '저녁/밤';
    }
    
    setTimeZoneName(tz);
    
    // 🌟 오직 커스텀 추천 기도(activeMap)만 화면에 노출시킴!
    // 모달과 100% 동기화됨.
    const customIds = activeMap[tz] || [];
    const customPrayersList = customIds.map(id => allPrayersList.find(p => p.id === id)).filter(Boolean);
    
    setRecommendedPrayers(customPrayersList);
  }, [isLoading, prayers, customPrayers, categories, customRecMap]);

  const fetchPrayers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/data/prayers.md');
      if (!response.ok) throw new Error('기도문 데이터를 불러오는데 실패했습니다.');
      const text = await response.text();
      
      const lines = text.split('\n');
      const parsedCats = [];
      const parsedPrayers = [];

      let currentCategory = null;
      let currentPrayer = null;
      let bodyLines = [];
      let prayerIndex = 1;

      for (let line of lines) {
        const trimmed = line.trim();

        // Category: ## 1. 예비신자 암송 주요 기도
        if (trimmed.startsWith('## ')) {
          if (currentPrayer) {
            currentPrayer.body = bodyLines.join('\n').trim();
            parsedPrayers.push(currentPrayer);
            currentPrayer = null;
            bodyLines = [];
          }

          const fullTitle = trimmed.replace(/^##\s+/, '').trim();
          const match = fullTitle.match(/^(\d+)\.?\s*(.+)/);
          const number = match ? match[1] : String(parsedCats.length + 1);
          const title = match ? match[2] : fullTitle;

          currentCategory = { id: parseInt(number), number, title };
          parsedCats.push(currentCategory);
          continue;
        }

        // Prayer: ### 성호경
        if (trimmed.startsWith('### ')) {
          if (currentPrayer) {
            currentPrayer.body = bodyLines.join('\n').trim();
            parsedPrayers.push(currentPrayer);
            bodyLines = [];
          }

          const title = trimmed.replace(/^###\s+/, '').trim();
          currentPrayer = {
            id: prayerIndex++,
            categoryId: currentCategory ? currentCategory.id : 0,
            title,
            body: '',
            order: parsedPrayers.length
          };
          continue;
        }

        // Body text
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
        parsedPrayers.push(currentPrayer);
      }

      // 나의 기도함 카테고리 추가
      const totalCats = [...parsedCats, { id: 99, number: '★', title: '나의 기도함' }];
      setCategories(totalCats);
      
      const prayersMap = {};
      parsedPrayers.forEach(p => {
        if (!prayersMap[p.categoryId]) {
          prayersMap[p.categoryId] = [];
        }
        prayersMap[p.categoryId].push(p);
      });
      // 나의 기도를 맵에 연동
      prayersMap[99] = customPrayers;
      setPrayers(prayersMap);
      
      localStorage.setItem('cached_prayers_list', JSON.stringify(parsedPrayers));
      localStorage.setItem('cached_prayers_categories', JSON.stringify(parsedCats));
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 🌟 [추가] 추천 기도 토글 핸들러
  const handleToggleRecPrayer = (tz, prayerId) => {
    setCustomRecMap(prev => {
      const currentList = prev[tz] || [];
      let updatedList;
      if (currentList.includes(prayerId)) {
        updatedList = currentList.filter(id => id !== prayerId);
      } else {
        updatedList = [...currentList, prayerId];
      }
      
      const newMap = {
        ...prev,
        [tz]: updatedList
      };
      
      localStorage.setItem('custom_recommended_prayers', JSON.stringify(newMap));
      return newMap;
    });
  };

  // 🌟 [추가] 나의 기도 저장/수정 핸들러
  const handleSaveCustomPrayer = (e) => {
    e.preventDefault();
    if (!newPrayerTitle.trim() || !newPrayerBody.trim()) {
      alert('제목과 내용을 모두 입력해 주세요.');
      return;
    }
    
    let updated;
    if (editingPrayer) {
      updated = customPrayers.map(p => 
        p.id === editingPrayer.id ? { ...p, title: newPrayerTitle, body: newPrayerBody } : p
      );
      setEditingPrayer(null);
    } else {
      const newId = 10000 + Date.now();
      const newP = {
        id: newId,
        categoryId: 99,
        title: newPrayerTitle,
        body: newPrayerBody,
        isCustom: true
      };
      updated = [newP, ...customPrayers];
    }
    
    setCustomPrayers(updated);
    localStorage.setItem('custom_prayers', JSON.stringify(updated));
    setNewPrayerTitle('');
    setNewPrayerBody('');
    setIsCreateModalOpen(false);
  };

  const handleCloseIntro = () => {
    setShowIntro(false);
    setIsIndividualMenu(true);
    setShowPrayerCategories(false);
    setIsPrayerSearchMode(false);
    setSelectedPrayerId(null);
  };

  const handlePrayerClick = (prayerId) => {
    const nextVisited = visitedPrayerIds.includes(prayerId) 
      ? visitedPrayerIds 
      : [...visitedPrayerIds, prayerId];
    localStorage.setItem('visited_prayer_ids', JSON.stringify(nextVisited));
    setVisitedPrayerIds(nextVisited);
    navigate(`/prayers/${prayerId}`);
  };

  const allPrayersList = Object.values(prayers).flat();
  
  const displayPrayers = selectedCategoryId !== null 
    ? (selectedCategoryId === -1 
        ? allPrayersList
        : prayers[selectedCategoryId] || []
      ).filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.body.toLowerCase().includes(searchQuery.toLowerCase())
      ) 
    : [];

  const searchResults = searchQuery 
    ? allPrayersList.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.body.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // 🧭 다른 탭으로 이동했다 복귀 시 기도 목록 스크롤 복원 (윈도우 + 컨테이너 동시 대응)
  useLayoutEffect(() => {
    if (!isLoading) {
      const restoreFlag = sessionStorage.getItem('restore_scroll_prayer');
      const savedScroll = localStorage.getItem('scroll_y_prayer_list');
      if (restoreFlag === 'true' && savedScroll && mainRef.current) {
        sessionStorage.removeItem('restore_scroll_prayer');
        const scrollVal = parseInt(savedScroll, 10);
        
        isRestoringRef.current = true;
        const scrollAttempts = [50, 100, 200, 350, 500, 800, 1200, 1600, 2000, 2500];
        
        scrollAttempts.forEach((delay, idx) => {
          setTimeout(() => {
            // 윈도우 스크롤 복원
            window.scrollTo(0, scrollVal);
            if (document.documentElement) document.documentElement.scrollTop = scrollVal;
            if (document.body) document.body.scrollTop = scrollVal;

            // 엘리먼트 스크롤 복원
            if (mainRef.current) {
              mainRef.current.scrollTop = scrollVal;
            }
            if (idx === scrollAttempts.length - 1) {
              setTimeout(() => {
                isRestoringRef.current = false;
              }, 100);
            }
          }, delay);
        });
      }
    }
  }, [isLoading]);

  // 🧭 스크롤 위치 실시간 감지 및 저장 (윈도우 + 컨테이너 둘 다 추적)
  useEffect(() => {
    if (isLoading) return;

    const saveScrollPosition = () => {
      if (isRestoringRef.current) return;
      
      const winScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
      const mainScroll = mainRef.current ? mainRef.current.scrollTop : 0;
      const finalScroll = Math.max(winScroll, mainScroll);
      
      if (finalScroll > 0) {
        localStorage.setItem('scroll_y_prayer_list', finalScroll.toString());
      }
    };

    window.addEventListener('scroll', saveScrollPosition, { passive: true });
    
    const mainEl = mainRef.current;
    if (mainEl) {
      mainEl.addEventListener('scroll', saveScrollPosition, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', saveScrollPosition);
      if (mainEl) {
        mainEl.removeEventListener('scroll', saveScrollPosition);
      }
    };
  }, [isLoading]);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  if (isLoading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(166, 75, 42, 0.1)', borderTopColor: '#A64B2A', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
        <p style={{ fontSize: '1rem', fontWeight: '500', opacity: 0.85 }}>기도문을 불러오고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="search-wrapper" style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* 📱 상단 상태바 가림막 (시간/배터리 표시 영역 확보 - 상시 노출) */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'max(47px, env(safe-area-inset-top))',
        backgroundColor: 'var(--status-bar-bg)',
        zIndex: 110
      }} />

      {/* 📱 상단 고정 헤더바 추가 (상태바 침범 방지) */}
      {SHOW_HEADER && (
        <header className="header" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 'calc(56px + max(47px, env(safe-area-inset-top)))',
          padding: 'max(47px, env(safe-area-inset-top)) 16px 0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-color)',
          borderBottom: '1px solid var(--border-color)',
          zIndex: 1000,
          boxSizing: 'border-box'
        }}>
          {/* 중앙 제목 */}
          <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-color)', position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
            기도
          </span>

          <div style={{ marginLeft: 'auto' }}>
            {/* 설정 버튼 */}
            <button className="header-btn" onClick={() => setIsSettingsOpen(true)} style={{ border: 'none', background: 'none', color: 'var(--text-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </header>
      )}

      
      {/* 🌟 감성 인트로 레이어 */}
      {showIntro && (
        <div 
          className="faith-intro-overlay"
          onClick={handleCloseIntro}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--bg-color, #1e293b)',
            color: 'var(--text-color, #f8fafc)',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px',
            cursor: 'pointer',
            textAlign: 'center',
            backgroundImage: 'linear-gradient(135deg, rgba(166, 75, 42, 0.15) 0%, rgba(30, 41, 59, 0.98) 100%)',
            transition: 'opacity 0.4s ease'
          }}
        >
          <div style={{ maxWidth: '480px', animation: 'fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <div style={{ width: '48px', height: '2px', backgroundColor: 'var(--ot-accent, #A64B2A)', margin: '0 auto 28px', opacity: 0.8 }}></div>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--ot-accent, #A64B2A)', letterSpacing: '4px', textTransform: 'uppercase', display: 'block', marginBottom: '16px', opacity: 0.9 }}>기도는</span>
            <blockquote style={{ fontSize: '1.45rem', fontWeight: '300', fontFamily: 'Gowun Batang, Georgia, serif', lineHeight: '2.0', margin: 0, padding: 0, color: 'var(--text-color)' }}>
              "떼쓰기 보다는<br />대화다"
            </blockquote>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '54px', display: 'block', opacity: 0.6 }}>화면을 탭하여 계속하기</span>
          </div>
        </div>
      )}



      {/* Main Container */}
      <main ref={mainRef} style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: SHOW_HEADER 
          ? 'calc(72px + max(47px, env(safe-area-inset-top))) 16px 120px'
          : 'calc(16px + max(47px, env(safe-area-inset-top))) 16px 120px'
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {isPrayerSearchMode ? (
            /* ══ 0. 기도문 검색 모드 ══ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#A64B2A', margin: 0 }}>기도문 검색</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>제목이나 본문 내용을 검색해보세요.</p>
              </div>

              {/* 검색창 */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="검색어 입력..."
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 44px',
                    borderRadius: '16px',
                    border: '1.5px solid rgba(44, 44, 44, 0.1)',
                    backgroundColor: 'var(--secondary-bg)',
                    fontSize: '1rem',
                    color: 'var(--text-color)',
                    boxSizing: 'border-box',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                  }}
                />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>

              {/* 검색 결과 리스트 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '80px' }}>
                {searchQuery.trim() === '' ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    검색어를 입력해 주세요.
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((prayer) => (
                    <div
                      key={`search-${prayer.id}`}
                      onClick={() => {
                        // 검색 결과 클릭 시: 스크롤 리셋 후 검색 모드 종료 & 카테고리 모드 진입
                        if (mainRef.current) mainRef.current.scrollTop = 0;
                        window.scrollTo(0, 0);
                        setIsPrayerSearchMode(false);
                        setShowPrayerCategories(true);
                        setSelectedPrayerCategoryId(prayer.categoryId || 1);
                        setSelectedPrayerId(prayer.id);
                      }}
                      style={{
                        padding: '16px 20px',
                        borderRadius: '16px',
                        backgroundColor: 'var(--secondary-bg)',
                        border: '1.5px solid rgba(44, 44, 44, 0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
                        {prayer.title}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prayer.body.replace(/\n/g, ' ')}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    '{searchQuery}'에 대한 검색 결과가 없습니다.
                  </div>
                )}
              </div>
            </div>
          ) : showPrayerCategories ? (
            /* ══ 1. 카테고리 목록 보기 모드 ══ */
            selectedPrayerCategoryId === null ? (
              /* ── 1-0. 카테고리 미선택 → 안내 메시지 ── */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', color: 'var(--text-muted, #94a3b8)', textAlign: 'center', gap: '16px' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>기도 분류를 선택해 주세요</p>
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>아래 막대에서 원하는 분류를 탭하세요</p>
              </div>
            ) : selectedPrayerId === null ? (
              /* ── 1-A. 특정 카테고리에 속한 기도 리스트 ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '12px', borderBottom: '1.5px solid rgba(166,75,42,0.1)' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#A64B2A', margin: 0 }}>
                    {categories.find(c => c.id === selectedPrayerCategoryId)?.title || '기도문'} 목록
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    총 {(prayers[selectedPrayerCategoryId] || []).length}개의 기도문이 있습니다.
                  </p>
                </div>
                
                {/* 나의 기도인 경우 쓰기 버튼 제공 */}
                {selectedPrayerCategoryId === 99 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <button
                      onClick={() => { setEditingPrayer(null); setNewPrayerTitle(''); setNewPrayerBody(''); setIsCreateModalOpen(true); }}
                      style={{
                        flex: 1,
                        height: '48px',
                        borderRadius: '24px',
                        backgroundColor: '#A64B2A',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 'bold',
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(166,75,42,0.2)'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                      나의 기도 쓰기
                    </button>
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(prayers[selectedPrayerCategoryId] || []).map((prayer) => (
                    <div
                      key={prayer.id}
                      onClick={() => {
                        // 스크롤 위치를 먼저 리셋한 후 기도문 열기
                        if (mainRef.current) mainRef.current.scrollTop = 0;
                        window.scrollTo(0, 0);
                        setSelectedPrayerId(prayer.id);
                      }}
                      style={{
                        padding: '16px 20px',
                        borderRadius: '16px',
                        backgroundColor: 'var(--secondary-bg)',
                        border: '1.5px solid rgba(44, 44, 44, 0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
                        transition: 'transform 0.15s, background-color 0.15s'
                      }}
                    >
                      <span style={{ fontSize: '1.02rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
                        {prayer.title}
                      </span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  ))}
                  {(prayers[selectedPrayerCategoryId] || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', opacity: 0.6 }}>
                      {selectedPrayerCategoryId === 99 
                        ? '저장된 나의 기도가 없습니다. 첫 번째 기도를 작성해 보세요! ✍️'
                        : '등록된 기도문이 없습니다.'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── 1-B. 선택된 개별 기도문 본문 보기 ── */
              (() => {
                const selectedPrayer = allPrayersList.find(p => p.id === selectedPrayerId);
                if (!selectedPrayer) return null;
                return (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    minHeight: '65vh', 
                    gap: '20px', 
                    paddingLeft: '3rem',
                    paddingRight: '3rem'
                  }}>
                    {/* 기도문 본문 컨테이너 (테두리/배경 없음) */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        margin: 'auto 0'
                      }}
                    >
                      <h3 style={{ 
                        fontSize: '1.35rem', 
                        fontWeight: '900', 
                        color: 'var(--text-color)', 
                        margin: 0, 
                        textAlign: 'center',
                        backgroundColor: speakingVerseId === `detail-title-${selectedPrayer.id}` ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        transition: 'background-color 0.3s ease'
                      }}>
                        {selectedPrayer.title}
                      </h3>
                      <div style={{ width: '36px', height: '2.5px', backgroundColor: '#A64B2A', margin: '0 auto' }}></div>
                      <div style={{
                        fontSize: `${settings.fontSize}px`,
                        fontFamily: getFontFamilyStyle(settings.fontFamily),
                        fontWeight: settings.fontWeight,
                        lineHeight: settings.lineHeight,
                        color: 'var(--text-color)',
                        margin: 0,
                        textAlign: 'left',
                        padding: '10px 8px',
                        transition: 'all 0.3s ease'
                      }}>
                        {splitBodyIntoParagraphs(selectedPrayer.body, `detail-sent-${selectedPrayer.id}`).map((para, paraIdx) => (
                          <p 
                            key={paraIdx} 
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
                                  display: 'inline',
                                  backgroundColor: speakingVerseId === sent.id ? 'rgba(234, 179, 8, 0.25)' : 'transparent'
                                }}
                              >
                                {sent.text}{' '}
                              </span>
                            ))}
                            {para.sentences.length === 0 && para.line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            )
          ) : (
            /* ══ 2. 기본 추천 기도 모드 ══ */
            <>
              {/* 🌟 시간대별 추천 기도 (추천 모드일 땐 다른 불필요 UI는 다 치우고 오직 본문들만 연결해서 노출) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 4px 40px' }}>
                {recommendedPrayers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    {recommendedPrayers.map((prayer, index) => (
                      <div 
                        key={`rec-${prayer.id}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          paddingBottom: '24px',
                          borderBottom: index < recommendedPrayers.length - 1 ? '1px solid rgba(44,44,44,0.08)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ 
                            fontSize: '1.2rem', 
                            fontWeight: 'bold', 
                            color: '#A64B2A',
                            textAlign: 'center',
                            backgroundColor: speakingVerseId === `rec-title-${prayer.id}` ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            transition: 'background-color 0.3s ease'
                          }}>{prayer.title}</span>
                        </div>
                        <div style={{ 
                          fontSize: `${settings.fontSize}px`,
                          fontFamily: getFontFamilyStyle(settings.fontFamily),
                          fontWeight: settings.fontWeight,
                          lineHeight: settings.lineHeight,
                          color: 'var(--text-color)', 
                          margin: 0, 
                          opacity: 0.95,
                          textAlign: 'left',
                          padding: '4px 3rem',
                          transition: 'all 0.3s ease'
                        }}>
                          {splitBodyIntoParagraphs(prayer.body, `rec-sent-${prayer.id}`).map((para, paraIdx) => (
                            <p 
                              key={paraIdx} 
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
                                    display: 'inline',
                                    backgroundColor: speakingVerseId === sent.id ? 'rgba(234, 179, 8, 0.25)' : 'transparent'
                                  }}
                                >
                                  {sent.text}{' '}
                                </span>
                              ))}
                              {para.sentences.length === 0 && para.line}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', opacity: 0.8, fontSize: '0.95rem' }}>
                    설정된 추천 기도가 없습니다.<br/>아래 버튼을 눌러 기도문을 추가해 보세요.
                  </div>
                )}

                {/* ⚙️ 하단 기도 추천관리 버튼 (항상 보임) */}
                <button
                  onClick={() => {
                    setRecSearchQuery('');
                    if (['아침', '낮', '저녁/밤'].includes(timeZoneName)) {
                      setRecManageTab(timeZoneName);
                    }
                    setIsRecManageModalOpen(true);
                  }}
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '24px',
                    backgroundColor: 'var(--secondary-bg)',
                    border: '1.5px solid rgba(44,44,44,0.08)',
                    color: 'var(--text-color)',
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  기도 추천관리
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* 🌟 나의 기도 쓰기/수정 모달 */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }} onClick={() => setIsCreateModalOpen(false)}>
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
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#A64B2A', margin: 0 }}>
                {editingPrayer ? '나의 기도 수정하기' : '나의 기도 쓰기'}
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ border: 'none', background: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSaveCustomPrayer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>기도 제목</label>
                <input 
                  type="text"
                  placeholder="예: 가족을 위한 기도"
                  value={newPrayerTitle}
                  onChange={e => setNewPrayerTitle(e.target.value)}
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
                  placeholder="주님, 저희 가족에게 늘 사랑과 평화를 주시고..."
                  rows="6"
                  value={newPrayerBody}
                  onChange={e => setNewPrayerBody(e.target.value)}
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

      {/* 🌟 추천 기도 통합 관리 모달 */}
      {isRecManageModalOpen && (
        <div 
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, 
            display: 'flex', justifyContent: 'center', alignItems: 'center', 
            padding: '20px', backdropFilter: 'blur(4px)' 
          }}
          onClick={() => setIsRecManageModalOpen(false)}
        >
          <div 
            style={{ 
              width: '100%', maxWidth: '500px', maxHeight: '80vh', 
              backgroundColor: 'var(--bg-color)', borderRadius: '24px', 
              padding: '24px', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', 
              display: 'flex', flexDirection: 'column', gap: '16px', 
              overflow: 'hidden' 
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#A64B2A', margin: 0 }}>추천 기도 관리</h3>
              <button onClick={() => setIsRecManageModalOpen(false)} style={{ border: 'none', background: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            {/* 시간대 전환 탭 */}
            <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--secondary-bg)', padding: '4px', borderRadius: '12px' }}>
              {['아침', '낮', '저녁/밤'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setRecManageTab(tab)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                    backgroundColor: recManageTab === tab ? 'var(--bg-color)' : 'transparent',
                    color: recManageTab === tab ? '#A64B2A' : 'var(--text-muted)',
                    fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer',
                    boxShadow: recManageTab === tab ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* 검색창 */}
            <div style={{ position: 'relative', width: '100%' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', color: 'var(--text-muted)', opacity: 0.6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
              <input 
                type="text" 
                placeholder="검색하여 추천 기도 추가..."
                value={recSearchQuery}
                onChange={e => setRecSearchQuery(e.target.value)}
                style={{
                  width: '100%', height: '40px', paddingLeft: '36px', paddingRight: '36px',
                  borderRadius: '10px', backgroundColor: 'var(--secondary-bg)', color: 'var(--text-color)',
                  border: '1.5px solid rgba(44,44,44,0.1)', outline: 'none', fontSize: '0.9rem'
                }}
              />
              {recSearchQuery && (
                <button 
                  onClick={() => setRecSearchQuery('')}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', opacity: 0.8 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* 기도문 선택 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="no-scrollbar">
              {(() => {
                const activeIds = customRecMap[recManageTab] || [];
                const activePrayers = activeIds.map(id => allPrayersList.find(p => p.id === id)).filter(Boolean);
                const inactivePrayers = allPrayersList.filter(p => !activeIds.includes(p.id));
                
                const filteredActive = activePrayers.filter(p => 
                  p.title.toLowerCase().includes(recSearchQuery.toLowerCase()) ||
                  p.body.toLowerCase().includes(recSearchQuery.toLowerCase())
                );
                
                const filteredInactive = inactivePrayers.filter(p => 
                  p.title.toLowerCase().includes(recSearchQuery.toLowerCase()) ||
                  p.body.toLowerCase().includes(recSearchQuery.toLowerCase())
                );

                return (
                  <>
                    {filteredActive.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {filteredActive.map((p, index) => (
                          <div 
                            key={p.id} 
                            style={{ 
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                              padding: '8px 4px', 
                              backgroundColor: 'rgba(166, 75, 42, 0.05)',
                              borderBottom: '1.5px solid rgba(44,44,44,0.04)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, paddingRight: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <button 
                                  onClick={() => handleMoveOrder(p.id, 'up')}
                                  disabled={index === 0}
                                  style={{ padding: '0px', background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.2 : 0.6 }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                                </button>
                                <button 
                                  onClick={() => handleMoveOrder(p.id, 'down')}
                                  disabled={index === filteredActive.length - 1}
                                  style={{ padding: '0px', background: 'none', border: 'none', cursor: index === filteredActive.length - 1 ? 'default' : 'pointer', opacity: index === filteredActive.length - 1 ? 0.2 : 0.6 }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </button>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.body.replace(/\n/g, ' ')}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleRecPrayer(recManageTab, p.id)}
                              style={{
                                padding: '6px 14px', borderRadius: '8px', border: 'none',
                                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                                color: '#dc3545',
                                fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer',
                                transition: 'all 0.15s',
                                flexShrink: 0
                              }}
                            >
                              제거
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {filteredInactive.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {filteredInactive.map(p => (
                          <div 
                            key={p.id} 
                            style={{ 
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                              padding: '8px 8px', borderBottom: '1.5px solid rgba(44,44,44,0.04)' 
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0, paddingLeft: '24px', paddingRight: '8px' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.body.replace(/\n/g, ' ')}
                              </span>
                            </div>
                            <button
                              onClick={() => handleToggleRecPrayer(recManageTab, p.id)}
                              style={{
                                padding: '6px 14px', borderRadius: '8px', border: 'none',
                                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                                color: '#0d6efd',
                                fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer',
                                transition: 'all 0.15s',
                                flexShrink: 0
                              }}
                            >
                              추가
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            
            <button 
              onClick={() => setIsRecManageModalOpen(false)}
              style={{ 
                width: '100%', padding: '14px', borderRadius: '16px', border: 'none', 
                backgroundColor: '#A64B2A', color: 'white', fontSize: '1rem', fontWeight: '800', 
                cursor: 'pointer', marginTop: '4px' 
              }}
            >
              완료
            </button>
          </div>
        </div>
      )}

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

function PrayerListItem({ prayer, onClick }) {
  const isCustom = prayer.isCustom || prayer.categoryId === 99;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '18px 8px',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: '1.5px solid rgba(44,44,44,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'opacity 0.15s'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '90%' }}>
        <h4 style={{
          fontSize: '1.12rem',
          fontWeight: 'bold',
          color: 'var(--text-color)',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{prayer.title}</span>
          {isCustom && (
            <span style={{ fontSize: '0.7rem', color: '#A64B2A', backgroundColor: 'rgba(166,75,42,0.08)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
              나의 기도
            </span>
          )}
        </h4>
        <p style={{
          fontSize: '0.92rem',
          color: '#767676',
          opacity: 0.9,
          margin: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {prayer.body.substring(0, 80).replace(/\n/g, ' ')}...
        </p>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, color: 'var(--text-muted)' }}><path d="m9 18 6-6-6-6"/></svg>
    </button>
  );
}
