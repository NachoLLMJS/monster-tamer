export async function persistOptionsProgress(session, saveData, onError = console.error) {
  if (!session?.character) return false;
  try {
    await saveData();
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
}
