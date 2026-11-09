export async function register() {
  // Bentuk ini wajib agar bundle edge membuang import node-only (Next mengganti NEXT_RUNTIME saat build).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.DISABLE_JOBS === '1' || !process.env.DATABASE_URL) return;
    const { startJobs } = await import('./lib/jobs');
    startJobs();
  }
}
