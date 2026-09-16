import { getLocationsWithRecordCount } from './src/db/locations.ts';

async function run() {
  try {
    const locs = await getLocationsWithRecordCount(1);
    console.log("Success");
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
run();
