首轮安装在26.6秒被保护程序终止（TERM，pip尚未完成，不能把systemd Result=success当安装成功）。瞬时安装cgroup峰值728MiB、swap0。系统pswpout由1增至4（3个4KiB页），pswpin0、oom_kill0；复核3次2秒间隔数值稳定、PSI avg10/60/300=0、可用内存约2.80GiB，A健康/就绪200。当前全机swap已分配268KiB，未宣称为0。

用户P1–P3要求监测Swap和保护A，并未要求系统任何换页就取消部署。首轮门槛沿用了P0过严的安装阶段条件。复核后仅调整临时保护程序：累计新增换出超过256页（1MiB）、任何换入或OOM、全机swap分配超过1MiB、内存PSI avg10>0.5%、可用<1GiB或A状态/身份异常时，停止B及安装。B及安装cgroup仍MemoryMax1536MiB、MemoryHigh1280MiB、MemorySwapMax0、CPUQuota100%；不放大资源限额、不改A。残缺B venv在确认安装进程退出/尚未登记服务后重建；保留第一轮日志。
