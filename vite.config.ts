import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import fs from 'fs';

// 设置 Windows 控制台编码为 UTF-8
if (process.platform === 'win32') {
  try {
    require('child_process').execSync('chcp 65001');
  } catch {}
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // 构建输出目录
    build: {
      outDir: 'dist',
    },
    server: {
      port: 3000,
      strictPort: false,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      electron([
        {
          // 主进程入口
          entry: 'electron/main.ts',
          vite: {
            build: {
              rollupOptions: {
                output: {
                  format: 'cjs',
                },
              },
            },
          },
          // Vite 服务启动后的回调
          async onstart(options) {
            // 通知 Electron 重新加载
            options.reload();
          },
        },
        {
          // 预加载脚本
          entry: 'electron/preload.ts',
          onstart(options) {
            // 通知 Electron 重新加载预加载脚本
            options.reload();
          },
          vite: {
            build: {
              rollupOptions: {
                output: {
                  format: 'cjs',
                },
              },
            },
          },
        },
      ]),
      renderer(),
      // 自定义插件：写入实际端口到文件
      {
        name: 'write-vite-port',
        configureServer(server) {
          server.httpServer?.once('listening', () => {
            const addr = server.httpServer?.address();
            const port = typeof addr === 'object' && addr ? addr.port : 3000;
            fs.writeFileSync(path.resolve(__dirname, '.vite-port'), String(port));
            console.log(`Vite 端口已写入：${port}`);
          });
        },
      },
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});