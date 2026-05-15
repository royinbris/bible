import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import localforage from 'localforage';
import { SettingsProvider } from './context/SettingsContext';
import Home from './pages/Home';
import BibleList from './pages/BibleList';
import ChapterList from './pages/ChapterList';
import Reader from './pages/Reader';
import Search from './pages/Search';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initDB();
  }, []);

  const initDB = async () => {
    try {
      const existingData = await localforage.getItem('bibleData_v2');
      if (existingData) {
        setLoading(false);
        return;
      }
      const response = await fetch('/bible_data.json');
      if (!response.ok) throw new Error('Failed to fetch bible data');
      const data = await response.json();
      await localforage.setItem('bibleData_v2', data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("성경 데이터를 불러오는데 실패했습니다.");
      setLoading(false);
    }
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
    <SettingsProvider>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/list/:testament" element={<BibleList />} />
          <Route path="/book/:bookId" element={<ChapterList />} />
          <Route path="/read/:bookId/:chapter" element={<Reader />} />
          <Route path="/search" element={<Search />} />
        </Routes>
      </div>
    </SettingsProvider>
  );
}

export default App;
