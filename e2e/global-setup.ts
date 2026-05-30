/** Runs once before all workers. Wipes emulator state so each worker starts clean. */
export default async function globalSetup(): Promise<void> {
  await Promise.all([
    fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-vvta/databases/(default)/documents', {
      method: 'DELETE',
    }).catch(() => {
      /* ignore */
    }),
    fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-vvta/accounts', {
      method: 'DELETE',
    }).catch(() => {
      /* ignore */
    }),
  ]);
}
