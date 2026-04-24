module.exports = [
  {
    ignores: [
      "android/**",
      "node_modules/**",
      "www/**",
      "vendor/**",
      "play-store-assets/**",
      "tests/**",
      "*.js"
    ]
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        location: "readonly",
        console: "readonly",
        fetch: "readonly",
        caches: "readonly",
        ReadableStream: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        Blob: "readonly",
        URL: "readonly",
        FileReader: "readonly",
        Image: "readonly",
        MouseEvent: "readonly",
        Event: "readonly",
        ProgressEvent: "readonly",
        AbortController: "readonly",
        indexedDB: "readonly",
        history: "readonly",
        requestAnimationFrame: "readonly",
        crypto: "readonly",
        NodeFilter: "readonly",
        MediaRecorder: "readonly",
        Chart: "readonly",
        L: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn"
    }
  }
];
