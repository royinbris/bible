import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata, BIBLE_DB_KEY } from '../lib/bibleInfo';
import SettingsSheet from '../components/SettingsSheet';
import { useBible } from '../context/BibleContext';
import { useSettings } from '../context/SettingsContext';

export default function ChapterList() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { setIsContinueMode } = useBible();
  const { settings } = useSettings();
  const [book, setBook] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    localforage.getItem(BIBLE_DB_KEY).then(data => {
      if (data && data.books) {
        const foundBook = data.books.find(b => b.id === parseInt(bookId, 10));
        if (foundBook) setBook(foundBook);
      }
    });
  }, [bookId]);

  if (!book) return <div className="loading-screen"><div className="spinner"></div></div>;

  const meta = bibleMetadata[book.name] || { full: book.name };

  return (
    <>
      <header className="header" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="header-back-group" onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="header-back-btn" style={{ pointerEvents: 'none' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>{meta.full}</h1>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
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
      
      <div className="list-container" style={{ padding: '0' }}>
        <div className="chapter-list-layout">
          {book.chapters.map(chap => {
            const hasSubheadings = chap.subheadings && chap.subheadings.length > 0;
            return (
              <div key={chap.c} className="chapter-row">
                <div 
                  className="chapter-num-box"
                  onClick={() => {
                    setIsContinueMode(false);
                    navigate(`/read/${book.id}/${chap.c}`);
                  }}
                >
                  {settings.bibleLanguage === 'en' ? chap.c : `${chap.c}${book.name === '시편' ? '편' : '장'}`}
                </div>
                <div className="subheadings-grid">
                  {(() => {
                    const filteredSubheadings = hasSubheadings 
                      ? chap.subheadings.filter(sub => settings.bibleLanguage === 'en' ? sub.enTitle : sub.title)
                      : [];

                    if (filteredSubheadings.length > 0) {
                      return filteredSubheadings.map((sub, idx) => {
                        const subheadingTitle = settings.bibleLanguage === 'en' 
                          ? (sub.enPartTitle ? `${sub.enPartTitle} - ${sub.enTitle}` : sub.enTitle)
                          : sub.title;
                        return (
                          <div 
                            key={idx} 
                            className="subheading-badge"
                            onClick={() => {
                              setIsContinueMode(false);
                              navigate(`/read/${book.id}/${chap.c}#sub-${book.id}-${chap.c}-${sub.verseId}`);
                            }}
                          >
                            {subheadingTitle.split('(')[0].replace(/[;\s]+$/, '').trim()}
                          </div>
                        );
                      });
                    } else {
                      return (
                        <div 
                          className="subheading-badge" 
                          style={{ opacity: 0.6, borderColor: 'transparent' }}
                          onClick={() => {
                            setIsContinueMode(false);
                            navigate(`/read/${book.id}/${chap.c}`);
                          }}
                        >
                          {settings.bibleLanguage === 'en' ? 'No Subheadings' : `${chap.c}${book.name === '시편' ? '편' : '장'} 읽기`}
                        </div>
                      );
                    }
                  })()}
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
