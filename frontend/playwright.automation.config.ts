import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./tests",testMatch:"automation.spec.ts",timeout:90000,workers:1,
  use:{baseURL:"http://localhost:5188",channel:"chrome",headless:true,viewport:{width:1440,height:1000},trace:"retain-on-failure"},
  webServer:[
    {command:"TEST_API_PORT=5058 TEST_PROVIDER_PORT=5098 TEST_WEB_PORT=5188 python3 ../tests/test_server.py",url:"http://localhost:5058/api/health",timeout:30000,reuseExistingServer:false},
    {command:"npm run dev -- --config vite.automation.config.ts",url:"http://localhost:5188",reuseExistingServer:false}
  ]
});
