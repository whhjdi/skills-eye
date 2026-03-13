# skills-eye

一个 Chrome 浏览器扩展，为 [skills.sh](https://skills.sh) 添加亮色/暗色主题切换功能。

skills.sh 默认强制使用暗色主题，在明亮环境下对眼睛不太友好。这个扩展让你可以自由切换，也可以跟随系统偏好自动适应。

## 功能

- **三种模式**：亮色 / 暗色 / 跟随系统
- **两个入口**：页面内浮动按钮 + 工具栏弹窗
- **无闪烁**：在页面首次渲染前就完成主题注入
- **持久化**：偏好保存在本地，刷新和重启后不丢失
- **SPA 兼容**：通过 MutationObserver 应对 Next.js 客户端导航时的 class 重置

## 安装

> 目前仅支持 Chrome（以及 Edge 等 Chromium 内核浏览器）。

1. 克隆或下载本仓库到本地
2. 打开 Chrome，访问 `chrome://extensions`
3. 右上角开启**开发者模式**
4. 点击**加载已解压的扩展程序**，选择本项目目录

安装完成后，工具栏会出现扩展图标，同时访问 skills.sh 时页面右下角会出现浮动切换按钮。

## 使用

### 浮动按钮（页面右下角）

| 当前模式 | 图标 | 点击后 |
|----------|------|--------|
| 暗色     | ☀    | 切换到亮色 |
| 亮色     | ☾    | 切换到暗色 |

### 工具栏弹窗

点击浏览器工具栏中的扩展图标，弹出面板提供三个选项：

- **跟随系统** — 自动跟随操作系统的深色/浅色模式设置
- **亮色模式** — 强制使用亮色主题
- **暗色模式** — 强制使用暗色主题（网站默认值）

## 技术实现

| 问题 | 解决方案 |
|------|----------|
| 防止主题闪烁 | `run_at: document_start`，在 CSS 解析前注入 |
| Next.js hydration 重置 class | MutationObserver 监听 `<html>` class 属性变化，自动重新应用偏好 |
| 浮动按钮样式隔离 | Shadow DOM（closed mode），防止 Tailwind 样式污染按钮 |
| 数据持久化 | `chrome.storage.local` |
| 系统偏好同步 | `prefers-color-scheme` media query 监听器 |

## 文件结构

```
skills-theme/
├── manifest.json     # 扩展配置（Manifest V3）
├── background.js     # Service Worker，初始化存储
├── content.js        # 注入到页面：主题应用逻辑 + 浮动按钮
├── popup.html        # 工具栏弹窗 HTML
├── popup.css         # 弹窗样式
├── popup.js          # 弹窗交互逻辑
└── icons/
    ├── icon-16.svg
    ├── icon-48.svg
    └── icon-128.svg
```

## 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 保存用户的主题偏好 |
| `activeTab` | 向当前标签页的 content script 发送消息 |
| `host_permissions: https://skills.sh/*` | 仅在 skills.sh 上注入脚本，不影响其他网站 |

扩展不收集任何数据，不访问任何外部服务。
