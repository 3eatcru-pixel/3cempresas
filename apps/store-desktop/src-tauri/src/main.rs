#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::io::Write;
use std::net::{IpAddr, SocketAddr, TcpStream};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::Duration;
use tauri::{Manager, State};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct EdgeSidecarState {
    running: Arc<AtomicBool>,
    port: u16,
    child: Mutex<Option<CommandChild>>,
}

#[derive(Serialize)]
struct PrintResult {
    printed: bool,
    bytes: usize,
    mode: &'static str,
    simulated: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScaleReading {
    weight_kg: f64,
    stable: bool,
    connected: bool,
    simulated: bool,
    protocol: &'static str,
}

#[derive(Serialize)]
struct EdgeNodeStatus {
    running: bool,
    port: u16,
    mode: &'static str,
}

#[derive(Serialize)]
struct SecureStorageValue {
    value: Option<String>,
    backend: &'static str,
}

fn sanitize_vault_key(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 128 {
        return Err("Chave de cofre inválida.".into());
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err("Chave contém caracteres não permitidos.".into());
    }
    Ok(trimmed.to_string())
}

fn resolve_vault_path(app: &tauri::AppHandle, key: &str) -> Result<PathBuf, String> {
    let safe_key = sanitize_vault_key(key)?;
    let base_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Falha ao resolver diretório seguro do SO: {e}"))?;
    let vault_dir = base_dir.join(".3c-secure-vault");
    std::fs::create_dir_all(&vault_dir)
        .map_err(|e| format!("Falha ao preparar cofre local: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&vault_dir, std::fs::Permissions::from_mode(0o700));
    }
    Ok(vault_dir.join(format!("{safe_key}.secret")))
}

#[tauri::command]
fn secure_storage_get(app: tauri::AppHandle, key: String) -> Result<SecureStorageValue, String> {
    let path = resolve_vault_path(&app, &key)?;
    if !path.exists() {
        return Ok(SecureStorageValue {
            value: None,
            backend: "TAURI_APP_LOCAL_VAULT",
        });
    }
    let val = std::fs::read_to_string(&path)
        .map_err(|e| format!("Falha ao ler segredo do cofre local: {e}"))?;
    Ok(SecureStorageValue {
        value: Some(val),
        backend: "TAURI_APP_LOCAL_VAULT",
    })
}

#[tauri::command]
fn secure_storage_set(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let path = resolve_vault_path(&app, &key)?;
    std::fs::write(&path, value.as_bytes())
        .map_err(|e| format!("Falha ao gravar segredo no cofre local: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[tauri::command]
fn secure_storage_remove(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let path = resolve_vault_path(&app, &key)?;
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Falha ao remover segredo do cofre local: {e}"))?;
    }
    Ok(())
}

fn spawn_edge_sidecar(app: &tauri::AppHandle, port: u16) -> Result<CommandChild, String> {
    let store_id = std::env::var("EDGE_STORE_ID").unwrap_or_else(|_| "store-1".into());
    let tenant_id = std::env::var("EDGE_TENANT_ID").unwrap_or_else(|_| "tenant-1".into());
    let cloud_url = std::env::var("CLOUD_BASE_URL")
        .unwrap_or_else(|_| "https://app-3ccorp-164281225843.us-west1.run.app".into());

    let cmd = app
        .shell()
        .sidecar("3c-edge-node")
        .map_err(|e| format!("Sidecar 3c-edge-node indisponível: {e}"))?
        .env("EDGE_PORT", port.to_string())
        .env("EDGE_STORE_ID", store_id)
        .env("EDGE_TENANT_ID", tenant_id)
        .env("CLOUD_BASE_URL", cloud_url);

    let (_rx, child) = cmd
        .spawn()
        .map_err(|e| format!("Falha ao iniciar 3C Edge Node: {e}"))?;
    Ok(child)
}

fn is_allowed_escpos_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_loopback() || v4.is_private() || v4.is_link_local(),
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unicast_link_local()
                || (v6.segments()[0] & 0xfe00) == 0xfc00
        }
    }
}

fn is_allowed_escpos_socket(addr: &SocketAddr, enforce_printer_port: bool) -> bool {
    if !is_allowed_escpos_ip(addr.ip()) {
        return false;
    }
    if enforce_printer_port {
        return (9100..=9102).contains(&addr.port());
    }
    addr.port() > 0
}

fn is_digits_only(s: &str) -> bool {
    !s.is_empty() && s.len() <= 3 && s.chars().all(|c| c.is_ascii_digit())
}

fn is_allowed_printer_device_path(raw: &str) -> bool {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 128 {
        return false;
    }
    if trimmed.contains("..") || trimmed.contains('\0') || trimmed.contains('*') || trimmed.contains('?') {
        return false;
    }

    let unix_prefixes = ["/dev/usb/lp", "/dev/lp", "/dev/ttyUSB", "/dev/ttyACM", "/dev/ttyS"];
    for prefix in unix_prefixes {
        if let Some(rest) = trimmed.strip_prefix(prefix) {
            return is_digits_only(rest);
        }
    }

    let upper = trimmed.to_ascii_uppercase();
    let win_body = upper.strip_prefix("\\\\.\\").unwrap_or(&upper);
    for prefix in ["COM", "LPT"] {
        if let Some(rest) = win_body.strip_prefix(prefix) {
            return is_digits_only(rest);
        }
    }

    false
}

fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    let mut out = Vec::with_capacity((input.len() * 3) / 4);
    let mut buf: u32 = 0;
    let mut bits: u8 = 0;
    for b in input.bytes() {
        if b.is_ascii_whitespace() || b == b'=' {
            continue;
        }
        let val = match b {
            b'A'..=b'Z' => b - b'A',
            b'a'..=b'z' => b - b'a' + 26,
            b'0'..=b'9' => b - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return Err("Payload ESC/POS Base64 inválido.".into()),
        };
        buf = (buf << 6) | (val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buf >> bits) & 0xff) as u8);
        }
    }
    Ok(out)
}

