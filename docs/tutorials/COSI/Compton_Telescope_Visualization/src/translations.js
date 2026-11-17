// Display-only translations. Original text nodes remain associated with their
// Chinese source so switching languages never rebuilds controls or scene state.
export const entries = `
Compton 事件锥 · 真实空间旋转几何|Compton event cone · Real-space geometry
Compton 事件锥 · 绕源轴旋转与反投影轴轨迹|Compton event cone · Rotation and axis tracks
固定源方向 S · 固定散射角 φ · β 绕 O—S 旋转真实 event cone，蓝色记录的是 A 而不是平面圆心 B|Fixed source S · Scattering angle φ · β rotates the event cone about O—S; blue tracks record A, not the planar center B
说明 / 约定|Help / conventions
读数|Readouts
投影字号|Text size
投影字号：|Text size:
左侧“投影字号”可在标准 / 大字 / 特大之间切换。1920×1080 建议“大字”；较低分辨率或较远观看距离建议“特大”。长操作说明集中在本弹层，不在主界面常驻。|Use the left-side Text size control to switch between Standard, Large and Extra large. Large is recommended for 1920×1080; use Extra large at lower resolutions or long viewing distances. Detailed operating notes live in this panel rather than permanently on the main screen.
标准|Standard
大字|Large
特大|Extra large
字号已切换为|Text size switched to
操作与轨迹规则|Controls and track rules
 相机与物理状态独立；改变视角、缩放、暂停、开关显示或重置视角都不会删除历史轨迹。只有“清空轨迹”删除历史，而且不会重置 φ、β 或相机。|Camera and physics are independent. Changing the view, zoom, playback or visibility preserves history. Only Clear tracks deletes it, without resetting φ, β or the camera.
自由观察需要明确点击进入；Esc 返回轨道观察。详细约定见右上角“说明 / 约定”。|Free flight requires an explicit click; Esc returns to orbit view. See Help / conventions for full details.
数学自检|Math checks
实验控制|Controls
观察相机|Camera
不影响物理|View only
轨道观察|Orbit view
自由观察|Free flight
左键拖动旋转 · 右键或 Shift+拖动平移 · 滚轮缩放|Drag to orbit · Right/Shift-drag to pan · Scroll to zoom
散射角 φ|Scattering angle φ
真实 event cone 的 Compton 角。范围 0°–180°，φ>90° 仍按有向向量公式绘制，不做 180°−φ 替换。|Compton angle of the physical event cone, 0°–180°. For φ > 90°, directed-vector geometry is retained; φ is not replaced by 180°−φ.
绕源方向旋转 β|Rotation about source β
开始自动旋转|Start rotation
暂停自动旋转|Pause rotation
速度|Speed
鼠标只改变观察视角；event cone 绕源轴的旋转只由 β 控制。手动调整数值时自动旋转会暂停。|Mouse input changes the view only. β rotates the event cone about the source axis. Manual angle edits pause automatic rotation.
痕迹与场景|Tracks and scene
历史轨迹|Track history
天空球|Sky sphere
角度辅助|Angle guides
理论小圆|Theoretical orbit
平面圆心 B|Planar center B
清空轨迹|Clear tracks
重置视角|Reset view
鼠标 ≠ β。|Mouse ≠ β.
· 鼠标只改变观察视角|· Mouse input changes the view only
相机与物理状态独立；改变视角、缩放、暂停、开关显示或重置视角都不会删除历史轨迹。只有“清空轨迹”删除历史。|Camera and physics are independent. Changing the view, zoom, playback or visibility preserves history. Only Clear tracks deletes it.
瞬时几何|Current geometry
固定源 S|Fixed source S
β 显示 / 累计|β display / total
累计|total
散射后传播方向 k|Scattered photon direction k
反投影轴 a = −k|Back-projection axis a = −k
χ、ψ 描述 k，不描述 a|χ and ψ describe k, not a
小圆 · 数学上经过 S|Small circle · passes through S
记录点|Tracked point
角度辅助默认隐藏，可在左侧打开 φ、χ 和 ψ 辅助弧。|Angle guides are hidden by default. Enable them on the left to show φ, χ and ψ.
Compton 能量示例|Compton energy example
散射后 E′|Scattered photon E′
反冲电子 Tₑ|Recoil electron Tₑ
会话轨迹|Session tracks
转动 β 后开始记录；每段固定自己的 φ。|Rotate β to record a track; each segment retains its own φ.
转动 β 后开始记录。|Rotate β to start recording.
图例|Legend
S 固定源|S · Fixed source
O—S 源轴|O—S · Source axis
A / 历史轨迹|A / Recorded tracks
k（散射后）|k (scattered)
（入射）|(incident)
χ / ψ 辅助弧|χ / ψ guides
本页角度约定|Angle convention
本页角度约定 · χ 从 −z；ψ 从 +y 朝 +x|Angle convention · χ from −z; ψ from +y toward +x
χ 从|χ is measured from
量起；ψ 在 xy 平面内由|; ψ increases in the xy plane from
朝|toward
增大。|.
R = 1.6 是天空方向球的显示尺度，不是源的真实距离。|R = 1.6 is the display radius of the direction sphere, not the physical source distance.
查看完整假设与角度约定 →|Full assumptions and conventions →
β 控件旋转 event cone|β rotates the event cone
· 拖动鼠标只改变观察视角|· Dragging changes the view only
自由观察模式|Free-flight mode
点击画面可锁定鼠标；未锁定时可直接拖动画面转向|Click the scene to capture the pointer; when unlocked, drag to look around.
鼠标已锁定 · 移动鼠标转向 · 按 Esc 返回轨道观察|Pointer captured · Move mouse to look · Esc returns to orbit view
鼠标看方向 · W/A/S/D 水平移动 · Q/E 下降/上升 · Shift 加速 · Esc 退出|Mouse: look · W/A/S/D: move · Q/E: down/up · Shift: faster · Esc: exit
水平移动|Move horizontally
下降 / 上升|Down / up
加速|Faster
退出|Exit
退出自由观察，返回轨道视角|Return to orbit view
方向原点|Direction origin
固定源|Fixed source
反投影轴端点|Axis endpoint
平面圆心|Planar center
散射后|Scattered
入射 · 射向 O|Incident · toward O
xy 平面投影|xy projection
未定义（极点）|Undefined (pole)
退化：候选方向 = S 点|Degenerate: candidate direction = S
φ=90° 大圆 / 平面盘|φ=90°: great circle / planar disk
显示回绕|wrapped display
连续区间|continuous interval
个采样点|samples
跨|sweep
段|segments
自动旋转已暂停；已有轨迹保留。|Rotation paused; recorded tracks preserved.
已记录完整 360° 旋转；手动端点保留为 360°，自动旋转时连续回绕。|Full 360° sweep recorded. The manual endpoint stays at 360°; automatic rotation wraps continuously.
自动旋转中：β 均匀增加，蓝色轨迹按角度采样。|Rotating at constant β speed; blue tracks are sampled by angle.
自动旋转已暂停；轨迹保留。|Rotation paused; tracks preserved.
历史轨迹已清空；φ、β、相机均未重置。|Tracks cleared; φ, β and camera preserved.
观察视角已重置；历史轨迹和物理参数保持不变。|View reset; recorded tracks and physics preserved.
全部通过|All passed
存在失败项|Checks failed
双精度容差：|Double-precision tolerance:
实际最大误差：|Maximum measured error:
运行耗时：|Elapsed time:
组内最大误差|Group maximum error
点击查看页面内双精度数学验证结果|View numerical validation results
φ 必须在 0° 到 180° 之间。|φ must be between 0° and 180°.
β 必须在 0° 到 360° 之间。|β must be between 0° and 360°.
浏览器拒绝了全屏请求。|The browser declined the fullscreen request.
退出全屏|Exit fullscreen
全屏|Fullscreen
操作、角度约定与物理假设|Controls, conventions and physical assumptions
1. 这个交互在展示什么|1. What this visualization shows
场景中有一个公共原点|The scene contains a common origin
、以 O 为球心、半径 R 的天空方向球，以及固定源方向|, a sky-direction sphere of radius R centered at O, and a fixed source direction
。红色的|. The red
真实 event cone|physical event cone
顶点在 O；它的轴是反投影轴|has its apex at O and back-projection axis
；与方向球相交得到红色|; its intersection with the direction sphere is the red
。无论 β 怎样旋转，event circle 都经过固定的源标记 S。|. The event circle passes through S at every rotation β.
蓝色标记|The blue marker
是反投影轴 a 在方向球上的端点|is the endpoint of a on the direction sphere,
，也是 event circle 的球面角中心。蓝色历史线记录的是 A 的轨迹，不是 event circle 所在平面的欧氏圆心 B。|and the spherical angular center of the event circle. Blue lines record A, not the Euclidean center B of the circle plane.
文字含义边界：|Interpretation:
本页把 O 当作当前示例事件的第一次相互作用位置；比较不同事件时，O 只是把不同方向向量平移到一起后的公共方向原点。真实观测中，不同光子的第一次相互作用位置并不相同。event circle 是一次事件允许的候选源方向集合，不是实际发射光子的圆环。旋转动画表示生成一族“同源方向、同 φ、不同散射方位”的可能事件，不表示一个已经测量完成的光子事件在探测器中旋转。|For the example event, O represents the first interaction. When comparing events, it is a common origin for translated direction vectors. Real photons need not interact at the same position. An event circle is a set of candidate source directions, not an emitting ring. Rotation generates a family of possible events sharing a source and φ but differing in scatter azimuth; it does not rotate a measured photon event inside the detector.
2. 本页实际采用的角度约定|2. Angle convention used here
使用右手物理坐标系 x、y、z。χ 从|The physical frame x, y, z is right-handed. χ is measured from
方向量起，范围 0°–180°；ψ 是 xy 平面方位角，从|, ranging from 0° to 180°. ψ is the xy-plane azimuth, increasing from
+y 朝 +x|+y toward +x
增大，范围 0°–360°。所有计算内部使用弧度，界面显示角度。|, ranging from 0° to 360°. Calculations use radians; the interface displays degrees.
在 χ = 0° 或 180° 的极点，ψ 没有唯一物理定义；界面显示“未定义（极点）”，不会让数值抖动或产生 NaN。参考图没有完全确定 ψ 的零方位，因此“从 +y 朝 +x”是本实现明确采用的选择，而不是声称所有 Compton 文献都采用它。|At χ = 0° or 180°, ψ is undefined and is displayed as Undefined (pole). The reference sketch does not uniquely specify the azimuth origin. Increasing from +y toward +x is an explicit choice here, not a universal convention in Compton literature.
本页公式使用离线 KaTeX（LaTeX 排版）渲染，所需字体已内嵌在单文件中，不加载网络资源。|Equations are typeset offline with KaTeX (LaTeX-style math); the fonts are embedded in this single HTML file. No network resources are loaded.
3. 源方向、入射方向、散射方向与反投影轴|3. Source, incident and scattered directions
s₀ 是从 O 指向源的固定单位向量；S = O + R s₀。入射光子传播方向与源方向相反：n|s₀ points from O toward the source; S = O + R s₀. Incident photon propagation is opposite to the source direction: n
= −s₀。散射后光子的单位传播方向记为 k；朝天空的反投影轴 a = −k。|= −s₀. k is the scattered photon direction; the skyward back-projection axis is a = −k.
χ、ψ 描述的是 k，不是 a。|χ and ψ describe k, not a.
若显示反投影轴 a 的天空坐标，必须标为 χ_a、ψ_a：|Coordinates of the back-projection axis are labeled χ_a, ψ_a:
4. 真实 event cone 的旋转构造|4. Rotation of the physical event cone
对固定源方向 s₀，取与 s₀ 垂直的正交单位基底 b₁、b₂，满足 b₂ = s₀ × b₁。β 是绕固定源方向 O—S 的额外旋转参数，不是 ψ。event cone 的反投影轴为：|Choose orthonormal b₁, b₂ perpendicular to the fixed source direction s₀, with b₂ = s₀ × b₁. β is the independent rotation about O—S, not ψ. The back-projection axis is:
event circle 上的候选源方向 s(t) 满足 |Candidate directions s(t) on the event circle satisfy
。为了在 φ→0° 或 180° 时不除以接近零的 sinφ，构造使用无除法分支：|. To avoid division by sinφ near 0° or 180°, use this division-free construction:
event circle 精确经过 S|the event circle passes exactly through S
真实 event cone 是从 O 沿这些方向延伸 0 ≤ ρ ≤ R 的母线集合，不是固定 45° 的普通 ConeGeometry。红色锥面是半透明的；φ = 90° 时它退化为过 O 的平面盘，而不是有有限高度的普通圆锥。|The physical event cone consists of generators from O with 0 ≤ ρ ≤ R, not a fixed 45° ConeGeometry. Its surface is translucent. At φ = 90° it becomes a disk through O, not a finite-height cone.
5. A、B 与轨迹的几何事实|5. Geometry of A, B and their tracks
（天空球上的球面角中心，蓝点）|(spherical angular center on the sky, blue marker)
（event circle 所在平面内的欧氏圆心，通常位于球内）|(Euclidean center of the event-circle plane, usually inside the sphere)
A 一般 ≠ B|In general, A ≠ B
固定 φ 时，A 的完整轨迹是一个平面小圆：平面垂直于 s₀，几何圆心为 O + R cosφ · s₀，欧氏半径为 R sinφ；以 S 为球面角中心时，角半径是 φ。不要把 R sinφ 标成 φ，也不要用弦长冒充球面弧长。沿球面从 S 到 A 的大圆弧中心角为 φ，弧长为 Rφ（φ 用弧度）。|For fixed φ, A traces a small circle in a plane normal to s₀. Its Euclidean center is O + R cosφ · s₀ and radius R sinφ. Its angular radius about S is φ. Do not confuse Euclidean radius or chord length with angular distance. The great-circle arc from S to A has central angle φ and length Rφ, with φ in radians.
“理论小圆”开关只显示当前 φ 的完整理论轨道，使用很淡的虚线，与已经扫过的蓝色历史轨迹明确区分，且可关闭。B 标记默认隐藏，打开时显示“平面圆心 B”。|The theoretical-orbit toggle shows a faint dashed full orbit for the current φ, distinct from recorded tracks. B is hidden by default and labeled Planar center B when enabled.
6. 历史轨迹规则|6. Track-history rules
只显示已经扫过的部分；初始不会预画一整圈实线。|Only swept portions are recorded; no full solid orbit is drawn initially.
轨迹按角度采样，间隔 0.25°，不是只按动画帧率采样；快速拖动 β 时插值补全区间。|Tracks are sampled every 0.25° rather than by frame rate. Fast β changes are interpolated.
每段记录自己的 φ、扫过的累计 β、对应单位方向向量和样式。渲染时绝不把旧点重新套用成最新 φ。|Each segment retains its own φ, cumulative β, unit directions and style. Old points are never recomputed with the current φ.
改变 φ 时先闭合旧段，再开启新段；绝不在不同 φ 的点之间画连线。只改 φ 不会生成新的蓝线。|Changing φ finishes the old segment and starts a separate one when rotation resumes. No line joins different φ values; changing φ alone records no line.
视角变化、缩放、暂停/继续、显示开关、重置视角都不删除历史。只有“清空轨迹”删除历史，而且不会重置 φ、β 或相机。|View changes, zoom, playback and visibility toggles preserve history. Only Clear tracks deletes it, without resetting φ, β or the camera.
β 内部保留未取模的累计角度，显示时回绕到 0°–360°。β 的绝对数值输入按显示旧值→新值的数值差录制，不做“最短角路径”修正，所以 0°→360° 会留下完整一圈。手动调整数值会暂停自动旋转。|β is stored as an unwrapped cumulative angle. Manual input uses the numerical interval between displayed values, not the shortest angular path: 0° to 360° records a full orbit. Manual 360° remains at the endpoint; automatic rotation wraps. Manual edits pause playback.
7. Compton 能量关系|7. Compton energy relations
给定入射光子能量 E = 1000 keV 的紧凑示例：|Example with incident photon energy E = 1000 keV:
若通过第一次散射的电子能量沉积 Eₑ 和散射后光子的完全吸收能量 E_γ 反算 φ，可使用：|To reconstruct φ from the first electron deposit Eₑ and fully absorbed scattered-photon energy E_γ, use:
本页同时显示当前 E′ 和 Tₑ。这里的旋转是按 β 均匀生成几何，不是真实探测计数分布；实际事件概率还需 Klein–Nishina 截面、探测器几何、接受度与筛选条件，本版本不模拟这些概率。|The interface displays E′ and Tₑ. Uniform β rotation illustrates geometry, not measured counts. Event probabilities also depend on the Klein–Nishina cross section, detector geometry, acceptance and selection; these are not simulated.
8. 操作与观察方式|8. Controls and viewing
轨道观察（默认）|Orbit view (default)
左键拖动：绕 O 旋转观察视角|Left-drag: orbit around O
右键或 Shift + 拖动：平移观察中心|Right/Shift-drag: pan the view
滚轮：缩放|Scroll: zoom
可以从上方、侧方、下方观察|Observe from above, beside or below
明确点击“自由观察”进入，浏览器会请求 Pointer Lock|Click Free flight to request pointer capture
移动鼠标：改变朝向|Move mouse: look around
W/A/S/D：水平移动；Q/E：下降/上升|W/A/S/D: move horizontally; Q/E: down/up
Shift：加速；Esc：退出并回到轨道视角|Shift: faster; Esc: return to orbit view
若浏览器未授予 Pointer Lock，可直接拖动画面转向|If pointer capture is unavailable, drag to look around
相机操作不会改变物理参数。|Camera input does not change physics.
“绕源方向旋转 event cone”与“移动摄像机观察场景”是两种独立操作；旋转视角不会被当成 β。|Rotating the cone about the source and moving the camera are independent operations. Camera orbit does not change β.
9. 简化、范围与限制|9. Assumptions and limitations
理想化：遥远点源；入射光子在探测器尺度上近似平行；初始电子静止；使用自由电子 Compton 关系。|Assumptions: a distant point source, approximately parallel incident photons, an initially stationary electron, and free-electron Compton scattering.
不考虑测量误差、Doppler broadening、背景和探测器接受度；展示的是几何上允许的一族事件。|Measurement errors, Doppler broadening, background and detector acceptance are omitted. This is a geometrically allowed family of events.
O 的双重用途按第 1 节说明：示例事件可视为第一次相互作用位置；不同事件比较时只是公共方向原点。|As explained in section 1, O is an example first interaction or a common direction origin when comparing events.
φ 的滑块步长较小但有限；极点附近角度辅助线会退化为不可见或极短，而物理量仍给出有限值。|The φ slider has a finite step. Near poles, angle guides may shrink or disappear while physical quantities remain finite.
本版本不实现 Compton data space、球面到平面投影、图像重建或固定 45° 辅助锥。所有位置与角度都按完整双精度计算后再送入渲染。|This version does not implement CDS, sphere-to-plane projection, image reconstruction or a fixed 45° helper cone. Geometry is calculated in double precision before rendering.
红色锥面在 φ = 90° 附近是真实几何的平面盘；φ 接近 0° 或 180° 时锥面接近一条射线并可能显得薄。|At φ = 90° the surface is a planar disk. Near 0° or 180° it approaches a ray and may appear thin.
页面内数学验证|Numerical validation
以下检查直接调用页面使用的物理函数，覆盖方向/角度约定、反投影轴、event circle、退化角、历史记录不变性、独立数值例子与能量关系。双精度非退化条件的目标容差为 10|These checks run the application's physics functions: angle conventions, back-projection axes, event circles, degeneracies, immutable history, independent examples and energy relations. The double-precision target tolerance away from degeneracies is 10
；WebGL 渲染缓冲不参与此容差。|; this tolerance excludes WebGL rendering buffers.
独立数值例子。|Independent numerical example.
取 s₀ = (0,0,1)，b₁ = (1,0,0)，b₂ = (0,1,0)，R = 1，φ = 60°。完整 A 轨迹满足 z = 0.5、x² + y² = 0.75：平面高度 0.5，欧氏半径 √3/2，而不是“半径 60°”或“半径 π/3”。β = 0° 与 360° 姿态相同，但 0°→360° 的扫描必须留下完整圆周。|For s₀ = (0,0,1), b₁ = (1,0,0), b₂ = (0,1,0), R = 1 and φ = 60°, the full A track satisfies z = 0.5 and x² + y² = 0.75. Its Euclidean radius is √3/2, not 60° or π/3. β = 0° and 360° give the same pose, but the sweep must record a full orbit.
重新运行|Run again
关闭|Close
正在初始化 WebGL 场景与物理自检…|Initializing WebGL and numerical checks…
无法启动三维场景|Unable to start the 3D scene
页面需要本地 WebGL 支持。请确认浏览器未禁用硬件加速，或换用较新版本的 Chrome / Edge / Safari / Firefox。此页面不依赖联网加载资源。|WebGL is required. Enable hardware acceleration or use a recent Chrome, Edge, Safari or Firefox. This page does not load resources from the network.
初始化错误。|Initialization error.
重新加载|Reload
此交互页面需要启用 JavaScript 与 WebGL。|This visualization requires JavaScript and WebGL.
三维 Compton 几何视口|3D Compton geometry viewport
Compton event cone 三维几何场景|3D Compton event-cone scene
`.trim().split('\n').map(line => { const i=line.indexOf('|'); return [line.slice(0,i), line.slice(i+1)]; });

