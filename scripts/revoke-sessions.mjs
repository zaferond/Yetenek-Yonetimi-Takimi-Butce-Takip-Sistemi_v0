import { Store } from "../backend/store.mjs";
const store = new Store();
store.run("DELETE FROM sessions");
store.close();
console.log("Tüm oturumlar kapatıldı.");
