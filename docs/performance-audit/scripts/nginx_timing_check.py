# Read configuration into memory, output ONLY timing-field availability, never raw configuration/logs.
import subprocess,json,re
p=subprocess.run(['sudo','-n','nginx','-T'],capture_output=True,text=True,timeout=12)
report={'read_only':True,'config_read_ok':p.returncode==0}
if p.returncode==0:
 formats=re.findall(r'log_format\s+[^;]+;',p.stdout,re.S)
 report.update(log_format_count=len(formats),any_request_time=any('$request_time' in x for x in formats),any_upstream_response_time=any('$upstream_response_time' in x for x in formats),b_custom_access_log_present=bool(re.search(r'access_log\s+[^;]*(?:dermatome)[^;]*;',p.stdout)))
 report['nginx_request_latency']='NOT_MEASURED: no request log read; do not expose URLs or identifiers'
print(json.dumps(report,indent=2))
