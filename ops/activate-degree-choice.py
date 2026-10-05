"""Run on the VPS against an already staged, hash-pinned prototype payload."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.request

stage = Path(sys.argv[1]).resolve()
manifest = json.loads((stage / 'payload/release.json').read_text())
release_id = manifest['release_id']
assert release_id.startswith(('direct-3-', 'thumb-4-', 'combat-5-', 'combat-6-', 'combat-7-', 'combat-8-', 'combat-9-')) and all(c.isalnum() or c == '-' for c in release_id)
assert shutil.disk_usage('/').free > 40 * 10**9
config = Path('/etc/nginx/sites-available/degree-choice-armagedom.conf')
assert Path('/etc/nginx/sites-enabled/degree-choice-armagedom.conf').resolve() == config
assert config.read_bytes() == (stage / 'before-degree-choice.conf').read_bytes(), 'Degree Choice config changed since inspection'
replacement = (stage / 'degree-choice.conf').read_bytes()
assert b'server_name playarmagedom' not in replacement and b'armagedom-official-redirects' not in replacement
def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def fetch(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        return {'url': response.url, 'status': response.status, 'sha256': hashlib.sha256(response.read()).hexdigest()}
protected = ['/etc/nginx/sites-available/playarmagedom.conf', '/etc/nginx/snippets/playarmagedom-preview.conf']
before = {p: digest(p) for p in protected}
main_before = fetch('https://playarmagedom.com/')
for name, expected in manifest['files_sha256'].items():
    assert digest(stage / 'payload' / name) == expected, name
subprocess.run(['nginx', '-t'], check=True)
base = Path('/var/www/test-combat-armagedom-1')
release = base / 'releases' / release_id
assert not release.exists()
release.parent.mkdir(parents=True, exist_ok=True)
shutil.copytree(stage / 'payload', release)
for p in release.rglob('*'):
    p.chmod(0o755 if p.is_dir() else 0o644)
release.chmod(0o755)
backup = Path('/var/backups/test-combat-armagedom-1') / release_id
backup.mkdir(parents=True, exist_ok=False)
shutil.copy2(config, backup / 'degree-choice.conf')
current = base / 'current'
assert not current.exists() or current.is_symlink(), 'Unexpected prototype current directory'
old_target = os.readlink(current) if current.is_symlink() else None
candidate = base / 'next'
assert not candidate.exists() and not candidate.is_symlink()
candidate.symlink_to(release)
os.replace(candidate, current)
pending_config = config.with_suffix('.combat-pending')
config_changed = replacement != config.read_bytes()
try:
    if config_changed:
        pending_config.write_bytes(replacement)
        pending_config.chmod(0o644)
        os.replace(pending_config, config)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    after = {p: digest(p) for p in protected}
    assert before == after, 'Protected main-game config changed during switch'
    main_after = fetch(main_before['url'])
    assert main_before == main_after, 'Pinned main-game page changed during switch'
    # Reload returns after signalling the master; workers may still serve the old vhost briefly.
    deadline = time.monotonic() + 10
    while True:
        root = fetch('https://degree-choice.com/?v=' + release_id)
        if root['status'] == 200 and root['url'].startswith('https://degree-choice.com/') and root['sha256'] == manifest['files_sha256']['index.html']:
            break
        assert time.monotonic() < deadline, f'Prototype root did not converge: {root}'
        time.sleep(0.25)
except Exception:
    # Restore only the Degree Choice host and prototype symlink.
    if config_changed:
        shutil.copy2(backup / 'degree-choice.conf', config)
    current.unlink()
    if old_target is not None:
        current.symlink_to(old_target)
    if config_changed:
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
receipt = {'nginx_config_changed': config_changed, 'release_id': release_id, 'source_commit': manifest['source_commit'], 'root': root, 'main_before': main_before, 'main_after': main_after, 'protected_configs_before': before, 'protected_configs_after': after, 'previous_prototype_target': old_target, 'backup': str(backup), 'release': str(release), 'files_sha256': manifest['files_sha256']}
(backup / 'deployment-receipt.json').write_text(json.dumps(receipt, indent=2))
print(json.dumps(receipt, indent=2))
