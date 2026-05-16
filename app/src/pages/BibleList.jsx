import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata } from '../lib/bibleInfo';
import SettingsSheet from '../components/SettingsSheet';

export default function BibleList() {
  const { testament } = useParams(); // '구약' or '신약'
  const [books, setBooks] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
        <div className="header-back-group" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>성경 목록</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="header-btn" onClick={() => navigate('/')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
          <button className="header-btn" onClick={() => navigate('/search')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
          <button className="header-btn" onClick={() => setIsSettingsOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.72V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.72V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>
      
      <div className="list-container">
        <div className="bible-grid">
          {books.map((book, index) => {
            const meta = bibleMetadata[book.name] || { full: book.name, abbrev: book.name, protestantAbbrev: '' };
            const numChapters = book.chapters ? book.chapters.length : 0;
            const bookIndex = index + 1;

            return (
              <div 
                key={book.id} 
                className="bible-card"
                onClick={() => navigate(`/book/${book.id}`)}
              >
                <div className="bible-card-header">
                  <span className="card-title-group">
                    <span className="card-index">{bookIndex}. </span>
                    <span className={`card-name ${meta.full.length >= 10 ? 'tight-text' : ''}`}>{meta.full}</span>
                  </span>
                </div>
                <div className="bible-card-bottom">
                  <span className="bible-card-chapters">총 {numChapters}장</span>
                  <div className="bible-card-tags">
                    <span className="tag-catholic">{meta.abbrev}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
