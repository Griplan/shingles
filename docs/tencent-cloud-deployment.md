# 智络智绘腾讯云部署报告

日期：2026-11-01，22:23开工（北京时间；最终快照22:37，文档及清理随后完成）。唯一开发台账见[task.md](../task.md)。

**服务器已部署，公网或微信联调仍待完成。** P1独立服务与P3服务器启停验收通过；P2独立域名/HTTPS、微信合法域名和完整原生联调未完成。用户本轮明确回复“暂无新域名，先完成服务器部署”及“暂不操作，先完成服务器验收”。不能称为微信真机或患者上线验收。

## 1. 实际环境与部署版本

| 项目 | 实际结果 |
|---|---|
| 目标 | 既有SSH别名 `acupuncture-server`，未扫描其他主机 |
| 系统/CPU | Ubuntu24.04.4 LTS、Python3.12.3、x86_64，4逻辑CPU，AMD EPYC7K62来宾型号 |
| 内存 | 总3.64GiB；本轮保护采样最低MemAvailable约2.25GiB |
| 磁盘 | 40GiB系统盘，开工可用约29.44GiB；新增生产目录约0.95GiB |
| 正式目录 | `/srv/dermatome-mapper/`，独立 `.venv/` |
| 用户/权限 | `dermatome`系统用户、nologin；代码/模型/venv归root，运行用户只写runtime/logs；不允许读取A目录与P0目录 |
| 版本 | `20261101-p1p3-92c517b5f35a`；不是Git提交。92个运行文件逐一核验，[版本清单](../deployment/release-manifest.json)，[版本摘要](validation-records/tencent-deployment-20261101/release.json) |
| 模型 | 官方MobileSAM vit_t，commit `f706ad9c4eb7f219c00d9050e46328518ffb65d2`，Apache2.0；40,728,226字节，SHA256 `6dbb90523a35330fedd7f1d3dfc66f995213d81b29a5ca8108dbcdd4e37d6c2f` |
| Python依赖 | torch2.5.1+cpu、torchvision0.20.1+cpu、timm1.0.12、NumPy2.1.3、Pillow11.1.0、Shapely2.1.2；API沿用本机已测试FastAPI0.162.0/Uvicorn0.54.0/Pydantic2.14.1。完整[Linux锁定清单](../deployment/requirements-linux-cpu.lock)，pip check通过 |

复用P0的CPU wheel及核验权重，在新目录重新建venv、安装固定依赖；没有把P0目录当生产目录、没有安装CUDA包或重新下载模型权重。P0证据与测试环境保留。只部署backend/AI/必要图谱，以及图谱校验所需的两份人体来源TS文件，没有部署整套小程序。没有Git提交/推送、资源购买或服务器升级。

## 2. 独立服务与限制

`dermatome.service`已enabled/active，Uvicorn单worker，**只监听127.0.0.1:8001**。原`acupuncture.service`继续使用127.0.0.1:8000。

- 硬限制实测：`cpu.max=100000 100000`，`memory.max=1610612736`、high=1342177280、swap.max=0，TasksMax64、Nice10、CPUWeight20。CPUQuota100%约为1逻辑CPU的配额，参见[systemd官方说明](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html)。不代表独占全部4核。
- OMP/MKL/OpenBLAS线程1；代码显式MobileSAM线程1，真实模型元信息已核实。进程还含HTTP线程，不能把“推理1线程”解释为总共只有1个操作系统线程。
- 模型惰性加载、单实例缓存。全局推理/画笔修正锁，忙碌直接429，不建立无界队列。
- 最多2个临时照片会话、2个在途AI写请求；10MiB文件、multipart额外64KiB，解码总像素≤3,000,000、单边≤8192且最小8像素。只允许解码验证的静态JPEG/PNG/WebP；不信任扩展名和MIME，不偷偷缩图。匹配请求2MiB上限。
- 模型处理45秒超时；客户端AI60秒；Uvicorn最多12连接、有限backlog、关闭空闲连接。停止优雅等待50秒，systemd停止上限60秒。
- on-failure重启间隔15秒，5分钟内最多3次，OOMPolicy=stop；不会无限快速重启或自行扩大内存上限。

服务定义：[dermatome.service](../deployment/dermatome.service)。模型未加载时health成功不代表模型已经推理过；本轮另有真实推理证据。

## 3. 访问保护与临时照片

新增`DERMATOME_ENV=controlled`，并保留development/test以及默认production关闭规则。controlled必须同时配置访问凭据SHA256和相应功能开关，不能单靠ENABLE开关公开接口。

