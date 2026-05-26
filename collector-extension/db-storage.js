/**
 * IndexedDB 存储管理器 - 替代 chrome.storage.local
 * 优势: 无 10MB 存储限制
 */

const DB_NAME = 'RedditCollectorDB';
const DB_VERSION = 1;
const STORE_NAME = 'collector_state';

class CollectorDB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }

    async saveState(state) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({ id: 'current', ...state });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadState() {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('current');
            
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    delete result.id; // 移除 id 字段
                    resolve(result);
                } else {
                    resolve(this.getDefaultState());
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async clearState() {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    getDefaultState() {
        return {
            communities: [],
            currentStage: 1,
            startStage: 1,
            stageProgress: { 1: {}, 2: {}, 3: {} },
            errors: [],
            totalRequests: 0,
            isRunning: false,
            isComplete: false,
            startTime: null,
        };
    }
}

// 全局实例
const collectorDB = new CollectorDB();
