"""Bundle reviewed public-code asset pins into the standalone laptop helper."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def build():
    import json
    assets=json.loads((ROOT/'tools/inspection/browser_assets.json').read_text())
    source=(ROOT/'tools/inspection/browser_implementation.py').read_text()
    return source.replace('ASSETS = None  # replaced by build_browser_helper.py','ASSETS = '+repr(assets),1)
if __name__=='__main__':
    (ROOT/'tools/backup/rehearse_browser.py').write_text(build(),encoding='utf-8')
