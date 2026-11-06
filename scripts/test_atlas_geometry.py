"""Independent non-medical SVG reader tests; synthetic input confined to backend/tests/fixtures."""
import json,unittest
from pathlib import Path
from shapely.geometry import shape,Point
from svg_geometry import path_rings,filled_geometry,transform,multiply
FIXTURE=Path(__file__).resolve().parents[1]/'backend/tests/fixtures/synthetic-atlas-svg.json'
class SvgTests(unittest.TestCase):
 def setUp(self):self.f=json.loads(FIXTURE.read_text());self.assertTrue(self.f['synthetic'])
 def test_evenodd_same_winding_hole(self):
  rings=path_rings(self.f['sameWindingRings'])
  self.assertAlmostEqual(filled_geometry(rings,'evenodd').area,84)
  self.assertFalse(filled_geometry(rings,'evenodd').covers(Point(5,5)))
  self.assertAlmostEqual(filled_geometry(rings,'nonzero').area,100)
 def test_two_islands_not_convex_hull(self):
  g=filled_geometry(path_rings(self.f['islands']),'evenodd');self.assertEqual(g.geom_type,'MultiPolygon');self.assertEqual(len(g.geoms),2);self.assertEqual(g.area,8);self.assertFalse(g.covers(Point(3,1)))
 def test_curve_and_relative_commands(self):
  g=filled_geometry(path_rings(self.f['curves']),'evenodd');self.assertTrue(g.is_valid);self.assertGreater(g.area,1);self.assertGreater(len(path_rings(self.f['curves'])[0]),15)
 def test_transform_order(self):
  rings=path_rings('M0 0L2 0L2 2L0 2Z',multiply(transform('translate(10 20)'),transform('scale(2)')))
  self.assertEqual(filled_geometry(rings).bounds,(10,20,14,24))
 def test_unsupported_command_fails(self):
  with self.assertRaises(ValueError):path_rings('M0 0A2 2 0 0 1 3 3Z')
if __name__=='__main__':unittest.main()
