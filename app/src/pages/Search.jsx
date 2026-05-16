import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata } from '../lib/bibleInfo';

export default function Search({ toggleDarkMode, isDark }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [directMatch, setDirectMatch] = useState(null);
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

  // Debounced search logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 1) {
        performSearch(query);
      } else {
        setResults([]);
        setDirectMatch(null);
        setHasSearched(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, filters]);

  const performSearch = async (searchQuery) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const bibleData = await localforage.getItem('bibleData_v2');
      if (!bibleData) return;

      const keywords = trimmedQuery.split(/\s+/).filter(k => k.length > 0);
      const bookIds = Object.keys(bibleMetadata);
      
      let matchSuggestion = null;
      const foundResults = [];

      // 1. Direct Reference Parsing (e.g., 마태 5:1)
      const refMatch = trimmedQuery.match(/^([1-4]?\s*[가-힣]+)(?:\s*(\d+)(?:[:,\s]+(\d+))?)?$/);
      if (refMatch) {
        const rawPrefix = refMatch[1].replace(/\s+/g, '');
        const chapterNum = refMatch[2] ? parseInt(refMatch[2]) : null;
        const verseNum = refMatch[3] ? parseInt(refMatch[3]) : null;

        for (const [key, data] of Object.entries(bibleMetadata)) {
          if (key === rawPrefix || data.abbrev === rawPrefix || data.protestantAbbrev === rawPrefix) {
            let previewText = '';
            const targetBook = bibleData.books.find(b => b.id === parseInt(key));
            
            if (targetBook && chapterNum) {
              const targetChapter = targetBook.chapters.find(c => c.c === chapterNum);
              if (targetChapter) {
                if (verseNum) {
                  const targetVerse = targetChapter.v.find(v => v.v === verseNum);
                  previewText = targetVerse ? targetVerse.text : '';
                } else {
                  // If no verse, show first few words of the chapter
                  previewText = targetChapter.v[0]?.text.substring(0, 40) + '...';
                }
              }
            }

            matchSuggestion = {
              type: 'direct',
              bookId: key,
              bookName: data.full,
              chapter: chapterNum,
              verse: verseNum,
              previewText: previewText,
              label: chapterNum ? (verseNum ? `${data.full} ${chapterNum}장 ${verseNum}절` : `${data.full} ${chapterNum}장`) : `${data.full} 전체`
            };
            break;
          }
        }
      }

      // 2. Full-text Search with Priority
      for (const [bookId, bookData] of Object.entries(bibleData.books)) {
        const bookIndex = bookIds.indexOf(bookId.toString());
        const isOT = bookData.testament === '구약';

        if (isOT && !filters.ot) continue;
        if (!isOT && !filters.nt) continue;

        const meta = bibleMetadata[bookData.name] || { full: bookData.name };
        const isPsalm = bookData.name === '시편';

        // Check if book name itself matches query (Priority 1)
        if (keywords.some(k => bookData.name.includes(k) || meta.abbrev?.includes(k))) {
          // Handled by direct match or could be added here
        }

        for (const chapter of bookData.chapters) {
          // Search Subheadings (Priority 2)
          if (filters.subheading && chapter.subheadings) {
            chapter.subheadings.forEach(sub => {
              const cleanTitle = sub.title.replace(/\(([^)]+)\)/g, '').trim();
              if (keywords.every(keyword => cleanTitle.includes(keyword))) {
                foundResults.push({
                  priority: 2,
                  type: 'subheading',
                  bookId: bookData.id,
                  bookName: bookData.name,
                  isPsalm,
                  chapter: chapter.c,
                  verse: sub.verseId,
                  text: cleanTitle
                });
              }
            });
          }

          // Search Verses (Priority 3)
          if (filters.verse && chapter.v) {
            chapter.v.forEach(verse => {
              if (keywords.every(keyword => verse.text.includes(keyword))) {
                foundResults.push({
                  priority: 3,
                  type: 'verse',
                  bookId: bookData.id,
                  bookName: bookData.name,
                  isPsalm,
                  chapter: chapter.c,
                  verse: verse.v,
                  text: verse.text
                });
              }
            });
          }
        }
      }

      // Sort by priority then biblical order
      foundResults.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.bookId !== b.bookId) return a.bookId - b.bookId;
        return a.chapter - b.chapter;
      });

      setDirectMatch(matchSuggestion);
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
        <strong key={i} style={{ color: '#ff4d85', backgroundColor: 'rgba(255, 77, 133, 0.1)', padding: '0 2px', borderRadius: '4px' }}>{part}</strong> : 
        part
    );
  };

  const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);

  const FilterButton = ({ active, label, onClick }) => (
    <button 
      onClick={onClick}
      style={{
        padding: '8px 18px',
        borderRadius: '20px',
        border: 'none',
        backgroundColor: active ? '#ff4d85' : 'var(--secondary-bg)',
        color: active ? '#fff' : 'var(--text-color)',
        fontSize: '0.9rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: active ? '0 4px 12px rgba(255, 77, 133, 0.3)' : 'none',
        transition: 'all 0.2s',
        flexShrink: 0
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="search-wrapper" style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="home-header" style={{ borderBottom: '1px solid var(--border-color)', height: '70px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '12px' }}><path d="m15 18-6-6 6-6"/></svg>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>성경 검색</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="header-btn" onClick={() => navigate('/')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        <form onSubmit={(e) => e.preventDefault()} style={{ marginBottom: '20px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4d85" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input 
              ref={inputRef}
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="말씀 검색 (예: 사랑, 마태 5:1)"
              style={{
                width: '100%',
                padding: '18px 48px',
                borderRadius: '32px',
                border: '2px solid var(--border-color)',
                backgroundColor: 'var(--secondary-bg)',
                color: 'var(--text-color)',
                fontSize: '1.15rem',
                outline: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
              }}
            />
          </div>
        </form>

        <div style={{ display: 'flex', overflowX: 'auto', gap: '10px', marginBottom: '24px', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          <FilterButton active={filters.ot} label="구약" onClick={() => toggleFilter('ot')} />
          <FilterButton active={filters.nt} label="신약" onClick={() => toggleFilter('nt')} />
          <FilterButton active={filters.subheading} label="소제목" onClick={() => toggleFilter('subheading')} />
          <FilterButton active={filters.verse} label="본문" onClick={() => toggleFilter('verse')} />
        </div>

        {isSearching ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
            <div className="spinner" style={{ margin: '0 auto 20px', width: '40px', height: '40px', border: '3px solid rgba(255, 77, 133, 0.1)', borderTopColor: '#ff4d85' }}></div>
            성경의 보물들을 찾는 중...
          </div>
        ) : (
          <>
            {/* Direct Match Section */}
            {directMatch && (
              <div 
                onClick={() => {
                  const hash = directMatch.verse ? `#v-${directMatch.bookId}-${directMatch.chapter}-${directMatch.verse}` : '';
                  navigate(`/read/${directMatch.bookId}/${directMatch.chapter || 1}${hash}`);
                }}
                style={{
                  backgroundColor: '#ff4d85',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '20px',
                  marginBottom: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 20px rgba(255, 77, 133, 0.3)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '4px' }}>말씀 바로가기</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{directMatch.label}</div>
                  {directMatch.previewText && (
                    <div style={{ 
                      fontSize: '1rem', 
                      marginTop: '10px', 
                      opacity: 0.95, 
                      fontStyle: 'italic',
                      lineHeight: '1.5',
                      borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                      paddingTop: '10px'
                    }}>
                      {directMatch.previewText}
                    </div>
                  )}
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
              </div>
            )}

            {hasSearched && results.length === 0 && !directMatch && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
                검색 결과가 없습니다.<br/>다른 키워드로 검색해 보세요.
              </div>
            )}

            {results.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '40px' }}>
                <div style={{ fontSize: '0.9rem', color: '#888', paddingLeft: '8px' }}>검색 결과 {results.length}건</div>
                {results.map((res, index) => (
                  <div 
                    key={index} 
                    onClick={() => navigate(`/read/${res.bookId}/${res.chapter}#v-${res.bookId}-${res.chapter}-${res.verse}`)}
                    style={{
                      backgroundColor: 'var(--secondary-bg)',
                      padding: '18px',
                      borderRadius: '20px',
                      border: '1.5px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          backgroundColor: res.type === 'subheading' ? 'rgba(255, 77, 133, 0.1)' : 'rgba(128, 128, 0, 0.1)',
                          color: res.type === 'subheading' ? '#ff4d85' : '#808000',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {res.type === 'subheading' ? '소제목' : '본문'}
                        </span>
                        <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-color)' }}>
                          {res.bookName} {res.chapter}{res.isPsalm ? '편' : '장'} {res.verse}절
                        </span>
                      </div>
                    </div>
                    <div style={{ lineHeight: '1.7', fontSize: '1.05rem', color: 'var(--text-color)', opacity: 0.9 }}>
                      {res.type === 'verse' && <span style={{ marginRight: '8px', fontSize: '0.9rem', opacity: 0.6, fontWeight: 'bold' }}>{res.verse}</span>}
                      {highlightText(res.text, keywords)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
