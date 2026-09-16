import { getOrCreateUser } from './src/db/users.ts';

async function run() {
  try {
    // simulating a new UID but same email
    const user = await getOrCreateUser("new_uid_1234", "rokeyboy311@gmail.com", "Test");
    console.log(user);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
