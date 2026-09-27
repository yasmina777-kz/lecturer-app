import { mergeConfig, defineConfig } from "vite";
import base from "./vite.config";
export default mergeConfig(base,defineConfig({server:{port:5188,proxy:{"/api":{target:"http://localhost:5058",changeOrigin:true,timeout:900000,proxyTimeout:900000}}}}));
