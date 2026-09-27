#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
case "$(uname -s)" in Darwin) platform=darwin;; Linux) platform=linux;; *) echo 'Install Bun 1.4.2 locally and use the commands in README.md.' >&2; exit 1;; esac
case "$(uname -m)" in arm64|aarch64) architecture=aarch64;; x86_64) architecture=x64;; *) echo 'Unsupported architecture' >&2; exit 1;; esac
runtime=".tools/bun-$platform-$architecture/bun"
if [ ! -x "$runtime" ]; then
 mkdir -p .tools
 archive="bun-$platform-$architecture.zip"
 base='https://github.com/oven-sh/bun/releases/download/bun-v1.4.2'
 curl --fail --location --silent --show-error "$base/$archive" -o ".tools/$archive"
 curl --fail --location --silent --show-error "$base/SHASUMS256.txt" -o .tools/SHASUMS256.txt
 (cd .tools && shasum -a 256 -c SHASUMS256.txt --ignore-missing)
 unzip -q -o ".tools/$archive" -d .tools
fi
./scripts/bun install --frozen-lockfile
