import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const BACKGROUND_PRESETS = [
  {
    id: 'default',
    label: '기본',
    color: '#F4EEE3',
    palette: ['#F4EEE3', '#FBF7F0', '#FBF7F0', '#E9DDD0', '#F2E9DC', '#F6EDE0']
  },
  {
    id: 'cream',
    label: '크림',
    color: '#F7F1E5',
    palette: ['#F7F1E5', '#FFFDF8', '#FFFDF8', '#EFE5D4', '#F6EDDD', '#FAF4E8']
  },
  {
    id: 'sepia',
    label: '세피아',
    color: '#EADFC8',
    palette: ['#EADFC8', '#F4EBD6', '#F4EBD6', '#DECFB2', '#EFE2C8', '#F4EBD6']
  },
  {
    id: 'green',
    label: '그린',
    color: '#E7EFE2',
    palette: ['#E7EFE2', '#F3F8EF', '#F3F8EF', '#D5E2CC', '#E9F1E2', '#F0F6EA']
  },
  {
    id: 'gray',
    label: '그레이',
    color: '#ECECEC',
    palette: ['#ECECEC', '#F7F7F7', '#F7F7F7', '#DCDCDC', '#EFEFEF', '#F4F4F4']
  },
  {
    id: 'white',
    label: '흰색',
    color: '#FFFFFF',
    palette: ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF']
  }
];

const BACKGROUND_VARIABLES = [
  '--bg-color',
  '--secondary-bg',
  '--nav-bg',
  '--mainnav-bg',
  '--subnav-bg',
  '--subsubnav-bg'
];

const mixWithWhite = (hexColor, intensity) => {
  const normalized = hexColor.replace('#', '');
  const amount = Math.max(0, Math.min(100, Number(intensity))) / 100;
  const channels = [0, 2, 4].map(offset => {
    const original = parseInt(normalized.slice(offset, offset + 2), 16);
    return Math.round(255 - ((255 - original) * amount));
  });
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
};

const clearBackgroundOverrides = root => {
  [...BACKGROUND_VARIABLES, '--header-bg'].forEach(variable => root.style.removeProperty(variable));
};

const applyBackgroundPalette = (root, presetId, intensity) => {
  const preset = BACKGROUND_PRESETS.find(item => item.id === presetId) || BACKGROUND_PRESETS[0];
  const colors = preset.palette.map(color => mixWithWhite(color, intensity));
  BACKGROUND_VARIABLES.forEach((variable, index) => root.style.setProperty(variable, colors[index]));
  const [red, green, blue] = [1, 3, 5].map(offset => parseInt(colors[0].slice(offset, offset + 2), 16));
  root.style.setProperty('--header-bg', `rgba(${red}, ${green}, ${blue}, 0.9)`);
};

const DEFAULT_SETTINGS = {
  fontSize: 18,
  fontWeight: 400,
  lineHeight: 1.7,
  verseSpacing: 0.8,
  horizontalPadding: 1.5,
  fontFamily: 'System Default',
  theme: 'system',
  bibleLanguage: 'ko',
  prayerTtsRate: 0.85,
  bgPreset: 'default',
  bgIntensity: 100
};

export function SettingsProvider({ children }) {
  const backgroundPresetIds = BACKGROUND_PRESETS.map(preset => preset.id);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('user_settings');
    const parsed = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    if (!backgroundPresetIds.includes(parsed.bgPreset)) parsed.bgPreset = 'default';
    const parsedIntensity = Number(parsed.bgIntensity);
    parsed.bgIntensity = Number.isFinite(parsedIntensity)
      ? Math.max(0, Math.min(100, parsedIntensity))
      : DEFAULT_SETTINGS.bgIntensity;
    return parsed;
  });

  const [backupSettings, setBackupSettings] = useState(() => {
    const saved = localStorage.getItem('backup_settings');
    return saved ? JSON.parse(saved) : null;
  });

  // Save settings whenever they change
  useEffect(() => {
    localStorage.setItem('user_settings', JSON.stringify(settings));
    
    // Apply theme
    const root = document.documentElement;
    const theme = settings.theme;
    let resolvedTheme = theme;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolvedTheme = isDark ? 'dark' : 'light';
      root.setAttribute('data-theme', resolvedTheme);
    } else {
      root.setAttribute('data-theme', theme);
    }

    const preset = settings.bgPreset || 'default';
    if (preset === 'default') {
      root.removeAttribute('data-bg');
      if (resolvedTheme === 'dark') {
        clearBackgroundOverrides(root);
      } else {
        applyBackgroundPalette(root, preset, settings.bgIntensity);
      }
    } else {
      root.setAttribute('data-theme', 'light');
      root.setAttribute('data-bg', preset);
      applyBackgroundPalette(root, preset, settings.bgIntensity);
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
