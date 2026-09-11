// The art pipeline shells out to ImageMagick 6 (`convert`, `identify`) and to
// POSIX file tools (`cp`, `rm`). None of those names resolve to the intended
// program on Windows.
//
// `convert` is the dangerous one: on Windows it resolves to
// C:\Windows\System32\convert.exe, the NTFS filesystem-conversion tool. Handing
// a list of image-processing arguments to a disk utility is not something we
// want to find out about empirically.
//
// The pipeline is POSIX-only by design, so refuse to spawn anything at all here
// rather than trying to guess which names happen to be harmless. Porting it
// means switching to ImageMagick 7 (`magick convert ...`) and replacing the
// `cp`/`rm` calls with node:fs equivalents.
export function assertPipelineCanSpawn(bin: string): void {
  if (process.platform !== 'win32') return;
  throw new Error(
    `Refusing to spawn '${bin}': the art pipeline is POSIX-only and is not supported on Windows.\n` +
    `These names do not resolve to the intended program here. Worst case is 'convert', which on ` +
    `Windows is C:\\Windows\\System32\\convert.exe -- the NTFS filesystem-conversion tool.\n` +
    `Run the pipeline on Linux, or port it to ImageMagick 7 ('magick ...') first.`
  );
}
