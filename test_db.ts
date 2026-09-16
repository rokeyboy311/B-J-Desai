import { getLocationsWithRecordCount } from './src/db/locations.ts';

async function run() {
  try {
    const locs = await getLocationsWithRecordCount(2);
    console.log("Success:", locs);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
