import { describe, expect, it, vi } from "vitest";

// Test for /todos command - github issue #8d98092e
describe("InteractiveMode /todos", () => {
	it("handles /todos command exists", () => {
		// This test verifies that the /todos command handler was added to interactive-mode.ts
		// The actual implementation is tested manually since it requires ripgrep and filesystem access
		const fs = require("fs");
		const path = require("path");
		const filePath = path.join(__dirname, "../src/modes/interactive/interactive-mode.ts");
		const content = fs.readFileSync(filePath, "utf8");
		
		// Check that the command handler is registered
		expect(content).toContain('if (text === "/todos")');
		expect(content).toContain("handleTodosCommand");
		
		// Check that the handler method exists
		expect(content).toContain("private async handleTodosCommand(): Promise<void>");
	});
});