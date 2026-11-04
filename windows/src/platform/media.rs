use super::{
    lyric_capture,
    lyric_recognition::{self, VocalSegment},
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use std::time::{SystemTime, UNIX_EPOCH};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session,
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionMediaProperties as Properties,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
    GlobalSystemMediaTransportControlsSessionTimelineProperties as Timeline,
};
use windows::Storage::Streams::DataReader;
use windows::Win32::System::WinRT::{RO_INIT_MULTITHREADED, RoInitialize, RoUninitialize};

struct Apartment;

impl Apartment {
    fn enter() -> windows::core::Result<Self> {
        unsafe { RoInitialize(RO_INIT_MULTITHREADED)? };
        Ok(Self)
    }
}

impl Drop for Apartment {
    fn drop(&mut self) {
        unsafe { RoUninitialize() }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSnapshot {
    source: String,
    title: String,
    artist: String,
    album: String,
    track_key: String,
    artwork: Option<String>,
    position_ms: Option<f64>,
    playback_rate: f64,
    sampled_at_ms: f64,
    duration_ms: Option<f64>,
    playing: bool,
    can_toggle: bool,
    can_next: bool,
    can_previous: bool,
    can_seek: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MediaAction {
    Toggle,
    Next,
    Previous,
}

fn current_session() -> windows::core::Result<Option<Session>> {
    let manager = Manager::RequestAsync()?.join()?;
    match manager.GetCurrentSession() {
        Ok(session) => Ok(Some(session)),
        Err(error) if error.code().0 == 0 => Ok(None),
        Err(error) => Err(error),
    }
}

fn artwork_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        Some("image/jpeg")
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        Some("image/webp")
    } else {
        None
    }
}

fn artwork(properties: &Properties) -> Option<String> {
    const MAX_ARTWORK_BYTES: u64 = 512 * 1024;
    let stream = properties
        .Thumbnail()
        .ok()?
        .OpenReadAsync()
        .ok()?
        .join()
        .ok()?;
    let size = stream.Size().ok()?;
    if !(1..=MAX_ARTWORK_BYTES).contains(&size) {
        return None;
    }
    let reader = DataReader::CreateDataReader(&stream.GetInputStreamAt(0).ok()?).ok()?;
    if u64::from(reader.LoadAsync(size as u32).ok()?.join().ok()?) != size {
        return None;
    }
    let mut bytes = vec![0; size as usize];
    reader.ReadBytes(&mut bytes).ok()?;
    Some(format!(
        "data:{};base64,{}",
        artwork_type(&bytes)?,
        STANDARD.encode(&bytes)
    ))
}

fn track_key(source: &str, title: &str, artist: &str, properties: &Properties) -> String {
    let album = properties.AlbumTitle().unwrap_or_default();
    let number = properties.TrackNumber().unwrap_or_default();
    serde_json::json!([source, title, artist, album.to_string(), number]).to_string()
}

fn bounded_seek_range(start: i64, end: i64, min: i64, max: i64) -> Option<(i64, i64)> {
    let lower = start.max(min);
    let upper = end.min(max);
    (lower < upper).then_some((lower, upper))
}

fn seek_range(timeline: &Timeline) -> Option<(i64, i64)> {
    bounded_seek_range(
        timeline.StartTime().ok()?.Duration,
        timeline.EndTime().ok()?.Duration,
        timeline.MinSeekTime().ok()?.Duration,
        timeline.MaxSeekTime().ok()?.Duration,
    )
}

fn snapshot(session: Session, known_artwork: Option<&str>) -> windows::core::Result<MediaSnapshot> {
    let properties = session.TryGetMediaPropertiesAsync()?.join()?;
    let source = session.SourceAppUserModelId()?.to_string();
    let title = properties.Title()?.to_string();
    let artist = properties.Artist()?.to_string();
    let album = properties.AlbumTitle().unwrap_or_default().to_string();
    let track_key = track_key(&source, &title, &artist, &properties);
    let playback = session.GetPlaybackInfo()?;
    let controls = playback.Controls()?;
    let playing = playback.PlaybackStatus()? == PlaybackStatus::Playing;
    let rate = playback
        .PlaybackRate()
        .and_then(|value| value.Value())
        .ok()
        .filter(|rate| rate.is_finite() && *rate > 0.0)
        .unwrap_or(1.0);
    let timeline = session.GetTimelineProperties().ok();
    let start = timeline
        .as_ref()
        .and_then(|value| value.StartTime().ok())
        .map_or(0, |time| time.Duration);
    let duration_ms = timeline.as_ref().and_then(|value| {
        let duration = value.EndTime().ok()?.Duration.checked_sub(start)?;
        (duration > 0).then_some(duration as f64 / 10_000.0)
    });
    let sampled_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |now| now.as_secs_f64() * 1000.0);
    let position_ms = timeline.as_ref().and_then(|timeline| {
        let position = timeline.Position().ok()?.Duration.checked_sub(start)? as f64 / 10_000.0;
        let updated = timeline.LastUpdatedTime().ok()?.UniversalTime;
        if updated <= 0 && duration_ms.is_none() {
            return None;
        }
        let elapsed = if playing && updated > 0 {
            let updated_ms = updated as f64 / 10_000.0 - 11_644_473_600_000.0;
            (sampled_at_ms - updated_ms).max(0.0) * rate
        } else {
            0.0
        };
        Some((position + elapsed).clamp(0.0, duration_ms.unwrap_or(f64::MAX)))
    });
    let can_seek = controls.IsPlaybackPositionEnabled().unwrap_or(false)
        && duration_ms.is_some()
        && timeline.as_ref().and_then(seek_range).is_some();
    Ok(MediaSnapshot {
        artwork: (known_artwork != Some(track_key.as_str()))
            .then(|| artwork(&properties))
            .flatten(),
        source,
        title,
        artist,
        album,
        track_key,
        position_ms,
        playback_rate: rate,
        sampled_at_ms,
        duration_ms,
        playing,
        can_toggle: controls.IsPlayPauseToggleEnabled()?
            || if playing {
                controls.IsPauseEnabled()?
            } else {
                controls.IsPlayEnabled()?
            },
        can_next: controls.IsNextEnabled()?,
        can_previous: controls.IsPreviousEnabled()?,
        can_seek,
    })
}

