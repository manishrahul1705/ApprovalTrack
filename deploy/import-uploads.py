"""Import a trusted backup ZIP without overwrites, scanning each file with clamd.

Run as appuser while application writes are paused. Never flatten archive paths.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess
import tempfile
import zipfile


def relative_name(name, prefix=''):
    if '\\' in name or name.startswith('/') or ':' in name:
        raise ValueError('Unsafe archive path')
    if prefix:
        if not name.startswith(prefix):
            raise ValueError('Entry does not match explicit archive prefix')
        name = name[len(prefix):]
    if not name or any(p in ('', '.', '..') for p in name.split('/')):
        raise ValueError('Unsafe archive path')
    return PurePosixPath(name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('--root', default='/var/data/uploads')
    parser.add_argument('--prefix', default='', help='Exact enclosing folder to strip, e.g. uploads/')
    parser.add_argument('--manifest', required=True)
    args = parser.parse_args()
    root = Path(args.root).resolve(strict=True)
    manifest = Path(args.manifest)
    if manifest.exists():
        raise ValueError('Manifest already exists')
    rows = []
    with zipfile.ZipFile(args.archive) as archive:
        files = [info for info in archive.infolist() if not info.is_dir()]
        names = [relative_name(info.filename, args.prefix) for info in files]
        if len(set(names)) != len(names):
            raise ValueError('Duplicate archive destinations')
        if sum(info.file_size for info in files) > shutil.disk_usage(root).free - 1024**3:
            raise ValueError('Insufficient disk space including 1 GiB reserve')
        for info, name in zip(files, names):
            target = root.joinpath(*name.parts)
            if stat.S_ISLNK(info.external_attr >> 16) or target.exists() or not target.resolve().is_relative_to(root):
                raise ValueError('Symlink, existing file, or escaping destination')
            if info.file_size > 25 * 1024**2:
                raise ValueError('Archive entry exceeds scanner limit')
        # Preflight above finishes before the first write. A failure may leave a partial
        # import; use the manifest to reconcile, never overwrite or retry blindly.
        with manifest.open('x', encoding='utf-8') as journal:
            os.chmod(manifest, 0o600)
            for info, name in zip(files, names):
                target = root.joinpath(*name.parts)
                with tempfile.NamedTemporaryFile() as staged:
                    with archive.open(info) as source:
                        shutil.copyfileobj(source, staged)
                    staged.flush()
                    subprocess.run(['clamdscan', '--config-file=/app/deploy/clamd.conf', '--stream', '--no-summary', staged.name], check=True)
                    staged.seek(0)
                    digest = hashlib.file_digest(staged, 'sha256').hexdigest()
                    staged.seek(0)
                    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                    with target.open('xb') as output:
                        os.chmod(target, 0o600)
                        shutil.copyfileobj(staged, output)
                row = {'path': str(name), 'size': info.file_size, 'sha256': digest}
                rows.append(row)
                journal.write(json.dumps(row) + '\n')
                journal.flush()
                os.fsync(journal.fileno())
    print(f'Imported and scanned {len(rows)} files; manifest saved')


if __name__ == '__main__':
    main()