- 除最小健康检查外，API必须携带`x-test-access-key`；后端只保存凭据摘要，常量时间比较，认证在请求体解析前完成。每分钟全局120个认证请求、新建会话8次，超限429；当前为单worker、共享测试名额，尚非正式多用户身份系统。
- 照片还必须有独立`x-ai-session-key`，两层保护均需要。无静态目录挂载/公开文件名/照片URL令牌；私有响应no-store，下载限定文件名与结果版本。
- 拒绝带Origin的跨站访问；没有开放通配CORS。原生小程序没有浏览器Origin，不依赖CORS代替鉴权。
- `/docs`、`/redoc`、`/openapi.json`在controlled一律404；不暴露内部路径、照片、提示或凭据。关闭Uvicorn访问日志，技术日志进独立journal。
- 上传原文件校验后删除，保存去EXIF统一方向的PNG、Mask与完整多片/孔洞轮廓。私有目录0700、快照0600；快照只存会话令牌摘要。
- **停服务不会删除未过期照片/结果**：受控模式原子快照，启动恢复并保持原expires_at；中断/超时结果持久失效，不能重启复活旧结果。V2人体标注继续在小程序会话中，停服务不清它，也没有新增病例数据库。
- 固定30分钟失效；运行时30秒检查；停止时独立`dermatome-cleanup.timer`每5分钟检查，故物理删除可能滞后失效最多约5分钟。取消立即删除；损坏快照在下次启动检查，非正常目录/符号链接不批量清理。清理和主服务使用同一独占锁。

私密服务配置只在服务器`config/service.env`（root0600）。本机测试凭据仅在被Git忽略的`private-data/cloud-access.json`，不在报告、小程序包或日志中。小程序由用户输入，凭据只在运行内存；未提供微信正式用户鉴权、隐私备案或患者数据管理验收，**目前仅用公开/合成测试图片**。

## 4. 真实测试结果

| 测试 | 结果/证据 |
|---|---|
| 锁定环境安装、CPU wheel、权重校验 | PASSED；第二轮安装退出0、pip check正常，安装受相同1CPU/1.5GiB限制，峰值约1.2GiB、cgroup swap0 |
| Python后端+AI | PASSED，`ai/.venv/bin/python -m pytest backend/tests ai/tests -q`，169项全量；最后新增频率断言的8项访问专项另行通过（与全量重叠）；含受控鉴权/来源/大小/像素/持久失效/停启/清理；7条官方timm/registry警告 |
| 小程序 | PASSED，`npm --prefix miniprogram test`，286项，含凭据内存模式/HTTPS门禁保护；TypeScript实际编译 |
| 云端完整链路 | PASSED，`DERMATOME_TEST_BASE=http://127.0.0.1:18001 node scripts/test_placement_http.cjs ...`；微信API和Canvas适配器执行真实页面状态/几何及真实云端HTTP，**不是原生GUI或真机** |
| 上传→分割→确认→背面放置→70%/25°→V2保存→匹配/编辑重算→清照片 | PASSED；与手工来源的相同人体几何返回完全一致，清照片后仍可匹配；未改公式/人体/图谱 |
| 云端安全/AI专项 | PASSED，`ai/.venv/bin/python scripts/test_cloud_http.py`，20项真实检查：健康200、缺鉴权401、跨站403、文档404、坏图/3MP超限422、请求体超限413、EXIF、真实3候选、单并发429、异会话410、确认和资源下载 |
| Mask/轮廓一致 | PASSED，700×460原尺寸Mask与独立Shapely像素中心回栅格全等；照片坐标仍photo_oriented_normalized_v1，不是医学准确率 |
| 启动/停止/重启 | PASSED，`scripts/test_cloud_lifecycle.py`，见下节；未过期原Mask哈希不变，重新真实推理成功，取消204、取消后访问410 |
| Linux独立TTL清理 | PASSED，低权限用户在B隔离临时目录验证过期删除、未过期保留、符号链接目标保留；清理unit在服务运行锁占用时安全跳过 |
| A保护 | PASSED，监测274轮A健康/就绪均200；本机/原HTTPS结束均200，PID/启动时间/自动重启次数不变，6个原核心文件哈希一致；39个本机人体/图谱/匹配/会话核心文件哈希未变 |
| 微信开发者工具 | 只验证最新入口实际编译与首页显示。完整原生云端流程NOT_RUN，用户暂不输入凭据；不称微信联调通过 |
| B公网HTTPS、微信合法域名、真机 | NOT_RUN，用户确认暂无B域名；无Nginx改动、无证书签发、无合法域名登记 |
| 真正45秒超时/弱网/生产故障注入 | NOT_RUN；超时、会话过期等已有自动化测试，未伪造云端HTTP504或等待30分钟的实时过期验收 |
| 最大3MP全HTTP、长时多用户、A视觉推理同时运行 | NOT_RUN；P0有2.98MP独立模型测试，不冒充本轮全HTTP或双业务峰值验收 |

