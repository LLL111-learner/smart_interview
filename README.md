# AI模拟面试与能力提升平台

面向计算机相关专业学生的 AI 模拟面试与能力提升系统，支持岗位化面试、多轮追问、语音/文本交互、智能评估报告和个性化提升建议。

## 项目简介

本项目围绕高校学生在技术类岗位面试中的真实痛点设计，目标是提供一个可反复练习、即时反馈、具备岗位针对性的 AI 面试教练平台，形成“练习 - 评估 - 提升”的完整闭环。

当前版本已覆盖以下核心能力：

- 岗位化模拟面试
- 多轮对话与动态追问
- 语音输入与文本输入
- 本地知识库与 RAG 检索增强
- 多维度面试评估报告
- 学习资源推荐与训练计划
- 面试历史记录与成长分析

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Ant Design + ECharts + Vite |
| 后端 | FastAPI + SQLAlchemy + Pydantic |
| 大模型 | Ollama + Qwen |
| 检索增强 | Sentence-Transformers + FAISS |
| 语音识别 | faster-whisper / Transformers ASR |
| 语音输出 | edge-tts |
| 数据库 | SQLite |

## 当前已支持岗位

- Java 后端
- Web 前端
- 嵌入式开发
- Python 算法
- 软件测试
- DevOps

## 项目结构

```text
smart-interview/
├── backend/            # FastAPI 后端服务
├── frontend/           # React 前端应用
├── knowledge_base/     # 本地知识库
├── docker-compose.yml
└── README.md
```

## 启动前准备

请先确认以下环境已经具备：

- Windows PowerShell
- Ollama 已安装
- 后端虚拟环境已安装依赖
- 前端 `node_modules` 已安装
- 本地模型和知识库文件已准备完成

当前项目默认使用的模型与端口：

- LLM 地址：`http://localhost:11434/v1`
- LLM 模型：`qwen2.5:3b`
- 后端端口：`8010`
- 前端端口：`3000`

## 推荐启动方式

### 1. 启动 Ollama

```powershell
ollama serve
```

如果模型未拉取，可执行：

```powershell
ollama pull qwen2.5:3b
```

### 2. 启动后端

```powershell
cd E:\桌面\A05\smart-interview\backend
.\venv\Scripts\python.exe main.py
```

说明：

- 当前默认是稳定启动模式
- 默认关闭热重载，适合语音面试、联调和演示
- 后端接口地址为 `http://127.0.0.1:8010`
- 接口文档地址为 `http://127.0.0.1:8010/docs`

### 3. 启动前端

```powershell
cd E:\桌面\A05\smart-interview\frontend
npm.cmd run dev
```

说明：

- 使用 `npm.cmd` 可以避开 PowerShell 对 `npm.ps1` 的执行策略限制
- 前端地址为 `http://127.0.0.1:3000`
- 前端已将 `/api` 代理到后端 `http://localhost:8010`

### 4. 访问系统

浏览器打开：

```text
http://127.0.0.1:3000
```

## 开发模式启动方式

如果你在开发后端、需要自动热重载，可显式开启：

```powershell
cd E:\桌面\A05\smart-interview\backend
$env:APP_RELOAD="1"
.\venv\Scripts\python.exe main.py
```

说明：

- 该模式只建议用于开发调试
- 语音上传、数据库写入等运行时文件可能增加热重载噪音
- 做比赛演示时建议仍然使用默认稳定模式

## 常见问题

### 1. 前端 `npm run dev` 被 PowerShell 拦截

请改用：

```powershell
npm.cmd run dev
```

### 2. 后端启动时卡在 RAG 初始化

当前版本已经兼容现有 `sentence-transformers` 环境。
如果 RAG 初始化失败，系统会自动降级为空检索，不再阻塞后端主服务启动。

### 3. 面试过程中语音无法识别

优先检查：

- `backend\.env` 中 ASR 相关配置
- 本地 Whisper 模型路径是否存在
- CUDA / CPU 推理环境是否正常

### 4. 页面打开但接口报错

优先检查：

- Ollama 是否运行
- 后端是否成功启动
- `8010` 和 `3000` 端口是否被占用

## 主要功能说明

### 岗位化模拟面试

- 根据岗位类型加载差异化题库和提问逻辑
- 支持基础知识、项目深挖、场景题、反问等环节

### 多模态交互

- 支持文本作答
- 支持语音录制并转写
- 支持 AI 面试官连续追问

### 智能评估与反馈

- 技术正确性
- 知识深度
- 逻辑表达
- 岗位匹配度
- 语音表达分析
- 结构化面试报告

### 能力提升闭环

- 推荐学习资源
- 生成训练计划
- 保存历史记录
- 展示成长趋势

## 说明

仓库根目录外层还包含一份 [启动说明](E:\桌面\A05\启动说明.md)，内容已和本 README 保持一致。实际使用时，两份说明任选其一即可。

