import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata } from '../lib/bibleInfo';

export default function Search({ toggleDarkMode, isDark }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef(null);

  // Filters
  const [filters, setFilters] = useState({
    ot: true,
    nt: true,
    subheading: true,
    verse: true
  });

  const toggleFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setHasSearched(true);
    setResults([]);

    // 1. Check for specific verse reference
    const refMatch = trimmedQuery.match(/^([1-4]?\s*[가-힣]+)(?:\s*(\d+)(?:[:,\s]+(\d+))?)?$/);
    if (refMatch) {
      const rawPrefix = refMatch[1].replace(/\s+/g, '');
      const chapterStr = refMatch[2];
      const verseStr = refMatch[3];

      let targetBookId = null;
      for (const [key, data] of Object.entries(bibleMetadata)) {
        if (key === rawPrefix || data.abbrev === rawPrefix || data.protestantAbbrev === rawPrefix) {
          targetBookId = key;
          break;
        }
      }

      if (targetBookId) {
        if (chapterStr) {
          const hash = verseStr ? `#v-${targetBookId}-${chapterStr}-${verseStr}` : '';
          navigate(`/read/${targetBookId}/${chapterStr}${hash}`);
          return;
        } else {
          navigate(`/book/${targetBookId}`);
          return;
        }
      }
    }

    // 2. Full-text search
    try {
      const bibleData = await localforage.getItem('bibleData_v2');
      if (!bibleData) {
        setIsSearching(false);
        return;
      }

      const keywords = trimmedQuery.split(/\s+/).filter(k => k.length > 0);
      const foundResults = [];
      const bookIds = Object.keys(bibleMetadata);

      for (const [bookId, bookData] of Object.entries(bibleData)) {
        const bookIndex = bookIds.indexOf(bookId);
        const isOT = bookIndex < 46;

        if (isOT && !filters.ot) continue;
        if (!isOT && !filters.nt) continue;

        for (const [chapterNum, chapterData] of Object.entries(bookData.chapters)) {
          // Search Subheadings
          if (filters.subheading && chapterData.subheadings) {
            chapterData.subheadings.forEach(sub => {
              const isMatch = keywords.every(keyword => sub.title.includes(keyword));
              if (isMatch) {
                foundResults.push({
                  type: 'subheading',
                  bookId,
                  bookName: bibleMetadata[bookId]?.full || bookId,
                  chapter: chapterNum,
                  verse: sub.verseId,
                  text: sub.title.replace(/\(([^)]+)\)/g, '').trim() // Clean links
                });
              }
            });
          }

          // Search Verses
          if (filters.verse && chapterData.v) {
            chapterData.v.forEach(verse => {
              const isMatch = keywords.every(keyword => verse.text.includes(keyword));
              if (isMatch) {
                foundResults.push({
                  type: 'verse',
                  bookId,
                  bookName: bibleMetadata[bookId]?.full || bookId,
                  chapter: chapterNum,
                  verse: verse.v,
                  text: `${verse.v} ${verse.text}` // Prepend verse number for display
                });
              }
            });
          }
        }
      }

      setResults(foundResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const highlightText = (text, keywords) => {
    if (!keywords || keywords.length === 0) return text;
    const regex = new RegExp(`(${keywords.join('|')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      keywords.some(k => k.toLowerCase() === part.toLowerCase()) ? 
        <strong key={i} style={{ color: 'var(--primary-color)', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '0 2px', borderRadius: '4px' }}>{part}</strong> : 
        part
    );
  };

  const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);

  const FilterButton = ({ active, label, onClick }) => (
    <button 
      onClick={onClick}
      style={{
        padding: '6px 16px',
        borderRadius: '20px',
        border: 'none',
        backgroundColor: active ? '#ff4d85' : 'var(--secondary-bg)',
        color: active ? '#fff' : 'var(--text-color)',
        fontSize: '0.9rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: active ? '0 2px 8px rgba(255, 77, 133, 0.4)' : 'none',
        transition: 'all 0.2s'
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="search-wrapper" style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="home-header" style={{ borderBottom: '1px solid var(--border-color)', height: '60px', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="m15 18-6-6 6-6"/></svg>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>성경 검색</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="header-btn" onClick={() => navigate('/')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
          <button className="header-btn" onClick={toggleDarkMode}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        <div style={{ textAlign: 'center', color: '#888', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span>💡</span> 띄어쓰기로 여러 단어를 입력하면 모두 포함된 결과를 찾습니다.
        </div>

        <form onSubmit={handleSearch} style={{ marginBottom: '20px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input 
              ref={inputRef}
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색어 입력"
              style={{
                width: '100%',
                padding: '16px 48px',
                borderRadius: '30px',
                border: '1.5px solid var(--border-color)',
                backgroundColor: 'var(--secondary-bg)',
                color: 'var(--text-color)',
                fontSize: '1.1rem',
                outline: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
              }}
            />
            {query && (
              <button 
                type="button" 
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            )}
          </div>
        </form>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '32px' }}>
          <FilterButton active={filters.ot} label="구약" onClick={() => toggleFilter('ot')} />
          <FilterButton active={filters.nt} label="신약" onClick={() => toggleFilter('nt')} />
          <FilterButton active={filters.subheading} label="소제목" onClick={() => toggleFilter('subheading')} />
          <FilterButton active={filters.verse} label="본문" onClick={() => toggleFilter('verse')} />
        </div>

        {isSearching ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
            성경을 검색하고 있습니다...
          </div>
        ) : (
          hasSearched && (
            <>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#665e55', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                검색 결과 ({results.length}건)
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {results.map((res, index) => (
                  <div 
                    key={index} 
                    onClick={() => navigate(`/read/${res.bookId}/${res.chapter}#v-${res.bookId}-${res.chapter}-${res.verse}`)}
                    style={{
                      backgroundColor: 'var(--secondary-bg)',
                      padding: '16px',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      boxShadow: 'var(--card-shadow)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <span style={{ 
                        backgroundColor: res.type === 'subheading' ? 'rgba(255, 77, 133, 0.1)' : 'rgba(100, 100, 100, 0.1)',
                        color: res.type === 'subheading' ? '#ff4d85' : '#666',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {res.type === 'subheading' ? '소제목' : '본문'}
                      </span>
                      <span style={{ 
                        color: res.type === 'subheading' ? '#ff4d85' : '#665e55', 
                        fontWeight: 'bold',
                        fontSize: '1.05rem'
                      }}>
                        {res.bookName} {res.chapter}장
                      </span>
                    </div>
                    <div style={{ lineHeight: '1.6', fontSize: '1rem', color: 'var(--text-color)' }}>
                      {highlightText(res.text, keywords)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}
