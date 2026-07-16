export function queueRemoteSave(previousSave, session, progress, saveRemoteProgress) {
  return previousSave
    .catch(() => undefined)
    .then(async () => {
      try {
        const updatedCharacter = await saveRemoteProgress(
          session,
          progress,
          session.character.progressVersion,
        );
        session.character = updatedCharacter;
        return updatedCharacter;
      } catch (error) {
        if (error?.status === 409 && error.body?.current) {
          session.character = error.body.current;
        }
        throw error;
      }
    });
}
