import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata } from '../lib/bibleInfo';

export default function BibleList({ toggleDarkMode, isDark }) {
  const { testament } = useParams(); // '구약' or '신약'
  const [books, setBooks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    localforage.getItem('bibleData_v2').then(data => {
      if (data && data.books) {
        setBooks(data.books.filter(b => b.testament === testament));
      }
    });
  }, [testament]);

  return (
    <>
      <header className="header" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <button className="header-btn" onClick={() => navigate('/')}>
          <span style={{ fontSize: '1rem', color: '#888' }}>&lt;</span>
        </button>
        <h1 style={{ flex: 1, textAlign: 'left', marginLeft: '10px', fontSize: '1.2rem', fontWeight: 'bold' }}>성경 목록</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="header-btn">🏠</button>
          <button className="header-btn">🔍</button>
          <button className="header-btn">⚙️</button>
        </div>
      </header>
      
      <div className="list-container">
        <div className="bible-grid">
          {books.map((book, index) => {
            const meta = bibleMetadata[book.name] || { full: book.name, abbrev: book.name, protestantAbbrev: '' };
            const numChapters = book.chapters ? book.chapters.length : 0;
            const bookIndex = testament === '신약' ? index + 1 : index + 1; // You can adjust index logic if needed

            return (
              <div 
                key={book.id} 
                className="bible-card"
                onClick={() => navigate(`/book/${book.id}`)}
              >
                <h3 className="bible-card-title">{bookIndex}. {meta.full}</h3>
                <div className="bible-card-bottom">
                  <span className="bible-card-chapters">총 {numChapters}장</span>
                  <div className="bible-card-tags">
                    <span className="tag-catholic">{meta.abbrev}</span>
                    {meta.protestantAbbrev && <span className="tag-protestant">{meta.protestantAbbrev}</span>}
                    <span className="tag-delete">🗑️</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
