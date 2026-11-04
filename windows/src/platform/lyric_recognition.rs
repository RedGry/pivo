use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    os::windows::process::CommandExt,
    path::PathBuf,
    process::{Command, Stdio},
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, Instant},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VocalSegment {
    start_ms: f64,
    end_ms: f64,
    text: String,
}

#[derive(Deserialize)]
struct Transcript {
    transcription: Vec<Segment>,
}

#[derive(Deserialize)]
struct Segment {
    tokens: Vec<Token>,
}

#[derive(Deserialize)]
struct Token {
    offsets: Offsets,
    text: String,
}

#[derive(Deserialize)]
struct Offsets {
    from: u32,
    to: u32,
}

pub(super) fn recognizer() -> Option<(PathBuf, PathBuf)> {
    let cli = PathBuf::from(
        std::env::var_os("PIVO_WHISPER_CLI")
            .or_else(|| option_env!("PIVO_WHISPER_CLI").map(Into::into))?,
    );
    let model = PathBuf::from(
        std::env::var_os("PIVO_WHISPER_MODEL")
            .or_else(|| option_env!("PIVO_WHISPER_MODEL").map(Into::into))?,
    );
    (cli.is_absolute() && model.is_absolute() && cli.is_file() && model.is_file())
        .then_some((cli, model))
}

fn wave_header(bytes: u32) -> Vec<u8> {
    let mut header = Vec::with_capacity(44);
    header.extend(b"RIFF");
    header.extend((36 + bytes).to_le_bytes());
    header.extend(b"WAVEfmt ");
    header.extend(16u32.to_le_bytes());
    header.extend(1u16.to_le_bytes());
    header.extend(1u16.to_le_bytes());
    header.extend(16_000u32.to_le_bytes());
    header.extend(32_000u32.to_le_bytes());
    header.extend(2u16.to_le_bytes());
    header.extend(16u16.to_le_bytes());
    header.extend(b"data");
    header.extend(bytes.to_le_bytes());
    header
}

fn emphasize_vocals(pcm: &mut [u8]) {
    let mut bass = 0.0_f32;
    let mut vocal_band = 0.0_f32;
    for bytes in pcm.as_chunks_mut::<2>().0 {
        let input = f32::from(i16::from_le_bytes(*bytes));
        bass += 0.08 * (input - bass);
        vocal_band += 0.65 * (input - bass - vocal_band);
        let sample = (vocal_band * 1.8).round() as i16;
        *bytes = sample.to_le_bytes();
    }
}

struct OutputDir(PathBuf);

impl Drop for OutputDir {
    fn drop(&mut self) {
        let _ = fs::remove_file(self.0.join("transcript.json"));
        let _ = fs::remove_dir(&self.0);
    }
}

pub(super) fn recognize(
    cli: PathBuf,
    model: PathBuf,
    mut pcm: Vec<u8>,
    position_ms: f64,
    still_current: impl Fn() -> bool,
) -> Result<Vec<VocalSegment>, Box<dyn std::error::Error>> {
    static ID: AtomicU64 = AtomicU64::new(0);
    let path = std::env::temp_dir().join(format!(
        "pivo-vocal-{}-{}",
        std::process::id(),
        ID.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir(&path)?;
    let output = OutputDir(path);
    let mut child = Command::new(cli)
        .creation_flags(0x08000000)
        .arg("-m")
        .arg(model)
        .args(["-f", "-", "-l", "auto", "-t", "4", "-ojf", "-of"])
        .arg(output.0.join("transcript"))
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    let mut stdin = child.stdin.take().expect("piped stdin");
    let writer = std::thread::spawn(move || {
        emphasize_vocals(&mut pcm);
        stdin.write_all(&wave_header(pcm.len() as u32))?;
        stdin.write_all(&pcm)
    });
    let deadline = Instant::now() + Duration::from_secs(30);
    let status = loop {
        if !still_current() || Instant::now() >= deadline {
            let _ = child.kill();
            break child.wait();
        }
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => std::thread::sleep(Duration::from_millis(50)),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(error);
            }
        }
    };
    let written = writer.join().map_err(|_| "recognizer input failed")?;
    if !status?.success() {
        return Ok(Vec::new());
    }
    written?;
    let transcript: Transcript =
        serde_json::from_slice(&fs::read(output.0.join("transcript.json"))?)?;
    Ok(transcript
        .transcription
        .into_iter()
        .flat_map(|segment| {
            let mut words: Vec<VocalSegment> = Vec::new();
            for token in segment.tokens {
                if token.text.starts_with("[_") || token.text.trim().is_empty() {
                    continue;
                }
                let end_ms = position_ms + f64::from(token.offsets.to);
                if !token.text.starts_with(char::is_whitespace)
                    && let Some(word) = words.last_mut()
                {
                    word.text.push_str(&token.text);
                    word.end_ms = word.end_ms.max(end_ms);
                } else {
                    words.push(VocalSegment {
                        start_ms: position_ms + f64::from(token.offsets.from),
                        end_ms,
                        text: token.text,
                    });
                }
            }
            words.retain(|word| word.end_ms > word.start_ms);
            words
        })
        .collect())
}
