import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('import_uploads', Path(__file__).with_name('import-uploads.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ArchivePathTests(unittest.TestCase):
    def test_preserves_nested_quarantine_and_strips_only_explicit_prefix(self):
        self.assertEqual(str(module.relative_name('uploads/quarantine/file.pdf', 'uploads/')), 'quarantine/file.pdf')

    def test_rejects_traversal_absolute_windows_and_ambiguous_names(self):
        for name in ('../x', '/x', 'C:/x', 'a\\x', 'a/../x', 'a//x', './x'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                module.relative_name(name)

    def test_rejects_mismatched_prefix(self):
        with self.assertRaises(ValueError):
            module.relative_name('other/file.pdf', 'uploads/')


if __name__ == '__main__':
    unittest.main()
