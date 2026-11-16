# 正背面切换与响应式布局

## 根因检查

V7.0 的人体结果页把人体、结果标签和操作区放在同一条纵向空间中，查看区高度和底部控件共同挤占空间。透明 Canvas 与页面手势区域没有足够的布局隔离时，视觉切换控件会靠近画布边界，自动化和真实触摸都存在被覆盖的风险。

本次没有只提高按钮层级，而是同时处理布局关系：

1. 正背面切换设置为 `flex: 0 0 auto`，位于人体或结果查看区之前的独立行。
2. 查看区设置 `overflow:hidden`，Canvas 绘制内容和触摸层不能越过自身容器。
3. 切换行与标签保留局部层叠，保证交互控件位于静态查看区之上。
4. 人体画布继续按容器等比适配，没有用页面总高度强制拉伸。
5. P9 的双栏条件继续基于容器宽高媒体查询，不读取设备名称。

适用文件：

- `miniprogram/pages/select/select.wxss`
- `miniprogram/packages/clinical/pages/annotate/annotate.wxss`
- `miniprogram/packages/clinical/pages/placement/placement.wxss`
- `miniprogram/packages/special/pages/local-surface/local-surface.wxss`

## 微信实际验证

微信开发者工具使用 `HUAWEI Mate X6内 100%` 预设：

1. 主页面显示完整人体、正面/背面切换和核心业务入口。
2. 点击“背面”后 AX 状态从“人体正面示意模型”变为“人体背面示意模型”，背面切换按钮为选中值。
3. 再次点击“正面”后恢复正面模型和对应左右方向。
4. 手动标注页成功打开，显示独立正背面计数、Canvas、全身、撤销、取消和闭合范围；空状态没有多余范围筛选。

主界面截图见 [修改后主界面](evidence/after-main.jpg)；背面切换结果另由微信 AX 状态确认。

## 自动回归

现有 P9/P11/placement/local-surface 测试继续覆盖 320、375、430 像素宽度、矮屏、折叠尺寸变化、Canvas 坐标重测和手势取消。新增 V7.1 测试同时断言切换行独立层级和查看区裁剪，防止后续仅用提高按钮 z-index 掩盖布局问题。

**物理折叠屏开合、键盘和真实手指边界命中仍为 NOT_RUN。**
