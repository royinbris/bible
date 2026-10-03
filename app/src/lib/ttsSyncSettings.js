export const TTS_SETTINGS_SYNCED_EVENT = 'bible:tts-settings-synced';

const SKIP_KOREAN_VALUES = new Set(['none', 'korean', 'english']);
const SUPERTONIC_VOICES = new Set(['M1', 'M2', 'M3', 'M4', 'M5', 'F1', 'F2', 'F3', 'F4', 'F5']);
const SUPERTONIC_FORMATS = new Set(['wav', 'aac']);
const FILEVIEW_HIGHLIGHT_COLORS = new Set(['yellow', 'green', 'blue', 'pink', 'purple']);

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function sanitizeString(value, fallback = '', maxLength = 512) {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function sanitizeResumePositions(value) {
  const sanitized = Object.create(null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return sanitized;

  Object.entries(value).slice(0, 200).forEach(([fileName, position]) => {
    if (
      !fileName ||
      fileName.length > 512 ||
      ['__proto__', 'constructor', 'prototype'].includes(fileName) ||
      !position ||
      typeof position !== 'object' ||
      Array.isArray(position)
    ) return;

    const index = Math.floor(clampNumber(position.index, 0, 10_000_000, 0));
    const skipKorean = SKIP_KOREAN_VALUES.has(position.skipKorean) ? position.skipKorean : 'none';
    sanitized[fileName] = { index, skipKorean };
  });

  return sanitized;
}

export function collectTtsSyncSettings() {
  if (typeof window === 'undefined') return null;

  const skipKorean = localStorage.getItem('skip_korean') || 'none';
  const supertonicVoice = localStorage.getItem('supertonic_voice') || 'M1';
  const supertonicFormat = localStorage.getItem('supertonic_fmt') || 'wav';

  return {
    version: 1,
    speed: clampNumber(localStorage.getItem('tts_speed'), 0.5, 2, 1),
    selectedVoiceURI: sanitizeString(localStorage.getItem('selected_voice_uri') || ''),
    hideEnglishVoices: localStorage.getItem('hide_english_voices') === 'true',
    repeatTimes: Math.floor(clampNumber(localStorage.getItem('repeat_times'), 1, 10, 1)),
    skipKorean: SKIP_KOREAN_VALUES.has(skipKorean) ? skipKorean : 'none',
    supertonic: {
      voice: SUPERTONIC_VOICES.has(supertonicVoice) ? supertonicVoice : 'M1',
      format: SUPERTONIC_FORMATS.has(supertonicFormat) ? supertonicFormat : 'wav',
      spatial: localStorage.getItem('supertonic_spatial') === 'true'
    },
    fileView: {
      englishSpeed: clampNumber(localStorage.getItem('rate_en'), 0.5, 2, 1),
      koreanSpeed: clampNumber(localStorage.getItem('rate_ko'), 0.5, 2, 1),
      pauseSeconds: clampNumber(localStorage.getItem('fileview_tts_pause_seconds'), 0, 5, 0),
      highlightColor: FILEVIEW_HIGHLIGHT_COLORS.has(localStorage.getItem('fileview_tts_highlight_color'))
        ? localStorage.getItem('fileview_tts_highlight_color')
        : 'yellow',
      resumePositions: sanitizeResumePositions(readJson('fileview_resume_positions', {}))
    }
  };
}

export function applyTtsSyncSettings(value) {
  if (typeof window === 'undefined' || !value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const supertonic = value.supertonic && typeof value.supertonic === 'object' ? value.supertonic : {};
  const fileView = value.fileView && typeof value.fileView === 'object' ? value.fileView : {};
  const normalized = {
    version: 1,
    speed: clampNumber(value.speed, 0.5, 2, 1),
    selectedVoiceURI: sanitizeString(value.selectedVoiceURI),
    hideEnglishVoices: value.hideEnglishVoices === true,
    repeatTimes: Math.floor(clampNumber(value.repeatTimes, 1, 10, 1)),
    skipKorean: SKIP_KOREAN_VALUES.has(value.skipKorean) ? value.skipKorean : 'none',
    supertonic: {
      voice: SUPERTONIC_VOICES.has(supertonic.voice) ? supertonic.voice : 'M1',
      format: SUPERTONIC_FORMATS.has(supertonic.format) ? supertonic.format : 'wav',
      spatial: supertonic.spatial === true
    },
    fileView: {
      englishSpeed: clampNumber(fileView.englishSpeed, 0.5, 2, 1),
      koreanSpeed: clampNumber(fileView.koreanSpeed, 0.5, 2, 1),
      pauseSeconds: clampNumber(fileView.pauseSeconds, 0, 5, 0),
      highlightColor: FILEVIEW_HIGHLIGHT_COLORS.has(fileView.highlightColor)
        ? fileView.highlightColor
        : 'yellow',
      resumePositions: sanitizeResumePositions(fileView.resumePositions)
    }
  };

  localStorage.setItem('tts_speed', normalized.speed.toString());
  localStorage.setItem('selected_voice_uri', normalized.selectedVoiceURI);
  localStorage.setItem('hide_english_voices', normalized.hideEnglishVoices.toString());
  localStorage.setItem('repeat_times', normalized.repeatTimes.toString());
  localStorage.setItem('repeat_english', (normalized.repeatTimes > 1).toString());
  localStorage.setItem('skip_korean', normalized.skipKorean);
  localStorage.setItem('supertonic_voice', normalized.supertonic.voice);
  localStorage.setItem('supertonic_fmt', normalized.supertonic.format);
  localStorage.setItem('supertonic_spatial', normalized.supertonic.spatial.toString());
  localStorage.setItem('rate_en', normalized.fileView.englishSpeed.toString());
  localStorage.setItem('rate_ko', normalized.fileView.koreanSpeed.toString());
  localStorage.setItem('fileview_tts_pause_seconds', normalized.fileView.pauseSeconds.toString());
  localStorage.setItem('fileview_tts_highlight_color', normalized.fileView.highlightColor);
  localStorage.setItem('fileview_resume_positions', JSON.stringify(normalized.fileView.resumePositions));

  window.dispatchEvent(new CustomEvent(TTS_SETTINGS_SYNCED_EVENT, { detail: normalized }));
  return normalized;
}
