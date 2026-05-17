import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata } from '../lib/bibleInfo';

export default function Search({ toggleDarkMode, isDark }) {
  const navigate = useNavigate();
  
  // Initialize state from URL param 'q' or sessionStorage if available
  const [query, setQuery] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlQuery = urlParams.get('q');
    if (urlQuery) {
      sessionStorage.setItem('search_query', urlQuery); // Pre-warm session storage
      return urlQuery;
    }
    return sessionStorage.getItem('search_query') || '';
  });
  const [results, setResults] = useState(() => {
    // If URL search parameter exists, we will trigger search, so start empty or load from session if matched
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('q')) return [];
    
    const saved = sessionStorage.getItem('search_results');
    return saved ? JSON.parse(saved) : [];
  });
  const [directMatch, setDirectMatch] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('q')) return null;

    const saved = sessionStorage.getItem('search_directMatch');
    return saved ? JSON.parse(saved) : null;
  });
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('q')) return false;

    return sessionStorage.getItem('search_hasSearched') === 'true';
  });
  const inputRef = useRef(null);

  // Filters
  const [filters, setFilters] = useState(() => {
    const saved = sessionStorage.getItem('search_filters');
    return saved ? JSON.parse(saved) : {
      ot: true,
      nt: true,
      subheading: true,
      verse: true
    };
  });

  const toggleFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Sync state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('search_query', query);
    sessionStorage.setItem('search_results', JSON.stringify(results));
    sessionStorage.setItem('search_directMatch', JSON.stringify(directMatch));
    sessionStorage.setItem('search_hasSearched', hasSearched ? 'true' : 'false');
    sessionStorage.setItem('search_filters', JSON.stringify(filters));
  }, [query, results, directMatch, hasSearched, filters]);

  // Keep input focus on mount only if there was no active query, to avoid visual jump
  useEffect(() => {
    if (inputRef.current && !query) {
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

      // 1. Direct Reference Parsing (e.g., 마태 5:1, 마태)
      const refMatch = trimmedQuery.match(/^([1-4]?\s*[가-힣]+)(?:\s*(\d+)(?:[:,\s]+(\d+))?)?$/);
      if (refMatch) {
        const rawPrefix = refMatch[1].replace(/\s+/g, '');
        const chapterNum = refMatch[2] ? parseInt(refMatch[2]) : null;
        const verseNum = refMatch[3] ? parseInt(refMatch[3]) : null;

        for (const [key, data] of Object.entries(bibleMetadata)) {
          if (key === rawPrefix || data.abbrev === rawPrefix || data.protestantAbbrev === rawPrefix) {
            let previewText = '';
            const targetBook = bibleData.books.find(b => b.name === data.full);
            
            const resolvedChapter = chapterNum || 1; // Default to chapter 1 if not specified
            
            if (targetBook) {
              const targetChapter = targetBook.chapters.find(c => c.c === resolvedChapter);
              if (targetChapter) {
                if (verseNum) {
                  const targetVerse = targetChapter.v.find(v => v.v.toString() === verseNum.toString());
                  previewText = targetVerse ? targetVerse.text : '';
                } else {
                  if (chapterNum) {
                    previewText = targetChapter.v[0]?.text.substring(0, 40) + '...';
                  } else {
                    // Book name only search: "마태오 복음서 1장으로 바로가기"
                    previewText = `${data.full} 1장으로 바로가기`;
                  }
                }
              }
            }

            matchSuggestion = {
              type: 'direct',
              bookId: targetBook ? targetBook.id : key,
              bookName: data.full,
              chapter: resolvedChapter,
              verse: verseNum,
              previewText: previewText,
              label: chapterNum ? (verseNum ? `${data.full} ${chapterNum}장 ${verseNum}절` : `${data.full} ${chapterNum}장`) : `${data.full} 1장`
            };
            break;
          }
        }
      }

      // 2. Full-text Search with Priority
      for (const bookData of bibleData.books) {
        const bookIndex = bookIds.indexOf(bookData.id.toString());
        const isOT = bookData.testament === '구약';

        if (isOT && !filters.ot) continue;
        if (!isOT && !filters.nt) continue;

        const meta = bibleMetadata[bookData.name] || { full: bookData.name };
        const isPsalm = bookData.name === '시편';

        // Check if book name itself matches query (Priority 1) -> Create the red book navigation card!
        if (keywords.some(k => bookData.name.includes(k) || meta.abbrev?.includes(k) || meta.protestantAbbrev?.includes(k))) {
          foundResults.push({
            priority: 1,
            type: 'book',
            bookId: bookData.id,
            bookName: bookData.name,
            testament: bookData.testament,
            text: `${bookData.name} 목록으로 이동`
          });
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
                padding: '18px 48px 18px 48px',
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
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setDirectMatch(null);
                  setHasSearched(false);
                  sessionStorage.removeItem('search_query');
                  sessionStorage.removeItem('search_results');
                  sessionStorage.removeItem('search_directMatch');
                  sessionStorage.removeItem('search_hasSearched');
                  if (inputRef.current) inputRef.current.focus();
                }}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0, 0, 0, 0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-color)',
                  opacity: 0.6,
                  transition: 'opacity 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
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
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  color: 'white',
                  padding: '24px 20px',
                  borderRadius: '24px',
                  marginBottom: '24px',
                  cursor: 'pointer',
                  boxShadow: '0 10px 25px rgba(139, 92, 246, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '10px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateY(-1px)' }}>
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    <span>{directMatch.label}</span>
                  </div>
                  {directMatch.previewText && (
                    <div style={{ 
                      fontSize: '1.05rem', 
                      opacity: 0.95, 
                      fontStyle: 'italic',
                      lineHeight: '1.6',
                      fontWeight: 'normal'
                    }}>
                      {directMatch.previewText}
                    </div>
                  )}
                </div>
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
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-color)', paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  <span>검색 결과 ({results.length}건)</span>
                </div>
                
                {results.map((res, index) => {
                  if (res.type === 'book') {
                    // Premium Red Book Card (성경 권별 이동 카드)
                    return (
                      <div 
                        key={index} 
                        onClick={() => navigate(`/bible/${res.bookId}`)}
                        style={{
                          backgroundColor: '#e11d48',
                          color: 'white',
                          padding: '18px 20px',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          boxShadow: '0 6px 16px rgba(225, 29, 72, 0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}>
                              성경
                            </span>
                            <span style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                              {res.bookName}
                            </span>
                          </div>
                          <span style={{ 
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            padding: '3px 9px',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            {res.testament}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.9rem', opacity: 0.9, fontWeight: '500', marginTop: '4px' }}>
                          {res.bookName} 목록으로 이동
                        </div>
                      </div>
                    );
                  }

                  const isSub = res.type === 'subheading';
                  
                  return (
                    <div 
                      key={index} 
                      onClick={() => navigate(`/read/${res.bookId}/${res.chapter}#v-${res.bookId}-${res.chapter}-${res.verse}`)}
                      style={{
                        backgroundColor: 'var(--secondary-bg)',
                        padding: '18px 20px',
                        borderRadius: '20px',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.01)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ 
                          backgroundColor: isSub ? '#ffe4e6' : '#f1f5f9',
                          color: isSub ? '#e11d48' : '#64748b',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          {isSub ? '소제목' : '본문'}
                        </span>
                        <span style={{ 
                          fontWeight: 'bold', 
                          fontSize: '1.1rem', 
                          color: isSub ? '#e11d48' : 'var(--text-color)' 
                        }}>
                          {res.bookName} {res.chapter}{res.isPsalm ? '편' : '장'} {res.verse ? `${res.verse}절` : ''}
                        </span>
                      </div>
                      
                      <div style={{ 
                        lineHeight: '1.75', 
                        fontSize: '1.05rem', 
                        color: 'var(--text-color)', 
                        opacity: 0.95 
                      }}>
                        {!isSub && res.verse && <span style={{ marginRight: '8px', fontSize: '0.95rem', opacity: 0.6, fontWeight: 'bold' }}>{res.verse}</span>}
                        {highlightText(res.text, keywords)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
