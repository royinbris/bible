import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata, BIBLE_DB_KEY } from '../lib/bibleInfo';
import SettingsSheet from '../components/SettingsSheet';
import { useBible } from '../context/BibleContext';
import { useSettings } from '../context/SettingsContext';

export default function BibleList() {
  const { testament } = useParams(); // '구약' or '신약'
  const [books, setBooks] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { isContinueMode, setContinueReadPos, setIsHistoryOpen } = useBible();
  const { settings } = useSettings();

  useEffect(() => {
    localforage.getItem(BIBLE_DB_KEY).then(data => {
      if (data && data.books) {
        setBooks(data.books.filter(b => b.testament === testament));
      }
    });
  }, [testament]);

  return (
    <>
      <div className="list-container" style={{ paddingTop: 'env(safe-area-inset-top, 44px)' }}>
        <div className={`testament-toggle-container theme-${testament === '구약' ? 'ot' : 'nt'}`}>
          <div className="testament-toggle-bg" style={{
            transform: testament === '신약' ? 'translateX(100%)' : 'translateX(0)'
          }} />
          <button 
            className={`testament-toggle-btn ${testament === '구약' ? 'active' : ''}`}
            onClick={() => navigate('/list/구약')}
          >
            구약성경
          </button>
          <button 
            className={`testament-toggle-btn ${testament === '신약' ? 'active' : ''}`}
            onClick={() => navigate('/list/신약')}
          >
            신약성경
          </button>
        </div>
        
        <div className="bible-grid">
          {books.map((book, index) => {
            const meta = bibleMetadata[book.name] || { full: book.name, abbrev: book.name, protestantAbbrev: '' };
            const numChapters = book.chapters ? book.chapters.length : 0;
            const bookIndex = index + 1;

            return (
              <div 
                key={book.id} 
                className="bible-card"
                onClick={() => {
                  if (isContinueMode) {
                    setContinueReadPos({
                      bookId: String(book.id),
                      bookName: book.name,
                      chapter: 1,
                      verseNum: 1,
                      subtitleId: '',
                      subtitleText: '1장 읽기',
                      timestamp: Date.now()
                    });
                    navigate(`/read/${book.id}/1`);
                  } else {
                    navigate(`/book/${book.id}`);
                  }
                }}
              >
                <div className="bible-card-header">
                  <span className="card-title-group">
                    <span className="card-index">{bookIndex}. </span>
                    <span className={`card-name ${(settings.bibleLanguage === 'en' ? book.enName : meta.full).length >= 10 ? 'tight-text' : ''}`}>
                      {settings.bibleLanguage === 'en' ? book.enName : meta.full}
                    </span>
                  </span>
                </div>
                <div className="bible-card-bottom">
                  <span className="bible-card-chapters">
                    {settings.bibleLanguage === 'en' ? `${numChapters} Chapters` : `총 ${numChapters}장`}
                  </span>
                  {settings.bibleLanguage !== 'en' && (
                    <div className="bible-card-tags" style={{ display: 'flex', gap: '6px' }}>
                      <span className="tag-catholic">{meta.abbrev}</span>
                      {meta.protestantAbbrev && (
                        <span className="tag-protestant">{meta.protestantAbbrev}</span>
                      )}
                    </div>
                  )}
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
