"""Local-warp/data tests; engineering reference points are not medical review."""
import copy
import json
import unittest
from pathlib import Path
from shapely.geometry import shape, Point
from prepare_atlas_extensions import row_warp, warp_geometry, visible_paths, ATLAS, ROOT
from check_preview_atlas import validate_parent_files, validate_geometry


class LocalRegistrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads((ROOT/'backend/tests/fixtures/synthetic-atlas-registration.json').read_text())
        cls.config = json.loads((ATLAS/'local-registration.json').read_text())
        cls.regions = json.loads((ATLAS/'front.json').read_text())['regions']

    def test_landmark_knots_and_no_folding(self):
        rows = self.fixture['rows']; warp = row_warp(rows)
        for row in rows:
            for sx, tx in zip(row['sourceX'], row['targetX']):
                self.assertEqual(warp(sx,row['sourceY']), (tx,row['targetY']))
        for y in [0,2,5,7,12]:
            xs = [warp(x/10,y)[0] for x in range(121)]
            self.assertTrue(all(a<b for a,b in zip(xs,xs[1:])))
        bad = copy.deepcopy(rows);bad[1]['targetX']=[0,7,6]
        with self.assertRaises(AssertionError):row_warp(bad)

    def test_hole_and_tiny_island_survive_without_area_filter(self):
        original = shape(self.fixture['geometry'])
        mapped = warp_geometry(original,row_warp(self.fixture['rows']))
        self.assertTrue(mapped.is_valid)
        self.assertEqual(len(mapped.geoms),2)
        self.assertEqual(sum(len(p.interiors) for p in mapped.geoms),1)
        self.assertLess(min(p.area for p in mapped.geoms),1e-6)

    def test_original_label_leaders_are_inside_audited_source_fills(self):
        _, visible = visible_paths()
        for index,label in [(13,'V1'),(14,'V2'),(16,'V3')]:
            evidence=self.config['face']['sourceEvidence'][label]
            self.assertTrue(visible[index].covers(Point(evidence['endpoint'])), label)

    def test_original_face_knots_map_to_declared_target_landmarks(self):
        rows=self.config['face']['rows'];warp=row_warp(rows)
        for row in rows:
            for x,target in zip(row['sourceX'],row['targetX']):
                p=warp(x,row['sourceY'])
                self.assertAlmostEqual(p[0],target,places=8)
                self.assertAlmostEqual(p[1],row['targetY'],places=8)

    def test_reference_sites_and_explicit_unsupported_surfaces(self):
        # Selected by inspecting actual source labels and target facial features,
        # independently of this containment operation. Not clinical ground truth.
        references=[(195,87,'V1'),(205,87,'V1'),(200,120,'V1'),
                    (185,116,'V2'),(216,117,'V2'),(195,153,'V3'),(205,153,'V3'),
                    (200,45,None),(164,111,None),(240,111,None),
                    (113,855,'S1'),(143,862,'L5')]
        additions=[r for r in self.regions if r.get('registrationRefs')]
        for x,y,label in references:
            matched={r['labelId'] for r in additions if shape(r['geometry']).covers(Point(x/400,y/900))}
            self.assertEqual(matched, {label} if label else set(), (x,y,label))

    def test_geometry_and_parent_archival_integrity(self):
        validate_parent_files()
        for region in self.regions:validate_geometry(region['geometry'])
        back=json.loads((ATLAS/'back.json').read_text())['regions']
        self.assertFalse(any(r['partitionType']=='trigeminal_sensory' for r in back))
        coverage=json.loads((ATLAS/'coverage.json').read_text())
        self.assertTrue(any(e['view']=='back' and 'V1' in e['labels'] and e['sourcePresent'] for e in coverage['surfaceExclusions']))


if __name__=='__main__':unittest.main(verbosity=2)
