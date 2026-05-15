import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  fontSize: 15,
  fontWeight: 400,
  lineHeight: 1.6,
  verseSpacing: 0.7,
  horizontalPadding: 1.5,
  fontFamily: 'System Default',
  theme: 'system'
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('user_settings');
    return saved ? JSON.parse(saved) : { ...DEFAULT_SETTINGS };
  });

  const [backupSettings, setBackupSettings] = useState(() => {
    const saved = localStorage.getItem('backup_settings');
    return saved ? JSON.parse(saved) : null;
  });

  // Save settings whenever they change
  useEffect(() => {
    localStorage.setItem('user_settings', JSON.stringify(settings));
    
    // Apply theme
    const theme = settings.theme;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }

    // Apply font family globally if needed or handle in components
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetToDefault = () => {
    setSettings({ ...DEFAULT_SETTINGS });
  };

  const saveAsDefault = () => {
    localStorage.setItem('backup_settings', JSON.stringify(settings));
    setBackupSettings({ ...settings });
    alert('현재 설정이 기본값으로 저장되었습니다.');
  };

  const restoreFromBackup = () => {
    if (backupSettings) {
      setSettings({ ...backupSettings });
    } else {
      alert('저장된 기본값이 없습니다.');
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      updateSetting, 
      resetToDefault, 
      saveAsDefault, 
      restoreFromBackup,
      hasBackup: !!backupSettings
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
