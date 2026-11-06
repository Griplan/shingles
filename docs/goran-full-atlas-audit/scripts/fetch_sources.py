"""Download public Goran originals into the isolated audit only; never edit runtime data."""
import hashlib
import json
import urllib.parse
import urllib.request
import time
from pathlib import Path

AUDIT = Path(__file__).resolve().parents[1]
META = AUDIT / 'evidence/metadata'
OUT = AUDIT / 'evidence/originals'

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={
        'User-Agent': 'DermatomeMapperSourceAudit/1.0 (public source verification)'
    }), timeout=45).read()

def main():
    gallery = json.loads((META / 'gallery.json').read_text())
    names = [x for x in gallery['parse']['images'] if x.startswith('Dermatomes_')]
    query = {'action': 'query', 'titles': '|'.join('File:' + x for x in names),
             'prop': 'imageinfo', 'iiprop': 'url|size|sha1|timestamp|user|extmetadata',
             'iilimit': 'max', 'format': 'json'}
    raw = (META / 'commons-imageinfo.json').read_bytes() if (META / 'commons-imageinfo.json').exists() else get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(query))
    (META / 'commons-imageinfo.json').write_bytes(raw)
    inventory = []
    for page in json.loads(raw)['query']['pages'].values():
        ii = page['imageinfo'][0]
        name = page['title'][5:].replace(' ', '_')
        path = OUT / name
        if not path.exists():
            time.sleep(10)
        try:
            blob = path.read_bytes() if path.exists() else get(ii['url'])
        except Exception as error:
            with (META / 'download-errors.log').open('a') as log:
                log.write(name + ': ' + str(error) + '\n')
            print(name, str(error), flush=True)
            break  # Respect server rate limits; no further requests in this run.
        assert hashlib.sha1(blob).hexdigest() == ii['sha1'], name
        if not path.exists(): path.write_bytes(blob)
        entry = dict(file=name, url=ii['url'], page=ii['descriptionurl'], timestamp=ii['timestamp'],
                     sha256=hashlib.sha256(blob).hexdigest(), sha1=ii['sha1'], bytes=len(blob),
                     width=ii['width'], height=ii['height'], metadata=ii['extmetadata'],
                     fileHistory=[{k: r.get(k) for k in ('timestamp','sha1','url')} for r in page['imageinfo']])
        inventory.append(entry)
        print(name, len(blob), flush=True)
    (META / 'inventory.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2)+'\n')

if __name__ == '__main__': main()
