# Third-party notices

PivO's code license is in LICENSE. Asset and branding terms are in LICENSE-ASSETS.md.

## Tauri application dependencies

The Windows Tauri 2 application resolves its Rust dependencies through Cargo.lock. Full collected license texts and source-download links are in [licenses/rust-dependencies.txt](licenses/rust-dependencies.txt). This inventory includes build and support packages and does not assert that every listed package contributes machine code to the executable. Upstream dependency sources are unmodified.

The bundled JavaScript uses @tauri-apps/api 2.12.4, licensed under Apache-2.0 OR MIT. Both terms are preserved in [licenses/tauri-api](licenses/tauri-api/). Vite, TypeScript and the Tauri CLI are development tools rather than bundled JavaScript runtimes.

Signed Windows updates use tauri-plugin-updater 2.14.1 and its networking and signature-verification dependencies. Their collected notices are included in the Rust inventory. The tauri-plugin 2.7.2 archive omits license files; its MIT text is preserved from upstream revision 59b63ab500da9859f12d8888c3298bc29bba0b92.

For packages whose published archives omit a license file, notices use the exact upstream revisions: alloc-stdlib 0.3.0 at 0a81fd6928ea3b33c8cd484aa4575d50ffb98012; webview2-com/webview2-com-sys 0.39.1 at edc2caf886175ccaebe86078c9cfe1ae2a187328; webview2-com-macros 0.8.1 at dffa41a8a46d3f5565eefbff2de57d38d399f158. The selectors 0.38.0 entry includes the canonical MPL 2.0 text, also distributed by cssparser. The inventory provides a source archive for each resolved package, including MPL components.

Microsoft Edge WebView2 Runtime is an installed system prerequisite and is not included in the portable archive.

## Windows bindings

windows-sys 0.61.2 and windows-link 0.2.1 are distributed under MIT OR Apache-2.0. This distribution includes their MIT terms below, copied from each package's license-mit file in the Cargo registry.
    MIT License

    Copyright (c) Microsoft Corporation.

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE

## Rust standard library

Built with Rust stable 1.99.1 for x86_64-pc-windows-msvc. The toolchain's library copyright and license report is preserved in [licenses/rust-standard-library.html](licenses/rust-standard-library.html). It includes source-level component notices; this does not assert that every listed component contributes machine code to the optimized executable.
