# MiKaScore

一个基于Python和Web技术的MMD评分系统，使用MediaPipe进行姿态识别，支持动作评分和可视化展示。

## 功能特性

- 使用MediaPipe进行实时姿态识别
- 支持MMD模型加载和动画播放
- 动作评分系统
- Web界面可视化展示
- 实时反馈和评分结果

## 技术栈

- **后端**：Python, Flask
- **前端**：HTML, CSS, JavaScript
- **姿态识别**：MediaPipe
- **3D渲染**：Reze Engine (基于Three.js)

## 第三方依赖

本项目使用了 [Reze Engine](https://github.com/reze-engine/reze-engine) 作为3D渲染引擎，该引擎基于Three.js，用于MMD模型的加载和动画渲染。

## 快速开始

### 环境要求

- Python 3.7+
- Node.js (用于前端构建)

### 安装依赖

```bash
# 安装Python依赖
pip install -r requirements.txt

# 安装前端依赖
npm install
```

### 启动服务

```bash
# 运行启动脚本
./start.bat

# 或手动启动
python app.py
```

### 访问系统

打开浏览器访问：`http://localhost:5000`

## 项目结构

```
MiKaScore/
├── app/                # 主应用目录
│   ├── routes/         # 路由定义
│   ├── static/         # 静态文件
│   ├── templates/      # HTML模板
│   └── utils/          # 工具函数
├── mmd/                # MMD模型和动作文件
│   ├── models/         # MMD模型
│   └── motion/         # MMD动作数据
├── models/             # 姿态识别模型
├── reze-engine/        # 3D渲染引擎
├── app.py              # 应用入口
├── requirements.txt    # Python依赖
├── start.bat           # 启动脚本
├── LICENSE             # Apache 2.0许可证
└── README.md           # 项目说明
```

## 许可证

本项目采用Apache 2.0许可证，详见 [LICENSE](LICENSE) 文件。

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！