entries.push(...`
角度约定与往返=>Angle conventions and round trips
χ 从 −z 量起、ψ 从 +y 朝 +x 增大；极点 ψ 标记为未定义。=>χ is measured from −z; ψ increases from +y toward +x and is undefined at the poles.
源基底与反投影轴=>Source basis and back-projection axis
真实 event circle=>Physical event circle
|s(t)|=1，s(t)·a=cosφ，s(0)=s0，且圆心 B = O + R cosφ a。=>|s(t)|=1, s(t)·a=cosφ, s(0)=s0; planar center B = O + R cosφ a.
退化角与 φ>90°=>Degenerate angles and φ>90°
φ=0°/90°/180° 不产生 NaN；超过 90° 仍按有向向量公式绘制。=>No NaNs at 0°, 90° or 180°; directed-vector geometry is retained beyond 90°.
独立数值例子=>Independent numerical example
s0=(0,0,1), b1=(1,0,0), b2=(0,1,0), R=1, φ=60°：A 轨迹应满足 z=0.5 与 x²+y²=0.75。=>s0=(0,0,1), b1=(1,0,0), b2=(0,1,0), R=1, φ=60°: A must satisfy z=0.5 and x²+y²=0.75.
历史轨迹不变性=>Track-history invariance
分 φ 存点，只显示扫过部分，改变 φ 不重算旧轨迹，清空只删历史。=>Store points separately by φ; record swept portions only, preserve old tracks and clear history independently.
Compton 能量关系=>Compton energy relations
E′=E/[1+(E/mₑc²)(1−cosφ)]，Tₑ=E−E′，能量沉积反算 φ。=>E′=E/[1+(E/mₑc²)(1−cosφ)], Tₑ=E−E′; reconstruct φ from energy deposits.
degree/radian 往返=>Degree/radian round trip
wrapTwoPi 落在 [0, 2π) 且同向=>wrapTwoPi is in [0, 2π) and preserves direction
d(χ=90°,ψ=90°) = +x（ψ 从 +y 朝 +x 增大）=>d(χ=90°,ψ=90°) = +x (ψ increases from +y toward +x)
d → (χ,ψ) → d 分量往返（非极点）=>d → (χ,ψ) → d component round trip, away from poles
ψ 往返（角差，非极点）=>ψ round trip (angular difference, away from poles)
χ=0 极点：χ≈0 且 ψ=null=>χ=0 pole: χ≈0 and ψ=null
χ=180 极点：χ≈π 且 ψ=null=>χ=180 pole: χ≈π and ψ=null
极点不产生 NaN=>No NaNs at the poles
默认源 (χ0,ψ0)=(145°,35°) 往返=>Default source (χ0,ψ0)=(145°,35°) round trip
基底单位性（多组源方向）=>Unit basis vectors for multiple source directions
基底正交性=>Basis orthogonality
max ||a|-1|（13 个 φ × 10 个 β）=>max ||a|-1| (13 φ values × 10 β values)
β=0° 与 β=360° 姿态一致=>Identical poses at β=0° and β=360°
β=−55° 与 β=305° 一致（内部不做最短路径）=>β=−55° and β=305° agree (no shortest-path correction)
max |s(0)−s0|（event circle 必须经过 S）=>max |s(0)−s0| (event circle must pass through S)
圆环首尾闭合=>Circle endpoints close
所有采样点到平面圆心 B 的欧氏半径 = R|sinφ|=>Euclidean distance from all circle samples to B = R|sinφ|
圆环点相对 B 的方向与 a 垂直=>Circle-point offsets from B are perpendicular to a
t=0 显式落点等于 S=>The t=0 point equals S
B 与 S 的夹角关系（源在圆上）=>B–S angular relation (source lies on circle)
A 与 B 一般不重合：|A−B| = R(1−cosφ)=>A and B generally differ: |A−B| = R(1−cosφ)
A 在天空球上而 B 在球内：R(1−cosφ)>0=>A lies on the sphere and B inside: R(1−cosφ)>0
网格与圆环所有坐标有限=>all mesh and circle coordinates are finite
event circle 仍然经过 S=>event circle still passes through S
分类为退化射线=>classified as a degenerate ray
锥面/圆环半径约为 0=>cone/circle radius approximately zero
时 A 与 S 重合=>A coincides with S
分类为平面盘=>classified as a planar disk
时 B 位于 O=>B is at O
时 event circle 的欧氏半径 = R=>event circle has Euclidean radius R
时 A 位于 S 的对跖点=>A is antipodal to S
φ→0/180 非退化数值分支有限且单位=>Near 0°/180°, nondegenerate branches remain finite and normalized
φ=145° 保留 cosφ<0，而不是自动替换成 35°=>φ=145° retains cosφ<0 without substitution by 35°
φ=145° 时 (−s0)·k 仍等于 cosφ=>At φ=145°, (−s0)·k still equals cosφ
β=0° 与 360° 姿态一致=>Identical poses at β=0° and 360°
0°→360° 扫过完整圆周（360 个方位 bin 全部覆盖）=>0°→360° covers the full orbit (all 360 azimuth bins)
β 增大时 A 的方位角单调扫过整圈=>Increasing β sweeps A monotonically around the source
轨迹平面 z=0.5 的几何半径 √3/2（不是 φ=60° 或 π/3）=>Track plane z=0.5 has radius √3/2, not φ=60° or π/3
35° 下 0°→180° 形成一个独立 segment=>At 35°, 0°→180° creates a separate segment
segment 起点 β≈0°=>Segment starts at β≈0°
segment 终点 β≈180°=>Segment ends at β≈180°
采样角间隔 ≤ 0.5°=>Angular sampling interval ≤ 0.5°
只改 φ、不转 β 时不新增 segment=>Changing φ alone creates no segment
只改 φ 后旧轨迹数据逐字节不变=>Old track data remains byte-identical after changing φ
55° 下继续转动创建新 segment=>Rotation at 55° creates a new segment
新 φ 下有独立段，不与 35° 段合并=>New φ creates a separate segment, not merged with 35°
35° 段的点仍然保持 35° 记录，未被最新 φ 重算=>35° points retain their recorded geometry, not recomputed using the latest φ
所有历史点：|A−O|=R（方向为单位向量）=>All history points: |A−O|=R (unit directions)
所有历史点：(A−O)·s0 = R cosφ（按记录 φ）=>All history points: (A−O)·s0 = R cosφ (recorded φ)
β 静止时不重复追加点=>No repeated points while β is stationary
β=0°→360° 记录起点 0°=>β=0°→360° records the 0° start
β=0°→360° 记录终点 360°=>β=0°→360° records the 360° endpoint
β=0°→360° 保留完整轨迹点（不是“没动”）=>β=0°→360° retains a full track despite matching endpoint poses
clear() 删除所有历史段=>clear() removes all history segments
clear() 后当前 φ 记录不参与渲染可恢复=>After clear(), the current φ remains available for subsequent recording
35° 散射后能量 E′ 在 (0,E) 内=>At 35°, scattered energy E′ lies in (0,E)
φ=0° 时 E′=E=>At φ=0°, E′=E
φ=180° 时 E′ 最小且仍 > 0=>At φ=180°, E′ is minimal and positive
能量沉积反算 φ 与输入一致（1000 keV, 35°）=>Energy-deposit reconstruction matches φ (1000 keV, 35°)
mₑc² 使用 510.999 keV=>mₑc² = 510.999 keV
`.trim().split('\n').map(line => { const i=line.indexOf('=>'); return [line.slice(0,i),line.slice(i+2)]; }));
