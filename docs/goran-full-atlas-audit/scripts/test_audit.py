"""Audit assertions; no generated medical boundaries and no runtime writes."""
import json,hashlib,sys,unittest
from pathlib import Path
from shapely.geometry import shape,box
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'docs/goran-full-atlas-audit/evidence'
class AuditTests(unittest.TestCase):
    def read(self,n):return json.loads((OUT/n).read_text())
    def test_all_raw_paths_accounted(self):
        for view,n,main in [('front',42,35),('back',50,43)]:
            rows=self.read(view+'-raw-source-regions.json')['regions']
            self.assertEqual([r['index'] for r in rows],list(range(n)))
            self.assertEqual(sum(r['scope']=='main-body' for r in rows),main)
            self.assertTrue(all(shape(r['geometry']).is_valid for r in rows))
    def test_parent_male_path_identity(self):
        self.assertTrue(all(r['orderedPathDataIdentical'] for r in self.read('version-path-comparison.json')))
    def test_current_all_regions_have_source_paths_and_same_label(self):
        for view in ['front','back']:
            rows={r['index']:r for r in self.read(view+'-raw-source-regions.json')['regions']}
            data=json.loads((ROOT/f'data/atlas/goran-2022-preview-v2/{view}.json').read_text())
            for r in data['regions']:
                self.assertTrue(r['sourceRefs']);self.assertTrue(r['sourcePathIndices'])
                self.assertTrue(all(rows[i]['label']==r['labelId'] for i in r['sourcePathIndices']))
    def test_palm_composites_not_individual_c7(self):
        rows=self.read('front-raw-source-regions.json')['regions']
        self.assertEqual(rows[29]['label'],'C6-C8');self.assertEqual(rows[30]['label'],'C6-C8');self.assertEqual(rows[31]['label'],'C8/T1')
        self.assertFalse(any(r['label']=='C7' for r in rows))
    def test_source_sole_exists_but_not_exported(self):
        rows=self.read('back-raw-source-regions.json')['regions']
        for i,label in [(43,'L5'),(44,'S1')]:
            self.assertEqual(rows[i]['label'],label)
            self.assertGreater(shape(rows[i]['geometry']).intersection(box(110,847,325,950)).area,100)
            self.assertEqual(rows[i]['currentRegionIds'],[])
    def test_ambiguous_c1_not_silently_normalized(self):
        r=self.read('back-raw-source-regions.json')['regions'][35]
        self.assertIn('UNKNOWN',r['label']);self.assertEqual(r['currentRegionIds'],[])
    def test_downloaded_bytes_match_official_sha1(self):
        for r in self.read('metadata/all-22-inventory.json'):
            if r['status']=='BYTES_VERIFIED':
                p=OUT/'originals'/r['file'];self.assertEqual(hashlib.sha1(p.read_bytes()).hexdigest(),r['sha1_official'])
    def test_runtime_inputs_unchanged(self):
        for name,digest in self.read('protected-before.json').items():
            self.assertEqual(hashlib.sha256((ROOT/name).read_bytes()).hexdigest(),digest,name)
if __name__=='__main__':unittest.main(verbosity=2)
