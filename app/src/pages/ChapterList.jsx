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
          <span style={{ fontSize: '1rem', color: '#888' }}>&lt;</span>
        </button>
        <h1 style={{ flex: 1, textAlign: 'left', marginLeft: '10px', fontSize: '1.2rem', fontWeight: 'bold' }}>{meta.full}</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="header-btn">🏠</button>
          <button className="header-btn">🔍</button>
          <button className="header-btn">⚙️</button>
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
