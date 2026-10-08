import {defineConfig} from '@playwright/test';
import path from 'node:path';

const python=process.env.SOCIETY_TEST_PYTHON||(process.platform==='win32'?'../backend/.venv/Scripts/python.exe':'../backend/.venv/bin/python');
export default defineConfig({
  testDir:'./tests',fullyParallel:false,workers:1,timeout:60000,
  use:{baseURL:'http://127.0.0.1:8097',viewport:{width:1440,height:1050},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:`"${python}" "${path.resolve('../tools/serve_test.py')}"`,url:'http://127.0.0.1:8097/api/health',reuseExistingServer:false,timeout:30000},
  reporter:[['list'],['json',{outputFile:'test-results/results.json'}]],
});
