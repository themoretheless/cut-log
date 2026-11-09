//! Copies Forma's WGSL out of the pinned git checkout so the shader ships
//! inside this wasm module. The browser build of Forma is compiled without the
//! native `gpu` feature, so the shader is not reachable through its API, and a
//! hand-copied file would drift from the revision Cargo actually resolved.
use std::{env, fs, path::PathBuf, process::Command};

fn main() {
    let metadata = Command::new(env::var("CARGO").unwrap_or_else(|_| "cargo".into()))
        .args(["metadata", "--format-version", "1"])
        .output()
        .expect("cargo metadata");
    assert!(metadata.status.success(), "cargo metadata failed");

    let parsed: serde_json::Value =
        serde_json::from_slice(&metadata.stdout).expect("cargo metadata json");
    let manifest = parsed["packages"]
        .as_array()
        .expect("packages")
        .iter()
        .find(|package| package["name"] == "forma")
        .map(|package| package["manifest_path"].as_str().expect("manifest_path"))
        .expect("forma package in the dependency graph");

    let shader = PathBuf::from(manifest)
        .parent()
        .expect("crate root")
        .join("src/vector.wgsl");
    let out = PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("vector.wgsl");
    fs::copy(&shader, &out).unwrap_or_else(|error| panic!("copy {}: {error}", shader.display()));

    println!("cargo:rerun-if-changed={}", shader.display());
}
