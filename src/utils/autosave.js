export function createAutosaveScheduler({
  save,
  delay = 750,
  retryDelay = 1_000,
  maxRetryDelay = 10_000,
  onError = (error) => console.error('Unable to autosave character progress.', error),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let timer;
  let dirty = false;
  let destroyed = false;
  let inFlight;
  let nextRetryDelay = retryDelay;

  const arm = (wait) => {
    if (destroyed || inFlight) return;
    if (timer !== undefined) clearTimer(timer);
    timer = setTimer(() => {
      timer = undefined;
      return attempt();
    }, wait);
  };

  const attempt = async () => {
    if (destroyed || !dirty) return true;
    if (inFlight) return inFlight;
    dirty = false;
    inFlight = (async () => {
      try {
        await save();
        nextRetryDelay = retryDelay;
        return true;
      } catch (error) {
        dirty = true;
        onError(error);
        return false;
      }
    })();
    const succeeded = await inFlight;
    inFlight = undefined;
    if (dirty && !destroyed) {
      arm(succeeded ? delay : nextRetryDelay);
      if (!succeeded) nextRetryDelay = Math.min(nextRetryDelay * 2, maxRetryDelay);
    }
    return succeeded;
  };

  return {
    schedule() {
      if (destroyed) return;
      dirty = true;
      if (!inFlight) arm(delay);
    },
    async flush() {
      if (destroyed) return;
      if (timer !== undefined) {
        clearTimer(timer);
        timer = undefined;
      }
      if (inFlight) {
        await inFlight;
        await Promise.resolve();
      }
      for (let retries = 0; dirty && retries < 2; retries += 1) {
        await attempt();
        if (timer !== undefined) {
          clearTimer(timer);
          timer = undefined;
        }
      }
      if (dirty) arm(nextRetryDelay);
    },
    destroy() {
      destroyed = true;
      dirty = false;
      if (timer !== undefined) clearTimer(timer);
      timer = undefined;
    },
  };
}
