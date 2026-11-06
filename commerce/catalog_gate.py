"""Only serve catalog bytes from a non-webroot directory after checking session and purchase."""
from pathlib import Path
from .access import session_email
class CatalogGate:
    def __init__(self,private_dir,store,session_secret):
        self.root=Path(private_dir).resolve(strict=True)
        self.store=store
        self.key=session_secret
    def read(self,token,relative_path):
        email=session_email(token,self.key)
        if not self.store.has_access(email): raise PermissionError('purchase required')
        if not isinstance(relative_path,str) or relative_path.startswith('/') or '\\' in relative_path or '\x00' in relative_path:
            raise ValueError('invalid path')
        target=(self.root/relative_path).resolve(strict=True)
        if not target.is_relative_to(self.root) or not target.is_file():
            raise PermissionError('outside protected catalog')
        return target.read_bytes()
