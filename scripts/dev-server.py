#!/usr/bin/env python3
"""开发服务器：no-store 禁缓存，供无头回归用（部署到 GitHub Pages 无此问题）"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
ROOT = sys.argv[2] if len(sys.argv) > 2 else "/home/z/my-project/pixel-xxl"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *a):
        pass


import functools
handler = functools.partial(NoCacheHandler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
    print(f"serving {ROOT} at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
