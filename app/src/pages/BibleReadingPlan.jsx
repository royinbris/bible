import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata, BIBLE_DB_KEY } from '../lib/bibleInfo';
import { useSettings } from '../context/SettingsContext';

export default function BibleReadingPlan() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Settings Form State
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [chaptersPerDay, setChaptersPerDay] = useState(2);
  const [dbBooks, setDbBooks] = useState([]);

  useEffect(() => {
    // 1. Load Bible DB for metadata
    localforage.getItem(BIBLE_DB_KEY).then(data => {
      if (data && data.books) {
        setDbBooks(data.books);
      }
    });

    // 2. Load Reading Plan
    const savedPlan = localStorage.getItem('bible_reading_plan');
    if (savedPlan) {
      setPlan(JSON.parse(savedPlan));
    }
    setIsLoading(false);
  }, []);

  const handleToggleBook = (bookId) => {
    setSelectedBooks(prev => 
      prev.includes(bookId) ? prev.filter(id => id !== bookId) : [...prev, bookId]
    );
  };

  const handleCreatePlan = () => {
    if (selectedBooks.length === 0) {
      alert("성경을 최소 1권 이상 선택해주세요.");
      return;
    }
    
    // Sort selected books to match biblical order
    const sortedSelected = [...selectedBooks].sort((a, b) => a - b);
    
    // Build schedule
    const newSchedule = [];
    let currentDay = 1;
    let currentDayItemCount = 0;
    
    for (const bookId of sortedSelected) {
      const bookData = dbBooks.find(b => b.id === bookId);
      if (!bookData) continue;
      
      const chapters = bookData.chapters;
      let chapIndex = 0;
      
      while (chapIndex < chapters.length) {
        // If the current chapter is the ONLY one left for this book, and it's not the start of a day
        // Requirement: "마지막 장이 1장으로 끝나면 그날 분량은 그것으로 끝"
        // Meaning: We put this 1 chapter in the current day, and then finish the day immediately.
        
        let chaptersToTake = chaptersPerDay - currentDayItemCount;
        if (chaptersToTake <= 0) {
          currentDay++;
          currentDayItemCount = 0;
          chaptersToTake = chaptersPerDay;
        }

        // Calculate remaining chapters in the book
        const remainingInBook = chapters.length - chapIndex;
        
        let took = 0;
        let forceFinishDay = false;

        // If exactly 1 chapter remaining and we have room in current day, take it and finish day
        if (remainingInBook === 1 && currentDayItemCount > 0) {
          took = 1;
          forceFinishDay = true;
        } else {
          took = Math.min(chaptersToTake, remainingInBook);
          // If taking 'took' chapters finishes the book and we just took 1 chapter, finish day? 
          // The rule is "마지막 장이 1장으로 끝나면 그날 분량은 그것으로 끝". 
          // This implies if a book has 28 chapters, and we do 3 per day:
          // ... Day 9: ch25, 26, 27. Day 10: ch28 (1 left). 
          // So Day 10 takes 1 chapter, and then the day finishes (no next book in Day 10).
          if (remainingInBook - took === 0 && took === 1) {
             forceFinishDay = true;
          }
        }

        // Add to schedule
        let dayObj = newSchedule.find(s => s.day === currentDay);
        if (!dayObj) {
          dayObj = { day: currentDay, items: [] };
          newSchedule.push(dayObj);
        }

        for (let i = 0; i < took; i++) {
          const chNum = chapters[chapIndex + i].c;
          dayObj.items.push({
            bookId: bookId,
            bookName: bookData.name,
            chapter: chNum,
            isCompleted: false,
            pickedVerse: null
          });
        }

        chapIndex += took;
        currentDayItemCount += took;

        if (forceFinishDay || chapIndex >= chapters.length) {
          // If the book ended, we forcefully jump to next day for the next book, 
          // OR if we hit the condition to end the day.
          currentDay++;
          currentDayItemCount = 0;
        }
      }
    }

    // Save
    const planObj = {
      isActive: true,
      settings: {
        books: sortedSelected,
        chaptersPerDay,
        daysPerWeek: 5
      },
      schedule: newSchedule
    };

    localStorage.setItem('bible_reading_plan', JSON.stringify(planObj));
    setPlan(planObj);
  };

  const handleResetPlan = () => {
    if (confirm("정말 통독 스케줄을 초기화하시겠습니까? 기록이 모두 삭제됩니다.")) {
      localStorage.removeItem('bible_reading_plan');
      setPlan(null);
      setSelectedBooks([]);
    }
  };

  if (isLoading || dbBooks.length === 0) {
    return <div className="loading-screen"><div className="spinner"></div></div>;
  }

  // --- RENDERING PLAN SETTINGS ---
  if (!plan) {
    return (
      <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', padding: '24px' }}>
        <header style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>한권읽기 설정</span>
          </button>
        </header>
        
        <div style={{ backgroundColor: 'var(--secondary-bg)', padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--text-color)' }}>하루 읽을 분량</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input 
              type="number" 
              value={chaptersPerDay} 
              onChange={(e) => setChaptersPerDay(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '80px', padding: '12px', borderRadius: '12px', border: '1px solid rgba(44,44,44,0.1)', fontSize: '1.1rem', textAlign: 'center', backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
            />
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>장 (주 5일 기준)</span>
          </div>
        </div>

        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-color)', marginBottom: '16px' }}>통독할 성경 선택 (다중 선택)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '160px' }}>
          {dbBooks.map(b => (
            <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: 'var(--secondary-bg)', borderRadius: '12px', cursor: 'pointer', border: selectedBooks.includes(b.id) ? '2px solid var(--primary-color)' : '2px solid transparent' }}>
              <input 
                type="checkbox" 
                checked={selectedBooks.includes(b.id)} 
                onChange={() => handleToggleBook(b.id)} 
                style={{ transform: 'scale(1.2)' }}
              />
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
                {bibleMetadata[b.name]?.full || b.name}
              </span>
            </label>
          ))}
        </div>

        <div style={{ 
          position: 'fixed', 
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', 
          left: 0, 
          right: 0, 
          padding: '16px', 
          backgroundColor: 'var(--bg-color)', 
          borderTop: '1px solid rgba(44,44,44,0.05)', 
          display: 'flex', 
          justifyContent: 'center',
          zIndex: 1000,
          boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)'
        }}>
          <button 
            onClick={handleCreatePlan}
            style={{ width: '100%', maxWidth: '600px', padding: '16px', borderRadius: '16px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', fontSize: '1.1rem', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 12px rgba(166, 75, 42, 0.3)' }}
          >
            통독 스케줄 시작하기
          </button>
        </div>
      </div>
    );
  }

  // --- RENDERING DASHBOARD ---
  // Calculate Progress
  const totalItems = plan.schedule.reduce((acc, d) => acc + d.items.length, 0);
  const completedItems = plan.schedule.reduce((acc, d) => acc + d.items.filter(i => i.isCompleted).length, 0);
  const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', padding: '24px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>한권읽기</span>
        </button>
        <button onClick={handleResetPlan} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}>
          초기화
        </button>
      </header>

      <div style={{ padding: '24px', backgroundColor: 'var(--secondary-bg)', borderRadius: '20px', marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', color: 'var(--text-color)' }}>나의 통독 여정</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>진행률</span>
          <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{progressPercent}%</span>
        </div>
        <div style={{ height: '8px', backgroundColor: 'rgba(44,44,44,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: 'var(--primary-color)', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {plan.schedule.map(dayInfo => {
          const isDayCompleted = dayInfo.items.every(i => i.isCompleted);
          return (
            <div key={dayInfo.day} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: isDayCompleted ? '#10b981' : 'var(--text-color)' }}>Day {dayInfo.day}</h3>
                {isDayCompleted && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {dayInfo.items.map((item, idx) => (
                  <div key={idx} style={{ backgroundColor: 'var(--secondary-bg)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', opacity: item.isCompleted ? 0.7 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
                        {item.bookName} {item.chapter}장
                      </span>
                      <button 
                        onClick={() => navigate(`/read/${item.bookId}/${item.chapter}?plan=true&day=${dayInfo.day}`)}
                        style={{ padding: '8px 16px', borderRadius: '12px', border: 'none', backgroundColor: item.isCompleted ? 'rgba(44,44,44,0.1)' : 'var(--primary-color)', color: item.isCompleted ? 'var(--text-muted)' : 'white', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {item.isCompleted ? '다시 읽기' : '읽기'}
                      </button>
                    </div>
                    {item.pickedVerse && (
                      <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '12px', borderLeft: '3px solid #10b981' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#10b981', fontWeight: 'bold', marginBottom: '4px' }}>✨ 마음에 닿은 구절</p>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-color)', lineHeight: '1.4' }}>{item.pickedVerse}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
