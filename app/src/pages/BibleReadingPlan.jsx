import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

// 📅 토요일(6) 및 일요일(0)을 건너뛰고 다음 평일 날짜를 반환하는 헬퍼 함수
const getNextWorkDay = (currentDateStr, isFirst = false) => {
  const date = new Date(currentDateStr);
  if (!isFirst) {
    date.setDate(date.getDate() + 1);
  }
  while (date.getDay() === 0 || date.getDay() === 6) { // 0: 일요일, 6: 토요일
    date.setDate(date.getDate() + 1);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function BibleReadingPlan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  // Calendar Dashboard View State
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // 0 ~ 11
  const [selectedDateStr, setSelectedDateStr] = useState('');

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
      const parsedPlan = JSON.parse(savedPlan);
      setPlan(parsedPlan);
      
      // 통독 기록이 있으면 첫 미완료 일자 혹은 오늘 날짜로 달력 위치 설정
      const todayStr = getTodayStr();
      const firstUncompleted = parsedPlan.schedule.find(s => !s.items.every(i => i.isCompleted));
      const targetDateStr = firstUncompleted ? firstUncompleted.date : (parsedPlan.schedule[0]?.date || todayStr);
      
      setSelectedDateStr(targetDateStr);
      const [y, m] = targetDateStr.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    } else {
      setSelectedDateStr(getTodayStr());
    }
    setIsLoading(false);
  }, []);

  const getTodayStr = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

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
    
    const sortedSelected = [...selectedBooks].sort((a, b) => a - b);
    const newSchedule = [];
    let currentDay = 1;
    let currentDayItemCount = 0;
    
    // 날짜 포인터 초기화 (시작일이 주말이면 첫 번째 평일로 자동 이동)
    let currentDateStr = startDate;
    currentDateStr = getNextWorkDay(currentDateStr, true);

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
          currentDateStr = getNextWorkDay(currentDateStr, false);
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
          dayObj = { 
            day: currentDay, 
            date: currentDateStr, // 📅 주말 제외 평일 매핑 날짜
            items: [] 
          };
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
          if (chapIndex < chapters.length) {
            currentDateStr = getNextWorkDay(currentDateStr, false);
          }
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
    
    // 달력 화면 기준일을 시작일로 셋팅
    const [y, m] = getNextWorkDay(startDate, true).split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    setSelectedDateStr(getNextWorkDay(startDate, true));
  };

  const handleResetPlan = () => {
    if (confirm("정말 통독 스케줄을 초기화하시겠습니까? 기록이 모두 삭제됩니다.")) {
      localStorage.removeItem('bible_reading_plan');
      setPlan(null);
      setSelectedBooks([]);
    }
  };

  // 실시간 평일 기준 날짜 계산
  const totalSelectedChapters = dbBooks
    .filter(b => selectedBooks.includes(b.id))
    .reduce((sum, b) => sum + (b.chapters ? b.chapters.length : 0), 0);

  const estimatedTotalDays = Math.ceil(totalSelectedChapters / chaptersPerDay);

  const getEstimatedEndDateStr = (startStr, days) => {
    if (!startStr || days <= 0) return '-';
    let dateObj = new Date(startStr);
    
    // 시작일이 토/일인 경우 첫 평일로 이동
    while (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
      dateObj.setDate(dateObj.getDate() + 1);
    }
    
    let remainingDays = days - 1;
    while (remainingDays > 0) {
      dateObj.setDate(dateObj.getDate() + 1);
      if (dateObj.getDay() !== 0 && dateObj.getDay() !== 6) {
        remainingDays--;
      }
    }
    
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const w = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
    
    return `${y}년 ${m}월 ${d}일 (${w})`;
  };

  const estimatedEndDate = getEstimatedEndDateStr(startDate, estimatedTotalDays);

  // --- CALENDAR RENDER HELPERS ---
  const handlePrevMonth = () => {
    setViewMonth(prev => {
      if (prev === 0) {
        setViewYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setViewMonth(prev => {
      if (prev === 11) {
        setViewYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const getCalendarDays = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 1일의 요일 (0: 일요일, 6: 토요일)
    
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate(); // 이번달 마지막 날 일자
    
    const days = [];
    
    // 이전달 빈칸 채우기
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // 이번달 날짜 채우기
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }
    
    return days;
  };

  if (isLoading || dbBooks.length === 0) {
    return <div className="loading-screen"><div className="spinner"></div></div>;
  }

  const showSetup = searchParams.get('setup') === 'true' || !plan;

  // --- RENDERING PLAN SETTINGS ---
  if (showSetup) {
    return (
      <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', padding: '24px', boxSizing: 'border-box' }}>
        <header style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>한권읽기 설정</span>
          </button>
        </header>
        
        {/* 📅 스케줄 및 날짜 계산 프리미엄 인포 카드 (토/일 주말 제외 갱신) */}
        <div style={{ 
          backgroundColor: 'var(--secondary-bg)', 
          padding: '16px', 
          borderRadius: '20px', 
          marginBottom: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', width: '100%', flexWrap: 'nowrap' }}>
            {/* 시작일 설정 */}
            <div style={{ flex: '0 1 180px', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>시작 날짜</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                style={{ 
                  width: '100%', 
                  maxWidth: '180px',
                  display: 'block',
                  minWidth: 0,
                  padding: '10px 6px', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-color)', 
                  fontSize: '0.85rem', 
                  backgroundColor: 'var(--bg-color)', 
                  color: 'var(--text-color)',
                  boxSizing: 'border-box',
                  height: '42px'
                }}
              />
            </div>

            {/* 하루 읽을 분량 */}
            <div style={{ flex: '0 0 92px', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>하루 읽을 분량</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="number" 
                  value={chaptersPerDay} 
                  onChange={(e) => setChaptersPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ 
                    width: '45px', 
                    padding: '10px 4px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color)', 
                    fontSize: '0.9rem', 
                    textAlign: 'center', 
                    backgroundColor: 'var(--bg-color)', 
                    color: 'var(--text-color)',
                    boxSizing: 'border-box',
                    height: '42px'
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-color)', fontWeight: '600', whiteSpace: 'nowrap' }}>장</span>
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
              <span style={{ color: 'var(--text-muted)' }}>예상 소요 평일:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{estimatedTotalDays} 일 (주말 제외)</span>
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
          {Object.keys(BIBLE_CATEGORIES).reverse().map((testamentKey) => {
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

  // --- RENDERING DASHBOARD (MONTHLY CALENDAR VIEW) ---
  const totalItems = plan.schedule.reduce((acc, d) => acc + d.items.length, 0);
  const completedItems = plan.schedule.reduce((acc, d) => acc + d.items.filter(i => i.isCompleted).length, 0);
  const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  const calendarDays = getCalendarDays(viewYear, viewMonth);
  const selectedDaySchedule = plan.schedule.find(s => s.date === selectedDateStr);

  const getDayFormatKorean = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const w = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${m}월 ${d}일 (${w})`;
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', padding: '24px', boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>한권읽기</span>
        </button>
        <button onClick={handleResetPlan} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer', padding: '4px 8px' }}>
          초기화
        </button>
      </header>

      {/* 📊 미니 진행률 바 */}
      <div style={{ 
        padding: '16px', 
        backgroundColor: 'var(--secondary-bg)', 
        borderRadius: '16px', 
        marginBottom: '20px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>전체 통독 진행률</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{progressPercent}% ({completedItems}/{totalItems}장)</span>
        </div>
        <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: 'var(--primary-color)', borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
        </div>
      </div>

      {/* 📅 한 달 달력 그리드 대시보드 카드 */}
      <div style={{
        backgroundColor: 'var(--secondary-bg)',
        borderRadius: '20px',
        border: '1px solid var(--border-color)',
        padding: '16px',
        marginBottom: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
      }}>
        {/* 달력 헤더 네비게이션 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
            {viewYear}년 {viewMonth + 1}월
          </span>
          <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        {/* 요일 명칭 행 (7열) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((w, idx) => (
            <span 
              key={w} 
              style={{ 
                fontSize: '0.8rem', 
                fontWeight: 'bold', 
                color: idx === 0 ? '#ef4444' : (idx === 6 ? '#3b82f6' : 'var(--text-muted)'),
                paddingBottom: '4px'
              }}
            >
              {w}
            </span>
          ))}
        </div>

        {/* 달력 날짜 그리드 행 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {calendarDays.map((dateObj, index) => {
            if (!dateObj) {
              return <div key={`empty-${index}`} style={{ aspectRatio: '1', backgroundColor: 'transparent' }} />;
            }

            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            const cellDateStr = `${y}-${m}-${d}`;
            const isSelected = cellDateStr === selectedDateStr;
            const isToday = cellDateStr === getTodayStr();

            // 주말 체크 (0: 일요일, 6: 토요일)
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            // 스케줄 매핑
            const daySched = plan.schedule.find(s => s.date === cellDateStr);
            const isDayCompleted = daySched && daySched.items.every(i => i.isCompleted);

            // 셀 텍스트 요약 분리 (윗줄: 성경이름, 아랫줄: 장번호)
            let bookSummary = '';
            let chapSummary = '';
            if (daySched && daySched.items.length > 0) {
              const firstItem = daySched.items[0];
              const lastItem = daySched.items[daySched.items.length - 1];
              if (firstItem.bookName === lastItem.bookName) {
                bookSummary = firstItem.bookName;
                chapSummary = `${firstItem.chapter}${daySched.items.length > 1 ? `-${lastItem.chapter}` : ''}`;
              } else {
                bookSummary = firstItem.bookName;
                chapSummary = '..';
              }
            }

            return (
              <div
                key={cellDateStr}
                onClick={() => setSelectedDateStr(cellDateStr)}
                style={{
                  aspectRatio: '0.9',
                  borderRadius: '12px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '6px 4px',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  border: isSelected 
                    ? '2px solid var(--primary-color)' 
                    : (isToday ? '2px dashed var(--text-muted)' : '1px solid var(--border-color)'),
                  backgroundColor: isWeekend 
                    ? 'rgba(128, 128, 128, 0.05)' // ☕ 주말인 경우 연회색 비활성화 배경
                    : (isDayCompleted 
                        ? 'rgba(16, 185, 129, 0.08)' // 💚 완료 시 연녹색 배경
                        : (daySched ? 'rgba(166, 75, 42, 0.03)' : 'var(--bg-color)')),
                  opacity: isWeekend ? 0.6 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                {/* 일자 표기 */}
                <span style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 'bold', 
                  color: isWeekend 
                    ? (dateObj.getDay() === 0 ? 'rgba(239, 68, 68, 0.45)' : 'rgba(59, 130, 246, 0.45)') // 주말 패스 흐린 요일색
                    : (dateObj.getDay() === 0 ? '#ef4444' : (dateObj.getDay() === 6 ? '#3b82f6' : 'var(--text-color)')),
                  alignSelf: 'flex-start'
                }}>
                  {dateObj.getDate()}
                </span>

                {/* 묵시적 요약 또는 완료체크 */}
                {isWeekend ? (
                  <span style={{ fontSize: '0.52rem', color: 'var(--text-muted)', transform: 'scale(0.9)', alignSelf: 'center', opacity: 0.6 }}>쉼</span>
                ) : (
                  daySched && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1px' }}>
                      {isDayCompleted ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          width: '100%', 
                          lineHeight: '1.1' 
                        }}>
                          <span style={{ 
                            fontSize: '0.55rem', 
                            fontWeight: '800', 
                            color: 'var(--text-color)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                            textAlign: 'center'
                          }}>
                            {bookSummary}
                          </span>
                          <span style={{ 
                            fontSize: '0.55rem', 
                            fontWeight: '800', 
                            color: 'var(--primary-color)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%',
                            textAlign: 'center'
                          }}>
                            {chapSummary}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 📋 선택한 일자의 읽기 상세 정보 카드 영역 */}
      <div style={{
        backgroundColor: 'var(--secondary-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        marginBottom: '40px'
      }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          📅 {getDayFormatKorean(selectedDateStr) || '날짜 선택'} 상세 일정
        </h4>

        {selectedDateStr && (new Date(selectedDateStr).getDay() === 0 || new Date(selectedDateStr).getDay() === 6) ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
            <p style={{ margin: '0 0 6px 0', fontSize: '1.2rem' }}>☕</p>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>토요일과 일요일은 한권읽기 쉬는 날(휴식일)입니다.</p>
          </div>
        ) : selectedDaySchedule ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
              🎯 Day {selectedDaySchedule.day} 오늘의 말씀
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedDaySchedule.items.map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => navigate(`/read/${item.bookId}/${item.chapter}?plan=true&day=${selectedDaySchedule.day}`)}
                  style={{ 
                    backgroundColor: 'var(--bg-color)', 
                    borderRadius: '16px', 
                    padding: '16px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px', 
                    opacity: item.isCompleted ? 0.7 : 1, 
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
                      {item.bookName} {item.chapter}장
                    </span>
                    <button 
                      style={{ 
                        padding: '8px 16px', 
                        borderRadius: '12px', 
                        border: 'none', 
                        backgroundColor: item.isCompleted ? 'var(--border-color)' : 'var(--primary-color)', 
                        color: item.isCompleted ? 'var(--text-muted)' : 'white', 
                        fontWeight: 'bold', 
                        fontSize: '0.85rem',
                        pointerEvents: 'none'
                      }}
                    >
                      {item.isCompleted ? '다시 읽기' : '읽기'}
                    </button>
                  </div>
                  {item.pickedVerse && (
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '12px', borderLeft: '3px solid #10b981' }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold', marginBottom: '4px' }}>✨ 마음에 닿은 구절</p>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-color)', lineHeight: '1.4' }}>{item.pickedVerse}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>이 날짜에 예정된 통독 일정이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
