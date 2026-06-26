import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata, BIBLE_DB_KEY } from '../lib/bibleInfo';
import SettingsSheet from '../components/SettingsSheet';
import { useBible } from '../context/BibleContext';
import { useSettings } from '../context/SettingsContext';

const FilterButton = ({ active, label, onClick }) => (
  <button 
    onClick={onClick}
    style={{
      padding: '8px 16px',
      borderRadius: '18px',
      border: 'none',
      backgroundColor: active ? 'var(--primary-color)' : 'var(--secondary-bg)',
      color: active ? '#fff' : 'var(--text-color)',
      fontSize: '0.8rem',
      fontWeight: 'bold',
      cursor: 'pointer',
      boxShadow: active ? '0 3px 8px rgba(255, 77, 133, 0.2)' : 'none',
      transition: 'all 0.2s',
      flexShrink: 0
    }}
  >
    {label}
  </button>
);

export default function Search() {
  const navigate = useNavigate();
  const { setIsContinueMode } = useBible();
  const { settings } = useSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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
  const [visibleCount, setVisibleCount] = useState(() => {
    return parseInt(sessionStorage.getItem('search_visibleCount') || '100');
  });
  const [totalCount, setTotalCount] = useState(() => {
    return parseInt(sessionStorage.getItem('search_totalCount') || '0');
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
    sessionStorage.setItem('search_visibleCount', visibleCount.toString());
    sessionStorage.setItem('search_totalCount', totalCount.toString());
  }, [query, results, directMatch, hasSearched, filters, visibleCount, totalCount]);

  // Keep input focus on mount only if there was no active query, to avoid visual jump
  useEffect(() => {
    if (inputRef.current && !query) {
      inputRef.current.focus();
    }
  }, []);

  // Track the latest active search query to cancel outdated asynchronous search runs
  const activeSearchQueryRef = useRef('');

  const performSearch = useCallback(async (searchQuery) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setHasSearched(true);
    setVisibleCount(100); // Reset progressive loading visible items limit back to 100 when starting a fresh search!
    
    try {
      const bibleData = await localforage.getItem(BIBLE_DB_KEY);
      // If the user started typing again while we were loading the 7MB JSON, abort immediately!
      if (activeSearchQueryRef.current !== trimmedQuery) {
        return; 
      }
      if (!bibleData) return;

      const keywords = trimmedQuery.split(/\s+/).filter(k => k.length > 0);
      const bookIds = Object.keys(bibleMetadata);
      
      // Determine if any keyword represents a book name or abbreviation filter (e.g., '마태', '로마')
      let targetBookName = null;
      let searchKeywords = [...keywords];

      if (keywords.length >= 2) {
        for (let i = 0; i < keywords.length; i++) {
          const kw = keywords[i].replace(/\s+/g, '');
          let foundBookName = null;
          for (const [key, data] of Object.entries(bibleMetadata)) {
            if (
              key === kw || 
              data.abbrev === kw || 
              data.protestantAbbrev === kw ||
              data.full === kw ||
              data.full.replace(/\s+/g, '') === kw
            ) {
              foundBookName = key;
              break;
            }
          }

          if (foundBookName) {
            targetBookName = foundBookName;
            searchKeywords.splice(i, 1);
            break; // Stop at first matched book name keyword
          }
        }
      }

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
            const targetBook = bibleData.books.find(b => b.name === key || b.name === data.abbrev);
            
            const resolvedChapter = chapterNum || 1; // Default to chapter 1 if not specified
            
            const isEn = settings.bibleLanguage === 'en';
            const bookLabel = targetBook ? (isEn ? targetBook.enName : data.full) : data.full;
            
            if (targetBook) {
              const targetChapter = targetBook.chapters.find(c => c.c === resolvedChapter);
              if (targetChapter) {
                if (verseNum) {
                  // Normalize both to pure digit-only strings for absolute comparison safety
                  const targetVerse = targetChapter.v.find(v => {
                    const vClean = v.v.toString().replace(/\D/g, '');
                    const refClean = verseNum.toString().replace(/\D/g, '');
                    return vClean === refClean;
                  });
                  previewText = targetVerse ? targetVerse.text : '';
                } else {
                  if (chapterNum) {
                    previewText = targetChapter.v[0]?.text.substring(0, 40) + '...';
                  } else {
                    // Book name only search
                    previewText = isEn ? `Go to ${bookLabel} Chapter 1` : `${data.full} 1장으로 바로가기`;
                  }
                }
              }
            }

            matchSuggestion = {
              type: 'direct',
              bookId: targetBook ? targetBook.id : key,
              bookName: bookLabel,
              chapter: resolvedChapter,
              verse: verseNum,
              previewText: previewText,
              label: isEn
                ? (chapterNum ? (verseNum ? `${bookLabel} ${chapterNum}:${verseNum}` : `${bookLabel} Chapter ${chapterNum}`) : `${bookLabel} Chapter 1`)
                : (chapterNum ? (verseNum ? `${bookLabel} ${chapterNum}장 ${verseNum}절` : `${bookLabel} ${chapterNum}장`) : `${bookLabel} 1장`)
            };
            break;
          }
        }
      }

      // 2. Full-text Search with Priority
      for (const bookData of bibleData.books) {
        // Yield to the event loop to keep the UI completely responsive and allow new keystroke processing!
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // If the user started typing again while yielding, abort immediately!
        if (activeSearchQueryRef.current !== trimmedQuery) {
          return; 
        }

        // If we are filtering by book name (e.g. "마태 사랑"), skip other books entirely!
        if (targetBookName && bookData.name !== targetBookName) {
          continue;
        }

        const isOT = bookData.testament === '구약';

        if (isOT && !filters.ot) continue;
        if (!isOT && !filters.nt) continue;

        const meta = bibleMetadata[bookData.name] || { full: bookData.name };
        const isPsalm = bookData.name === '시편';

        // Check if book name itself matches query (Priority 1) -> Create the red book navigation card!
        // Only suggest book card if we are NOT in narrowed search mode
        const isEn = settings.bibleLanguage === 'en';
        if (!targetBookName && keywords.some(k => bookData.name.includes(k) || meta.abbrev?.includes(k) || meta.protestantAbbrev?.includes(k))) {
          const fullBookName = isEn ? bookData.enName : (meta.full || bookData.name);
          foundResults.push({
            priority: 1,
            type: 'book',
            bookId: bookData.id,
            bookName: fullBookName,
            testament: bookData.testament,
            text: isEn ? `Go to ${fullBookName}` : `${fullBookName} 목록으로 이동`
          });
        }

        for (const chapter of bookData.chapters) {
          // Search Subheadings (Priority 2)
          if (filters.subheading && chapter.subheadings) {
            chapter.subheadings.forEach(sub => {
              const cleanTitle = sub.title.replace(/\(([^)]+)\)/g, '').replace(/[;\s]+$/, '').trim();
              if (searchKeywords.every(keyword => cleanTitle.includes(keyword))) {
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
              if (searchKeywords.every(keyword => verse.text.includes(keyword))) {
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

      const total = foundResults.length;
      const slicedResults = foundResults.slice(0, 300); // 300 items strict memory/session quota guard!

      if (activeSearchQueryRef.current === trimmedQuery) {
        setDirectMatch(matchSuggestion);
        setResults(slicedResults);
        setTotalCount(total);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      if (activeSearchQueryRef.current === trimmedQuery) {
        setIsSearching(false);
      }
    }
  }, [filters, settings.bibleLanguage]);

  // Debounced search logic

  useEffect(() => {
    const trimmed = query.trim();
    activeSearchQueryRef.current = trimmed;

    const timer = setTimeout(() => {
      if (trimmed.length >= 1) {
        performSearch(trimmed);
      } else {
        setResults([]);
        setDirectMatch(null);
        setHasSearched(false);
        setIsSearching(false); // Cleanly stop the loading indicator when search query is cleared!
        setTotalCount(0); // Cleanly reset the total results count!
      }
    }, 600); // 600ms debounce gives comfortable typing buffer for Korean input

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const highlightText = (text, keywords) => {
    if (!keywords || keywords.length === 0) return text;
    const regex = new RegExp(`(${keywords.join('|')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      keywords.some(k => k.toLowerCase() === part.toLowerCase()) ? 
        <strong key={i} style={{ color: 'var(--primary-color)', backgroundColor: 'var(--highlight)', padding: '0 4px', borderRadius: '4px', fontWeight: 'bold' }}>{part}</strong> : 
        part
    );
  };

  const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);

  // Extract book name filter from query keywords for highlighting, to avoid highlighting book filter terms
  const getSearchHighlightKeywords = () => {
    if (keywords.length >= 2) {
      for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i].replace(/\s+/g, '');
        let matchesBook = false;
        for (const [key, data] of Object.entries(bibleMetadata)) {
          if (
            key === kw || 
            data.abbrev === kw || 
            data.protestantAbbrev === kw ||
            data.full === kw ||
            data.full.replace(/\s+/g, '') === kw
          ) {
            matchesBook = true;
            break;
          }
        }
        if (matchesBook) {
          const resultKeywords = [...keywords];
          resultKeywords.splice(i, 1);
          return resultKeywords;
        }
      }
    }
    return keywords;
  };

  const highlightKeywords = getSearchHighlightKeywords();

  return (
    <div className="search-wrapper" style={{ backgroundColor: 'var(--bg-color)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, overflowY: 'auto', padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 120px' }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-color)', margin: 0 }}>성경 검색</h1>
        </div>

        <form onSubmit={(e) => e.preventDefault()} style={{ marginBottom: '20px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input 
              ref={inputRef}
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="(예: 믿음 희망 사랑, 마태 5 1, 마태5;1, 마태5,1)"
              className="search-input-field"
              style={{
                width: '100%',
                padding: '12px 16px 12px 44px',
                paddingRight: query ? '42px' : '16px',
                borderRadius: '24px',
                border: '2px solid var(--border-color)',
                backgroundColor: 'var(--secondary-bg)',
                color: 'var(--text-color)',
                fontSize: '0.98rem',
                outline: 'none',
                boxShadow: '0 6px 18px rgba(0,0,0,0.04)',
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
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0, 0, 0, 0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </form>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <FilterButton active={filters.ot} label="구약" onClick={() => toggleFilter('ot')} />
          <FilterButton active={filters.nt} label="신약" onClick={() => toggleFilter('nt')} />
          <FilterButton active={filters.subheading} label="소제목" onClick={() => toggleFilter('subheading')} />
          <FilterButton active={filters.verse} label="본문" onClick={() => toggleFilter('verse')} />
        </div>

        {isSearching ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
            <div className="spinner" style={{ margin: '0 auto 20px', width: '40px', height: '40px', border: '3px solid rgba(255, 77, 133, 0.1)', borderTopColor: 'var(--primary-color)' }}></div>
            성경의 보물들을 찾는 중...
          </div>
        ) : (
          <>
            {/* Direct Match Section */}
            {directMatch && (
              <div 
                onClick={() => {
                  setIsContinueMode(false);
                  const hash = directMatch.verse ? `#v-${directMatch.bookId}-${directMatch.chapter}-${directMatch.verse}` : '';
                  navigate(`/read/${directMatch.bookId}/${directMatch.chapter || 1}${hash}`);
                }}
                style={{
                  background: 'linear-gradient(135deg, #9C5A38, #C08A4E)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(139, 92, 246, 0.2)',
                  transition: 'all 0.2s'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '3px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateY(-1px)' }}>
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    <span>{directMatch.label}</span>
                  </div>
                  {directMatch.previewText && (
                    <div style={{ 
                      fontSize: '0.96rem', 
                      opacity: 0.95, 
                      fontStyle: 'italic',
                      lineHeight: '1.45',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '40px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-color)', paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  <span>
                    {settings.bibleLanguage === 'en' ? `Search Results (Total ${totalCount.toLocaleString()})` : `검색 결과 (총 ${totalCount.toLocaleString()}건)`}
                  </span>
                </div>
                
                {results.slice(0, visibleCount).map((res, index) => {
                  const isEn = settings.bibleLanguage === 'en';
                  if (res.type === 'book') {
                    // Premium Red Book Card (성경 권별 이동 카드)
                    return (
                      <div 
                        key={index} 
                        onClick={() => {
                          setIsContinueMode(false);
                          navigate(`/book/${res.bookId}`);
                        }}
                        style={{
                          backgroundColor: 'var(--primary-color)',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(225, 29, 72, 0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: 'bold'
                            }}>
                              {isEn ? 'Book' : '성경'}
                            </span>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                              {res.bookName}
                            </span>
                          </div>
                          <span style={{ 
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold'
                          }}>
                            {isEn ? (res.testament === '구약' ? 'OT' : 'NT') : res.testament}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.85rem', opacity: 0.9, fontWeight: '500' }}>
                          {isEn ? `Go to ${res.bookName}` : `${res.bookName} 목록으로 이동`}
                        </div>
                      </div>
                    );
                  }

                  const isSub = res.type === 'subheading';
                  const meta = bibleMetadata[res.bookName] || { full: res.bookName };
                  const bookDisplayName = isEn 
                    ? (meta.enName || res.bookName) 
                    : (meta.full || res.bookName);
                  
                  return (
                    <div 
                      key={index} 
                      onClick={() => {
                        setIsContinueMode(false);
                        const hash = isSub 
                          ? `#sub-${res.bookId}-${res.chapter}-${res.verse}` 
                          : `#v-${res.bookId}-${res.chapter}-${res.verse}`;
                        navigate(`/read/${res.bookId}/${res.chapter}${hash}`);
                      }}
                      style={{
                        backgroundColor: 'var(--secondary-bg)',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          backgroundColor: isSub ? 'rgba(255, 77, 133, 0.1)' : '#f1f5f9',
                          color: isSub ? 'var(--primary-color)' : '#64748b',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold'
                        }}>
                          {isEn ? (isSub ? 'Subheading' : 'Verse') : (isSub ? '소제목' : '본문')}
                        </span>
                        <span style={{ 
                          fontWeight: 'bold', 
                          fontSize: '0.98rem', 
                          color: isSub ? 'var(--primary-color)' : 'var(--text-color)' 
                        }}>
                          {isEn
                            ? `${bookDisplayName} ${res.chapter}${res.verse ? `:${res.verse}` : ''}`
                            : `${bookDisplayName} ${res.chapter}${res.isPsalm ? '편' : '장'} ${res.verse ? `${res.verse}절` : ''}`
                          }
                        </span>
                      </div>
                      
                      <div style={{ 
                        lineHeight: '1.6', 
                        fontSize: '0.98rem', 
                        color: 'var(--text-color)', 
                        opacity: 0.95 
                      }}>
                        {!isSub && res.verse && <span style={{ marginRight: '6px', fontSize: '0.9rem', opacity: 0.6, fontWeight: 'bold' }}>{res.verse}</span>}
                        {highlightText(res.text, highlightKeywords)}
                      </div>
                    </div>
                  );
                })}

                {results.length > visibleCount && (
                  <button 
                    onClick={() => setVisibleCount(prev => prev + 100)}
                    className="load-more-btn"
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '16px',
                      border: '1.5px solid var(--border-color)',
                      backgroundColor: 'var(--secondary-bg)',
                      color: 'var(--text-color)',
                      fontWeight: 'bold',
                      fontSize: '0.98rem',
                      cursor: 'pointer',
                      marginTop: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      outline: 'none'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                    <span>검색 결과 {results.length - visibleCount}개 더 보기 ({visibleCount} / {results.length} 노출)</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
      
      <SettingsSheet 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}
