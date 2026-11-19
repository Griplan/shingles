# 26 术语表

> 文档基线：2026-11-19。术语按项目实际含义解释；“医学边界”和“工程模拟”必须区分。

## 26.1 产品与医学

| 术语 | English | 本项目含义 | 不能误解为 |
| --- | --- | --- | --- |
| 智络智绘 | dermatome-mapper | 人体病灶标注、照片辅助分割和参考分区匹配研究工具 | 诊断产品 |
| 病灶 | lesion | 用户圈选或 AI 提示得到的皮肤可见区域 | 已证实病因 |
| 带状疱疹 | herpes zoster | 项目背景疾病之一，不由 MobileSAM 直接诊断 | 图片分类结论 |
| 神经皮节 | dermatome | 一侧脊神经根相关皮肤区域参考分布 | 单一感觉点或外周神经分支 |
| 神经节段 | spinal segment | 参考标签如 T4、L5 的节段概念 | 对患者真实受累根的确定诊断 |
| 参考区域 | reference region | 图谱中的二维多边形 | 临床真实边界保证 |
| 模拟分区 | schematic region | 人工构建用于交互演示的区域 | 已审核医学图谱 |
| 推定图谱 | provisional atlas | 由有限来源和变换近似构建的试验数据 | 精确原图边界 |
| 医学审核 | medical review | 有记录的专业人员审核 | 自动测试通过 |
| 覆盖比例 | coverage ratio | 病灶面积与参考区域交集的比例 | 疾病概率或医学置信度 |
| 未覆盖区域 | uncovered region | 没有被当前 atlas 几何覆盖的有效表面 | 自动归属最近标签 |

## 26.2 坐标与视图

| 术语 | 定义 | 使用位置 |
| --- | --- | --- |
| 屏幕坐标 | CSS/客户端像素，原点通常为元素或窗口左上 | 触摸、布局 |
| Canvas backing store | DPR 放大后的绘制缓冲区坐标 | Canvas 2D |
| `photo_oriented_normalized_v1` | EXIF 转正后的照片归一化坐标，x/y 均在 `[0,1]` | AI 提示、Mask、照片 Polygon |
| `body_template_normalized_v1` | 某一人体/特殊模板的归一化坐标 | V2 保存、V4 匹配 |
| `normalized_2d_top_left` | 后端 identity/坐标契约的总称 | API |
| front | 完整人体正面 | 全身视图 |
| back | 完整人体背面 | 全身视图，独立坐标 |
| viewId | 唯一视图标识，如 `sole-left` | 图谱、会话、匹配 |
| templateId/version | 人体底板和有效几何版本 | identity |
| geometryId | 有效皮肤外轮廓/孔洞几何 | identity |
| regionSetId | UI 粗区域集合 | identity |

## 26.3 几何

| 术语 | 定义 | 关键约束 |
| --- | --- | --- |
| Polygon | 一个外环加零个或多个孔洞 | 环合法、方向最终按库解释 |
| MultiPolygon | 多个独立 Polygon | 不合并成凸包 |
| 外环 | Polygon 最外层闭合边界 | 表示病灶或皮肤范围 |
| 孔洞 | 外环内部未受影响的区域 | 必须保留 |
| 顶点 | `[x,y]` 坐标对 | 有限浮点，归一化 |
| 闭合环 | 首尾概念上相连的环 | API 通常不重复首点 |
| 自交 | 边与非相邻边相交 | 非法几何 |
| 重叠片区 | MultiPolygon 两个 polygon 有面积重叠 | V7 源几何通常拒绝 |
| 边界接触 | 只点/线接触、无面积交集 | 与面积重叠区分 |
| 有效皮肤 | 人体模板中允许放置的区域 | 不是 Canvas 矩形 |
| 人体孔洞 | 人体轮廓内不允许病灶的空隙 | 如两腿之间、手臂与躯干之间 |
| 交集 | Shapely `intersection` | 面积匹配核心 |
| 并集 | Shapely `unary_union` | 去重与覆盖率 |
| 裁剪 | 病灶与人体/视图交叠后生成有效部分 | 裁剪后必须重新验合法 |
| 拓扑 | 自交、洞越界、片重叠、共享边等关系 | 与坐标变换正确性分开 |

