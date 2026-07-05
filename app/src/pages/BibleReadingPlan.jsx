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

// 📅 날짜 문자열(YYYY-MM-DD)을 'M. D. (요일)' 형태로 포맷팅하는 헬퍼 함수
const fmtDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  
  const date = new Date(y, m, d);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = days[date.getDay()];
  return `${month}. ${day}. (${dayOfWeek})`;
};

// 📅 오늘 날짜를 YYYY-MM-DD 포맷으로 반환하는 헬퍼 함수
const getTodayStr = () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function BibleReadingPlan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [planHistory, setPlanHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bible_reading_plan_history') || '[]'); } catch { return []; }
  });
  
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

  // 테마(다크/라이트) 실시간 감지 및 설정 적용
  useEffect(() => {
    const applyTheme = () => {
      const theme = settings.theme;
      if (theme === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(systemDark);
      } else {
        setIsDark(theme === 'dark');
      }
    };
    applyTheme();
    
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e) => setIsDark(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings.theme]);

  // Calendar Dashboard View State
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // 0 ~ 11
  const [selectedDateStr, setSelectedDateStr] = useState('');

  useEffect(() => {
    let cancelled = false;

    // 1. Load Bible DB for metadata
    localforage.getItem(BIBLE_DB_KEY).then(data => {
      if (cancelled) return;
      if (data && data.books) {
        setDbBooks(data.books);
      }
      // 2. Load Reading Plan
      const savedPlan = localStorage.getItem('bible_reading_plan');
      if (savedPlan) {
        let parsedPlan;
        try {
          parsedPlan = JSON.parse(savedPlan);
        } catch (e) {
          console.error('Invalid plan data:', e);
          localStorage.removeItem('bible_reading_plan');
          if (!cancelled) setIsLoading(false);
          return;
        }
        if (!cancelled) setPlan(parsedPlan);
        const todayStr = getTodayStr();
        const firstUncompleted = parsedPlan.schedule.find(s => !s.items.every(i => i.isCompleted));
        const targetDateStr = firstUncompleted ? firstUncompleted.date : (parsedPlan.schedule[0]?.date || todayStr);
        if (!cancelled) setSelectedDateStr(targetDateStr);
        const [y, m] = targetDateStr.split('-').map(Number);
        if (!cancelled) { setViewYear(y); setViewMonth(m - 1); }
      } else {
        if (!cancelled) setSelectedDateStr(getTodayStr());
      }
      if (!cancelled) setIsLoading(false);
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
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
        let took;
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

  const [confirmReset, setConfirmReset] = useState(false);
  const handleResetPlan = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    localStorage.removeItem('bible_reading_plan');
    setPlan(null);
    setSelectedBooks([]);
    setConfirmReset(false);
  };

  const handleSaveToHistory = (currentPlan) => {
    const entry = {
      completedAt: getTodayStr(),
      settings: currentPlan.settings,
      totalChapters: currentPlan.schedule.reduce((a, d) => a + d.items.length, 0),
    };
    const updated = [entry, ...planHistory];
    setPlanHistory(updated);
    localStorage.setItem('bible_reading_plan_history', JSON.stringify(updated));
  };

  const handleStartNew = () => {
    if (plan) handleSaveToHistory(plan);
    localStorage.removeItem('bible_reading_plan');
    setPlan(null);
    setSelectedBooks([]);
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

  if (isLoading) {
    return <div className="loading-screen"><div className="spinner"></div></div>;
  }

  const showSetup = searchParams.get('setup') === 'true' || !plan;

  // --- RENDERING PLAN SETTINGS ---
  if (showSetup) {
    // 성경별 완료 횟수 계산
    const bookCompletionCount = {};
    planHistory.forEach(h => {
      (h.settings?.books || []).forEach(id => {
        bookCompletionCount[id] = (bookCompletionCount[id] || 0) + 1;
      });
    });

    return (
      <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', padding: '8px 20px 190px 20px', boxSizing: 'border-box', color: 'var(--text-color)' }}>
        <div style={{ textAlign: 'center', padding: '16px 0 8px', fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-color)' }}>한권통독 설정</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '8px', lineHeight: '1.6' }}>
          시작 날짜 · 하루 읽을 분량 · 성경 선택 후 스케줄 시작 버튼 클릭
        </div>
        
        {/* 📅 스케줄 및 날짜 계산 프리미엄 인포 카드 (토/일 주말 제외 갱신) */}
        <div style={{ 
          backgroundColor: isDark ? '#1e2030' : '#ffffff', 
          padding: '12px 14px', 
          borderRadius: '16px', 
          marginBottom: '16px',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', width: '100%', flexWrap: 'nowrap' }}>
            {/* 시작일 설정 */}
            <div style={{ flex: '0 0 140px', width: '140px', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>시작 날짜</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                style={{ 
                  width: '140px', 
                  maxWidth: '140px',
                  display: 'block',
                  minWidth: 0,
                  padding: '8px 6px', 
                  borderRadius: '10px', 
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(0, 0, 0, 0.15)', 
                  fontSize: '0.85rem', 
                  backgroundColor: isDark ? '#282830' : '#f1f3f5', 
                  color: isDark ? '#ffffff' : '#1a1a1a',
                  boxSizing: 'border-box',
                  height: '38px'
                }}
              />
            </div>
 
            {/* 하루 읽을 분량 */}
            <div style={{ flex: '0 0 92px', width: '92px', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)', marginBottom: '4px', letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>하루 읽을 분량</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="number" 
                  value={chaptersPerDay} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setChaptersPerDay('');
                    } else {
                      const parsed = parseInt(val);
                      setChaptersPerDay(isNaN(parsed) ? 1 : Math.max(1, parsed));
                    }
                  }}
                  onBlur={() => {
                    if (chaptersPerDay === '') {
                      setChaptersPerDay(1);
                    }
                  }}
                  style={{ 
                    width: '45px', 
                    padding: '8px 4px', 
                    borderRadius: '10px', 
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(0, 0, 0, 0.15)', 
                    fontSize: '0.9rem', 
                    textAlign: 'center', 
                    backgroundColor: isDark ? '#282830' : '#f1f3f5', 
                    color: isDark ? '#ffffff' : '#1a1a1a',
                    boxSizing: 'border-box',
                    height: '38px'
                  }}
                />
                <span style={{ fontSize: '0.82rem', color: isDark ? '#ffffff' : '#1a1a1a', fontWeight: '600', whiteSpace: 'nowrap' }}>장</span>
              </div>
            </div>
          </div>
 
          {/* ⚡ 실시간 자동 날짜 지정 및 통독 예상 결과 정보 */}
          <div style={{ 
            marginTop: '12px', 
            paddingTop: '12px', 
            borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>선택된 성경 수:</span>
              <span style={{ fontWeight: 'bold', color: isDark ? '#ffffff' : '#1a1a1a' }}>{selectedBooks.length} 권</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>총 분량:</span>
              <span style={{ fontWeight: 'bold', color: isDark ? '#ffffff' : '#1a1a1a' }}>{totalSelectedChapters} 장</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>예상 소요 평일:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{estimatedTotalDays} 일 (주말 제외)</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontSize: '0.92rem', 
              marginTop: '4px',
              padding: '8px 12px',
              backgroundColor: isDark ? 'rgba(249, 115, 22, 0.1)' : 'rgba(249, 115, 22, 0.05)',
              border: '1.5px solid var(--primary-color)',
              borderRadius: '8px'
            }}>
              <span style={{ color: isDark ? 'var(--primary-color)' : 'var(--primary-color)', fontWeight: 'bold' }}>🏁 통독 완료 예정일:</span>
              <span style={{ fontWeight: '900', color: isDark ? '#ffffff' : '#1a1a1a' }}>{estimatedEndDate}</span>
            </div>
          </div>
        </div>
 
        {/* 📚 성경 목록 (구약 / 신약 2단 반응형 그리드 구조) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '14px',
          marginBottom: '12px',
          overflow: 'visible',
          padding: '6px 2px'
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
                  backgroundColor: isDark ? '#1e2030' : '#ffffff', 
                  padding: '12px 14px', 
                  borderRadius: '16px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isDark ? '1.5px solid rgba(255, 255, 255, 0.12)' : '1.5px solid rgba(0, 0, 0, 0.08)', paddingBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: isDark ? '#ffffff' : '#1a1a1a', fontWeight: '800' }}>{testamentKey}</h3>
                  <button 
                    onClick={() => handleTestamentToggle(testamentKey)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: isTestamentAllSelected ? (isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)') : 'var(--primary-color)', 
                      fontSize: '0.82rem', 
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
                    <div key={cat.title} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)', fontWeight: 'bold' }}>{cat.title}</span>
                        <button 
                          onClick={() => handleCategoryToggle(cat.books)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: isCatAllSelected ? (isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)') : (isDark ? '#ffffff' : '#1a1a1a'), 
                            fontSize: '0.72rem', 
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
                        gap: '4px',
                        overflow: 'visible'
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
                                position: 'relative',
                                padding: '6px 2px',
                                borderRadius: '8px',
                                backgroundColor: isSelected ? 'var(--primary-color)' : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'),
                                color: isSelected ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.9)' : '#1a1a1a'),
                                border: isSelected ? '1px solid var(--primary-color)' : (isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)'),
                                fontSize: '0.82rem',
                                fontWeight: isSelected ? '800' : '600',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.1s ease',
                                userSelect: 'none',
                                overflow: 'visible'
                              }}
                              title={`${bibleMetadata[bookName]?.full || bookName} (${bookData.chapters?.length}장)`}
                            >
                              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookName}</span>
                              {bookCompletionCount[bookData.id] > 0 && (
                                <span style={{
                                  position: 'absolute',
                                  top: '-5px',
                                  right: '-3px',
                                  backgroundColor: '#e53935',
                                  color: '#fff',
                                  fontSize: '0.6rem',
                                  fontWeight: 'bold',
                                  borderRadius: '50%',
                                  width: '14px',
                                  height: '14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: 1
                                }}>
                                  {bookCompletionCount[bookData.id]}
                                </span>
                              )}
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

        {/* 뱃지 범례 + 완료 진행률 + 완료 기록 */}
        {planHistory.length > 0 && (() => {
          const allBookIds = dbBooks.map(b => b.id);
          const completedBookIds = new Set(planHistory.flatMap(h => h.settings?.books || []));
          const completedCount = allBookIds.filter(id => completedBookIds.has(id)).length;
          return (
            <div style={{ padding: '12px 14px', backgroundColor: 'var(--secondary-bg)', borderRadius: '12px', border: '0.5px solid var(--border-color)', marginBottom: '160px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                🔴 숫자 뱃지는 완료한 횟수를 의미합니다
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-color)' }}>완독 성경</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{completedCount} / {allBookIds.length}권</span>
              </div>
              <div style={{ height: '4px', backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', borderRadius: '2px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ height: '100%', width: `${Math.round(completedCount / allBookIds.length * 100)}%`, backgroundColor: 'var(--primary-color)', borderRadius: '2px' }} />
              </div>
              {planHistory.map((h, i) => {
                const bookNames = (h.settings?.books || [])
                  .map(id => dbBooks.find(b => b.id === id))
                  .filter(Boolean)
                  .map(b => bibleMetadata[b.name]?.full || b.name)
                  .join(', ');
                return (
                  <div key={i} style={{ paddingTop: i === 0 ? '0' : '8px', marginTop: i === 0 ? '0' : '8px', borderTop: i === 0 ? 'none' : '0.5px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-color)' }}>{bookNames}  <span style={{ color: 'var(--text-muted)' }}>{h.completedAt} 완료</span></div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <button
          onClick={handleCreatePlan}
          style={{
            position: 'fixed',
            bottom: 'calc(109px + env(safe-area-inset-bottom, 0px))',
            left: 0,
            right: 0,
            width: '100%',
            padding: '13px 0',
            backgroundColor: 'var(--bg-color)',
            color: 'var(--primary-color)',
            border: 'none',
            borderTop: '1px solid var(--border-color)',
            fontSize: '1rem',
            fontWeight: '900',
            cursor: 'pointer',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span style={{ padding: '8px 24px', border: '2px solid var(--primary-color)', borderRadius: '24px', color: 'var(--primary-color)', fontSize: '0.95rem', fontWeight: '900' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'4px'}}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> 통독 스케줄 ({estimatedTotalDays}일 코스) 시작
          </span>
        </button>
      </div>
    );
  }

  // --- RENDERING DASHBOARD (MONTHLY CALENDAR VIEW) ---
  const totalItems = plan.schedule.reduce((acc, d) => acc + d.items.length, 0);
  const completedItems = plan.schedule.reduce((acc, d) => acc + d.items.filter(i => i.isCompleted).length, 0);
  const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);
  const planStartDate = plan.settings?.startDate || (plan.schedule.length > 0 ? plan.schedule[0]?.date : null);
  const planEndDate = plan.schedule.length > 0 ? plan.schedule[plan.schedule.length - 1]?.date : null;
  const planTotalDays = plan.schedule.length;

  const calendarDays = getCalendarDays(viewYear, viewMonth);
  const selectedDaySchedule = plan.schedule.find(s => s.date === selectedDateStr);

  return (
    <div style={{ backgroundColor: 'var(--bg-color, #f8f9fa)', minHeight: '100vh', padding: '8px 24px 120px 24px', boxSizing: 'border-box', color: 'var(--text-color, #1a1a1a)' }}>
      {/* 초기화 확인 모달 */}
      {confirmReset && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '24px', borderRadius: '16px', maxWidth: '300px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-color)' }}>정말 삭제할 건가요?</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>지금 삭제하면 모든 기록이 사라집니다.</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={() => setConfirmReset(false)} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: 'var(--secondary-bg)', color: 'var(--text-color)', border: 'none', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
              <button onClick={() => { localStorage.removeItem('bible_reading_plan'); setPlan(null); setSelectedBooks([]); setConfirmReset(false); }} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#e53935', color: '#fff', border: 'none', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}>확인</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ position: 'relative', textAlign: 'center', padding: '16px 0 10px' }}>
        <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-color)' }}>한권통독</span>
        <button onClick={() => setConfirmReset(true)} style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.82rem', fontWeight: '600', padding: '4px 8px', background: 'none', border: 'none', color: 'var(--text-color)', opacity: 0.8, cursor: 'pointer' }}>초기화</button>
      </div>
 
      {/* 완료 축하 배너 */}
      {progressPercent === 100 && (
        <div style={{
          textAlign: 'center',
          padding: '20px 16px',
          marginBottom: '12px',
          backgroundColor: isDark ? '#2a2010' : '#fff8f0',
          borderRadius: '16px',
          border: '1px solid var(--primary-color)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '4px' }}>통독 완료!</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {plan.settings?.startDate && `${fmtDate(plan.settings.startDate)} ~ ${fmtDate(planEndDate)} · `}{planTotalDays}일 과정
          </div>
          <button
            onClick={handleStartNew}
            style={{
              padding: '10px 24px',
              borderRadius: '20px',
              backgroundColor: 'var(--primary-color)',
              color: '#fff',
              border: 'none',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            다음 성경 선택 →
          </button>
        </div>
      )}


      {/* 진행률 요약 (한 줄) */}
      <div style={{ padding: '10px 8px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '40px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{progressPercent}% · {completedItems}/{totalItems}장</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-color)' }}>
            {planStartDate ? fmtDate(planStartDate) : '-'} → {planEndDate ? fmtDate(planEndDate) : '-'} · {planTotalDays}일
          </span>
        </div>
        <div style={{ height: '4px', backgroundColor: 'var(--secondary-bg)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: 'var(--primary-color)', borderRadius: '2px', transition: 'width 0.5s ease' }}></div>
        </div>
      </div>

      {/* 선택한 일자의 읽기 상세 */}
      <div style={{
        backgroundColor: 'var(--secondary-bg)',
        border: '0.5px solid var(--border-color)',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '16px'
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', fontWeight: '600', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
          {fmtDate(selectedDateStr) || '날짜 선택'}
        </h4>

        {selectedDateStr && (new Date(selectedDateStr).getDay() === 0 || new Date(selectedDateStr).getDay() === 6) ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            주말은 쉬는 날입니다.
          </div>
        ) : selectedDaySchedule ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedDaySchedule.items.map((item, idx) => (
              <div key={idx}>
                <div
                  onClick={() => navigate(`/read/${item.bookId}/${item.chapter}?plan=true&day=${selectedDaySchedule.day}`)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-color)',
                    cursor: 'pointer',
                    opacity: item.isCompleted ? 0.5 : 1
                  }}
                >
                  <span style={{ fontSize: '0.95rem', color: 'var(--text-color)', textDecoration: item.isCompleted ? 'line-through' : 'none', display: 'block', textAlign: 'center' }}>
                    {bibleMetadata[item.bookName]?.full || item.bookName} {item.chapter}장
                  </span>
                </div>
                {item.pickedVerse && (
                  <div style={{ padding: '8px 12px', margin: '0 0 8px', borderLeft: '2px solid var(--primary-color)', backgroundColor: 'var(--bg-color)' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-color)', lineHeight: '1.4' }}>{item.pickedVerse}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            이 날짜엔 일정이 없습니다.
          </div>
        )}
      </div>

      {/* 한 달 달력 */}
      <div style={{
        backgroundColor: 'var(--secondary-bg)',
        borderRadius: '16px',
        border: '0.5px solid var(--border-color)',
        padding: '16px 8px',
        marginBottom: '50px',
        overflow: 'hidden'
      }}>
        {/* 달력 헤더 네비게이션 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-color)' }}>
            {viewYear}년 {viewMonth + 1}월
          </span>
          <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        {/* 요일 명칭 행 (7열) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px', width: '100%', boxSizing: 'border-box' }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((w, idx) => (
            <span
              key={w}
              style={{
                fontSize: '0.78rem',
                fontWeight: '600',
                color: 'var(--text-muted)',
                paddingBottom: '2px'
              }}
            >
              {w}
            </span>
          ))}
        </div>

        {/* 달력 날짜 그리드 행 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
          {calendarDays.map((dateObj, index) => {
            if (!dateObj) {
              return <div key={`empty-${index}`} style={{ height: '34px', backgroundColor: 'transparent', minWidth: 0 }} />;
            }

            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            const cellDateStr = `${y}-${m}-${d}`;
            const isSelected = cellDateStr === selectedDateStr;
            const isToday = cellDateStr === getTodayStr();

            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            const daySched = plan.schedule.find(s => s.date === cellDateStr);
            const isDayCompleted = daySched && daySched.items.every(i => i.isCompleted);

            return (
              <div
                key={cellDateStr}
                onClick={() => setSelectedDateStr(cellDateStr)}
                style={{
                  height: '34px',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  minWidth: 0,
                  backgroundColor: isSelected ? 'var(--primary-color)' : 'transparent',
                  border: (isToday && !isSelected) ? '1px solid var(--primary-color)' : '1px solid transparent',
                  transition: 'all 0.1s ease'
                }}
              >
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: (isToday || isSelected) ? '700' : '400',
                  lineHeight: '1',
                  color: isSelected ? '#fff' : (isWeekend ? 'var(--text-muted)' : 'var(--text-color)')
                }}>
                  {dateObj.getDate()}
                </span>

                {!isWeekend && daySched && (
                  isDayCompleted ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isSelected ? '#fff' : 'var(--primary-color)'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSelected ? '#fff' : 'var(--primary-color)' }} />
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 완료 기록 — 항상 표시 */}
      {planHistory.length > 0 && (() => {
        const allBookIds = dbBooks.map(b => b.id);
        const completedBookIds = new Set(planHistory.flatMap(h => h.settings?.books || []));
        const completedCount = allBookIds.filter(id => completedBookIds.has(id)).length;
        return (
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)' }}>완료 기록</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>{completedCount}/{allBookIds.length}권 완독</span>
            </div>
            <div style={{ height: '3px', backgroundColor: 'var(--secondary-bg)', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{ height: '100%', width: `${Math.round(completedCount / allBookIds.length * 100)}%`, backgroundColor: 'var(--primary-color)', borderRadius: '2px' }} />
            </div>
            <div style={{ backgroundColor: 'var(--secondary-bg)', border: '0.5px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              {planHistory.map((h, i) => {
                const bookNames = (h.settings?.books || [])
                  .map(id => dbBooks.find(b => b.id === id))
                  .filter(Boolean)
                  .map(b => bibleMetadata[b.name]?.full || b.name)
                  .join(', ');
                return (
                  <div key={i} style={{ padding: '10px 14px', borderTop: i === 0 ? 'none' : '0.5px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-color)' }}>{bookNames}  <span style={{ color: 'var(--text-muted)' }}>{h.completedAt} 완료</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
