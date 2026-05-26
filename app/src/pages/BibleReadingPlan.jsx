import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import { bibleMetadata, BIBLE_DB_KEY } from '../lib/bibleInfo';
import { useSettings } from '../context/SettingsContext';

const BIBLE_CATEGORIES = {
  "구약 성경": [
    { title: "오경", books: ["창세", "탈출", "레위", "민수", "신명"] },
    { title: "역사서", books: ["여호", "판관", "룻", "1사무", "2사무", "1열왕", "2열왕", "1역대", "2역대", "에즈", "느헤", "토빗", "유딧", "에스", "1마카", "2마카"] },
    { title: "시서와 지혜서", books: ["욥", "시편", "잠언", "코헬", "아가", "지혜", "집회"] },
    { title: "예언서", books: ["이사", "예레", "애가", "바룩", "에제", "다니", "호세", "요엘", "아모스", "오바", "요나", "미카", "나훔", "하박", "스바", "학개", "스가", "말라"] }
  ],
  "신약 성경": [
    { title: "복음서", books: ["마태", "마르", "루카", "요한"] },
    { title: "사도행전", books: ["사도"] },
    { title: "서간", books: ["로마", "1코린", "2코린", "갈라", "에페", "필리", "콜로", "1테살", "2테살", "1티모", "2티모", "티토", "필레", "히브", "야고", "1베드", "2베드", "1요한", "2요한", "3요한", "유다"] },
    { title: "묵시록", books: ["묵시"] }
  ]
};

