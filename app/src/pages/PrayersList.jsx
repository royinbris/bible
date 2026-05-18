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

  useEffect(() => {
    fetchPrayers();
  }, []);

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

        // Category: # 1. 예비신자 암송 주요 기도
        if (trimmed.startsWith('# ') && !trimmed.startsWith('### ')) {
          if (currentPrayer) {
            currentPrayer.body = bodyLines.join('\n').trim();
            parsedPrayers.push(currentPrayer);
            currentPrayer = null;
            bodyLines = [];
          }

          const fullTitle = trimmed.replace(/^#\s+/, '').trim();
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

      setCategories(parsedCats);
      
      const prayersMap = {};
      parsedPrayers.forEach(p => {
        if (!prayersMap[p.categoryId]) {
          prayersMap[p.categoryId] = [];
        }
        prayersMap[p.categoryId].push(p);
      });
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

  const handlePrayerClick = (prayerId) => {
    // Save visited status
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
              
              {/* Cloud download decorative checkmark */}
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--secondary-bg)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(44,44,44,0.06)', color: 'var(--text-muted)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>
              </div>
            </div>
          )}

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
                      visited={visitedPrayerIds.includes(prayer.id)} 
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
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {displayPrayers.map((prayer) => (
                    <PrayerListItem 
                      key={prayer.id} 
                      prayer={prayer} 
                      visited={visitedPrayerIds.includes(prayer.id)} 
                      onClick={() => handlePrayerClick(prayer.id)} 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

function PrayerListItem({ prayer, visited, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '16px 8px',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '90%' }}>
        <h4 style={{
          fontSize: '0.98rem',
          fontWeight: visited ? 'normal' : 'bold',
          color: visited ? 'var(--text-muted)' : 'var(--text-color)',
          margin: 0,
          transition: 'colors 0.2s'
        }}>
          {prayer.title}
        </h4>
        <p style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          opacity: 0.7,
          margin: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {prayer.body.substring(0, 80).replace(/\n/g, ' ')}...
        </p>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, color: 'var(--text-muted)' }}><path d="m9 18 6-6-6-6"/></svg>
    </button>
  );
}
