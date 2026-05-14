import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import localforage from 'localforage';
import Home from './pages/Home';
import BibleList from './pages/BibleList';
import ChapterList from './pages/ChapterList';
import Reader from './pages/Reader';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(18);

  useEffect(() => {
    // Check dark mode preference
    const isDark = localStorage.getItem('darkMode') === 'true';
    setDarkMode(isDark);
    if (isDark) document.documentElement.setAttribute('data-theme', 'dark');

    // Check font size
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize));
      document.documentElement.style.setProperty('--font-size', `${savedFontSize}px`);
    }

    // Initialize Database
    initDB();
  }, []);

  const initDB = async () => {
    try {
      // Check if data already exists
      const existingData = await localforage.getItem('bibleData_v2');
      if (existingData) {
        console.log("Bible data loaded from IndexedDB");
        setLoading(false);
        return;
      }

      console.log("Fetching bible data...");
      const response = await fetch('/bible_data.json');
      if (!response.ok) throw new Error('Failed to fetch bible data');
      
      const data = await response.json();
      await localforage.setItem('bibleData_v2', data);
      console.log("Bible data saved to IndexedDB");
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("성경 데이터를 불러오는데 실패했습니다.");
      setLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode);
    if (newMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const changeFontSize = (delta) => {
    const newSize = Math.max(12, Math.min(32, fontSize + delta));
    setFontSize(newSize);
    localStorage.setItem('fontSize', newSize);
    document.documentElement.style.setProperty('--font-size', `${newSize}px`);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>성경 데이터를 준비하고 있습니다...<br/>(최초 1회만 다운로드합니다)</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen">
        <p style={{color: 'red'}}>{error}</p>
        <button onClick={initDB} style={{marginTop: 20, padding: '10px 20px'}}>다시 시도</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<Home toggleDarkMode={toggleDarkMode} isDark={darkMode} />} />
        <Route path="/list/:testament" element={<BibleList toggleDarkMode={toggleDarkMode} isDark={darkMode} />} />
        <Route path="/book/:bookId" element={<ChapterList toggleDarkMode={toggleDarkMode} isDark={darkMode} />} />
        <Route path="/read/:bookId/:chapter" element={<Reader toggleDarkMode={toggleDarkMode} isDark={darkMode} changeFontSize={changeFontSize} fontSize={fontSize} />} />
      </Routes>
    </div>
  );
}

export default App;
