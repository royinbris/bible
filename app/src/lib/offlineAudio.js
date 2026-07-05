// 오프라인 낭독용 음원(Blob)을 IndexedDB에 저장/조회.
// 라이브 메모리를 잡아먹지 않고 디스크에 보관 → 신호 없는 곳에서도 재생 가능.

const DB_NAME = 'supertonic_offline';
const STORE = 'clips';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function putClip(id, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, 'readwrite').put(blob, id);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export async function getClip(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, 'readonly').get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

export async function hasClip(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, 'readonly').getKey(id);
    r.onsuccess = () => resolve(r.result !== undefined);
    r.onerror = () => reject(r.error);
  });
}

export async function countClips() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, 'readonly').count();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function clearAllClips() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, 'readwrite').clear();
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
