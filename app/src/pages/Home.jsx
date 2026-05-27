import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import SettingsSheet from '../components/SettingsSheet';
import { useBible } from '../context/BibleContext';
import { BIBLE_DB_KEY } from '../lib/bibleInfo';
import { useSettings } from '../context/SettingsContext';

export default function Home() {
  const navigate = useNavigate();
  const { continueReadPos, setIsContinueMode } = useBible();
  const { settings } = useSettings();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [todayDate, setTodayDate] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  const [massReadings, setMassReadings] = useState(null);
  const [isMassLoading, setIsMassLoading] = useState(false);
  const [readingPlanInfo, setReadingPlanInfo] = useState(null);
  const [recommendedPrayers, setRecommendedPrayers] = useState([]);

  useEffect(() => {
    // 1. 오늘의 한권읽기 정보
    const savedPlan = localStorage.getItem('bible_reading_plan');
    if (savedPlan) {
      try {
        const parsedPlan = JSON.parse(savedPlan);
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const todaySchedule = parsedPlan.schedule.find(s => s.date === todayStr);
        if (todaySchedule) {
          const completedCount = todaySchedule.items.filter(i => i.isCompleted).length;
          setReadingPlanInfo({
            day: todaySchedule.day,
            items: todaySchedule.items,
            completedCount,
            totalItems: todaySchedule.items.length,
            isWeekend: new Date().getDay() === 0 || new Date().getDay() === 6
          });
        } else {
          // 일정이 없거나 지난 경우 (가장 먼저 해야 할 미완료 분량 찾기)
          const firstUncompleted = parsedPlan.schedule.find(s => !s.items.every(i => i.isCompleted));
          if (firstUncompleted) {
            setReadingPlanInfo({
              day: firstUncompleted.day,
              date: firstUncompleted.date,
              items: firstUncompleted.items,
              completedCount: firstUncompleted.items.filter(i => i.isCompleted).length,
              totalItems: firstUncompleted.items.length,
              isWeekend: false
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    // 2. 오늘의 미사 타이틀 가져오기
    const fetchMass = async () => {
      setIsMassLoading(true);
      try {
        const now = new Date();
        const year = now.getFullYear();
        const monthStr = String(now.getMonth() + 1).padStart(2, '0');
        const dateStr = String(now.getDate()).padStart(2, '0');
        const formattedDate = `${year}${monthStr}${dateStr}`;
        
        const response = await fetch(`/api/mass?date=${formattedDate}&type=ko`);
        const data = await response.json();
        if (data.success && data.readings) {
          setMassReadings(data.readings);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsMassLoading(false);
      }
    };
    fetchMass();

    // 3. 추천 기도 로드
    const fetchRecPrayers = async () => {
      try {
        const response = await fetch('/data/prayers.md');
        if (!response.ok) throw new Error('기도문 데이터 로드 실패');
        const text = await response.text();
        
        const lines = text.split('\n');
        const parsedPrayers = [];
        let currentPrayer = null;

        for (let line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('## ')) {
            if (currentPrayer) {
              parsedPrayers.push(currentPrayer);
              currentPrayer = null;
            }
          } else if (trimmed.startsWith('### ')) {
            if (currentPrayer) parsedPrayers.push(currentPrayer);
            currentPrayer = {
              id: '',
              title: trimmed.replace('### ', '').trim(),
              body: ''
            };
            const match = currentPrayer.title.match(/^\[(.*?)\]/);
            if (match) {
              currentPrayer.id = match[1];
              currentPrayer.title = currentPrayer.title.replace(/^\[.*?\]\s*/, '');
            }
          }
        }
        if (currentPrayer) parsedPrayers.push(currentPrayer);

        const hour = new Date().getHours();
        let tz = '하루';
        if (hour >= 5 && hour < 11) tz = '아침';
        else if (hour >= 11 && hour < 17) tz = '낮';
        else tz = '저녁/밤';

        let customRecMap = { '아침': [], '낮': [], '저녁/밤': [] };
        try {
          const saved = localStorage.getItem('custom_recommended_prayers');
          if (saved) customRecMap = JSON.parse(saved);
        } catch(e) {}

        const customIds = customRecMap[tz] || [];
        const result = customIds.map(id => parsedPrayers.find(p => p.id === id)).filter(Boolean);
        
        // 데이터가 없으면 기본값(예비) 세팅
        if (result.length === 0) {
          const defaults = parsedPrayers.slice(0, 3);
          setRecommendedPrayers(defaults);
        } else {
          setRecommendedPrayers(result);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchRecPrayers();
  }, []);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const day = weekDays[now.getDay()];
    setTodayDate(`${month}월 ${date}일 (${day})`);

    const monthStr = String(month).padStart(2, '0');
    const dateStr = String(date).padStart(2, '0');
    const yyyymmdd = `${year}${monthStr}${dateStr}`;
    const savedDate = localStorage.getItem('home_intro_date');
    if (savedDate !== yyyymmdd) {
      setShowIntro(true);
    }
  }, []);

  const handleCloseIntro = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    localStorage.setItem('home_intro_date', `${year}${month}${date}`);
    setShowIntro(false);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <div className="home-wrapper" style={{ backgroundColor: 'var(--home-bg)', minHeight: '100vh', paddingBottom: '100px' }}>
      {showIntro && (
        <div 
          className="faith-intro-overlay"
          onClick={handleCloseIntro}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'var(--bg-color, #1e293b)', color: 'var(--text-color, #f8fafc)',
            zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            padding: '24px', cursor: 'pointer', textAlign: 'center',
            backgroundImage: 'linear-gradient(135deg, rgba(163, 21, 69, 0.15) 0%, rgba(30, 41, 59, 0.98) 100%)',
            transition: 'opacity 0.4s ease'
          }}
        >
          <div style={{ maxWidth: '480px', animation: 'fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <div style={{ width: '48px', height: '2px', backgroundColor: 'var(--ot-accent, #A64B2A)', margin: '0 auto 28px', opacity: 0.8 }}></div>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--ot-accent, #A64B2A)', letterSpacing: '4px', textTransform: 'uppercase', display: 'block', marginBottom: '16px', opacity: 0.9 }}>나의 신앙</span>
            <blockquote style={{ fontSize: '1.45rem', fontWeight: '300', fontFamily: 'Gowun Batang, Georgia, serif', lineHeight: '2.0', margin: 0, padding: 0, color: 'var(--text-color)' }}>
              "나를 비우고<br />예수님의 믿음을 채우는 것"
            </blockquote>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '54px', display: 'block', opacity: 0.6 }}>화면을 탭하여 시작하기</span>
          </div>
        </div>
      )}
      
      <header className="home-header">
        <div className="header-placeholder"></div>
        <h1 
          className="home-main-title" 
          onClick={handleRefresh}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <span>가톨릭 성경</span>
          {isRefreshing && (
            <svg className="refresh-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite', color: 'var(--ot-accent)', flexShrink: 0 }}>
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          )}
        </h1>
        
        <div className="header-right">
          <button className="header-btn" onClick={() => navigate('/search')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
          <button className="header-btn" onClick={() => setIsSettingsOpen(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1-1-1.72V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>

      <main className="home-container">
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-color)', marginTop: '8px' }}>
          {todayDate}
        </h2>

        {/* 1. 오늘의 한권읽기 */}
        <section style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
              오늘의 한권읽기
            </h3>
            <button onClick={() => navigate('/plan')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>전체보기</button>
          </div>
          
          <div 
            onClick={() => navigate('/plan')}
            style={{ 
              backgroundColor: 'var(--card-bg, #ffffff)', 
              borderRadius: '16px', 
              padding: '16px', 
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              cursor: 'pointer'
            }}
          >
            {readingPlanInfo ? (
              readingPlanInfo.isWeekend ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '10px 0' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '1.2rem' }}>☕</p>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>주말은 한권읽기 쉬는 날입니다.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-color)' }}>Day {readingPlanInfo.day}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 'bold', backgroundColor: 'rgba(240, 140, 0, 0.1)', padding: '4px 8px', borderRadius: '12px' }}>
                      {readingPlanInfo.completedCount} / {readingPlanInfo.totalItems} 완료
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {readingPlanInfo.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.isCompleted ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid var(--border-color)' }} />
                        )}
                        <span style={{ fontSize: '0.95rem', color: item.isCompleted ? 'var(--text-muted)' : 'var(--text-color)', textDecoration: item.isCompleted ? 'line-through' : 'none' }}>
                          {item.bookName} {item.chapter}장
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '10px 0' }}>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>생성된 한권읽기 일정이 없습니다.<br/>새로운 통독을 시작해보세요!</p>
              </div>
            )}
          </div>
        </section>

        {/* 2. 오늘의 미사 */}
        <section style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mass-accent, #8b5cf6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              오늘의 매일미사
            </h3>
          </div>
          <div 
            onClick={() => navigate('/mass')}
            style={{ 
              backgroundColor: 'var(--card-bg, #ffffff)', 
              borderRadius: '16px', 
              padding: '16px', 
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {isMassLoading ? (
              <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>미사 정보를 불러오는 중...</div>
            ) : massReadings && massReadings.length > 0 ? (
              massReadings.map((reading, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: '800', 
                    color: reading.type.includes('복음') ? 'var(--reading-accent-pink)' : 'var(--ot-accent)',
                    backgroundColor: reading.type.includes('복음') ? 'rgba(214,51,108,0.1)' : 'rgba(240,140,0,0.1)',
                    padding: '3px 8px', 
                    borderRadius: '6px',
                    minWidth: '45px',
                    textAlign: 'center'
                  }}>
                    {reading.type}
                  </span>
                  <span style={{ fontSize: '0.95rem', color: 'var(--text-color)', fontWeight: '500' }}>
                    {reading.label.replace(reading.type, '').trim()}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '10px 0' }}>오늘의 미사 정보가 없습니다.</div>
            )}
            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--mass-accent, #8b5cf6)', fontWeight: 'bold' }}>매일미사 전체 보기 &rarr;</span>
            </div>
          </div>
        </section>

        {/* 3. 추천 기도 */}
        <section style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--prayer-accent, #14b8a6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              지금 시간에 추천하는 기도
            </h3>
            <button onClick={() => navigate('/prayers')} style={{ background: 'none', border: 'none', color: 'var(--prayer-accent, #14b8a6)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>더보기</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recommendedPrayers.length > 0 ? (
              recommendedPrayers.map((prayer, idx) => (
                <div 
                  key={idx}
                  onClick={() => navigate(`/prayers/${prayer.id}`)}
                  style={{ 
                    backgroundColor: 'var(--card-bg, #ffffff)', 
                    borderRadius: '16px', 
                    padding: '16px', 
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-color)' }}>{prayer.title}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '20px', backgroundColor: 'var(--card-bg, #ffffff)', borderRadius: '16px' }}>추천 기도문이 없습니다.</div>
            )}
          </div>
        </section>

      </main>

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