真实样本仅CDC PHIL21505公开图（授权来源沿用V5.1记录），不是新收集的患者图。无临床准确率结论。[原图](validation-records/tencent-deployment-20261101/cloud-http/public-original.png)、[Mask](validation-records/tencent-deployment-20261101/cloud-http/mask.png)、[叠加预览](validation-records/tencent-deployment-20261101/cloud-http/overlay.jpg)。

### 实际耗时与资源，口径分开

- 首次云端HTTP分割约6.91秒（含模型加载）；同进程细化3.61秒；独立专项暖模型3.58秒。匹配约356～392ms，含SSH通道/HTTP传输。
- 停后start首次推理7.66秒，restart首次6.78秒。不是M4/MPS速度或固定延迟保证。
- 全HTTP服务观察到进程高水位约764.9MiB，cgroup峰值约696.75MiB，两个计量口径不能相加。最终RSS约543.6MiB，当前模型已加载。
- 空闲2秒采样约0.11%单核CPU，不是业务繁忙时CPU；单核配额已在cgroup验证。
- 停止前cgroup约480.70MiB、RSS约549.72MiB；停止后PID0、8001不监听，MemAvailable从约2.34GiB增至约2.76GiB（约436MiB变化，包含其他系统活动）。不是增加公网带宽的承诺。
- 全机swap从开工12KiB增至524KiB，pswpout1→5、pswpin0、oom_kill0；B cgroup swap/OOM0。不能声称系统完全没发生换页。

### 失败记录与修复

1. 首轮安装因全机pswpout新增3页触发沿用P0的严格监测，安装被TERM；systemd显示success不代表pip安装完成。复核三次可用内存约2.8GiB、PSI均0、A均200后，仅将临时监测调整为新增换出>1MiB、任何换入/OOM、swap分配>1MiB、PSI avg10>0.5%、可用<1GiB或A异常即停B/安装；B硬资源限制不变。残缺新venv重建，第二轮成功。见[复核记录](validation-records/tencent-deployment-20261101/install-guard-review.md)。
2. 首次SSH命令沿用了ClearAllForwardings=yes，清掉指定转发；修正为唯一显式回环转发后成功，保留首次失败日志。没有扩大公网暴露。
3. 首次启停断言只接受连接异常，而SSH/本机传输实际返回502；服务已确实停止、无监听，修正为允许明确不可用响应，随后start/restart完成。该502不能说成Nginx新站点已配置。
4. 第一次本地回归暴露预处理默认参数固化常量和测试间限流计数共享；修复后169项全过。最后又补上超时失效快照，最终云端版本完整HTTP复验通过。
5. 普通SSH用户直接统计0700照片目录被权限拒绝，未放松目录权限；用管理员只统计目录数量，结束为0，无照片内容输出。

所有失败日志保留，未覆盖成通过。完整[证据目录](validation-records/tencent-deployment-20261101/)。

## 5. 独立启动、停止、重启

在服务器上：

```bash
sudo systemctl stop dermatome
sudo systemctl start dermatome
sudo systemctl restart dermatome
sudo systemctl status dermatome --no-pager
sudo journalctl -u dermatome -n 50 --no-pager
```

本机也可直接双击[停止云端后端.command](../停止云端后端.command)、[启动云端后端.command](../启动云端后端.command)、[查看云端状态.command](../查看云端状态.command)。固定SSH别名和服务目标，不能传任意服务名；[脚本](../deployment/cloud-control.sh)最后只读检查A仍active。服务器版[控制脚本](../deployment/dermatome-control.sh)也只接受固定动作。

`stop`只停止当前运行，enabled仍保留，机器下次启动可恢复；`disable`改变开机自动启动，单独disable不等于立即stop。本轮没有disable。停服务时正在进行的B请求可能中断，客户端显示不可用并保留V2标注，不返回假结果；已在AI页确认但尚未放到人体的数据仍遵循小程序原会话生命周期和服务器30分钟TTL。

停止不需重启Nginx，也不会停A。`dermatome-cleanup.timer`保留，以便B暂停时继续清理过期敏感临时文件；主模型不会由该timer拉起。

## 6. 当前实际可用访问方式

1. 服务器本机：`http://127.0.0.1:8001/api/v1/health`；受保护的`/api/v1/ready`验证图谱/人体版本和模型是否加载。历史`GET /atlas`仍501，未伪造新图谱查询API。
2. 本机SSH通道：运行[cloud-tunnel.sh](../deployment/cloud-tunnel.sh)，保留窗口；访问`http://127.0.0.1:18001`。API依旧需要访问凭据；这不是手机可访问地址。测试结束后本轮临时通道关闭，可自行重新开启。
3. 微信开发工具首页“连接受控云端测试服务”，输入单独保存在本机private-data的测试凭据；切换到18001。切回本机恢复原8000，原本机后端不被停止。凭据不持久化，重编译须重填。