fn dispatch_escpos_raw(
    raw_bytes: &[u8],
    network_addr: Option<String>,
    device_path: Option<String>,
) -> Result<PrintResult, String> {
    if raw_bytes.is_empty() {
        return Err("Payload ESC/POS vazio.".into());
    }
    let bytes = raw_bytes.len();

    let (resolved_addr, addr_from_webview) = match network_addr {
        Some(v) if !v.trim().is_empty() => (Some(v), true),
        _ => (std::env::var("THREEC_ESCPOS_NETWORK_ADDR").ok(), false),
    };

    if let Some(addr_raw) = resolved_addr {
        let trimmed_addr = addr_raw.trim();
        if !trimmed_addr.is_empty() {
            let socket_addr = trimmed_addr
                .parse::<SocketAddr>()
                .map_err(|_| "Endereço de impressora ESC/POS inválido (esperado IP:9100).".to_string())?;
            if !is_allowed_escpos_socket(&socket_addr, addr_from_webview) {
                return Err("Endereço de impressora ESC/POS fora da rede local ou porta permitida (9100-9102).".into());
            }
            if let Ok(mut stream) = TcpStream::connect_timeout(&socket_addr, Duration::from_secs(3)) {
                let _ = stream.set_write_timeout(Some(Duration::from_secs(3)));
                if stream.write_all(raw_bytes).is_ok() {
                    return Ok(PrintResult {
                        printed: true,
                        bytes,
                        mode: "TAURI_ESCPOS_TCP_9100",
                        simulated: false,
                    });
                }
            }
        }
    }

    let resolved_path = match device_path {
        Some(v) if !v.trim().is_empty() => Some(v),
        _ => std::env::var("THREEC_ESCPOS_DEVICE").ok(),
    };

    if let Some(path_raw) = resolved_path {
        let trimmed = path_raw.trim();
        if !trimmed.is_empty() {
            if !is_allowed_printer_device_path(trimmed) {
                return Err("Caminho de dispositivo de impressão não permitido.".into());
            }
            if std::fs::write(trimmed, raw_bytes).is_ok() {
                return Ok(PrintResult {
                    printed: true,
                    bytes,
                    mode: "TAURI_ESCPOS_DEVICE",
                    simulated: false,
                });
            }
        }
    }

    Ok(PrintResult {
        printed: false,
        bytes,
        mode: "SANDBOX_NO_PRINTER_CONFIGURED",
        simulated: true,
    })
}