export default function BibleReadingPlan() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Settings Form State
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [chaptersPerDay, setChaptersPerDay] = useState(2);
  const [dbBooks, setDbBooks] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

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

  const handleCategoryToggle = (bookNames) => {
    const targetIds = dbBooks
      .filter(b => bookNames.includes(b.name))
      .map(b => b.id);
    
    setSelectedBooks(prev => {
      const isAllSelected = targetIds.every(id => prev.includes(id));
      if (isAllSelected) {
        // 이미 해당 카테고리가 다 채워져 있다면 전부 해제
        return prev.filter(id => !targetIds.includes(id));
      } else {
        // 덜 채워졌거나 안 채워졌다면 전부 채움
        const next = [...prev];
        targetIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      }
    });
  };

  const handleTestamentToggle = (testamentKey) => {
    const allBookNames = BIBLE_CATEGORIES[testamentKey].reduce((acc, cat) => [...acc, ...cat.books], []);
    const targetIds = dbBooks
      .filter(b => allBookNames.includes(b.name))
      .map(b => b.id);
    
    setSelectedBooks(prev => {
      const isAllSelected = targetIds.every(id => prev.includes(id));
      if (isAllSelected) {
        return prev.filter(id => !targetIds.includes(id));
      } else {
        const next = [...prev];
        targetIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      }
    });
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
        let chaptersToTake = chaptersPerDay - currentDayItemCount;
        if (chaptersToTake <= 0) {
          currentDay++;
          currentDayItemCount = 0;
          chaptersToTake = chaptersPerDay;
        }

        const remainingInBook = chapters.length - chapIndex;
        
        let took = 0;
        let forceFinishDay = false;

        if (remainingInBook === 1 && currentDayItemCount > 0) {
          took = 1;
          forceFinishDay = true;
        } else {
          took = Math.min(chaptersToTake, remainingInBook);
          if (remainingInBook - took === 0 && took === 1) {
             forceFinishDay = true;
          }
        }

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
          currentDay++;
          currentDayItemCount = 0;
        }
      }
    }

    const planObj = {
      isActive: true,
      settings: {
        books: sortedSelected,
        chaptersPerDay,
        daysPerWeek: 5,
        startDate
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

  // 실시간 날짜 계산 데이터 도출
  const totalSelectedChapters = dbBooks
    .filter(b => selectedBooks.includes(b.id))
    .reduce((sum, b) => sum + (b.chapters ? b.chapters.length : 0), 0);

  const estimatedTotalDays = Math.ceil(totalSelectedChapters / chaptersPerDay);

  const getEstimatedEndDateStr = (startStr, days) => {
    if (!startStr || days <= 0) return '-';
    const dateObj = new Date(startStr);
    dateObj.setDate(dateObj.getDate() + days - 1);
    
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const w = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
    
    return `${y}년 ${m}월 ${d}일 (${w})`;
  };

  const estimatedEndDate = getEstimatedEndDateStr(startDate, estimatedTotalDays);

  if (isLoading || dbBooks.length === 0) {
    return <div className="loading-screen"><div className="spinner"></div></div>;
  }

  // --- RENDERING PLAN SETTINGS ---
  if (!plan) {
    return (
      <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', padding: '24px', boxSizing: 'border-box' }}>
        <header style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>한권읽기 설정</span>
          </button>
        </header>
        
        {/* 📅 스케줄 및 날짜 계산 프리미엄 인포 카드 */}
        <div style={{ 
          backgroundColor: 'var(--secondary-bg)', 
          padding: '24px', 
          borderRadius: '20px', 
          marginBottom: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            {/* 시작일 설정 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>시작 날짜</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-color)', 
                  fontSize: '1rem', 
                  backgroundColor: 'var(--bg-color)', 
                  color: 'var(--text-color)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* 하루 읽을 분량 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>하루 읽을 분량</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input 
                  type="number" 
                  value={chaptersPerDay} 
                  onChange={(e) => setChaptersPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ 
                    width: '90px', 
                    padding: '12px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color)', 
                    fontSize: '1.1rem', 
                    textAlign: 'center', 
                    backgroundColor: 'var(--bg-color)', 
                    color: 'var(--text-color)',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '1rem', color: 'var(--text-color)', fontWeight: '500' }}>장씩 읽기</span>
              </div>
            </div>
          </div>

          {/* ⚡ 실시간 자동 날짜 지정 및 통독 예상 결과 정보 */}
          <div style={{ 
            marginTop: '20px', 
            paddingTop: '20px', 
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>선택된 성경 수:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-color)' }}>{selectedBooks.length} 권</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>총 분량:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-color)' }}>{totalSelectedChapters} 장</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>예상 소요 일수:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{estimatedTotalDays} 일</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '1rem', 
              marginTop: '4px',
              padding: '12px',
              backgroundColor: 'rgba(166, 75, 42, 0.05)',
              borderRadius: '10px'
            }}>
              <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>🏁 통독 완료 예정일:</span>
              <span style={{ fontWeight: '900', color: 'var(--primary-color)' }}>{estimatedEndDate}</span>
            </div>
          </div>
        </div>

        {/* 📚 성경 목록 (구약 / 신약 2단 반응형 그리드 구조) */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '24px', 
          marginBottom: '160px' 
        }}>
          {Object.keys(BIBLE_CATEGORIES).map((testamentKey) => {
            const categories = BIBLE_CATEGORIES[testamentKey];
            
            // 모든 책 ID 추출
            const allBookNames = categories.reduce((acc, cat) => [...acc, ...cat.books], []);
            const allBookIds = dbBooks.filter(b => allBookNames.includes(b.name)).map(b => b.id);
            const isTestamentAllSelected = allBookIds.length > 0 && allBookIds.every(id => selectedBooks.includes(id));

            return (
              <div 
                key={testamentKey} 
                style={{ 
                  backgroundColor: 'var(--secondary-bg)', 
                  padding: '20px', 
                  borderRadius: '20px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}
              >
                {/* 대분류 헤더 및 대량 선택 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-color)', paddingBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-color)', fontWeight: '800' }}>{testamentKey}</h3>
                  <button 
                    onClick={() => handleTestamentToggle(testamentKey)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: isTestamentAllSelected ? 'var(--text-muted)' : 'var(--primary-color)', 
                      fontSize: '0.85rem', 
                      fontWeight: 'bold', 
                      cursor: 'pointer' 
                    }}
                  >
                    {isTestamentAllSelected ? '선택 해제 ✕' : '전체 선택 ✓'}
                  </button>
                </div>

                {/* 소분류 카테고리 루프 */}
                {categories.map((cat) => {
                  const catBookIds = dbBooks.filter(b => cat.books.includes(b.name)).map(b => b.id);
                  const isCatAllSelected = catBookIds.length > 0 && catBookIds.every(id => selectedBooks.includes(id));

                  return (
                    <div key={cat.title} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.92rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{cat.title}</span>
                        <button 
                          onClick={() => handleCategoryToggle(cat.books)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: isCatAllSelected ? 'var(--text-muted)' : 'var(--text-color)', 
                            fontSize: '0.75rem', 
                            cursor: 'pointer',
                            opacity: 0.8
                          }}
                        >
                          {isCatAllSelected ? '해제' : '선택'}
                        </button>
                      </div>
                      
                      {/* 성경 개별 체크박스 리스트 */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))', 
                        gap: '6px' 
                      }}>
                        {cat.books.map((bookName) => {
                          const bookData = dbBooks.find(b => b.name === bookName);
                          if (!bookData) return null;
                          const isSelected = selectedBooks.includes(bookData.id);
                          return (
                            <div 
                              key={bookData.id}
                              onClick={() => handleToggleBook(bookData.id)}
                              style={{
                                padding: '8px 2px',
                                borderRadius: '10px',
                                backgroundColor: isSelected ? 'var(--primary-color)' : 'var(--bg-color)',
                                color: isSelected ? '#ffffff' : 'var(--text-color)',
                                border: isSelected ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                fontSize: '0.85rem',
                                fontWeight: isSelected ? 'bold' : 'normal',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                userSelect: 'none',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                              }}
                              title={`${bibleMetadata[bookName]?.full || bookName} (${bookData.chapters?.length}장)`}
                            >
                              {bookName}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* 하단 스케줄 생성 고정 바 */}
        <div style={{ 
          position: 'fixed', 
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', 
          left: 0, 
          right: 0, 
          padding: '16px', 
          backgroundColor: 'var(--bg-color)', 
          borderTop: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'center',
          zIndex: 1000,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.05)'
        }}>
          <button 
            onClick={handleCreatePlan}
            style={{ 
              width: '100%', 
              maxWidth: '600px', 
              padding: '16px', 
              borderRadius: '16px', 
              backgroundColor: 'var(--primary-color)', 
              color: 'white', 
              border: 'none', 
              fontSize: '1.1rem', 
              fontWeight: '900', 
              cursor: 'pointer', 
              boxShadow: '0 4px 12px rgba(166, 75, 42, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            🚀 통독 스케줄 생성 ({estimatedTotalDays}일 코스)
          </button>
        </div>
      </div>
    );
  }

  // --- RENDERING DASHBOARD ---
  const totalItems = plan.schedule.reduce((acc, d) => acc + d.items.length, 0);
  const completedItems = plan.schedule.reduce((acc, d) => acc + d.items.filter(i => i.isCompleted).length, 0);
  const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  // 예상 완료일 및 시작 정보
  const pSettings = plan.settings || {};
  const pStartDate = pSettings.startDate || '';
  const pEndDate = getEstimatedEndDateStr(pStartDate, plan.schedule.length);

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', padding: '24px', boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>한권읽기</span>
        </button>
        <button onClick={handleResetPlan} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer', padding: '4px 8px' }}>
          초기화
        </button>
      </header>

      {/* 📊 진행 상태 대시보드 카드 */}
      <div style={{ 
        padding: '24px', 
        backgroundColor: 'var(--secondary-bg)', 
        borderRadius: '20px', 
        marginBottom: '24px',
        border: '1px solid var(--border-color)'
      }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', color: 'var(--text-color)', fontWeight: '800' }}>나의 통독 여정</h2>
        
        {pStartDate && (
          <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            🗓️ 기간: {pStartDate.replace(/-/g, '.')} ~ {pEndDate ? pEndDate.replace(/년 |월 /g, '.').replace('일', '') : '-'} ({plan.schedule.length}일간)
          </p>
        )}

        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>진행률</span>
          <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{progressPercent}% ({completedItems}/{totalItems}장 완료)</span>
        </div>
        <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
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
                  <div key={idx} style={{ backgroundColor: 'var(--secondary-bg)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', opacity: item.isCompleted ? 0.7 : 1, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
                        {item.bookName} {item.chapter}장
                      </span>
                      <button 
                        onClick={() => navigate(`/read/${item.bookId}/${item.chapter}?plan=true&day=${dayInfo.day}`)}
                        style={{ padding: '8px 16px', borderRadius: '12px', border: 'none', backgroundColor: item.isCompleted ? 'var(--border-color)' : 'var(--primary-color)', color: item.isCompleted ? 'var(--text-muted)' : 'white', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {item.isCompleted ? '다시 읽기' : '읽기'}
                      </button>
                    </div>
                    {item.pickedVerse && (
                      <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '12px', borderLeft: '3px solid #10b981' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#10b981', fontWeight: 'bold', marginBottom: '4px' }}>✨ 마음에 닿은 구절</p>
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