本轮没有B公网URL、证书、Nginx站点或微信域名；没有借用A正式域名承载B，没有公开8001，没有降低TLS或合法域名检查来冒充上线。

## 7. 域名具备后的最少人工准备

用户提供明确授权的B域名/子域名及DNS操作权限、备案/主体确认。检查解析到既有服务器，再独立签发覆盖B域名的证书；保留A站点/证书不动。新增B站点前备份、`nginx -t`成功才reload，再立即检查A与B的HTTPS。

B站点需独立上传上限（至少10MiB文件+multipart余量，例如11m）、连接/读取超时、认证不透传日志、按实际入口限流、不可用503友好响应，无静态照片目录或调试文档。未获域名时不生成含猜测域名的有效站点。

微信公众平台实际需要登记同一B HTTPS主机的**request、uploadFile、downloadFile合法域名**（alpha/照片确实用downloadFile）。取得平台权限后人工登记，再配置明确的HTTPS客户端模式与受控用户授权。当前真机URL空、develop/devtools门禁保留；仅填域名还不等于已完成真机配置或体验版验收。

当前方案可供有SSH权限的开发者小范围使用公开/合成图片，**不能作为真实患者开放测试入口**。正式多用户授权、隐私合规/留存策略与真机、最大输入及长期双业务负载仍需另外验收；本轮不推进新业务阶段。

## 8. 回滚与原服务保护

执行前已制定[独立回滚](../deployment/rollback.md)。如A异常：先`sudo systemctl stop dermatome`，确认新进程退出，再检查A健康/ready/原HTTPS，保留日志；不重启A或整机。B配置/代码保留以便调查，不能清理A文件或用户合法标注。

本轮Nginx完全未改，因此无需为B回滚重载Nginx。未来新增B站点时只撤回B链接/备份，nginx -t通过才reload，禁止覆盖A配置/证书。

结束A仍PID3480408、NRestarts0、启动时间2026-10-31 23:51:02；Nginx仍PID12643及原启动时间。A本机健康/就绪及原HTTPS均200，6文件哈希相同；未调用A业务视觉/考试/数据库接口。不能把健康成功描述为A全业务功能验收。

## P4 后续更新（2026-11-01）

以上P1–P3为历史部署记录。P4当前内容版本20261101-p4-15893ff5de3a，94运行文件一致；增加一次性邀请/限时Bearer与照片principal绑定，保留原单worker/单推理/1CPU/1.5GiB、内网8001及独立启停。仅改5个旧后端文件并新增2模块，无新依赖、模型、Nginx或证书变更。备份在B独立deployment/backups/p4-20261101。

trial/旧develop的真实云端HTTP全链路、21项授权隔离与新授权/照片跨停启恢复通过；A保持正常。用户再次确认无B域名，故P4尚无手机HTTPS、微信平台配置、体验版上传或真机验收。新签发入口为仓库“生成体验邀请码.command”，码值不打印。具体能力、权限与准确状态以[P4报告](wechat-trial-integration.md)及唯一task.md为准，不覆盖历史结论。


## V6.5 后端版本同步（2026-11-05）

用户报告版本冲突后已完成B后端更新：当前全身template4.0.1、geometry hands-v2、atlas preview.3，并配置V6.4独立足底。暂存Linux数据检查、117文件摘要、两端28项真实HTTP检查通过；A/Nginx PID与启动时间不变。没有改模型、访问配置或匹配公式。详见[V6.5版本冲突修复](validation-records/v6.5-backend-sync/report.md)。本段覆盖旧报告的运行版本，不代表手机或医学审核完成。

## V6.6.2 后端同步（2026-11-05）

用户后续明确授权更新后端。已新增左右腋下view及独立PROVISIONAL图谱支持，更新18运行文件、仅重启dermatome，22项公网真实请求检查通过。旧空图谱保留ATLAS_NOT_READY，原全身/足底/AI配置与针灸/Nginx保持；没有上传微信。详见[云端同步报告](validation-records/v6.6-axilla/backend-sync/report.md)。

## V6.6.4 腋下模拟图谱后端同步（2026-11-06）

用户授权把本地 `axilla-schematic-v1 / axilla-schematic.1` 同步到云端。白名单更新10个文件，Linux暂存验证全身136、脚底4、旧PROVISIONAL 4、新SCHEMATIC 6个区域；仅重启 dermatome。公网26项合成几何检查通过，针灸/Nginx进程和保护摘要不变。首次快速验收触发入口5r/s限流，未修改限流，按0.25秒间隔重跑通过。

微信体验版上传 `NOT_RUN`：开发者工具账号登录票据失效（errcode 41001 / access_token missing），新代码未上传或设为体验版，手机验收未执行。部署、回滚与证据见[V6.6.4记录](validation-records/v6.6-axilla/deployment-v6.6.4/report.md)。
