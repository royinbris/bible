import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsSheet from '../components/SettingsSheet';

export default function PrayersList() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [prayers, setPrayers] = useState({});
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [showIntro, setShowIntro] = useState(false);
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
  const [customRecMap, setCustomRecMap] = useState({ '아침': [], '낮': [], '저녁/밤': [] });
  const [recSearchQuery, setRecSearchQuery] = useState('');

  useEffect(() => {
    fetchPrayers();
  }, []);

  // 🌟 [추가] 모달이 열릴 때 로컬스토리지 추천 설정을 불러와 동기화
  useEffect(() => {
    try {
      const saved = localStorage.getItem('custom_recommended_prayers');
      if (saved) {
        setCustomRecMap(JSON.parse(saved));
      } else {
        setCustomRecMap({ '아침': [], '낮': [], '저녁/밤': [] });
      }
    } catch {
      setCustomRecMap({ '아침': [], '낮': [], '저녁/밤': [] });
    }
  }, [isRecManageModalOpen]);

  // 🌟 [추가] 나의 기도 목록이 바뀔 때 prayers 맵의 99번 카테고리 실시간 업데이트
  useEffect(() => {
    setPrayers(prev => ({
      ...prev,
      99: customPrayers
    }));
  }, [customPrayers]);

  // 🌟 [추가] 감성 인트로 하루 1회 체크
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const yyyymmdd = `${year}${month}${date}`;
    const savedDate = localStorage.getItem('prayers_intro_date');
    if (savedDate !== yyyymmdd) {
      setShowIntro(true);
    }
  }, []);

  // 🌟 [추가] 시간대별 추천 기도 세팅
  useEffect(() => {
    if (isLoading || categories.length === 0) return;
    
    const allPrayersList = Object.values(prayers).flat();
    const hour = new Date().getHours();
    let tz = '하루';
    let keywords = [];
    
    if (hour >= 5 && hour < 11) {
      tz = '아침';
      keywords = ['아침', '삼종', '시작', '주님의 기도', '성모송'];
    } else if (hour >= 11 && hour < 17) {
      tz = '낮';
      keywords = ['식사', '삼종', '삼종기도', '낮', '영광송'];
    } else {
      tz = '저녁/밤';
      keywords = ['저녁', '성찰', '마치는', '하루를 마치는', '삼종', '성모송', '영광송'];
    }
    
    setTimeZoneName(tz);
    
    // 🌟 [추가] 커스텀 추천 기도 반영 (customRecMap과 실시간 연동)
    const customIds = customRecMap[tz] || [];
    
    const customPrayersList = allPrayersList.filter(p => customIds.includes(p.id));
    const keywordPrayersList = allPrayersList.filter(p => 
      !customIds.includes(p.id) && keywords.some(k => p.title.toLowerCase().includes(k))
    ).slice(0, Math.max(0, 4 - customPrayersList.length));
    
    setRecommendedPrayers([...customPrayersList, ...keywordPrayersList]);
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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const yyyymmdd = `${year}${month}${date}`;
    localStorage.setItem('prayers_intro_date', yyyymmdd);
    setShowIntro(false);
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
            zIndex: 9999,
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

      {/* Premium Header */}
      <header className="home-header">
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }} onClick={() => selectedCategoryId !== null ? setSelectedCategoryId(null) : navigate('/')}>
          <button className="header-back-btn" style={{ pointerEvents: 'none' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>가톨릭 기도문</span>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button className="header-btn" onClick={() => navigate('/')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
          <button className="header-btn" onClick={() => setIsSettingsOpen(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Title & Stats */}
          {selectedCategoryId === null && !searchQuery && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#A64B2A', margin: 0 }}>가톨릭 기도문</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontWeight: '500' }}>
                  가톨릭 기도문 모음입니다. (총 {allPrayersList.length}개)
                </p>
              </div>
              
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--secondary-bg)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(44,44,44,0.06)', color: 'var(--text-muted)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>
              </div>
            </div>
          )}

          {/* 명언 인용구 */}
          <div style={{ padding: '20px', borderRadius: '16px', backgroundColor: 'var(--ot-bg)', border: '1px solid rgba(166, 75, 42, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ot-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--ot-accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>기도는</span>
            </div>
            <blockquote style={{ margin: 0, padding: 0, fontSize: '1.25rem', fontWeight: '500', color: 'var(--text-color)', lineHeight: '1.5', fontFamily: 'Gowun Batang, Georgia, serif' }}>
              "떼쓰기 보다는 대화다"
            </blockquote>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', display: 'flex', color: 'var(--text-muted)', opacity: 0.6 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
            <input 
              type="text"
              placeholder="기도문 제목이나 내용 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '56px',
                paddingLeft: '52px',
                paddingRight: '48px',
                borderRadius: '28px',
                backgroundColor: 'var(--secondary-bg)',
                color: 'var(--text-color)',
                border: '2.5px solid rgba(44,44,44,0.1)',
                outline: 'none',
                fontSize: '1rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            )}
          </div>

          {/* 🌟 시간대별 추천 기도 (메인 화면이며 검색어가 없을 때만 노출) */}
          {selectedCategoryId === null && !searchQuery && recommendedPrayers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 4px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#A64B2A' }}>✨ {timeZoneName}</span>에 바치는 추천 기도
                </h3>
                <button
                  onClick={() => {
                    setRecSearchQuery('');
                    if (['아침', '낮', '저녁/밤'].includes(timeZoneName)) {
                      setRecManageTab(timeZoneName);
                    }
                    setIsRecManageModalOpen(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #777)',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--secondary-bg)',
                    border: '1.5px solid rgba(44,44,44,0.06)'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  추천 관리
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="no-scrollbar">
                {recommendedPrayers.map(prayer => (
                  <div 
                    key={`rec-${prayer.id}`}
                    onClick={() => handlePrayerClick(prayer.id)}
                    style={{
                      minWidth: '160px',
                      maxWidth: '180px',
                      backgroundColor: 'var(--secondary-bg)',
                      border: '1.5px solid rgba(44,44,44,0.06)',
                      borderRadius: '16px',
                      padding: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                      transition: 'transform 0.15s'
                    }}
                  >
                    <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: 'var(--text-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prayer.title}</span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #777)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                      {prayer.body.replace(/\n/g, ' ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Lists */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* 🔍 Search Results Mode */}
            {searchQuery ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', margin: '0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  검색 결과 ({searchResults.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {searchResults.map((prayer) => (
                    <PrayerListItem 
                      key={prayer.id} 
                      prayer={prayer} 
                      onClick={() => handlePrayerClick(prayer.id)} 
                    />
                  ))}
                  {searchResults.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', opacity: 0.6, fontSize: '0.95rem' }}>
                      검색 결과가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            ) : selectedCategoryId === null ? (
              
              /* 📂 Categories Main Menu Mode */
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* 0. 전체 기도문 보기 */}
                <button
                  onClick={() => setSelectedCategoryId(-1)}
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
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#A64B2A', opacity: 0.4, width: '24px' }}>0.</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-color)' }}>전체 기도문 보기</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#A64B2A', opacity: 0.4 }}>{allPrayersList.length}</span>
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, color: '#A64B2A' }}><path d="m9 18 6-6-6-6"/></svg>
                </button>

                {/* Categories Map */}
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
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
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#A64B2A', opacity: 0.4, width: '24px' }}>{cat.number}.</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-color)' }}>{cat.title}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#A64B2A', opacity: 0.4 }}>{prayers[cat.id]?.length || 0}</span>
                      </div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, color: '#A64B2A' }}><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                ))}
              </div>
            ) : (
              
              /* 📜 Specific Category Prayers List Mode */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px' }}>
                  <button 
                    onClick={() => setSelectedCategoryId(null)}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: '8px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      color: 'var(--text-color)',
                      backgroundColor: 'var(--secondary-bg)'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#A64B2A', margin: 0 }}>
                    {selectedCategoryId === -1 ? '전체 기도문' : selectedCategory?.title}
                    <span style={{ marginLeft: '8px', fontSize: '0.9rem', fontWeight: 'bold', opacity: 0.4 }}>({displayPrayers.length})</span>
                  </h3>
                </div>

                {/* 🌟 나의 기도 쓰기 버튼 (나의 기도함 카테고리일 때 노출) */}
                {selectedCategoryId === 99 && (
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
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {displayPrayers.map((prayer) => (
                    <PrayerListItem 
                      key={prayer.id} 
                      prayer={prayer} 
                      onClick={() => handlePrayerClick(prayer.id)} 
                    />
                  ))}
                  {selectedCategoryId === 99 && displayPrayers.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', opacity: 0.6, fontSize: '0.92rem' }}>
                      저장된 나의 기도가 없습니다.<br />첫 번째 기도를 작성해 보세요!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
                  width: '100%', height: '40px', paddingLeft: '36px', paddingRight: '12px',
                  borderRadius: '10px', backgroundColor: 'var(--secondary-bg)', color: 'var(--text-color)',
                  border: '1.5px solid rgba(44,44,44,0.1)', outline: 'none', fontSize: '0.9rem'
                }}
              />
            </div>

            {/* 기도문 선택 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="no-scrollbar">
              {allPrayersList.filter(p => 
                p.title.toLowerCase().includes(recSearchQuery.toLowerCase()) ||
                p.body.toLowerCase().includes(recSearchQuery.toLowerCase())
              ).map(p => {
                const activeIds = customRecMap[recManageTab] || [];
                const isAdded = activeIds.includes(p.id);
                return (
                  <div 
                    key={p.id} 
                    style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                      padding: '12px 4px', borderBottom: '1.5px solid rgba(44,44,44,0.04)' 
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '75%' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-color)' }}>{p.title}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.body.replace(/\n/g, ' ')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleRecPrayer(recManageTab, p.id)}
                      style={{
                        padding: '6px 14px', borderRadius: '8px', border: 'none',
                        backgroundColor: isAdded ? 'rgba(44,44,44,0.1)' : 'rgba(166, 75, 42, 0.08)',
                        color: isAdded ? 'var(--text-muted)' : '#A64B2A',
                        fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {isAdded ? '제거' : '추가'}
                    </button>
                  </div>
                );
              })}
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
