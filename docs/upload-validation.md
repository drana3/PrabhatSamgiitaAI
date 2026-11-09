# What happens to an uploaded file

Every recording starts as somebody else's bytes: a name, a claimed type, a size, and a file. This
page lists every check, in order, and what is planned. Code:
`apps/api/app/services/upload_validation.py`, called from `apps/api/app/api/v1/recordings.py` and
`apps/api/app/services/recordings.py` (`inspect_stored_file`). Tests:
`apps/api/tests/test_upload_validation.py`.

There is **one** entry point for "may this file become a recording". The routes do not carry
their own rules.

## The steps

| # | When | Check | Refused with |
| - | --- | --- | --- |
| 1 | Before the file travels (`POST /recordings/uploads`) | the file **name**; the claimed **type** (MP3, M4A/AAC, WAV, OGG, FLAC, WebM audio); the claimed **size** (at least 512 bytes, at most `RECORDING_MAX_BYTES`, 60 MB) | 415, 422, 413 |
| 2 | When the bytes arrive (local disk adapter) and again at publish | the **first bytes** (magic numbers) | 422 `not_audio` |
| 3 | At publish, on the stored file | the real **size**; a **container check** for the format; the length the file **declares** | 413, 422 |
| 4 | At publish, after Chromaprint | the **measured length** (when Chromaprint is installed) | 422 `too_long` |
| 5 | At publish | the SHA-256 against the library and the **blocked list** (`docs/takedown-process.md`), then the existing duplicate checks (`docs/duplicate-check.md`) | 409 |
| 6 | At publish | ffmpeg measures loudness with a **fixed demuxer**, no network, a time limit and a clean environment (`docs/loudness-leveling.md`) | (skipped on failure) |

A refused file is **deleted from storage** at once. The error carries a plain English message and a
machine code in the `X-Error-Code` header (`not_audio`, `bad_container`, `bad_header`,
`too_large`, `too_small`, `too_long`, `bad_extension`, `bad_type`, `bad_name`).

## Step 1: names, type, size

- The **stored key is a random id**; the file name is never used as a path. The name is still
  checked, because it is shown in logs and could mislead a person.
- Refused names: empty or over 255 characters; control characters or a NUL byte; a folder
  (`/`, `\`) or `..`; no extension, or an extension that is not an audio one; and a name that
  hides something behind an audio extension (`song.mp3.exe`, `shell.php.mp3`, `page.html.mp3`,
  `backup.zip.m4a`). The list is `DANGEROUS_PARTS` in the module.
- The claimed content type must be one we store. This only decides the extension of the stored
  key; step 2 and 3 decide what the file really is.

## Step 2: the first bytes

Only the audio formats we play pass (`sniff_audio`). The module also **names** what a file is when
it is clearly not audio, so the member sees a useful message: a program (Windows, Linux, macOS,
Java class), a script (`#!`), an archive (ZIP, RAR, 7z, gzip, bzip2, xz), a document (PDF, Office,
RTF), a picture (PNG, GIF, JPEG, WebP, BMP, SVG), a web page or XML, a video stream, a MIDI file.
Everything else that is not audio is refused with a general message.

## Step 3: the container

A bounded read per format. **A file cannot make us read gigabytes of header**, and we never decode
audio here.

- **MP3**: the ID3 tag is at most 8 MB (cover art is a few hundred KB) and its size field must be
  valid; there must be an MPEG frame right after it.
- **M4A / MP4 audio**: the first box must be `ftyp` with an audio brand (a video `qt  ` brand is
  refused); every box must fit inside the file; at most 4096 boxes; the `moov` box is at most 8 MB
  and must exist; any **video track** (`hdlr` of type `vide`) is refused, so a video renamed to
  `.m4a` does not pass.
- **WAV**: a `fmt ` chunk with PCM, float, extensible or MP3 format; at most 8 channels and
  384 kHz; a `data` chunk; no giant chunk before the format.
- **FLAC**: the STREAMINFO block first; the metadata (cover pictures) at most 8 MB in at most 128
  blocks; sane rate and channels.
- **OGG**: Vorbis, Opus, FLAC or Speex only; Theora (video) refused.
- **WebM**: refused when a video codec name (VP8, VP9, AV1, ...) is in the track list.
- **ADTS AAC**: the frame sync only.

These are checks of the headers, not a decode. A file with a valid header and broken audio still
passes; ffmpeg later simply fails to measure it, and the recording is stored without loudness.

## Size, length, and "zip bombs"

Audio does not unzip, but two things behave like a bomb:

1. **A big header** (tags, boxes, cover pictures). Step 3 caps them (8 MB, 4096 parts).
2. **A file that decodes to far more than it weighs**, for example a few MB of silent FLAC that is
   a day long. WAV, FLAC and M4A **declare** their length in the header, so a file that declares more
   than `RECORDING_MAX_DURATION_SECONDS` (default 4 hours) is refused before anything reads it. For
   other formats the measured length from Chromaprint is checked (step 4). ffmpeg reads at most
   3 hours anyway, with a time limit.

If Chromaprint is not installed the measured length is not available; MP3, OGG, WebM and AAC then
rely on the 60 MB size limit and ffmpeg's own caps.

## Checked on real files

The parsers were run on files made by ffmpeg in every format above, with and without
`faststart`, with ID3 tags, and on 16 real MP3, M4A, WAV and FLAC files from the owner's disk. All
passed. A video MP4 and a video WebM were refused.

## What is not covered

- **Malware inside valid audio** (an exploit aimed at a decoder). We reduce the surface: the demuxer
  is fixed, there is no network, ffmpeg runs with a clean environment and a time limit. For
  stronger protection, run ffmpeg and Chromaprint in a sandbox with no network (see
  `docs/loudness-leveling.md`).
- **Copyright**: a clean file can still be someone's music. That is the takedown process.
- **Images** (author photos, playlist covers) have their own checks in
  `author_profiles.py` and `recording_sets.py` (type, 300 KB limit, re-encoding).
- The direct upload to R2 (storage) accepts any bytes up to the size in the signed URL; we check
  them at publish and delete a refused object. A file that is uploaded and never published stays in
  storage: there is no cleanup of such leftovers yet (a bucket lifecycle rule on the `recordings/`
  prefix for unpublished objects would do it; a decision for the deployment).

## Planned: ClamAV

A virus scan is worth adding **before real traffic from unknown members**. The plan, not built:

1. Run `clamd` as a second container in the same Azure Container Apps environment (no public
   address), with the signature database refreshed daily by `freshclam`.
2. In `inspect_stored_file`, right after step 3, stream the file to `clamd` over its socket
   (`INSTREAM`, with a 30 s time limit). A hit is refused with 422 `malware` and the object is
   deleted; the member sees a general message.
3. If `clamd` is down, **publish is not blocked** for members who already have published
   recordings (fail open, logged and alerted); for a member's first upload it waits (fail closed),
   because that is the case the scan exists for.
4. Tests use a fake `clamd` that answers with the EICAR test string.

This needs a container, about 1 GB of memory for the signatures, and a decision on cost. It is an
owner's decision, not a code one.

## Changing a limit

The numbers are at the top of `upload_validation.py`; the two that deploy can change are
`RECORDING_MAX_BYTES` and `RECORDING_MAX_DURATION_SECONDS` (`.env.example`).
