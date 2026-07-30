import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { useBible } from '../context/BibleContext';
import { useSettings } from '../context/SettingsContext';
import 'highlight.js/styles/github-dark.css'; // 기본 하이라이트 스타일 시트 (다크 테마)

// Marked 설정 초기화 (highlight.js 연동)
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    } else {
      return hljs.highlightAuto(code).value;
    }
  },
  breaks: true,
  gfm: true
});

// 커스텀 링크 렌더러 설정 (새 창 열기)
marked.use({
  renderer: {
    link(href, title, text) {
      return `<a target="_blank" rel="noopener noreferrer" href="${href}" title="${title || ''}">${text}</a>`;
    }
  }
});

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
const SUPERTONIC_VOICES = ['M1', 'M2', 'M3', 'M4', 'M5', 'F1', 'F2', 'F3', 'F4', 'F5'];

// 마크다운 HTML이 TTS 재생 상태 변화(isSpeaking 등)로 인해 리셋되는 것을 막기 위한 메모 컴포넌트
const MarkdownRenderer = React.memo(({ html, style, previewRef }) => {
  return (
    <div 
      ref={previewRef}
      className="preview-content markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
      style={style}
    />
  );
}, (prevProps, nextProps) => {
  return prevProps.html === nextProps.html && 
         JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style);
});

// 한글이 없고 알파벳이 있으면 영어 문장으로 판단
function isEnglishSentence(text) {
  const hangul = (text.match(/[가-힣]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return hangul === 0 && latin > 0;
}

// 프론트매터 전처리 함수
function preprocessMarkdown(markdown) {
  if (markdown.startsWith('---')) {
    const endFrontmatter = markdown.indexOf('\n---', 3);
    if (endFrontmatter !== -1) {
      const frontmatter = markdown.slice(4, endFrontmatter).trim();
      const content = markdown.slice(endFrontmatter + 4);
      const lines = frontmatter.split('\n');
      let rows = '';

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.slice(0, colonIndex).trim();
          let value = line.slice(colonIndex + 1).trim();
          if (value.startsWith('http')) {
            value = `<a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a>`;
          }
          rows += `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`;
        }
      }
      const html = `<details class="frontmatter-details" style="margin-bottom: 20px; border: 1px solid var(--border-color); padding: 10px; border-radius: 8px; background-color: var(--secondary-bg);"><summary style="cursor:pointer; font-weight: bold; padding: 4px;">메타데이터</summary><table style="width: 100%; border-collapse: collapse; margin-top: 10px;"><thead><tr style="border-bottom: 1px solid var(--border-color); text-align: left;"><th>Key</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table></details>\n\n`;
      return html + content;
    }
  }
  return markdown;
}

// 이어듣기 위치 저장/조회 (파일명이 있는 업로드 파일에 한해서만 사용)
const RESUME_STORAGE_KEY = 'fileview_resume_positions';

function loadResumePosition(fileName) {
  if (!fileName) return null;
  try {
    const map = JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || '{}');
    return map[fileName] || null;
  } catch {
    return null;
  }
}

function saveResumePosition(fileName, index, skipKoreanVal) {
  if (!fileName) return;
  try {
    const map = JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || '{}');
    map[fileName] = { index, skipKorean: skipKoreanVal };
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage 접근 실패 시 이어듣기 저장은 조용히 무시
  }
}

const initialMarkdown = `---
title: 마크다운 뷰어 데모
author: Antigravity
date: 2026-07-16
source: https://google.com
tags: [마크다운, 뷰어, 라이브]
---

# 마크다운 뷰어에 오신 것을 환영합니다

이곳은 **실시간 미리보기** 마크다운 에디터입니다.

## 헤더 데모
### 헤딩 레벨 3
#### 헤딩 레벨 4

## 기능
- **다양한 헤더 색상**을 지원하는 실시간 미리보기!
- 문법 강조 (Syntax highlighting)
- **굵은 텍스트는 금색입니다!**
- *이탤릭 텍스트는 분홍색입니다!*

\`\`\`javascript
function hello() {
  console.log("안녕하세요, 세상아!");
}
\`\`\`

> 즐거운 편집 되세요!
`;

