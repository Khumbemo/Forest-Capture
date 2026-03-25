// SecureStore.js

const uuid = require('uuid');
const fs = require('fs');
const path = require('path');

class SecureStore {
    constructor() {
        this.storePath = path.join(__dirname, 'secure_store.json');
        this.version = '1.0.0';
        this.init();
    }

    init() {
        if (!fs.existsSync(this.storePath)) {
            fs.writeFileSync(this.storePath, JSON.stringify({ items: [] }, null, 2));
        }
    }

    addItem(data) {
        const item = {
            id: uuid.v4(),
            data: data,
            timestamp: new Date().toISOString(),
            version: this.version,
        };
        const store = this.getStore();
        store.items.push(item);
        this.saveStore(store);
        return item;
    }

    getStore() {
        const content = fs.readFileSync(this.storePath);
        return JSON.parse(content);
    }

    saveStore(store) {
        fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2));
    }

    getItem(id) {
        const store = this.getStore();
        return store.items.find(item => item.id === id) || null;
    }

    deleteItem(id) {
        let store = this.getStore();
        store.items = store.items.filter(item => item.id !== id);
        this.saveStore(store);
    }
}

module.exports = SecureStore;

