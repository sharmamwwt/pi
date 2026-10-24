#!/usr/bin/env node

/**
 * Print all environment variables
 */

const envVars = Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b));

console.log("Environment Variables:");
console.log("=".repeat(80));

for (const [key, value] of envVars) {
	console.log(`${key}=${value}`);
}

console.log("=".repeat(80));
console.log(`Total: ${envVars.length} environment variables`);
