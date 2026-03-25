// Updated SecureStore.js content replacing Node.js APIs with browser native APIs
class SecureStore {
    constructor() {
        this.store = {};
    }

    setItem(key, value) {
        this.store[key] = value;
        localStorage.setItem(key, value);
    }

    getItem(key) {
        return this.store[key] || localStorage.getItem(key);
    }

    removeItem(key) {
        delete this.store[key];
        localStorage.removeItem(key);
    }

    generateUUID() {
        return crypto.randomUUID();
    }
}

// Export the SecureStore class
export default SecureStore;