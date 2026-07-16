import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
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

// TTS 기본 서버 설정
const DEFAULT_SERVER_URL = window.location.protocol === 'https:'
  ? 'https://roy-macbookair.tailf4ccb7.ts.net'
  : 'http://royui-macbookair.local:8080';

const SUPERTONIC_VOICES = ['M1', 'M2', 'M3', 'M4', 'M5', 'F1', 'F2', 'F3', 'F4', 'F5'];
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

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
  const [isCopied, setIsCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // TTS 관련 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentences, setSentences] = useState([]);
  const [sentenceIndexMap, setSentenceIndexMap] = useState([]);
  const [ttsSpeedEn, setTtsSpeedEn] = useState(() => parseFloat(localStorage.getItem('rate_en')) || 1.0);
  const [ttsSpeedKo, setTtsSpeedKo] = useState(() => parseFloat(localStorage.getItem('rate_ko')) || 1.0);
  const [repeatEnglish, setRepeatEnglish] = useState(() => localStorage.getItem('repeat_english') === 'true');
  const [repeatTimes, setRepeatTimes] = useState(() => Math.max(1, parseInt(localStorage.getItem('repeat_times'), 10) || 2));
  const [skipKorean, setSkipKorean] = useState(() => localStorage.getItem('skip_korean') === 'true');
  const [spatialAudio, setSpatialAudio] = useState(() => localStorage.getItem('spatial_audio') === 'true');
  const [wholeAudioMode, setWholeAudioMode] = useState(() => localStorage.getItem('whole_audio_mode') === 'true');
  const [voice, setVoice] = useState(() => localStorage.getItem('supertonic_voice') || 'M1');
  const [fmt, setFmt] = useState(() => localStorage.getItem('supertonic_fmt') || 'wav');
  const [textSize, setTextSize] = useState(() => parseInt(localStorage.getItem('preview_text_size'), 10) || 100);
  const [serverUrl, setServerUrl] = useState(() => (localStorage.getItem('supertonic_url') || DEFAULT_SERVER_URL).replace(/\/$/, ''));
  const [token, setToken] = useState(() => localStorage.getItem('supertonic_token') || '');
  const [statusMessage, setStatusMessage] = useState('');

  // Refs
  const editorRef = useRef(null);
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioPlayerRef = useRef(null);

  // 클래스 변수 대체용 ref들 (재생 제어용)
  const allSentencesRef = useRef([]);
  const audioCacheRef = useRef({});
  const repeatCountLeftRef = useRef(0);
  const lastSpokenIndexRef = useRef(-1);
  const lastHighlightFlatOffsetRef = useRef(0);
  const audioUnlockedRef = useRef(false);
  const playTokenRef = useRef(0);
  const wholeAudioActiveRef = useRef(false);
  const lastFetchErrorRef = useRef('');
  const sentencesRef = useRef([]); // state 동기화용 ref
  const currentIndexRef = useRef(0); // state 동기화용 ref

  // Refs 동기화
  useEffect(() => {
    sentencesRef.current = sentences;
  }, [sentences]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Audio 객체 초기화 및 이벤트 리스너 등록
  useEffect(() => {
    const audio = new Audio();
    audioPlayerRef.current = audio;

    const handleEnded = () => {
      if ((audio.src || '').includes(SILENT_WAV.slice(-24))) return;
      if (!isPlaying || isPaused) return;

      if (wholeAudioActiveRef.current) {
        stopTts();
        return;
      }

      if (repeatEnglish && repeatCountLeftRef.current > 0) {
        repeatCountLeftRef.current--;
        speakNext();
      } else {
        const nextIdx = currentIndexRef.current + 1;
        setCurrentIndex(nextIdx);
        speakNext(nextIdx);
      }
    };

    const handleError = () => {
      if (audio.src) {
        console.error('Audio playback error');
        stopTts();
      }
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // 복원할 읽기 위치 복구
    const pendingResumeIndex = localStorage.getItem('pending_resume_index');
    if (pendingResumeIndex !== null) {
      localStorage.removeItem('pending_resume_index');
      const idx = parseInt(pendingResumeIndex, 10);
      // 복원 텍스트 기준 세팅
      setTimeout(() => {
        if (previewRef.current) {
          const previewText = previewRef.current.innerText || previewRef.current.textContent;
          const localSents = localSplitSentences(previewText);
          const localPlaylist = skipKorean ? localSents.filter(isEnglishSentence) : localSents;
          if (idx < localPlaylist.length) {
            setSentences(localPlaylist);
            setCurrentIndex(idx);
            highlightSentence(localPlaylist[idx]);
          }
        }
      }, 300);
    }

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      revokeAllAudioCache();
    };
  }, [isPlaying, isPaused, repeatEnglish, skipKorean]);

  // 글씨 크기 스타일 적용
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.style.fontSize = `${textSize}%`;
    }
  }, [textSize]);

  // marked 변환 결과 렌더링
  const getRenderedHtml = () => {
    const processed = preprocessMarkdown(markdown);
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
    };
    reader.readAsText(file);
    e.target.value = ''; // 초기화
  };

  // 클립보드에 HTML 복사
  const handleCopyToClipboard = () => {
    const processed = preprocessMarkdown(markdown);
    const htmlContent = marked.parse(processed);
    navigator.clipboard.writeText(htmlContent).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // 설정 저장
  const handleSaveSettings = (urlInput, tokenInput) => {
    const formattedUrl = urlInput.trim().replace(/\/$/, '');
    setServerUrl(formattedUrl);
    setToken(tokenInput.trim());
    localStorage.setItem('supertonic_url', formattedUrl);
    localStorage.setItem('supertonic_token', tokenInput.trim());
    audioCacheRef.current = {};
    setShowSettings(false);
  };

  // ----------------------------------------------------
  // TTS 핵심 비즈니스 로직 이식
  // ----------------------------------------------------

  const synthUrl = (text) => {
    return `${serverUrl}/synth?token=${encodeURIComponent(token)}` +
      `&voice=${encodeURIComponent(voice)}&fmt=${encodeURIComponent(fmt)}` +
      `${spatialAudio ? '&spatial=1' : ''}` +
      `&text=${encodeURIComponent(text)}`;
  };

  const fetchWholeAudio = async (text) => {
    const params = `token=${encodeURIComponent(token)}` +
      `&voice=${encodeURIComponent(voice)}&fmt=${encodeURIComponent(fmt)}` +
      `${spatialAudio ? '&spatial=1' : ''}`;
    try {
      const response = await fetch(`${serverUrl}/synth?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: text
      });
      if (!response.ok) {
        lastFetchErrorRef.current = `HTTP ${response.status}`;
        return null;
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      lastFetchErrorRef.current = e?.message || '네트워크 오류';
      return null;
    }
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
    try {
      const response = await fetch(`${serverUrl}/chunks?token=${encodeURIComponent(token)}&text=${encodeURIComponent(text)}`);
      if (response.ok) {
        const chunks = await response.json();
        if (Array.isArray(chunks) && chunks.length > 0) return chunks;
      }
    } catch (e) {
      console.warn('서버 문장 분리 실패, 로컬 분리 사용', e);
    }
    return localSplitSentences(text);
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
        if (index === currentIndexRef.current) {
          setStatusMessage(`재시도 중... (${attempt + 1}/${delays.length})`);
        }
        await new Promise(res => setTimeout(res, delays[attempt]));
      }
    }
    return null;
  };

  const prefetch = (index) => {
    const currentPlaylist = sentencesRef.current;
    if (index < 0 || index >= currentPlaylist.length) return;
    if (audioCacheRef.current[index]) return;

    const text = cleanTextForTTS(currentPlaylist[index]);
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

  // 텍스트 강조 및 스크롤 추적
  const buildTextNodeIndex = () => {
    if (!previewRef.current) return [];
    const walker = document.createTreeWalker(previewRef.current, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let node;
    let flatStart = 0;
    while (node = walker.nextNode()) {
      nodes.push({ node, flatStart });
      flatStart += node.nodeValue.length;
    }
    return nodes;
  };

  const findRangeInNodes = (nodes, resumeFrom, cleanText) => {
    for (const { node, flatStart } of nodes) {
      const localStart = Math.max(0, resumeFrom - flatStart);
      if (localStart >= node.nodeValue.length) continue;
      const idx = node.nodeValue.indexOf(cleanText, localStart);
      if (idx !== -1) return { node, index: idx, flatIndex: flatStart + idx };
    }
    for (const { node, flatStart } of nodes) {
      const idx = node.nodeValue.indexOf(cleanText);
      if (idx !== -1) return { node, index: idx, flatIndex: flatStart + idx };
    }
    return null;
  };

  const findSentenceRange = (cleanText) => {
    const nodes = buildTextNodeIndex();
    return findRangeInNodes(nodes, lastHighlightFlatOffsetRef.current || 0, cleanText);
  };

  const getViewportFlatOffset = () => {
    if (!previewRef.current) return null;
    const container = previewRef.current;
    const rect = container.getBoundingClientRect();
    const x = Math.min(rect.left + rect.width / 2, rect.right - 4);
    const y = rect.top + 24;

    let range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
      }
    }
    if (!range || !previewRef.current.contains(range.startContainer)) return null;

    const nodes = buildTextNodeIndex();
    const target = nodes.find(n => n.node === range.startContainer);
    return target ? target.flatStart + range.startOffset : null;
  };

  const findResumeIndexForViewport = (playlist) => {
    const viewportOffset = getViewportFlatOffset();
    if (viewportOffset === null || viewportOffset <= 0) return 0;

    const nodes = buildTextNodeIndex();
    let resumeFrom = 0;
    for (let i = 0; i < playlist.length; i++) {
      const cleanText = playlist[i].trim();
      if (!cleanText) continue;
      const match = findRangeInNodes(nodes, resumeFrom, cleanText);
      if (!match) continue;
      resumeFrom = match.flatIndex + cleanText.length;
      if (resumeFrom > viewportOffset) return i;
    }
    return 0;
  };

  const highlightSentence = (text) => {
    const highlights = document.querySelectorAll('.highlight-sentence');
    highlights.forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.innerText), el);
      parent.normalize();
    });

    if (!text || !previewRef.current) return;
    const cleanText = text.trim();
    if (!cleanText) return;

    const match = findSentenceRange(cleanText);
    if (!match) return;

    const { node, index } = match;
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + cleanText.length);

    const span = document.createElement('span');
    span.className = 'highlight-sentence';
    span.style.backgroundColor = 'var(--highlight, #F3D9A8)';
    span.style.borderRadius = '4px';
    span.style.padding = '2px 0';
    range.surroundContents(span);

    // blockquote 등 들여쓰기 박스에서도 강조폭 유지 
    const bodyRect = previewRef.current.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    span.style.marginLeft = `${bodyRect.left - spanRect.left}px`;
    span.style.marginRight = `${spanRect.right - bodyRect.right}px`;

    span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    lastHighlightFlatOffsetRef.current = match.flatIndex + cleanText.length;
  };

  // ----------------------------------------------------
  // 재생 제어 버튼들 핸들러
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
    if (isPaused) {
      resumeTts();
      return;
    }
    if (isPlaying) return;

    // 미리보기 모드로 전환
    setIsEditorMode(false);
    stopTts();
    unlockAudio();

    setStatusMessage('분석 중...');
    
    // 약간의 딜레이를 주어 화면 모드 전환(에디터 -> 미리보기) 후 innerText 캡처 보장
    setTimeout(async () => {
      if (!previewRef.current) return;
      const textContent = previewRef.current.innerText || previewRef.current.textContent;
      
      const allSents = await splitIntoSentences(textContent);
      allSentencesRef.current = allSents;

      let playlist = [];
      let idxMap = [];
      if (skipKorean) {
        allSents.forEach((s, i) => {
          if (isEnglishSentence(s)) {
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
        setStatusMessage(skipKorean ? '영어 문장 없음' : '0 / 0');
        return;
      }

      audioCacheRef.current = {};
      const resumeIndex = findResumeIndexForViewport(playlist);
      
      setCurrentIndex(resumeIndex);
      repeatCountLeftRef.current = 0;
      lastSpokenIndexRef.current = -1;
      setIsPlaying(true);
      setIsPaused(false);

      if (wholeAudioMode) {
        playWholeAudioFromCurrent(playlist, resumeIndex);
      } else {
        speakNext(resumeIndex, playlist);
      }
    }, 150);
  };

  const playWholeAudioFromCurrent = async (playlist, startIdx) => {
    const text = playlist.slice(startIdx)
      .map(s => cleanTextForTTS(s))
      .filter(Boolean)
      .join(' ');
    if (!text) { stopTts(); return; }

    setStatusMessage('오디오 생성 중...');
    highlightSentence(playlist[startIdx]);

    const src = await fetchWholeAudio(text);
    if (!audioPlayerRef.current) return;
    if (!src) {
      stopTts();
      const detail = lastFetchErrorRef.current ? ` (${lastFetchErrorRef.current})` : '';
      setStatusMessage(`서버 연결 실패${detail}`);
      return;
    }

    audioPlayerRef.current.src = src;
    audioPlayerRef.current.playbackRate = 1.0;
    wholeAudioActiveRef.current = true;
    
    // 미디어 세션 등록
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: '마크다운 뷰어 읽기',
        artist: 'Supertonic3',
      });
      navigator.mediaSession.setActionHandler('play', () => resumeTts());
      navigator.mediaSession.setActionHandler('pause', () => pauseTts());
      navigator.mediaSession.setActionHandler('stop', () => stopTts());
    }

    try {
      await audioPlayerRef.current.play();
      setStatusMessage('전체 재생 중');
    } catch (e) {
      console.error('전체 오디오 재생 실패', e);
    }
  };

  const speakNext = async (indexToSpeak = null, currentPlaylist = null) => {
    if (!audioPlayerRef.current) return;
    const playlist = currentPlaylist || sentencesRef.current;
    const index = indexToSpeak !== null ? indexToSpeak : currentIndexRef.current;

    playTokenRef.current = (playTokenRef.current || 0) + 1;
    const currentToken = playTokenRef.current;

    if (index >= playlist.length) {
      if (skipKorean && playlist.length > 0) {
        setCurrentIndex(0);
        speakNext(0, playlist);
      } else {
        stopTts();
      }
      return;
    }

    const sentence = playlist[index];
    if (!sentence || !cleanTextForTTS(sentence)) {
      const nextIdx = index + 1;
      setCurrentIndex(nextIdx);
      speakNext(nextIdx, playlist);
      return;
    }

    trimAudioCache(index);

    if (index !== lastSpokenIndexRef.current) {
      repeatCountLeftRef.current = (repeatEnglish && isEnglishSentence(sentence)) ? repeatTimes - 1 : 0;
      lastSpokenIndexRef.current = index;
    }

    highlightSentence(sentence);
    setStatusMessage(`${index + 1} / ${playlist.length}`);

    prefetch(index);
    prefetch(index + 1);

    try {
      const src = await audioCacheRef.current[index];
      if (currentToken !== playTokenRef.current || !audioPlayerRef.current) return;
      if (!src) throw new Error('음성 합성 실패');

      audioPlayerRef.current.src = src;
      audioPlayerRef.current.playbackRate = isEnglishSentence(sentence) ? ttsSpeedEn : ttsSpeedKo;
      await audioPlayerRef.current.play();
      
      if (currentToken !== playTokenRef.current) return;
      prefetch(index + 1);
      prefetch(index + 2);
    } catch (e) {
      if (currentToken !== playTokenRef.current || e?.name === 'AbortError') return;
      console.error('TTS Error:', e, lastFetchErrorRef.current);
      const detail = lastFetchErrorRef.current ? ` (${lastFetchErrorRef.current})` : '';
      stopTts();
      setStatusMessage(`서버 연결 실패${detail}`);
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
      audioPlayerRef.current.play().catch(e => console.error(e));
      setIsPaused(false);
    }
  };

  const stopTts = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      const prevSrc = audioPlayerRef.current.src;
      audioPlayerRef.current.removeAttribute('src');
      if (wholeAudioActiveRef.current && prevSrc && prevSrc.startsWith('blob:')) {
        URL.revokeObjectURL(prevSrc);
      }
    }
    wholeAudioActiveRef.current = false;
    revokeAllAudioCache();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    lastHighlightFlatOffsetRef.current = 0;
    highlightSentence(null);
    setStatusMessage('0 / 0');
  };

  const nextSentence = () => {
    const playlist = sentencesRef.current;
    if (!isPlaying || playlist.length === 0) return;
    if (audioPlayerRef.current) audioPlayerRef.current.pause();

    let nextIdx = currentIndexRef.current;
    if (currentIndexRef.current < playlist.length - 1) {
      nextIdx = currentIndexRef.current + 1;
    } else if (skipKorean) {
      nextIdx = 0;
    } else {
      stopTts();
      return;
    }
    
    setCurrentIndex(nextIdx);
    setIsPaused(false);
    speakNext(nextIdx, playlist);
  };

  const prevSentence = () => {
    const playlist = sentencesRef.current;
    if (!isPlaying || playlist.length === 0) return;
    if (audioPlayerRef.current) audioPlayerRef.current.pause();

    let prevIdx = currentIndexRef.current;
    if (currentIndexRef.current > 0) {
      prevIdx = currentIndexRef.current - 1;
    }
    
    lastHighlightFlatOffsetRef.current = 0;
    setCurrentIndex(prevIdx);
    setIsPaused(false);
    speakNext(prevIdx, playlist);
  };

  const handleSpeedChange = (lang, change) => {
    const clamp = v => Math.max(0.5, Math.min(2.0, parseFloat(v.toFixed(2))));
    if (lang === 'en') {
      const newSpeed = clamp(ttsSpeedEn + change);
      setTtsSpeedEn(newSpeed);
      localStorage.setItem('rate_en', newSpeed);
      if (audioPlayerRef.current && sentences[currentIndex] && isEnglishSentence(sentences[currentIndex])) {
        audioPlayerRef.current.playbackRate = newSpeed;
      }
    } else {
      const newSpeed = clamp(ttsSpeedKo + change);
      setTtsSpeedKo(newSpeed);
      localStorage.setItem('rate_ko', newSpeed);
      if (audioPlayerRef.current && sentences[currentIndex] && !isEnglishSentence(sentences[currentIndex])) {
        audioPlayerRef.current.playbackRate = newSpeed;
      }
    }
  };

  // ----------------------------------------------------
  // 플레이리스트 재빌드 (한국어 스킵 등의 스위치 작동 시)
  // ----------------------------------------------------
  const rebuildPlaylist = (newSkipKorean) => {
    if (allSentencesRef.current.length === 0) return;
    const globalIndex = sentenceIndexMap[currentIndex] ?? 0;
    
    let playlist = [];
    let idxMap = [];
    if (newSkipKorean) {
      allSentencesRef.current.forEach((s, i) => {
        if (isEnglishSentence(s)) {
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

    if (isPlaying) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      if (playlist.length === 0) {
        setStatusMessage('영어 문장 없음');
        stopTts();
        return;
      }
      setIsPaused(false);
      speakNext(newIndex, playlist);
    } else {
      setStatusMessage(`${newIndex + 1} / ${playlist.length}`);
    }
  };

  const handleToggleSkipKorean = () => {
    const val = !skipKorean;
    setSkipKorean(val);
    localStorage.setItem('skip_korean', String(val));
    rebuildPlaylist(val);
  };

  const handleToggleRepeatEnglish = () => {
    const val = !repeatEnglish;
    setRepeatEnglish(val);
    localStorage.setItem('repeat_english', String(val));
    repeatCountLeftRef.current = 0;
    lastSpokenIndexRef.current = -1;
  };

  // HTML 내용 복제
  const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';

  return (
    <div className="fileview-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 108px - env(safe-area-inset-bottom, 0px))',
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
        .toolbar-btn {
          background-color: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-color);
          padding: 6px 12px;
          border-radius: 15px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .toolbar-btn:hover {
          background-color: var(--border-color);
        }
        .toolbar-btn.active {
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
        /* TTS Control Bar */
        .tts-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 10px 16px;
          background-color: var(--secondary-bg);
          border-top: 1px solid var(--border-color);
          flex-shrink: 0;
        }
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
          background-color: var(--bg-color);
          color: var(--text-color);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          width: 90%;
          max-width: 450px;
          padding: 24px;
          box-shadow: var(--card-shadow);
        }
        .settings-row {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .settings-row label {
          font-size: 0.85rem;
          font-weight: bold;
          color: var(--text-muted);
        }
        .settings-input {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--secondary-bg);
          color: var(--text-color);
          font-size: 0.9rem;
          outline: none;
        }
        .settings-row select {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--secondary-bg);
          color: var(--text-color);
          font-size: 0.9rem;
          outline: none;
        }
        /* Mobile layout toggle */
        @media (max-width: 767px) {
          .editor-pane {
            display: ${isEditorMode ? 'flex' : 'none'};
          }
          .preview-pane {
            display: ${!isEditorMode ? 'flex' : 'none'};
          }
        }
        @media (min-width: 768px) {
          .editor-pane {
            display: flex;
            border-right: 1px solid var(--border-color);
          }
          .preview-pane {
            display: flex;
          }
        }
      `}</style>

      {/* 1. 상단 툴바 */}
      <div className="fileview-toolbar">
        <div className="toolbar-group">
          {/* 모바일용 편집/보기 토글 버튼 */}
          <button 
            className={`toolbar-btn ${isEditorMode ? 'active' : ''} md-only`} 
            style={{ display: 'none' }} // 스타일 인라인 덮어쓰기 적용을 위해 하단 미디어쿼리와 매칭
            onClick={() => setIsEditorMode(true)}
          >
            편집기
          </button>
          <button 
            className={`toolbar-btn ${!isEditorMode ? 'active' : ''} md-only`}
            style={{ display: 'none' }}
            onClick={() => setIsEditorMode(false)}
          >
            미리보기
          </button>
          <span className="md-hide" style={{ display: 'inline-flex', gap: '8px' }}>
            <button className="toolbar-btn" onClick={() => setIsEditorMode(prev => !prev)}>
              {isEditorMode ? '미리보기 보기' : '편집기 보기'}
            </button>
          </span>
          <button className="toolbar-btn" onClick={handleFileUploadClick}>
            파일 열기
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".md,.txt,.markdown" 
            style={{ display: 'none' }} 
          />
          <button className="toolbar-btn" onClick={handleCopyToClipboard}>
            {isCopied ? 'HTML 복사됨!' : 'HTML 복사'}
          </button>
        </div>

        <div className="toolbar-group">
          {/* 글씨 크기 조절 */}
          <select 
            value={textSize} 
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setTextSize(val);
              localStorage.setItem('preview_text_size', String(val));
            }}
            style={{
              padding: '4px 8px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--secondary-bg)',
              color: 'var(--text-color)',
              fontSize: '0.78rem'
            }}
          >
            <option value="100">글자 크기 (기본)</option>
            <option value="120">글자 크기 (크게)</option>
            <option value="140">글자 크기 (더크게)</option>
            <option value="160">글자 크기 (아주크게)</option>
            <option value="180">글자 크기 (최대)</option>
          </select>
          <button className="toolbar-btn" onClick={() => setShowSettings(true)}>
            설정
          </button>
        </div>
      </div>

      {/* 2. 에디터 / 미리보기 본문 영역 */}
      <div className="fileview-content">
        <div className="editor-pane">
          <textarea
            ref={editorRef}
            className="editor-textarea"
            placeholder="마크다운 텍스트를 입력하거나 파일을 불러오세요..."
            value={markdown}
            onChange={handleEditorChange}
          />
        </div>
        <div className="preview-pane">
          <div 
            ref={previewRef}
            className="preview-content markdown-body"
            dangerouslySetInnerHTML={{ __html: getRenderedHtml() }}
          />
        </div>
      </div>

      {/* 3. TTS 컨트롤 하단바 */}
      <div className="tts-bar">
        {/* TTS 이전 문장 */}
        <button 
          onClick={prevSentence} 
          disabled={!isPlaying}
          style={{
            background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-color)',
            width: '40px', height: '40px', borderRadius: '50%', cursor: isPlaying ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPlaying ? 1 : 0.4
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        </button>

        {/* TTS 재생/일시정지 */}
        <button 
          onClick={isPlaying ? (isPaused ? resumeTts : pauseTts) : playTts}
          style={{
            background: 'var(--primary-color)', border: 'none', color: '#fff',
            width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
          }}
        >
          {isPlaying && !isPaused ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>

        {/* TTS 다음 문장 */}
        <button 
          onClick={nextSentence} 
          disabled={!isPlaying}
          style={{
            background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-color)',
            width: '40px', height: '40px', borderRadius: '50%', cursor: isPlaying ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPlaying ? 1 : 0.4
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.9V8.1L8.5 12zM16 6h2v12h-2z"/></svg>
        </button>

        {/* TTS 정지 */}
        <button 
          onClick={stopTts} 
          disabled={!isPlaying}
          style={{
            background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-color)',
            width: '40px', height: '40px', borderRadius: '50%', cursor: isPlaying ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPlaying ? 1 : 0.4
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        </button>

        {/* 현재 재생 상태 메시지 */}
        <div style={{
          fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '70px', textAlign: 'center',
          fontFamily: 'monospace'
        }}>
          {statusMessage || '0 / 0'}
        </div>

        {/* 영어 반복 스위치 */}
        <button 
          className={`toolbar-btn ${repeatEnglish ? 'active' : ''}`}
          onClick={handleToggleRepeatEnglish}
          style={{ padding: '6px 10px', fontSize: '0.72rem' }}
        >
          영{repeatTimes}회반복
        </button>

        {/* 한국어 건너뛰기 스위치 */}
        <button 
          className={`toolbar-btn ${skipKorean ? 'active' : ''}`}
          onClick={handleToggleSkipKorean}
          style={{ padding: '6px 10px', fontSize: '0.72rem' }}
        >
          한글제외
        </button>

        {/* 배속 제어 */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-color)', borderRadius: '15px', padding: '2px 6px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', marginRight: '4px' }}>한: {ttsSpeedKo.toFixed(2)}</span>
          <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-color)', padding: '0 4px', fontWeight: 'bold' }} onClick={() => handleSpeedChange('ko', -0.05)}>-</button>
          <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-color)', padding: '0 4px', fontWeight: 'bold' }} onClick={() => handleSpeedChange('ko', 0.05)}>+</button>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-color)', borderRadius: '15px', padding: '2px 6px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', marginRight: '4px' }}>영: {ttsSpeedEn.toFixed(2)}</span>
          <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-color)', padding: '0 4px', fontWeight: 'bold' }} onClick={() => handleSpeedChange('en', -0.05)}>-</button>
          <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-color)', padding: '0 4px', fontWeight: 'bold' }} onClick={() => handleSpeedChange('en', 0.05)}>+</button>
        </div>
      </div>

      {/* 4. 설정 모달 팝업 */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              TTS 및 뷰어 상세 설정
            </h3>
            
            <div className="settings-row">
              <label>TTS 서버 URL</label>
              <input 
                type="text" 
                className="settings-input" 
                defaultValue={serverUrl} 
                id="setting-server-url"
              />
            </div>
            
            <div className="settings-row">
              <label>인증 토큰 (선택)</label>
              <input 
                type="password" 
                className="settings-input" 
                defaultValue={token} 
                id="setting-token"
              />
            </div>

            <div className="settings-row">
              <label>목소리 선택</label>
              <select 
                value={voice} 
                onChange={(e) => {
                  setVoice(e.target.value);
                  localStorage.setItem('supertonic_voice', e.target.value);
                  audioCacheRef.current = {};
                }}
              >
                {SUPERTONIC_VOICES.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <label>오디오 포맷</label>
              <select 
                value={fmt} 
                onChange={(e) => {
                  setFmt(e.target.value);
                  localStorage.setItem('supertonic_fmt', e.target.value);
                  audioCacheRef.current = {};
                }}
              >
                <option value="wav">wav</option>
                <option value="mp3">mp3</option>
              </select>
            </div>

            <div className="settings-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
              <label htmlFor="chk-spatial" style={{ cursor: 'pointer' }}>공간 음향 (Spatial Audio)</label>
              <input 
                type="checkbox" 
                id="chk-spatial" 
                checked={spatialAudio}
                onChange={(e) => {
                  setSpatialAudio(e.target.checked);
                  localStorage.setItem('spatial_audio', String(e.target.checked));
                  audioCacheRef.current = {};
                }}
              />
            </div>

            <div className="settings-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <label htmlFor="chk-whole" style={{ cursor: 'pointer' }}>전체 다운로드 지속 재생 (Whole Audio Mode)</label>
              <input 
                type="checkbox" 
                id="chk-whole" 
                checked={wholeAudioMode}
                onChange={(e) => {
                  setWholeAudioMode(e.target.checked);
                  localStorage.setItem('whole_audio_mode', String(e.target.checked));
                }}
              />
            </div>

            <div className="settings-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <label>영어 반복 횟수</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  className="toolbar-btn" 
                  style={{ padding: '2px 8px' }} 
                  onClick={() => {
                    const val = Math.max(1, repeatTimes - 1);
                    setRepeatTimes(val);
                    localStorage.setItem('repeat_times', String(val));
                  }}
                >
                  -
                </button>
                <span>{repeatTimes}회</span>
                <button 
                  className="toolbar-btn" 
                  style={{ padding: '2px 8px' }}
                  onClick={() => {
                    const val = Math.min(10, repeatTimes + 1);
                    setRepeatTimes(val);
                    localStorage.setItem('repeat_times', String(val));
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button className="toolbar-btn" onClick={() => setShowSettings(false)}>
                취소
              </button>
              <button 
                className="toolbar-btn active"
                onClick={() => {
                  const urlVal = document.getElementById('setting-server-url').value;
                  const tokenVal = document.getElementById('setting-token').value;
                  handleSaveSettings(urlVal, tokenVal);
                }}
              >
                설정 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
