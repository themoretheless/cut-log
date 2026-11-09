//! Forma/Svet host bindings for the CutLog browser frontend.
//!
//! The browser side owns no geometry: Forma parses the markup, lays it out and
//! emits GPU buffers, which the host uploads as-is. Only the markup generation
//! and the shader live here, so the JS host stays a transport.

use wasm_bindgen::prelude::*;

/// WGSL used by both the native wgpu backend and the browser painter. Exposing
/// it from the crate keeps the host free of files copied out of the Forma repo.
#[wasm_bindgen]
pub fn forma_shader() -> String {
    include_str!(concat!(env!("OUT_DIR"), "/vector.wgsl")).to_string()
}

fn escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'")
}

/// Visual template for one piece row. The runtime binds a single component
/// template to the `Button` control name, so the row type has to use it.
#[wasm_bindgen]
pub fn piece_row_component() -> String {
    "component Button {
    width: 700;
    height: 18;
    text: '';
    fontSize: 12;
    color: #e6e6e6;

    Rectangle {
        radius: 0;
        background: Brush { color: #1b1b1b; };
        Text {
            text: props.text;
            color: props.color;
            fontSize: props.fontSize;
        }
    }
}
"
    .to_string()
}

/// A scene of one row per piece, mirroring the columns the Svelte piece list
/// shows: label, width, height and quantity.
#[wasm_bindgen]
pub fn piece_list_markup(count: u32, filter: &str) -> String {
    let mut out = String::with_capacity(count as usize * 96);
    out.push_str(
        "component PieceList {\n    Frame {\n        width: 720;\n        height: 560;\n        padding: 8;\n        gap: 2;\n        background: #1b1b1b;\n        clip: true;\n",
    );
    for index in 0..count {
        let label = format!("Piece {index}");
        if !filter.is_empty() && !label.contains(filter) {
            continue;
        }
        let width = 200 + (index % 400);
        let height = 150 + (index % 300);
        out.push_str(&format!(
            "        Button {{ key: 'p{}'; text: '{}  {} x {}  1'; }}\n",
            index,
            escape(&label),
            width,
            height
        ));
    }
    out.push_str("    }\n}\n");
    out
}

/// Reports how many rows the markup above would contain, so the host can assert
/// what it asked for without parsing the markup again.
#[wasm_bindgen]
pub fn piece_list_rows(count: u32, filter: &str) -> u32 {
    (0..count)
        .filter(|index| {
            let label = format!("Piece {index}");
            filter.is_empty() || label.contains(filter)
        })
        .count() as u32
}

/// Hands the browser host a Forma runtime. Without a reference from this crate
/// the linker drops the whole engine and wasm-bindgen emits no `Runtime`.
#[wasm_bindgen]
pub fn create_runtime() -> forma::Runtime {
    forma::Runtime::new()
}
