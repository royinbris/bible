import { useState, useEffect, Fragment } from 'react';
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
      <header className="reader-header-v2" style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 'env(safe-area-inset-top, 44px) 10px 0 10px',
        height: 'calc(34px + env(safe-area-inset-top, 44px))',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
        boxSizing: 'border-box',
      }}>
        <button onClick={() => navigate(parseInt(bookId) <= 46 ? '/list/구약' : '/list/신약')} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', marginRight: 'auto' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--border-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 style={{ position: 'absolute', left: '50%', top: 'calc(50% + env(safe-area-inset-top, 44px) / 2)', transform: 'translate(-50%, -50%)', fontSize: 'min(4.5vw, 1.12rem)', fontWeight: 'bold', color: 'var(--text-color)', margin: 0, whiteSpace: 'nowrap' }}>
          {settings.bibleLanguage === 'en' ? book.enName : meta.full}
        </h1>
        <div style={{ width: '32px', flexShrink: 0, marginLeft: 'auto' }} />
      </header>
      
      <div className="list-container" style={{ padding: '16px 0 120px' }}>
        <div className="chapter-list-layout">
          {(() => {
            let lastPartTitle = null;
            return book.chapters.map(chap => {
              const hasSubheadings = chap.subheadings && chap.subheadings.length > 0;
              
              // Find the first part title in this chapter
              let partTitleToShow = null;
              if (settings.bibleLanguage === 'en' && hasSubheadings) {
                const firstSubWithPart = chap.subheadings.find(s => s.enPartTitle);
                if (firstSubWithPart && firstSubWithPart.enPartTitle !== lastPartTitle) {
                  partTitleToShow = firstSubWithPart.enPartTitle;
                  lastPartTitle = firstSubWithPart.enPartTitle;
                }
              }

              return (
                <Fragment key={chap.c}>
                  {partTitleToShow && (
                    <div className="bible-part-header" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '24px 16px 12px',
                      width: '100%'
                    }}>
                      <div style={{ flex: 1, height: '1.5px', background: 'linear-gradient(90deg, transparent, var(--border-color))' }}></div>
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: '800',
                        color: 'var(--primary-color)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        padding: '4px 12px',
                        backgroundColor: 'var(--date-badge-bg)',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px var(--date-badge-bg)'
                      }}>
                        {partTitleToShow}
                      </span>
                      <div style={{ flex: 1, height: '1.5px', background: 'linear-gradient(90deg, var(--border-color), transparent)' }}></div>
                    </div>
                  )}
                  <div className="chapter-row">
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
                            const subheadingTitle = settings.bibleLanguage === 'en' ? sub.enTitle : sub.title;
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
                </Fragment>
              );
            });
          })()}
        </div>
      </div>
      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