#[tauri::command]
pub async fn pivo_media_snapshot(
    known_artwork: Option<String>,
) -> Result<Option<MediaSnapshot>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _apartment = Apartment::enter().map_err(|error| error.to_string())?;
        current_session()
            .and_then(|session| {
                session
                    .map(|session| snapshot(session, known_artwork.as_deref()))
                    .transpose()
            })
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn pivo_media_action(source: String, action: MediaAction) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || -> windows::core::Result<bool> {
        let _apartment = Apartment::enter()?;
        let Some(session) = current_session()? else {
            return Ok(false);
        };
        if session.SourceAppUserModelId()?.to_string_lossy() != source {
            return Ok(false);
        }
        let playback = session.GetPlaybackInfo()?;
        let controls = playback.Controls()?;
        match action {
            MediaAction::Toggle if controls.IsPlayPauseToggleEnabled()? => {
                session.TryTogglePlayPauseAsync()?.join()
            }
            MediaAction::Toggle
                if playback.PlaybackStatus()? == PlaybackStatus::Playing
                    && controls.IsPauseEnabled()? =>
            {
                session.TryPauseAsync()?.join()
            }
            MediaAction::Toggle
                if playback.PlaybackStatus()? != PlaybackStatus::Playing
                    && controls.IsPlayEnabled()? =>
            {
                session.TryPlayAsync()?.join()
            }
            MediaAction::Next if controls.IsNextEnabled()? => session.TrySkipNextAsync()?.join(),
            MediaAction::Previous if controls.IsPreviousEnabled()? => {
                session.TrySkipPreviousAsync()?.join()
            }
            _ => Ok(false),
        }
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

static LYRIC_GENERATION: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
pub fn pivo_cancel_lyric_alignment() {
    LYRIC_GENERATION.fetch_add(1, Ordering::Relaxed);
}

#[tauri::command]
pub async fn pivo_align_lyrics(
    expected_track: String,
    extended: bool,
) -> Result<Vec<VocalSegment>, String> {
    static BUSY: AtomicBool = AtomicBool::new(false);
    struct Job;
    impl Drop for Job {
        fn drop(&mut self) {
            BUSY.store(false, Ordering::Release);
        }
    }

    let Some((cli, model)) = lyric_recognition::recognizer() else {
        return Ok(Vec::new());
    };
    let generation = LYRIC_GENERATION.load(Ordering::Relaxed);
    if BUSY.swap(true, Ordering::Acquire) {
        return Ok(Vec::new());
    }
    let job = Job;
    tauri::async_runtime::spawn_blocking(move || {
        let _job = job;
        let still_current = || LYRIC_GENERATION.load(Ordering::Relaxed) == generation;
        let run = || -> Result<Vec<VocalSegment>, Box<dyn std::error::Error>> {
            let _apartment = Apartment::enter()?;
            let Some(session) = current_session()? else {
                return Ok(Vec::new());
            };
            let source = session.SourceAppUserModelId()?.to_string();
            let Some(pid) = lyric_capture::player_process(&source)? else {
                return Ok(Vec::new());
            };
            let sample = || snapshot(session.clone(), Some(&expected_track));
            let before = sample()?;
            let Some(position) = before.position_ms else {
                return Ok(Vec::new());
            };
            if before.track_key != expected_track
                || !before.playing
                || (before.playback_rate - 1.0).abs() > 0.01
            {
                return Ok(Vec::new());
            }
            let started = Instant::now();
            let duration = Duration::from_secs(if extended { 30 } else { 12 });
            let pcm = lyric_capture::capture_player(pid, duration, still_current)?;
            let Some(selected) = current_session()? else {
                return Ok(Vec::new());
            };
            let after = snapshot(selected, Some(&expected_track))?;
            let elapsed = started.elapsed().as_secs_f64() * 1000.0;
            if pcm.is_empty()
                || after.track_key != expected_track
                || !after.playing
                || after
                    .position_ms
                    .is_none_or(|end| (end - position - elapsed).abs() > 750.0)
            {
                return Ok(Vec::new());
            }
            lyric_recognition::recognize(cli, model, pcm, position, still_current)
        };
        run().map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn pivo_media_seek(
    source: String,
    expected_track: String,
    position_ms: f64,
) -> Result<bool, String> {
    if !position_ms.is_finite() || position_ms < 0.0 {
        return Ok(false);
    }
    tauri::async_runtime::spawn_blocking(move || -> windows::core::Result<bool> {
        let _apartment = Apartment::enter()?;
        let Some(session) = current_session()? else {
            return Ok(false);
        };
        if session.SourceAppUserModelId()?.to_string_lossy() != source
            || !session
                .GetPlaybackInfo()?
                .Controls()?
                .IsPlaybackPositionEnabled()?
        {
            return Ok(false);
        }
        let properties = session.TryGetMediaPropertiesAsync()?.join()?;
        let title = properties.Title()?.to_string();
        let artist = properties.Artist()?.to_string();
        if track_key(&source, &title, &artist, &properties) != expected_track {
            return Ok(false);
        }
        let timeline = session.GetTimelineProperties()?;
        let Some((lower, upper)) = seek_range(&timeline) else {
            return Ok(false);
        };
        let start = timeline.StartTime()?.Duration;
        let target = start.saturating_add((position_ms * 10_000.0).round() as i64);
        session
            .TryChangePlaybackPositionAsync(target.clamp(lower, upper))?
            .join()
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{artwork_type, bounded_seek_range};

    #[test]
    fn artwork_accepts_supported_raster_signatures() {
        assert_eq!(artwork_type(b"\x89PNG\r\n\x1a\n"), Some("image/png"));
        assert_eq!(artwork_type(b"\xff\xd8\xff"), Some("image/jpeg"));
        assert_eq!(artwork_type(b"RIFF0000WEBP"), Some("image/webp"));
        assert_eq!(artwork_type(b"RIFF"), None);
        assert_eq!(artwork_type(b"<svg/>"), None);
    }

    #[test]
    fn seek_range_intersects_track_and_player_bounds() {
        assert_eq!(bounded_seek_range(20, 100, 0, 110), Some((20, 100)));
        assert_eq!(bounded_seek_range(20, 100, 30, 80), Some((30, 80)));
        assert_eq!(bounded_seek_range(20, 100, 0, 0), None);
        assert_eq!(bounded_seek_range(20, 100, 100, 150), None);
    }
}