export default function FileView() {
  const [markdown, setMarkdown] = useState(() => {
    return localStorage.getItem('pending_markdown') || initialMarkdown;
  });
  const [isEditorMode, setIsEditorMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // BibleContext로부터 전역 TTS 설정 및 상태 가져오기
  const {
    isSpeaking,
    setIsSpeaking,
    isPaused,
    setIsPaused,
    setTtsHandlers,
    ttsSpeed,
    supertonicUrl,
    supertonicVoice,
    setSupertonicVoice,
    supertonicFmt,
    supertonicToken,
    supertonicSpatial,
    repeatEnglish,
    setRepeatEnglish,
    repeatTimes,
    setRepeatTimes,
    skipKorean,
    setSkipKorean
  } = useBible();

  // SettingsContext에서 성경 전역 글씨 크기 가져오기
  const { settings } = useSettings();

  // 본문 보기 모드 state ('all': 한영 모두 보기, 'korean': 한글만 보기, 'english': 영어만 보기)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('fileview_view_mode') || 'all');

  // 보기 모드 변경 함수
  const handleViewModeChange = (newMode) => {
    setViewMode(newMode);
    localStorage.setItem('fileview_view_mode', newMode);
    if (newMode === 'korean') {
      setSkipKorean('english'); // 한글만 보기 시 자동으로 한글만 읽기(K)
    } else if (newMode === 'english') {
      setSkipKorean('korean'); // 영어만 보기 시 자동으로 영어만 읽기(E)
    }
  };
  // 업로드된 파일명 (붙여넣기/직접 입력 콘텐츠는 파일명이 없어 이어듣기 대상에서 제외)
  const [currentFileName, setCurrentFileName] = useState(() => localStorage.getItem('fileview_current_filename') || null);
  // 파일뷰 진입 후 첫 재생 여부 (첫 재생=저장된 위치로 이어듣기, 이후 재생=현재 화면 위치)
  const hasPlayedOnceRef = useRef(false);

  const [ttsSpeedEn, setTtsSpeedEn] = useState(() => parseFloat(localStorage.getItem('rate_en')) || ttsSpeed || 1.0);
  const [ttsSpeedKo, setTtsSpeedKo] = useState(() => parseFloat(localStorage.getItem('rate_ko')) || ttsSpeed || 1.0);
  const ttsSpeedEnRef = useRef(ttsSpeedEn);
  const ttsSpeedKoRef = useRef(ttsSpeedKo);

  const localSpeedTimerRef = useRef(null);

  const applyLocalSpeedChange = () => {
    clearTimeout(localSpeedTimerRef.current);
    localSpeedTimerRef.current = setTimeout(() => {
      const state = stateRef.current;
      if (state.isSpeaking && !state.isPaused && audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.removeAttribute('src');
        setTimeout(() => speakNext(state.currentIndex), 50);
      }
    }, 180);
  };

  const updateSpeedEn = (val) => {
    const nextVal = typeof val === 'function' ? val(ttsSpeedEn) : val;
    setTtsSpeedEn(nextVal);
    ttsSpeedEnRef.current = nextVal;
    localStorage.setItem('rate_en', nextVal.toString());
    applyLocalSpeedChange();
  };

  const updateSpeedKo = (val) => {
    const nextVal = typeof val === 'function' ? val(ttsSpeedKo) : val;
    setTtsSpeedKo(nextVal);
    ttsSpeedKoRef.current = nextVal;
    localStorage.setItem('rate_ko', nextVal.toString());
    applyLocalSpeedChange();
  };

  // 하단 바 배속 버튼 조절(전역 ttsSpeed) 시 파일뷰 속도(ttsSpeedEn, ttsSpeedKo) 및 오디오 playbackRate 즉시 동기화
  useEffect(() => {
    if (ttsSpeed) {
      setTtsSpeedEn(ttsSpeed);
      setTtsSpeedKo(ttsSpeed);
      ttsSpeedEnRef.current = ttsSpeed;
      ttsSpeedKoRef.current = ttsSpeed;
      localStorage.setItem('rate_en', ttsSpeed.toString());
      localStorage.setItem('rate_ko', ttsSpeed.toString());
      if (audioPlayerRef.current) {
        audioPlayerRef.current.defaultPlaybackRate = ttsSpeed;
        audioPlayerRef.current.playbackRate = ttsSpeed;
      }
    }
  }, [ttsSpeed]);

  // 속도 변경 시 현재 재생 중인 오디오에 즉시 playbackRate 반영 (혹시 모를 브라우저용)
  useEffect(() => {
    if (audioPlayerRef.current) {
      const state = stateRef.current;
      if (state.sentences && state.sentences[state.currentIndex]) {
        const currentSent = state.sentences[state.currentIndex];
        const targetSpeed = isEnglishSentence(currentSent.text) ? ttsSpeedEn : ttsSpeedKo;
        audioPlayerRef.current.defaultPlaybackRate = targetSpeed;
        audioPlayerRef.current.playbackRate = targetSpeed;
      }
    }
  }, [ttsSpeedEn, ttsSpeedKo]);

  // 내부 재생 상태
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentences, setSentences] = useState([]);
  const [sentenceIndexMap, setSentenceIndexMap] = useState([]);
  const [statusMessage, setStatusMessage] = useState('0 / 0');
  const [repeatLeft, setRepeatLeft] = useState(0);

  // Refs
  const editorRef = useRef(null);
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioPlayerRef = useRef(null);

  // 최신 상태 캡처용 Ref
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = {
      isSpeaking,
      isPaused,
      currentIndex,
      sentences,
      sentenceIndexMap,
      repeatEnglish,
      repeatTimes,
      skipKorean,
      ttsSpeedEn,
      ttsSpeedKo,
      supertonicUrl,
      supertonicVoice,
      supertonicFmt,
      supertonicToken,
      supertonicSpatial,
      currentFileName
    };
  }, [
    isSpeaking,
    isPaused,
    currentIndex,
    sentences,
    sentenceIndexMap,
    repeatEnglish,
    repeatTimes,
    skipKorean,
    ttsSpeedEn,
    ttsSpeedKo,
    supertonicUrl,
    supertonicVoice,
    supertonicFmt,
    supertonicToken,
    supertonicSpatial,
    currentFileName
  ]);

  // 클래스 변수 대체용 ref들 (재생 제어용)
  const allSentencesRef = useRef([]);
  const audioCacheRef = useRef({});
  const repeatCountLeftRef = useRef(0);
  const lastSpokenIndexRef = useRef(-1);
  const lastHighlightFlatOffsetRef = useRef(0);
  const audioUnlockedRef = useRef(false);
  const playTokenRef = useRef(0);
  const lastFetchErrorRef = useRef('');
  const lastHighlightedElementRef = useRef(null);
  const lastHighlightedOriginalHtmlRef = useRef('');

  // Audio 객체 초기화 및 전역 핸들러 연동
  useEffect(() => {
    const audio = new Audio();
    audio.setAttribute('playsinline', '');
    audioPlayerRef.current = audio;

    const handleEnded = () => {
      if ((audio.src || '').includes(SILENT_WAV.slice(-24))) return;
      const state = stateRef.current;
      if (!state.isSpeaking || state.isPaused) return;

      if (repeatCountLeftRef.current > 0) {
        repeatCountLeftRef.current--;
        speakNext();
      } else {
        const nextIdx = state.currentIndex + 1;
        setCurrentIndex(nextIdx);
        speakNext(nextIdx);
      }
    };

    const handleError = () => {
      if (audio.src && !(audio.src || '').includes(SILENT_WAV.slice(-24))) {
        console.warn('Audio playback error, auto skipping to next sentence');
        const state = stateRef.current;
        if (!state.isSpeaking || state.isPaused) return;
        const nextIdx = state.currentIndex + 1;
        setCurrentIndex(nextIdx);
        speakNext(nextIdx);
      }
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      revokeAllAudioCache();
      setTtsHandlers({});
      setIsSpeaking(false);
      setIsPaused(false);
    };
  }, [setTtsHandlers, setIsSpeaking, setIsPaused]);

  // 전역 재생 상태 변화에 맞춰 ttsHandlers 바인딩 (이 페이지가 활성 상태일 때만)
  useEffect(() => {
    if (!window.location.pathname.startsWith('/fileview')) return;

    setTtsHandlers({
      play: playTts,
      pause: pauseTts,
      resume: resumeTts,
      stop: stopTts,
      prev: prevSentence,
      next: nextSentence,
      restartFromCurrent: () => {
        const state = stateRef.current;
        if (state.isSpeaking && !state.isPaused) {
          if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.removeAttribute('src');
          }
          setTimeout(() => speakNext(state.currentIndex), 50);
        }
      }
    });
  }, [setTtsHandlers]);

  // 한글제외/영어반복 상태 변경 시 리플레이
  useEffect(() => {
    const state = stateRef.current;
    if (state.isSpeaking) {
      rebuildPlaylist(skipKorean);
    }
  }, [skipKorean, repeatEnglish, repeatTimes]);

  // marked 변환 결과 렌더링 (viewMode에 따라 화면 표시 필터링)
  const getRenderedHtml = () => {
    let processed = preprocessMarkdown(markdown);
    if (viewMode !== 'all') {
      const lines = processed.split('\n');
      const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return true; // 빈 줄이나 줄바꿈은 유지
        // 마크다운 헤더, 표, 구조적 기호는 유지
        if (trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('---') || trimmed.startsWith('```')) {
          return true;
        }
        const isEng = isEnglishSentence(trimmed);
        if (viewMode === 'korean' && isEng) return false; // 한글만 보기 시 영어 문장 필터링
        if (viewMode === 'english' && !isEng) return false; // 영어만 보기 시 한글 문장 필터링
        return true;
      });
      processed = filteredLines.join('\n');
    }
    return marked.parse(processed);
  };

  // 마크다운 편집 시 저장
  const handleEditorChange = (e) => {
    const text = e.target.value;
    setMarkdown(text);
    localStorage.setItem('pending_markdown', text);
  };

  // 파일 업로드 처리
  const handleFileUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setMarkdown(event.target.result);
      localStorage.setItem('pending_markdown', event.target.result);
      setCurrentFileName(file.name);
      localStorage.setItem('fileview_current_filename', file.name);
      hasPlayedOnceRef.current = false;
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 클립보드 텍스트 붙여넣기
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setMarkdown(text);
        localStorage.setItem('pending_markdown', text);
        setCurrentFileName(null);
        localStorage.removeItem('fileview_current_filename');
      }
    } catch (err) {
      alert("클립보드 접근 권한이 없거나 지원하지 않는 브라우저입니다.");
    }
  };

  // ----------------------------------------------------
  // TTS 핵심 비즈니스 로직 이식
  // ----------------------------------------------------

  const synthUrl = (text) => {
    const state = stateRef.current;
    return `${state.supertonicUrl}/synth?token=${encodeURIComponent(state.supertonicToken)}` +
      `&voice=${encodeURIComponent(state.supertonicVoice)}&fmt=${encodeURIComponent(state.supertonicFmt)}` +
      `${state.supertonicSpatial ? '&spatial=1' : ''}` +
      `&text=${encodeURIComponent(text)}`;
  };

  const cleanTextForTTS = (text) => {
    return text.replace(/[*#`_\[\]]/g, '').trim();
  };

  const localSplitSentences = (text) => {
    return (text.match(/[^.!?\n]+[.!?\n\s]*|[^.!?\n]+$/g) || [])
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  const splitIntoSentences = async (text) => {
    const state = stateRef.current;
    let rawChunks = [];
    try {
      const response = await fetch(`${state.supertonicUrl}/chunks?token=${encodeURIComponent(state.supertonicToken)}&text=${encodeURIComponent(text)}`);
      if (response.ok) {
        const chunks = await response.json();
        if (Array.isArray(chunks) && chunks.length > 0) rawChunks = chunks;
      }
    } catch (e) {
      console.warn('서버 문장 분리 실패, 로컬 분리 사용', e);
    }
    if (rawChunks.length === 0) {
      rawChunks = localSplitSentences(text);
    }

    const playlistWithOffsets = [];
    let currentOffset = 0;
    for (const chunk of rawChunks) {
      const cleanChunk = chunk.trim();
      if (!cleanChunk) continue;
      const idx = text.indexOf(cleanChunk, currentOffset);
      if (idx !== -1) {
        playlistWithOffsets.push({
          text: chunk,
          start: idx,
          end: idx + cleanChunk.length
        });
        currentOffset = idx + cleanChunk.length;
      } else {
        playlistWithOffsets.push({
          text: chunk,
          start: currentOffset,
          end: currentOffset + cleanChunk.length
        });
        currentOffset += chunk.length;
      }
    }
    return playlistWithOffsets;
  };

  const fetchAudioWithRetry = async (text, index, delays = [500, 1000, 2000, 4000]) => {
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const response = await fetch(synthUrl(text));
        if (response.ok) {
          const blob = await response.blob();
          return URL.createObjectURL(blob);
        }
        lastFetchErrorRef.current = `HTTP ${response.status}`;
      } catch (e) {
        lastFetchErrorRef.current = e?.message || '네트워크 오류';
      }
      if (attempt < delays.length) {
        const state = stateRef.current;
        if (index === state.currentIndex) {
          setStatusMessage(`재시도 중... (${attempt + 1}/${delays.length})`);
        }
        await new Promise(res => setTimeout(res, delays[attempt]));
      }
    }
    return null;
  };

  const prefetch = (index) => {
    const state = stateRef.current;
    if (index < 0 || index >= state.sentences.length) return;
    if (audioCacheRef.current[index]) return;

    const sentenceObj = state.sentences[index];
    if (!sentenceObj) return;
    const text = cleanTextForTTS(sentenceObj.text);
    if (!text) {
      audioCacheRef.current[index] = Promise.resolve(null);
      return;
    }
    audioCacheRef.current[index] = fetchAudioWithRetry(text, index);
  };

  const trimAudioCache = (currentIdx, keepBehind = 2) => {
    Object.keys(audioCacheRef.current).forEach(key => {
      const idx = parseInt(key, 10);
      if (idx < currentIdx - keepBehind) {
        Promise.resolve(audioCacheRef.current[idx]).then(url => url && URL.revokeObjectURL(url));
        delete audioCacheRef.current[idx];
      }
    });
  };

  const revokeAllAudioCache = () => {
    Object.values(audioCacheRef.current).forEach(promise => {
      Promise.resolve(promise).then(url => url && URL.revokeObjectURL(url));
    });
    audioCacheRef.current = {};
  };

  const findResumeIndexForViewport = (playlist) => {
    const container = previewRef.current;
    if (!container) return 0;
    const containerRect = container.getBoundingClientRect();
    
    // 뷰포트 내의 위치를 기반으로 현재 보고 있는 첫 문단의 인덱스를 찾음
    const blockCandidates = container.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, pre');
    
    let visibleBlock = null;
    for (const el of blockCandidates) {
      const rect = el.getBoundingClientRect();
      // 뷰포트 상단 부근에 위치한 블록 검출
      if (rect.top >= containerRect.top && rect.top < containerRect.top + 150) {
        visibleBlock = el;
        break;
      }
    }

    if (visibleBlock) {
      const elText = (visibleBlock.innerText || visibleBlock.textContent || '').trim();
      const foundIdx = playlist.findIndex(item => elText.includes(item.text.trim()));
      if (foundIdx !== -1) return foundIdx;
    }
    return 0;
  };

  const highlightSentence = (index) => {
    // 1. 이전 강조 요소 HTML 복원 및 클래스 제거
    if (lastHighlightedElementRef.current && lastHighlightedOriginalHtmlRef.current) {
      try {
        lastHighlightedElementRef.current.innerHTML = lastHighlightedOriginalHtmlRef.current;
      } catch (e) {
        console.warn('이전 HTML 복원 실패:', e);
      }
      lastHighlightedElementRef.current.classList.remove('tts-highlight');
      lastHighlightedElementRef.current = null;
      lastHighlightedOriginalHtmlRef.current = '';
    }

    const highlights = document.querySelectorAll('.tts-highlight, .tts-highlight-inline');
    highlights.forEach(el => {
      el.classList.remove('tts-highlight', 'tts-highlight-inline');
    });

    const state = stateRef.current;
    if (index < 0 || index >= state.sentences.length) return;
    const sentenceObj = state.sentences[index];
    if (!sentenceObj || !previewRef.current) return;

    const cleanText = sentenceObj.text.trim();
    if (!cleanText) return;

    // 2. 블록 후보 엘리먼트 추출
    const blockCandidates = previewRef.current.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, pre');
    
    let targetBlock = null;
    
    // 3. 텍스트 완전/포함 일치 매칭 (100% 매칭 보장)
    for (const el of blockCandidates) {
      const elText = (el.innerText || el.textContent || '').trim();
      if (elText.includes(cleanText)) {
        targetBlock = el;
        break;
      }
    }

    // 4. 부분 키워드 일치 폴백 (마크다운 파싱 시 줄바꿈/태그 쪼개짐 대응)
    if (!targetBlock) {
      const keyword = cleanText.slice(0, 12);
      if (keyword.length >= 4) {
        for (const el of blockCandidates) {
          const elText = (el.innerText || el.textContent || '').trim();
          if (elText.includes(keyword)) {
            targetBlock = el;
            break;
          }
        }
      }
    }

    // 5. 하이라이트 부여 및 부드러운 스크롤
    if (targetBlock) {
      // 낭독 텍스트 영역만 정확히 감싸기 위한 인라인 치환 강조 적용
      lastHighlightedElementRef.current = targetBlock;
      lastHighlightedOriginalHtmlRef.current = targetBlock.innerHTML;

      // 특수문자 이스케이프 후 텍스트만 span으로 감싸 치환
      const escapedText = cleanText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      try {
        const regex = new RegExp(`(${escapedText})`, 'i');
        if (regex.test(targetBlock.innerHTML)) {
          targetBlock.innerHTML = targetBlock.innerHTML.replace(regex, '<span class="tts-highlight-inline">$1</span>');
        } else {
          targetBlock.classList.add('tts-highlight');
        }
      } catch (err) {
        targetBlock.classList.add('tts-highlight');
      }

      // window 전체 스크롤을 유발하지 않기 위해 preview-content 컨테이너만 자체 스크롤 조정
      const container = previewRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const elemRect = targetBlock.getBoundingClientRect();
        const relativeTop = elemRect.top - containerRect.top + container.scrollTop;
        const targetScrollTop = relativeTop - (containerRect.height / 2) + (elemRect.height / 2);
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      }
    }
  };

  // ----------------------------------------------------
  // 재생 제어 로직 (Global 플레이어 연동)
  // ----------------------------------------------------

  const unlockAudio = () => {
    if (audioUnlockedRef.current || !audioPlayerRef.current) return;
    audioPlayerRef.current.src = SILENT_WAV;
    const playPromise = audioPlayerRef.current.play();
    if (playPromise && playPromise.then) {
      playPromise.then(() => { audioUnlockedRef.current = true; }).catch(() => {});
    } else {
      audioUnlockedRef.current = true;
    }
  };

  const playTts = async () => {
    const state = stateRef.current;
    if (state.isPaused) {
      resumeTts();
      return;
    }
    if (state.isSpeaking) return;

    setIsEditorMode(false);
    stopTts();
    unlockAudio();

    setStatusMessage('분석 중...');

    // 파일뷰 진입 후 첫 재생이고, 이 파일에 저장된 이어듣기 기록이 있으면 그 지점(필터 포함)으로 시작
    const isFirstPlay = !hasPlayedOnceRef.current;
    hasPlayedOnceRef.current = true;
    const savedPosition = isFirstPlay ? loadResumePosition(state.currentFileName) : null;
    const effectiveSkipKorean = savedPosition ? savedPosition.skipKorean : state.skipKorean;
    if (savedPosition && effectiveSkipKorean !== state.skipKorean) {
      setSkipKorean(effectiveSkipKorean);
    }

    setTimeout(async () => {
      if (!previewRef.current) return;
      const textContent = previewRef.current.innerText || previewRef.current.textContent;

      const allSents = await splitIntoSentences(textContent);
      allSentencesRef.current = allSents;

      let playlist = [];
      let idxMap = [];
      if (effectiveSkipKorean === 'korean') {
        allSents.forEach((s, i) => {
          if (isEnglishSentence(s.text)) {
            playlist.push(s);
            idxMap.push(i);
          }
        });
      } else if (effectiveSkipKorean === 'english') {
        allSents.forEach((s, i) => {
          if (!isEnglishSentence(s.text)) {
            playlist.push(s);
            idxMap.push(i);
          }
        });
      } else {
        playlist = allSents.slice();
        idxMap = allSents.map((_, i) => i);
      }

      setSentences(playlist);
      setSentenceIndexMap(idxMap);

      if (playlist.length === 0) {
        setStatusMessage(
          effectiveSkipKorean === 'korean' ? '영어 문장 없음' :
          effectiveSkipKorean === 'english' ? '한글 문장 없음' : '0'
        );
        return;
      }

      audioCacheRef.current = {};
      const resumeIndex = (savedPosition && savedPosition.index >= 0 && savedPosition.index < playlist.length)
        ? savedPosition.index
        : findResumeIndexForViewport(playlist);

      setCurrentIndex(resumeIndex);
      repeatCountLeftRef.current = 0;
      lastSpokenIndexRef.current = -1;
      setIsSpeaking(true);
      setIsPaused(true);

      highlightSentence(resumeIndex);
      setStatusMessage(`${resumeIndex + 1} : ${playlist.length}`);
    }, 150);
  };

  const speakNext = async (indexToSpeak = null, currentPlaylist = null) => {
    if (!audioPlayerRef.current) return;
    const state = stateRef.current;
    const playlist = currentPlaylist || state.sentences;
    const index = indexToSpeak !== null ? indexToSpeak : state.currentIndex;

    playTokenRef.current = (playTokenRef.current || 0) + 1;
    const currentToken = playTokenRef.current;

    if (index >= playlist.length) {
      if (state.skipKorean !== 'none' && playlist.length > 0) {
        setCurrentIndex(0);
        speakNext(0, playlist);
      } else {
        stopTts();
      }
      return;
    }

    const sentenceObj = playlist[index];
    if (!sentenceObj || !cleanTextForTTS(sentenceObj.text)) {
      const nextIdx = index + 1;
      setCurrentIndex(nextIdx);
      speakNext(nextIdx, playlist);
      return;
    }

    trimAudioCache(index);

    // 동일 인덱스를 다시 재생(반복)하거나 이전 인덱스로 되돌아가는 경우 검색 시작 오프셋을 리셋
    if (index <= lastSpokenIndexRef.current) {
      lastHighlightFlatOffsetRef.current = 0;
    }

    if (index !== lastSpokenIndexRef.current) {
      const leftCount = (state.repeatTimes > 0 && isEnglishSentence(sentenceObj.text)) ? state.repeatTimes : 0;
      repeatCountLeftRef.current = leftCount;
      setRepeatLeft(leftCount);
      lastSpokenIndexRef.current = index;
      saveResumePosition(state.currentFileName, index, state.skipKorean);
    } else {
      setRepeatLeft(repeatCountLeftRef.current);
    }

    highlightSentence(index);
    setStatusMessage(`${index + 1} : ${playlist.length}`);

    prefetch(index);
    prefetch(index + 1);

    try {
      const src = await audioCacheRef.current[index];
      if (currentToken !== playTokenRef.current || !audioPlayerRef.current) return;
      if (!src) throw new Error('음성 합성 실패');

      audioPlayerRef.current.src = src;
      // 영어 문장인지 여부에 따라 조절된 배속 부여
      const targetSpeed = isEnglishSentence(sentenceObj.text) ? ttsSpeedEnRef.current : ttsSpeedKoRef.current;
      audioPlayerRef.current.defaultPlaybackRate = targetSpeed;
      audioPlayerRef.current.playbackRate = targetSpeed;
      
      try {
        await audioPlayerRef.current.play();
        // 확실히 재생된 후 한 번 더 배속 반영 (Safari 등 일부 브라우저 문제 해결용)
        audioPlayerRef.current.playbackRate = targetSpeed;
      } catch (e) {
        throw e;
      }
      
      if (currentToken !== playTokenRef.current) return;
      prefetch(index + 1);
      prefetch(index + 2);
    } catch (e) {
      if (currentToken !== playTokenRef.current || e?.name === 'AbortError') return;
      console.warn('TTS Error for sentence', index, 'skipping to next:', e, lastFetchErrorRef.current);
      const nextIdx = index + 1;
      if (nextIdx < playlist.length) {
        setCurrentIndex(nextIdx);
        speakNext(nextIdx, playlist);
      } else {
        stopTts();
      }
    }
  };

  const pauseTts = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeTts = () => {
    if (audioPlayerRef.current) {
      const src = audioPlayerRef.current.src || '';
      if (!src || src.includes(SILENT_WAV.slice(-24))) {
        setIsPaused(false);
        speakNext(stateRef.current.currentIndex);
      } else {
        audioPlayerRef.current.play().catch(e => console.error(e));
        setIsPaused(false);
      }
    }
  };

  const stopTts = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.removeAttribute('src');
    }
    revokeAllAudioCache();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentIndex(0);
    lastHighlightFlatOffsetRef.current = 0;
    
    if (lastHighlightedElementRef.current && lastHighlightedOriginalHtmlRef.current) {
      try {
        lastHighlightedElementRef.current.innerHTML = lastHighlightedOriginalHtmlRef.current;
      } catch (e) {}
      lastHighlightedElementRef.current.classList.remove('tts-highlight');
      lastHighlightedElementRef.current = null;
      lastHighlightedOriginalHtmlRef.current = '';
    }
    
    highlightSentence(null);
    setStatusMessage('0');
  };

  const nextSentence = () => {
    const state = stateRef.current;
    if (!state.isSpeaking || state.sentences.length === 0) return;
    if (audioPlayerRef.current) audioPlayerRef.current.pause();

    let nextIdx = state.currentIndex;
    if (state.currentIndex < state.sentences.length - 1) {
      nextIdx = state.currentIndex + 1;
    } else if (state.skipKorean !== 'none') {
      nextIdx = 0;
    } else {
      stopTts();
      return;
    }
    
    setCurrentIndex(nextIdx);
    setIsPaused(false);
    speakNext(nextIdx, state.sentences);
  };

  const prevSentence = () => {
    const state = stateRef.current;
    if (!state.isSpeaking || state.sentences.length === 0) return;
    if (audioPlayerRef.current) audioPlayerRef.current.pause();

    let prevIdx = state.currentIndex;
    if (state.currentIndex > 0) {
      prevIdx = state.currentIndex - 1;
    }
    
    lastHighlightFlatOffsetRef.current = 0;
    setCurrentIndex(prevIdx);
    setIsPaused(false);
    speakNext(prevIdx, state.sentences);
  };

  // 플레이리스트 동적 갱신
  const rebuildPlaylist = (newSkipKorean) => {
    if (allSentencesRef.current.length === 0) return;
    const state = stateRef.current;
    const globalIndex = state.sentenceIndexMap[state.currentIndex] ?? 0;
    
    let playlist = [];
    let idxMap = [];
    if (newSkipKorean === 'korean') {
      allSentencesRef.current.forEach((s, i) => {
        if (isEnglishSentence(s.text)) {
          playlist.push(s);
          idxMap.push(i);
        }
      });
    } else if (newSkipKorean === 'english') {
      allSentencesRef.current.forEach((s, i) => {
        if (!isEnglishSentence(s.text)) {
          playlist.push(s);
          idxMap.push(i);
        }
      });
    } else {
      playlist = allSentencesRef.current.slice();
      idxMap = allSentencesRef.current.map((_, i) => i);
    }
    
    setSentences(playlist);
    setSentenceIndexMap(idxMap);
    audioCacheRef.current = {};
    repeatCountLeftRef.current = 0;
    lastSpokenIndexRef.current = -1;

    let newIndex = idxMap.findIndex(gi => gi >= globalIndex);
    if (newIndex === -1) newIndex = Math.max(0, playlist.length - 1);
    setCurrentIndex(newIndex);

    if (state.isSpeaking) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      if (playlist.length === 0) {
        setStatusMessage(
          newSkipKorean === 'korean' ? '영어 문장 없음' : 
          newSkipKorean === 'english' ? '한글 문장 없음' : '0'
        );
        stopTts();
        return;
      }
      setIsPaused(false);
      speakNext(newIndex, playlist);
    } else {
      setStatusMessage(`${newIndex + 1} : ${playlist.length}`);
    }
  };

  // 진행률 문자열 구성
  const getProgressString = () => {
    if (sentences.length === 0) return '0';
    if (isSpeaking) {
      return `${currentIndex + 1} : ${sentences.length}`;
    }
    return `${sentences.length}`;
  };

  // 설정 초기화 (↻ 클릭 시)
  const handleResetSettings = () => {
    setTtsSpeedEn(1.0);
    setTtsSpeedKo(1.0);
    localStorage.setItem('rate_en', '1.0');
    localStorage.setItem('rate_ko', '1.0');
    setSkipKorean('none');
    handleViewModeChange('all');
    setRepeatTimes(0);
  };

  const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';

  return (
    <div className="fileview-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 108px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-color)',
      overflow: 'hidden'
    }}>
      <style>{`
        /* 마크다운 뷰어 내장 CSS 스타일 */
        .fileview-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          padding-top: calc(8px + env(safe-area-inset-top, 0px));
          border-bottom: 1px solid var(--border-color);
          background-color: var(--secondary-bg);
          gap: 10px;
          flex-shrink: 0;
        }
        .toolbar-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .toolbar-icon-btn {
          background-color: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          width: 36px;
          height: 36px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .toolbar-icon-btn:hover {
          background-color: var(--border-color);
          color: var(--text-color);
        }
        .toolbar-icon-btn.active {
          background-color: var(--primary-color);
          color: #fff;
          border-color: var(--primary-color);
        }
        .fileview-content {
          display: flex;
          flex: 1;
          overflow: hidden;
          position: relative;
        }
        .editor-pane, .preview-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .editor-textarea {
          width: 100%;
          height: 100%;
          border: none;
          padding: 20px;
          resize: none;
          outline: none;
          font-family: monospace;
          font-size: 15px;
          background-color: var(--secondary-bg);
          color: var(--text-color);
          line-height: 1.6;
        }
        .preview-content {
          padding: 20px;
          overflow-y: auto;
          height: 100%;
          line-height: 1.7;
          word-break: break-word;
          font-family: var(--serif-font), serif;
        }
        .preview-content a {
          color: var(--primary-color);
          text-decoration: none;
          border-bottom: 1px dashed var(--primary-color);
        }
        .preview-content h1, .preview-content h2, .preview-content h3 {
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          font-weight: 700;
          line-height: 1.3;
          color: var(--primary-color);
        }
        .preview-content h1 { font-size: 1.8rem; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; }
        .preview-content h2 { font-size: 1.5rem; }
        .preview-content h3 { font-size: 1.25rem; }
        .preview-content strong {
          color: var(--accent-soft, #C08A4E);
        }
        .preview-content em {
          font-style: italic;
          opacity: 0.9;
        }
        .preview-content blockquote {
          margin: 1.5em 0;
          padding: 8px 20px;
          border-left: 4px solid var(--primary-color);
          background-color: var(--secondary-bg);
          color: var(--text-muted);
          border-radius: 0 8px 8px 0;
        }
        .preview-content pre {
          background-color: #1e1e24;
          padding: 14px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1.5em 0;
          border: 1px solid var(--border-color);
        }
        .preview-content code {
          font-family: monospace;
          background-color: rgba(0,0,0,0.06);
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 0.9em;
        }
        ${isDarkTheme ? '.preview-content code { background-color: rgba(255,255,255,0.08); }' : ''}
        .preview-content pre code {
          background-color: transparent;
          padding: 0;
          color: #e6e8ec;
        }
        .preview-content ul, .preview-content ol {
          padding-left: 24px;
          margin: 1em 0;
        }
        .preview-content li {
          margin-bottom: 0.5em;
        }
        .preview-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5em 0;
        }
        .preview-content th, .preview-content td {
          border: 1px solid var(--border-color);
          padding: 8px 12px;
          text-align: left;
        }
        .preview-content th {
          background-color: var(--secondary-bg);
          font-weight: bold;
        }
        
        ${viewMode === 'korean' ? '.preview-content .view-hide-korean { display: none !important; }' : ''}
        ${viewMode === 'english' ? '.preview-content .view-hide-english { display: none !important; }' : ''}

        /* 읽기 설정 모달 CSS */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 30000;
        }
        .settings-modal {
          background-color: #151821; /* 스크린샷 톤의 짙은 네이비/블랙 배경 */
          color: #f0ebe0;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          width: 90%;
          max-width: 420px;
          padding: 24px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.5);
          font-family: var(--font-family);
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .modal-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .modal-title {
          font-size: 1.2rem;
          font-weight: bold;
          margin: 0;
        }
        .reset-icon-btn {
          background: none;
          border: none;
          color: #8b92a3;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .reset-icon-btn:hover {
          color: #f0ebe0;
        }
        .close-icon-btn {
          background: none;
          border: none;
          color: #8b92a3;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .close-icon-btn:hover {
          color: #f0ebe0;
        }
        .settings-section-title {
          font-size: 0.82rem;
          font-weight: 600;
          color: #6c7385; /* 진회색의 카테고리 타이틀 */
          margin-top: 0px;
          margin-bottom: 16px;
          letter-spacing: 0.5px;
        }
        .settings-item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .settings-item-label {
          font-size: 0.95rem;
          font-weight: 500;
          color: #e2e8f0;
        }
        
        /* Stepper Control [ -  Value  + ] */
        .stepper-control {
          display: flex;
          align-items: center;
          background-color: #20242e; /* 버튼 배경 */
          border-radius: 20px;
          padding: 2px 4px;
        }
        .stepper-btn {
          background: none;
          border: none;
          color: #8b92a3;
          width: 32px;
          height: 32px;
          font-size: 1.1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .stepper-btn:hover {
          color: #f0ebe0;
        }
        .stepper-value {
          min-width: 56px;
          text-align: center;
          font-family: monospace;
          font-size: 0.95rem;
          font-weight: bold;
          color: #79a1eb; /* 보라/하늘색 텍스트 톤 */
        }
        
        /* iOS 스타일 토글 스위치 */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 46px;
          height: 26px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #2f3442;
          transition: .25s;
          border-radius: 34px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .25s;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        input:checked + .toggle-slider {
          background-color: #79a1eb; /* 스크린샷 상의 연보라/하늘색 톤 */
        }
        input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        /* Mobile layout toggle */
        @media (max-width: 767px) {
          .editor-pane {
            display: ${isEditorMode ? 'flex' : 'none'};
          }
          .preview-pane {
            display: ${!isEditorMode ? 'flex' : 'none'};
          }
          .md-only {
            display: flex !important;
          }
          .md-hide {
            display: none !important;
          }
        }
        @media (min-width: 768px) {
          .editor-pane {
            display: ${isEditorMode ? 'flex' : 'none'};
          }
          .preview-pane {
            display: ${!isEditorMode ? 'flex' : 'none'};
          }
        }
      `}</style>

      {/* 1. 상단 툴바 */}
      <div className="fileview-toolbar">
        <div className="toolbar-group">
          {/* 파일열기 (아이콘화) */}
          <button className="toolbar-icon-btn" onClick={handleFileUploadClick} title="파일 열기">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              <path d="M2 10h20"/>
            </svg>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".md,.txt,.markdown" 
            style={{ display: 'none' }} 
          />

          {/* 붙여넣기 (아이콘화) */}
          <button className="toolbar-icon-btn" onClick={handlePasteFromClipboard} title="붙여넣기">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>

          {/* 모바일/PC 겸용 편집/미리보기 모드 토글 (아이콘화) */}
          <button 
            className="toolbar-icon-btn"
            onClick={() => setIsEditorMode(prev => !prev)}
            title={isEditorMode ? '미리보기 보기' : '편집기 보기'}
          >
            {isEditorMode ? (
              // 미리보기 (눈 아이콘)
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              // 편집기 (연필 아이콘)
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
            )}
          </button>
        </div>

        {/* 중앙 진행률 표시 */}
        <div className="toolbar-group" style={{ 
          fontSize: '0.8rem', 
          fontWeight: 'bold', 
          color: 'var(--primary-color)',
          fontFamily: 'monospace',
          backgroundColor: 'var(--border-color)',
          padding: '4px 12px',
          borderRadius: '999px'
        }}>
          {getProgressString()}
        </div>

        <div className="toolbar-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* 한글 또는 영어 제외 버튼 */}
          <button 
            className="toolbar-icon-btn" 
            onClick={() => {
              setSkipKorean(current => {
                if (current === 'none') return 'korean';
                if (current === 'korean') return 'english';
                return 'none';
              });
            }}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-color)',
              border: '1px solid var(--border-color)',
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            title={
              skipKorean === 'none' ? '모두 읽기 (KE)' :
              skipKorean === 'korean' ? '한글 건너뛰기 (영어만 읽기 - E)' : '영어 건너뛰기 (한글만 읽기 - K)'
            }
          >
            {skipKorean === 'none' && 'KE'}
            {skipKorean === 'korean' && 'E'}
            {skipKorean === 'english' && 'K'}
          </button>

          {/* 영어 반복 횟수 설정 드롭박스 및 남은 횟수 표시 */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select 
              value={repeatTimes} 
              onChange={(e) => setRepeatTimes(parseInt(e.target.value, 10))}
              style={{
                width: '36px',
                height: '36px',
                minWidth: '36px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-color)',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                outline: 'none',
                cursor: 'pointer',
                textAlign: 'center',
                appearance: 'none',
                textAlignLast: 'center',
                padding: '0'
              }}
              title="영어 반복 횟수"
            >
              {Array.from({ length: 11 }, (_, i) => (
                <option key={i} value={i}>{i === 0 ? '0' : i}</option>
              ))}
            </select>
            {isSpeaking && repeatLeft > 0 && (
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: 'var(--secondary-bg)',
                border: '1px solid var(--border-color)',
                color: '#8b92a3',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                fontSize: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                pointerEvents: 'none'
              }}>
                {repeatLeft}
              </div>
            )}
          </div>

          {/* 목소리 설정 드롭박스 */}
          <select 
            value={supertonicVoice} 
            onChange={(e) => {
              setSupertonicVoice(e.target.value);
              audioCacheRef.current = {};
            }}
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              padding: '0',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              color: 'var(--text-color)',
              fontSize: '0.7rem',
              outline: 'none',
              cursor: 'pointer',
              textAlign: 'center',
              appearance: 'none',
              textAlignLast: 'center'
            }}
            title="목소리 선택"
          >
            {SUPERTONIC_VOICES.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          {/* 설정 (아이콘화) */}
          <button className="toolbar-icon-btn" onClick={() => setShowSettings(true)} title="읽기 설정">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 2. 에디터 / 미리보기 본문 영역 (SettingsContext 연동) */}
      <div className="fileview-content">
        <div className="editor-pane">
          <textarea
            ref={editorRef}
            className="editor-textarea"
            placeholder="마크다운 텍스트를 입력하거나 붙여넣기 해보세요..."
            value={markdown}
            onChange={handleEditorChange}
            style={{ 
              fontSize: `${settings.fontSize}px`,
              fontWeight: settings.fontWeight,
              lineHeight: settings.lineHeight,
              fontFamily: settings.fontFamily !== 'System Default' ? settings.fontFamily : 'inherit'
            }}
          />
        </div>
        <div className="preview-pane">
          <MarkdownRenderer 
            previewRef={previewRef}
            html={getRenderedHtml()}
            style={{ 
              fontSize: `${settings.fontSize}px`,
              fontWeight: settings.fontWeight,
              lineHeight: settings.lineHeight,
              paddingLeft: `${settings.horizontalPadding}rem`,
              paddingRight: `${settings.horizontalPadding}rem`,
              fontFamily: settings.fontFamily !== 'System Default' ? settings.fontFamily : 'inherit'
            }}
          />
        </div>
      </div>

      {/* 3. 읽기 설정 모달 팝업 (스크린샷 매칭 디자인) */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-title">읽기 설정</span>
                <button className="reset-icon-btn" onClick={handleResetSettings} title="설정 초기화">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                </button>
              </div>
              <button className="close-icon-btn" onClick={() => setShowSettings(false)} title="닫기">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* 재생 속도 섹션 */}
            <div className="settings-section-title">재생 속도</div>

            <div className="settings-item-row">
              <span className="settings-item-label">EN 문장</span>
              <div className="stepper-control">
                <button className="stepper-btn" onClick={() => updateSpeedEn(v => Math.max(0.5, parseFloat((v - 0.05).toFixed(2))))}>-</button>
                <span className="stepper-value">{ttsSpeedEn.toFixed(2)}</span>
                <button className="stepper-btn" onClick={() => updateSpeedEn(v => Math.min(2.0, parseFloat((v + 0.05).toFixed(2))))}>+</button>
              </div>
            </div>

            <div className="settings-item-row" style={{ marginBottom: '30px' }}>
              <span className="settings-item-label">KR 문장</span>
              <div className="stepper-control">
                <button className="stepper-btn" onClick={() => updateSpeedKo(v => Math.max(0.5, parseFloat((v - 0.05).toFixed(2))))}>-</button>
                <span className="stepper-value">{ttsSpeedKo.toFixed(2)}</span>
                <button className="stepper-btn" onClick={() => updateSpeedKo(v => Math.min(2.0, parseFloat((v + 0.05).toFixed(2))))}>+</button>
              </div>
            </div>

            {/* 본문 화면 표시 및 읽기 설정 섹션 */}
            <div className="settings-item-row">
              <span className="settings-item-label">본문 화면 표시</span>
              <select
                value={viewMode}
                onChange={(e) => handleViewModeChange(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--secondary-bg)',
                  color: 'var(--text-color)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">한영 모두 보기</option>
                <option value="korean">한글만 보기</option>
                <option value="english">영어만 보기</option>
              </select>
            </div>

            <div className="settings-item-row">
              <span className="settings-item-label">음성 읽기 설정</span>
              <select
                value={skipKorean}
                onChange={(e) => setSkipKorean(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--secondary-bg)',
                  color: 'var(--text-color)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="none">한영 모두 읽기 (KE)</option>
                <option value="english">한글만 읽기 (K)</option>
                <option value="korean">영어만 읽기 (E)</option>
              </select>
            </div>

            <div className="settings-item-row">
              <span className="settings-item-label">영어 문장 반복</span>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={repeatTimes > 0}
                  onChange={(e) => setRepeatTimes(e.target.checked ? 1 : 0)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-item-row" style={{ marginTop: '24px' }}>
              <span className="settings-item-label">문장당 반복 횟수</span>
              <div className="stepper-control">
                <button className="stepper-btn" onClick={() => setRepeatTimes(v => Math.max(0, v - 1))}>-</button>
                <span className="stepper-value" style={{ color: '#79a1eb' }}>
                  {repeatTimes === 0 ? '반복 없음' : `${repeatTimes}회`}
                </span>
                <button className="stepper-btn" onClick={() => setRepeatTimes(v => Math.min(10, v + 1))}>+</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
