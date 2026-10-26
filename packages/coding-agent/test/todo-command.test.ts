import { spawn } from "child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, test } from "vitest";
import { ensureTool } from "../src/utils/tools-manager.ts";

describe("todo command", () => {
	test("finds TODO comments in files", async () => {
		const rgPath = await ensureTool("rg");
		if (!rgPath) {
			console.warn("Skipping test: ripgrep not available");
			return;
		}

		// Create a temporary directory with test files
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-todo-test-"));

		try {
			// Create test files with TODO comments
			await fs.writeFile(
				path.join(tmpDir, "test1.ts"),
				`// TODO: implement feature A
function foo() {
  // TODO: fix bug B
  return 42;
}`,
			);

			await fs.writeFile(
				path.join(tmpDir, "test2.js"),
				`// todo: lowercase should also match
const bar = 123;`,
			);

			await fs.writeFile(
				path.join(tmpDir, "test3.txt"),
				`This file has no TODO comments
Just regular text`,
			);

			// Run ripgrep to search for TODO comments
			const MAX_RESULTS = 50;
			const args = [
				"--no-config",
				"--json",
				"--line-number",
				"--color=never",
				"--hidden",
				"--ignore-case",
				"--max-count",
				String(MAX_RESULTS),
				"--",
				"TODO",
				tmpDir,
			];

			const child = spawn(rgPath, args, { stdio: ["ignore", "pipe", "pipe"] });
			let stdout = "";
			let stderr = "";

			child.stdout.on("data", (chunk) => {
				stdout += chunk.toString();
			});

			child.stderr.on("data", (chunk) => {
				stderr += chunk.toString();
			});

			await new Promise<void>((resolve, reject) => {
				child.on("close", (code) => {
					if (code !== null && code > 1) {
						reject(new Error(`ripgrep failed with code ${code}: ${stderr}`));
					} else {
						resolve();
					}
				});

				child.on("error", (error) => {
					reject(error);
				});
			});

			// Parse JSON output
			const outputLines = stdout.trim().split("\n").filter((line) => line);
			const matches: Array<{ path: string; line: number; text: string }> = [];

			for (const line of outputLines) {
				try {
					const parsed = JSON.parse(line);
					if (parsed.type === "match") {
						const relativePath = path.relative(tmpDir, parsed.data.path.text);
						matches.push({
							path: relativePath || parsed.data.path.text,
							line: parsed.data.line_number,
							text: parsed.data.lines.text.trim(),
						});
					}
				} catch {
					// Skip invalid JSON lines
				}
			}

			// Verify results
			expect(matches.length).toBeGreaterThan(0);
			expect(matches.length).toBeLessThanOrEqual(MAX_RESULTS);

			// Check that we found the expected TODO comments
			const test1Matches = matches.filter((m) => m.path.includes("test1.ts"));
			expect(test1Matches.length).toBe(2);
			expect(test1Matches.some((m) => m.text.includes("implement feature A"))).toBe(true);
			expect(test1Matches.some((m) => m.text.includes("fix bug B"))).toBe(true);

			const test2Matches = matches.filter((m) => m.path.includes("test2.js"));
			expect(test2Matches.length).toBe(1);
			expect(test2Matches[0].text.toLowerCase()).toContain("todo");
		} finally {
			// Clean up
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});

	test("caps results at 50", async () => {
		const rgPath = await ensureTool("rg");
		if (!rgPath) {
			console.warn("Skipping test: ripgrep not available");
			return;
		}

		// Create a temporary directory with many TODO comments
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-todo-test-"));

		try {
			// Create a file with more than 50 TODO comments
			const todoLines = [];
			for (let i = 0; i < 60; i++) {
				todoLines.push(`// TODO: task ${i}`);
			}
			await fs.writeFile(path.join(tmpDir, "many-todos.ts"), todoLines.join("\n"));

			// Run ripgrep with max-count limit
			const MAX_RESULTS = 50;
			const args = [
				"--no-config",
				"--json",
				"--line-number",
				"--color=never",
				"--hidden",
				"--ignore-case",
				"--max-count",
				String(MAX_RESULTS),
				"--",
				"TODO",
				tmpDir,
			];

			const child = spawn(rgPath, args, { stdio: ["ignore", "pipe", "pipe"] });
			let stdout = "";

			child.stdout.on("data", (chunk) => {
				stdout += chunk.toString();
			});

			await new Promise<void>((resolve, reject) => {
				child.on("close", (code) => {
					if (code !== null && code > 1) {
						reject(new Error(`ripgrep failed with code ${code}`));
					} else {
						resolve();
					}
				});

				child.on("error", (error) => {
					reject(error);
				});
			});

			// Parse JSON output
			const outputLines = stdout.trim().split("\n").filter((line) => line);
			const matches: Array<{ path: string; line: number; text: string }> = [];

			for (const line of outputLines) {
				try {
					const parsed = JSON.parse(line);
					if (parsed.type === "match") {
						matches.push({
							path: parsed.data.path.text,
							line: parsed.data.line_number,
							text: parsed.data.lines.text.trim(),
						});
					}
				} catch {
					// Skip invalid JSON lines
				}
			}

			// Verify that results are capped
			expect(matches.length).toBeLessThanOrEqual(MAX_RESULTS);
		} finally {
			// Clean up
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});

	test("handles no matches gracefully", async () => {
		const rgPath = await ensureTool("rg");
		if (!rgPath) {
			console.warn("Skipping test: ripgrep not available");
			return;
		}

		// Create a temporary directory with no TODO comments
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-todo-test-"));

		try {
			await fs.writeFile(
				path.join(tmpDir, "no-todos.ts"),
				`function foo() {
  return 42;
}`,
			);

			// Run ripgrep
			const MAX_RESULTS = 50;
			const args = [
				"--no-config",
				"--json",
				"--line-number",
				"--color=never",
				"--hidden",
				"--ignore-case",
				"--max-count",
				String(MAX_RESULTS),
				"--",
				"TODO",
				tmpDir,
			];

			const child = spawn(rgPath, args, { stdio: ["ignore", "pipe", "pipe"] });
			let stdout = "";

			child.stdout.on("data", (chunk) => {
				stdout += chunk.toString();
			});

			await new Promise<void>((resolve, reject) => {
				child.on("close", (code) => {
					// Code 1 means no matches, which is expected
					if (code !== null && code > 1) {
						reject(new Error(`ripgrep failed with code ${code}`));
					} else {
						resolve();
					}
				});

				child.on("error", (error) => {
					reject(error);
				});
			});

			// Parse JSON output
			const outputLines = stdout.trim().split("\n").filter((line) => line);
			const matches: Array<{ path: string; line: number; text: string }> = [];

			for (const line of outputLines) {
				try {
					const parsed = JSON.parse(line);
					if (parsed.type === "match") {
						matches.push({
							path: parsed.data.path.text,
							line: parsed.data.line_number,
							text: parsed.data.lines.text.trim(),
						});
					}
				} catch {
					// Skip invalid JSON lines
				}
			}

			// Verify no matches found
			expect(matches.length).toBe(0);
		} finally {
			// Clean up
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});
});