#[tauri::command]
fn print_escpos_receipt(
    content: String,
    network_addr: Option<String>,
    device_path: Option<String>,
) -> Result<PrintResult, String> {
    if content.trim().is_empty() {
        return Err("Conteúdo do cupom vazio.".into());
    }
    dispatch_escpos_raw(content.as_bytes(), network_addr, device_path)
}

#[tauri::command]
fn print_escpos_bytes(
    bytes_base64: String,
    network_addr: Option<String>,
    device_path: Option<String>,
) -> Result<PrintResult, String> {
    let raw = decode_base64(&bytes_base64)?;
    dispatch_escpos_raw(&raw, network_addr, device_path)
}

#[tauri::command]
fn read_scale_weight() -> ScaleReading {
    ScaleReading {
        weight_kg: 0.0,
        stable: false,
        connected: false,
        simulated: true,
        protocol: "SANDBOX_SCALE_NO_SERIAL_PORT",
    }
}

#[tauri::command]
fn get_edge_node_status(state: State<'_, EdgeSidecarState>) -> EdgeNodeStatus {
    let has_child = state
        .child
        .lock()
        .map(|guard| guard.is_some())
        .unwrap_or(false);
    EdgeNodeStatus {
        running: state.running.load(Ordering::SeqCst) && has_child,
        port: state.port,
        mode: "STANDARD_SQLITE_WAL",
    }
}

#[tauri::command]
fn restart_edge_node(
    app: tauri::AppHandle,
    state: State<'_, EdgeSidecarState>,
) -> Result<serde_json::Value, String> {
    if let Ok(mut guard) = state.child.lock() {
        if let Some(prev_child) = guard.take() {
            let _ = prev_child.kill();
        }
        match spawn_edge_sidecar(&app, state.port) {
            Ok(new_child) => {
                *guard = Some(new_child);
                state.running.store(true, Ordering::SeqCst);
                return Ok(serde_json::json!({ "restarted": true, "port": state.port }));
            }
            Err(err) => {
                state.running.store(false, Ordering::SeqCst);
                return Err(err);
            }
        }
    }
    Ok(serde_json::json!({ "restarted": false }))
}

fn main() {
    let sidecar_running = Arc::new(AtomicBool::new(false));
    let sidecar_port = std::env::var("EDGE_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(3300);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(EdgeSidecarState {
            running: Arc::clone(&sidecar_running),
            port: sidecar_port,
            child: Mutex::new(None),
        })
        .setup(move |app| {
            let has_updater_pubkey = app
                .config()
                .plugins
                .0
                .get("updater")
                .and_then(|u| u.get("pubkey"))
                .and_then(|v| v.as_str())
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false);
            if has_updater_pubkey {
                if let Err(err) = app.handle().plugin(tauri_plugin_updater::Builder::new().build()) {
                    eprintln!("[3C Store OS] Updater plugin não inicializado: {err}");
                }
            }

            let handle = app.handle().clone();
            if let Ok(child) = spawn_edge_sidecar(&handle, sidecar_port) {
                let state = app.state::<EdgeSidecarState>();
                if let Ok(mut guard) = state.child.lock() {
                    *guard = Some(child);
                    state.running.store(true, Ordering::SeqCst);
                };
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            secure_storage_get,
            secure_storage_set,
            secure_storage_remove,
            print_escpos_receipt,
            print_escpos_bytes,
            read_scale_weight,
            get_edge_node_status,
            restart_edge_node
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao inicializar 3C Store OS Desktop (Tauri 2)");
}
