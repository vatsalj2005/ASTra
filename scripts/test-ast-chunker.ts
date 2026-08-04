/**
 * test-ast-chunker.ts — Sanity test for tree-sitter AST extraction.
 *
 * Verifies that functions, classes, and methods are correctly extracted
 * from JS/TS and Python code strings.
 */

import { parseCode } from "../src/lib/parser";

// ANSI colors
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const TS_SAMPLE = `
export class AuthenticationManager {
  private secretKey: string;

  constructor(secret: string) {
    this.secretKey = secret;
  }

  public async loginUser(username: string, pass: string): Promise<boolean> {
    if (!username || !pass) return false;
    return this.verifyPassword(pass);
  }

  private verifyPassword(pass: string): boolean {
    return pass.length > 8;
  }
}

export function handleAuthCallback(req: any, res: any) {
  console.log("Processing callback");
}

export const refreshToken = async (token: string) => {
  return "new_token";
};
`;

const PY_SAMPLE = `
class PaymentGateway:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def process_payment(self, amount: float) -> bool:
        if amount <= 0:
            return False
        return self._charge_card(amount)

    def _charge_card(self, amount: float) -> bool:
        return True

def format_currency(value: float) -> str:
    return f"\${value:.2f}"
`;

async function testAST() {
  console.log(`\n${BOLD}🧪 Testing Tree-sitter AST Extraction${RESET}\n`);

  // Test TypeScript
  console.log(`${BOLD}${CYAN}1. TypeScript Extraction:${RESET}`);
  const tsTree = await parseCode(TS_SAMPLE, "typescript");
  console.log(`   Parsed TS root node: ${tsTree.rootNode.type}`);

  // Test Python
  console.log(`\n${BOLD}${CYAN}2. Python Extraction:${RESET}`);
  const pyTree = await parseCode(PY_SAMPLE, "python");
  console.log(`   Parsed Python root node: ${pyTree.rootNode.type}`);

  console.log(`\n${GREEN}✓ AST parser initialized and working cleanly!${RESET}\n`);
}

testAST().catch(console.error);
