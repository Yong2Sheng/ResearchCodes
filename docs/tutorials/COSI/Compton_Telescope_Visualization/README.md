**中文** | [English](https://github.com/Yong2Sheng/compton-telescope-visualization/blob/main/README.en.md)

# Compton Telescope Visualization

用于科研演讲与教学的三个离线三维演示：event cone 的几何关系、光子事件重建与 Compton Data Space（CDS），以及从 2D 到 3D 的 Compton 散射过程。直接双击 HTML 即可使用，需要支持 WebGL 的浏览器，不需要启动服务器。

## 页面入口

点击页面名直接打开在线演示（GitHub Pages），无需下载；离线使用时双击仓库根目录中的同名 HTML 文件。GitHub 的文件视图只显示 HTML 源码，不会运行页面，所以入口链接指向的是在线演示地址。

| 在线演示 | 内容 |
| --- | --- |
| [reconstruction.html](https://yong2sheng.github.io/compton-telescope-visualization/reconstruction.html) | **完整演示。** 光子入射 → 第一次 Compton 散射 → 第二处完全吸收 → event cone → 参数卡片 → CDS 点累积。支持 Klein–Nishina 抽样、能量与源方向设置、批量增加 1000 个事件、两种投影、历史事件、中英文和自由观察。 |
| [event-cone-rotation.html](https://yong2sheng.github.io/compton-telescope-visualization/event-cone-rotation.html) | **几何探索。** 手动控制散射角与绕源轴旋转，观察真实 event cone 以及反投影轴端点在方向球上的轨迹，保留不同散射角的历史轨迹。 |
| [compton-scattering.html](https://yong2sheng.github.io/compton-telescope-visualization/compton-scattering.html) | **分步讲解。** 静止电子与入射光子 → 一次 Compton 散射，散射光子与反冲电子同时逐步显现 → 两处相互作用的测量 → 平面到 3D 的相机过渡 → event circle 与候选入射方向的扫描。支持能量与散射角设置、自动步进、中英文和自由观察。 |

`event-cone-rotation.html` 是最初旋转动画的新文件名。过渡用的投影预览页面已删除，两种投影继续保留在完整演示中。

## 说明文档

- [更新记录](https://github.com/Yong2Sheng/compton-telescope-visualization/blob/main/CHANGELOG.md)：按日期登记每一步改动的说明、影响范围和对应提交，便于追溯。
- [完整重建演示说明](https://github.com/Yong2Sheng/compton-telescope-visualization/blob/main/RECONSTRUCTION.md)：操作、物理模型、投影、限制及验证方法。
- [绕源旋转演示说明](https://github.com/Yong2Sheng/compton-telescope-visualization/blob/main/EVENT_CONE_ROTATION.md)：原始几何推导、轨迹规则与验证记录。
- [分步散射演示说明](https://github.com/Yong2Sheng/compton-telescope-visualization/blob/main/SCATTERING_DEMO.md)：演示流程、物理模型与 PowerPoint 使用建议。
- [方位等距投影（ArcGIS Pro 帮助）](https://doc.esri.com/en/arcgis-pro/latest/help/mapping/properties/azimuthal-equidistant.html)：不同平面投影的官方说明，供理解演示中投影选择时参考。

当前不实现“任意源位置下标准圆锥刚性平移”。相关物理约定与以后可以采用的显示方式记录在完整演示说明的“限制”部分。

## 构建

HTML 已内嵌所需脚本。完整演示的 KaTeX 数学字体也内嵌在文件中，离线可用。只有需要修改源码并重新生成页面时，才需要安装构建依赖。

```bash
npm install
npm run build:all
```

单独构建：

```bash
npm run build                  # event-cone-rotation.html
npm run build:reconstruction   # reconstruction.html
npm run build:scattering       # compton-scattering.html
```

## 检查

```bash
npm test
npm run test:psi
npm run test:reconstruction
npm run test:browser
npm run test:reconstruction-browser
npm run test:notation
npm run test:origin
npm run test:projection-seams
npm run test:audit-fixes
npm run test:angle-guides
npm run test:angle-guides-browser
npm run test:scattering
npm run test:scattering-browser
npm run test:scattering-reveal
```

浏览器检查需要 Google Chrome。

## 项目结构

- `src/physics.js`、`src/geometry.js`：共享角度约定、向量、能量和 event cone 几何。
- `src/app.js`、`src/scene.js`、`src/history.js`：绕源旋转演示。
- `src/event-simulation.js`：理想事件生成、Klein–Nishina 抽样与重建。
- `src/reconstruction*.js`：完整流程、场景、界面与语言。
- `src/angle-relations*.js`：完整演示中可选的 3D 角度辅助线。
- `src/scattering*.js`：分步散射演示的模型与界面逻辑。
- `src/cds-projections.js`：方向到平面显示的投影。
- `src/math-typesetting.js`：统一数学排版。
- `src/healpix-reference-data.json`：正式页面使用的 HEALPix 像素边界，以及数学测试使用的参考事件。
- `src/*.template.html`、`build*.mjs`：页面模板与构建脚本。
- `tests/`：当前可运行的验证入口。
- `artifacts/`、`output/`、`node_modules/`：本地开发与测试产物，不纳入版本控制，克隆后无需它们即可打开 HTML。

## 许可

以 MIT 许可发布，详见 [LICENSE](LICENSE)。可以自由使用、修改和再分发，保留版权与许可声明即可。这些演示是教学用的理想化模型，不适合直接用于科学数据分析。
