// Copy DATA_DIR to backups/<timestamp>/. Run before trips end or on a schedule.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../src/config.js";

if (!existsSync(config.dataDir)) {
  console.log(`沒有資料可備份（${config.dataDir} 不存在）`);
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = join("backups", stamp);
mkdirSync("backups", { recursive: true });
cpSync(config.dataDir, target, { recursive: true });
console.log(`✅ 已備份到 ${target}`);
