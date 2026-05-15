import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata } from '../lib/bibleInfo';

export default function ChapterList({ toggleDarkMode, isDark }) {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);

  useEffect(() => {
    localforage.getItem('bibleData_v2').then(data => {
      if (data && data.books) {
        const foundBook = data.books.find(b => b.id === parseInt(bookId));
        setBook(foundBook);
      }
    });
  }, [bookId]);

  if (!book) return <div className="loading-screen"><div className="spinner"></div></div>;

  const meta = bibleMetadata[book.name] || { full: book.name };

  return (
    <>
      <header className="header" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <button className="header-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 style={{ flex: 1, textAlign: 'left', marginLeft: '10px', fontSize: '1.2rem', fontWeight: 'bold' }}>{meta.full}</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="header-btn" onClick={() => navigate('/')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
          <button className="header-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
          <button className="header-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.72V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>
      
      <div className="list-container" style={{ padding: '20px 10px' }}>
        <div className="chapter-list-layout">
          {book.chapters.map(chap => {
            const hasSubheadings = chap.subheadings && chap.subheadings.length > 0;
            return (
              <div key={chap.c} className="chapter-row">
                {/* 왼쪽: 장 번호 */}
                <div 
                  className="chapter-num-box"
                  onClick={() => navigate(`/read/${book.id}/${chap.c}`)}
                >
                  {chap.c}장
                </div>
                
                {/* 오른쪽: 소제목 그리드 또는 비어있는 공간 */}
                <div className="subheadings-grid">
                  {hasSubheadings ? (
                    chap.subheadings.map((sub, idx) => (
                      <div 
                        key={idx} 
                        className="subheading-badge"
                        onClick={() => navigate(`/read/${book.id}/${chap.c}#v${sub.verseId}`)}
                      >
                        {sub.title.split('(')[0].trim()}
                      </div>
                    ))
                  ) : (
                    // 소제목이 없는 경우 본문 읽기로 유도하는 버튼
                    <div 
                      className="subheading-badge" 
                      style={{ opacity: 0.6, borderColor: 'transparent' }}
                      onClick={() => navigate(`/read/${book.id}/${chap.c}`)}
                    >
                      {chap.c}장 읽기
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
