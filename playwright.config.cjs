const { defineConfig } = require('@playwright/test');

// The optional executable path is useful in CI images with a preinstalled Chromium.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

module.exports = defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.cjs',
    fullyParallel: false,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:8010',
        browserName: 'chromium',
        ...(executablePath ? { launchOptions: { executablePath, args: ['--no-sandbox'] } } : {})
    },
    webServer: {
        command: 'node tests/test-server.cjs',
        url: 'http://127.0.0.1:8010',
        reuseExistingServer: false
    }
});
