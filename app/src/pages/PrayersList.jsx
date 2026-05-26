import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsSheet from '../components/SettingsSheet';
import { useBible } from '../context/BibleContext';

export default function PrayersList() {
  const navigate = useNavigate();
  const {
    showPrayerCategories,
    selectedPrayerCategoryId,
    selectedPrayerId,
    setSelectedPrayerId
  } = useBible();
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
  const [showIntro, setShowIntro] = useState(true);
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

      {/* Premium Header - 목록 모드일 때만 노출 */}
      {showPrayerCategories && (
        <header className="home-header">
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }} onClick={() => navigate('/')}>
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
      )}

      {/* Main Container */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {showPrayerCategories ? (
            /* ══ 1. 카테고리 목록 보기 모드 ══ */
            selectedPrayerId === null ? (
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
                      onClick={() => setSelectedPrayerId(prayer.id)}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* 상단 네비게이션 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => setSelectedPrayerId(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#A64B2A',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          padding: '6px 12px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(166, 75, 42, 0.08)'
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m15 18-6-6 6-6"/>
                        </svg>
                        목록으로 돌아가기
                      </button>
                    </div>

                    {/* 기도문 본문 카드 */}
                    <div
                      style={{
                        backgroundColor: 'var(--secondary-bg)',
                        border: '1px solid rgba(166, 75, 42, 0.08)',
                        borderRadius: '24px',
                        padding: '28px 24px',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                      }}
                    >
                      <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-color)', margin: 0, textAlign: 'center' }}>
                        {selectedPrayer.title}
                      </h3>
                      <div style={{ width: '36px', height: '2.5px', backgroundColor: '#A64B2A', margin: '0 auto' }}></div>
                      <p style={{
                        fontSize: '1.05rem',
                        color: 'var(--text-color)',
                        margin: 0,
                        lineHeight: '1.85',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'Gowun Batang, Georgia, serif',
                        textAlign: 'center',
                        padding: '10px 0 0 0'
                      }}>
                        {selectedPrayer.body}
                      </p>
                    </div>
                  </div>
                );
              })()
            )
          ) : (
            /* ══ 2. 기본 추천 기도 모드 ══ */
            <>
              {/* 🌟 시간대별 추천 기도 (추천 모드일 땐 다른 불필요 UI는 다 치우고 오직 본문들만 연결해서 노출) */}
              {recommendedPrayers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 4px 40px' }}>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#A64B2A' }}>{prayer.title}</span>
                        </div>
                        <p style={{ 
                          fontSize: '1.05rem', 
                          color: 'var(--text-color)', 
                          margin: 0, 
                          lineHeight: '1.8', 
                          whiteSpace: 'pre-wrap', 
                          fontFamily: 'Gowun Batang, Georgia, serif',
                          opacity: 0.95,
                          textAlign: 'justify'
                        }}>
                          {prayer.body}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* ⚙️ 하단 기도 추천관리 버튼 */}
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
              )}
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
