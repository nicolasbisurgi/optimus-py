# -*- mode: python ; coding: utf-8 -*-
import sys

hiddenimports = ['seaborn', 'execution_mode', 'executors', 'results', 'checkpoint']
if sys.platform == 'win32':
    hiddenimports.append('win32timezone')

a = Analysis(
    ['optimuspy.py'],
    pathex=[],
    binaries=[],
    datas=[('execution_mode.py', '.'), ('executors.py', '.'), ('results.py', '.'), ('checkpoint.py', '.')],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='optimuspy',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
