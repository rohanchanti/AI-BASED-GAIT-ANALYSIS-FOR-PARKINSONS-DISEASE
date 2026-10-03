/**
 * Browser-recorded WebM files (MediaRecorder) often report `duration = Infinity`
 * until the element is seeked past the end. This forces the browser to compute
 * the real duration, then rewinds. Input-handling helper only.
 */
export async function resolveVideoDuration(video: HTMLVideoElement): Promise<number> {
  if (isFinite(video.duration) && video.duration > 0) return video.duration;
  await new Promise<void>((resolve) => {
    const done = () => {
      if (isFinite(video.duration)) {
        video.removeEventListener("durationchange", done);
        video.removeEventListener("timeupdate", done);
        resolve();
      }
    };
    video.addEventListener("durationchange", done);
    video.addEventListener("timeupdate", done);
    setTimeout(resolve, 3000);
    video.currentTime = 1e101;
  });
  await new Promise<void>((resolve) => {
    video.addEventListener("seeked", () => resolve(), { once: true });
    setTimeout(resolve, 1500);
    video.currentTime = 0;
  });
  return isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
}