## 26.4 AI

| 术语 | 本项目含义 |
| --- | --- |
| MobileSAM | Segment Anything 的轻量提示式分割模型 |
| predictor | 将图片编码后响应点/框提示并输出掩码的模型对象 |
| embedding | 图像编码后的特征表示；当前尚未做持久特征缓存 |
| point prompt | 前景或背景提示点 |
| box prompt | 用户框选区域 |
| Mask | 原处理图同尺寸的二值分割结果 |
| candidate | 模型返回的一个待确认 Mask |
| contour | Mask 转换得到的边界 |
| 二次修正 | 用笔刷或补充提示调整候选 |
| 人工确认 | 用户选择最终候选，系统不自动认定最高分 |
| 过度分割 | 候选包含大片正常皮肤 |
| 空 Mask | 模型没有返回有效区域 |
| stale result | 属于旧图片、旧框或旧 revision 的迟到结果 |

## 26.5 会话与状态

| 术语 | 定义 |
| --- | --- |
| V2 annotation session | 小程序中的手工/确认后标注权威会话 |
| AI session | 服务端与一张临时照片关联的分析会话 |
| session token | 服务端只保存摘要的能力令牌 |
| principal | access 层绑定的随机访问主体 |
| activity time | 最近有效请求的活动时间 |
| idle TTL | 无活动后自动回收时长，当前默认 120 秒 |
| placement draft | AI 照片几何到人体坐标的独立编辑草稿 |
| placementTransform | translate、scale、rotation、锚点等 |
| matching result | 某 view + annotation revision 的几何匹配输出 |
| revision | 防止旧异步结果覆盖新状态的版本号 |
| scene key | Canvas 当前 page/view/data 的组合标识 |
| overlay ready | 当前 revision 的 Canvas 已完成正式绘制 |

## 26.6 图谱与数据状态

| 术语 | 定义 |
| --- | --- |
| Atlas | 按 version 管理的区域集合 |
| manifest | atlas/template/geometry/region/hash/license 等元数据 |
| source path | SVG 原始 path 的追踪标识 |
| registration | 来源几何到目标模板的配准方法 |
| `SCHEMATIC` | 人工示意数据 |
| `PROVISIONAL` | 近似驱动数据，待进一步审核 |
| `NOT_MEDICALLY_VALIDATED` | 未经医学验证 |
| `INTERACTIVE_SIMULATION` | 只用于交互模拟 |
| `ARTIFICIALLY_CONSTRUCTED` | 人工构建几何 |
| `mappingEnabled` | 是否允许该 atlas 进入匹配 |
| content SHA | 防止内容静默改变 |

## 26.7 工程状态

| 标签 | 含义 |
| --- | --- |
| IMPLEMENTED | 当前源码实现 |
| TESTED | 当前环境有可重复测试证据 |
| DEPLOYED | 特定环境有部署证据 |
| PARTIAL | 只完成部分范围 |
| TRIAL_VERIFIED | 新体验包并在真机完成实际流程 |
| NOT_RUN | 应做但没有执行 |
| BLOCKED | 缺外部条件，无法安全推进 |
| DEPRECATED | 历史保留但不再作为产品入口 |
| UNKNOWN | 证据不足 |

## 26.8 常用缩略语

| 缩写 | 含义 |
| --- | --- |
| ADR | Architecture Decision Record，架构决策记录 |
| API | Application Programming Interface |
| DPR | Device Pixel Ratio，设备像素比 |
| EXIF | 图片方向等元数据 |
| MP | Megapixel，百万像素 |
| MultiPolygon | 多片多边形集合 |
| RAF | requestAnimationFrame |
| RSS | Resident Set Size，进程常驻内存 |
| TTL | Time To Live，会话空闲/过期时间 |
| V2/V4/V7 | 项目内部版本阶段，不是医学分级 |
