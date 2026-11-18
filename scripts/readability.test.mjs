import assert from "node:assert/strict";
import { test } from "node:test";

import { boundaries, format } from "./readability-core.mjs";

test("separates function values, named functions, methods, control flow and returns", () => {
  for (const code of [
    "const x = 1;\nconst f = () => x;",
    "const f = async () => {};\nconst g = function* () {};",
    "function a() {}\nfunction b() {}",
    "class A { a() {}\nb() {} }",
    "class A { field = 1;\nconstructor() {}\nmethod() {} }",
    "function f() { const x = 1;\ntry {} catch {} }",
    "function f() { const x = 1;\nfor (;;) {} }",
    "function f() { const x = 1;\nwhile (x) {} }",
    "function f() { const x = 1;\ndo {} while (x); }",
    "function f() { const x = 1;\nswitch (x) { case 1: const y = 2;\nreturn y; default: const z = 3;\nreturn z; } }",
    "namespace Example { function first() {}\nfunction second() {} }",
    "function a() { const x = 1;\nif (x) {}\nreturn x; }",
    "export const a = () => {};\nexport const b = () => {};",
  ]) {
    assert.ok(boundaries(code).length);
    assert.equal(boundaries(format(code)).length, 0);
    assert.equal(format(format(code)), format(code));
  }
});

test("preserves related declarations, inline callbacks, comments and first returns", () => {
  for (const code of [
    "const x = 1;\nconst y = x + 1;",
    "items.map(() => { return 1; });",
    "const x = 1;\n// attached comment\nconst f = () => x;",
    "function f() { return 1; }",
    "const x = 1;\n\nconst f = () => x;",
    "import 'side-effect';\nimport y from './y';",
  ]) {
    assert.equal(format(code), code);
  }
});

test("preserves CRLF and indentation, collapses excessive padding", () => {
  const code = "function f() {\r\n  const x = 1;\r\n\r\n\r\n  return x;\r\n}";
  assert.equal(format(code), code.replace("\r\n\r\n\r\n", "\r\n\r\n"));
});

test("keeps overload signatures with their implementation", () => {
  const code =
    "function f(x: string): string;\nfunction f(x: string) { return x; }";

  assert.equal(format(code), code);
});

test("preserves directives, decorators, comments and import evaluation order", () => {
  const code =
    "'use client';\nimport 'first';\nimport x from 'package';\nimport y from './local';\nclass A {\n  first() {}\n  @decorator\n  second() {}\n}";
  const result = format(code);

  assert.equal(result.replace(/\s/g, ""), code.replace(/\s/g, ""));
  assert.equal(format(result), result);
});

test("rejects parse errors instead of claiming inspection succeeded", () => {
  assert.throws(() => boundaries("const = ;"), SyntaxError);
});

test("separates multiline callback hooks and identifiable memoized functions", () => {
  for (const declaration of [
    "useCallback(\n  (signal: AbortSignal) => getSeason(id, signal),\n  [id]\n)",
    "React.useCallback(async () => load(), [id])",
    "useMemo(() => () => load(), [id])",
    "useMemo(() => { return function () {}; }, [])",
    "(() => () => load())",
  ]) {
    const code = `const first = useCallback(() => load(), []);\nconst second = ${declaration};`;

    assert.equal(boundaries(code).length, 1);
    assert.equal(boundaries(format(code)).length, 0);
    assert.equal(format(format(code)), format(code));
  }
});

test("keeps value hooks and unidentifiable factory calls grouped", () => {
  for (const declaration of [
    "useState(false)",
    "useRef(null)",
    "useMemo(() => items.map(item => item.id), [items])",
    "useMemo(() => { function helper() {} return 1; }, [])",
    "createCallback(options)",
  ]) {
    const code = `const first = 1;\nconst second = ${declaration};`;

    assert.equal(format(code), code);
  }
});

test("separates every sibling if after statements, preserving comments and expressions", () => {
  for (const [input, expected] of [
    [
      "const parsed = schema.safeParse(input);\nif (!parsed.success) fail();",
      "const parsed = schema.safeParse(input);\n\nif (!parsed.success) fail();",
    ],
    ["save();\nif (ready) run();", "save();\n\nif (ready) run();"],
    ["save(); if (ready) run();", "save();\n\nif (ready) run();"],
    [
      "if (first) run();\nif (second) run();",
      "if (first) run();\n\nif (second) run();",
    ],
    [
      "function f() {\n  if (outer) {\n    save();\n    if (ready) run();\n  }\n}",
      "function f() {\n  if (outer) {\n    save();\n\n    if (ready) run();\n  }\n}",
    ],
    [
      "const value = load(\n  input,\n);\nif (value) run();",
      "const value = load(\n  input,\n);\n\nif (value) run();",
    ],
    [
      "save();\n// guard explanation\nif (ready) run();",
      "save();\n\n// guard explanation\nif (ready) run();",
    ],
    [
      "save(); // result explanation\nif (ready) run();",
      "save(); // result explanation\n\nif (ready) run();",
    ],
    [
      "save(); /* trailing */\n// guard explanation\nif (ready) run();",
      "save(); /* trailing */\n\n// guard explanation\nif (ready) run();",
    ],
    [
      "save();\n/* explanation\n\n   continued */\nif (ready) run();",
      "save();\n\n/* explanation\n\n   continued */\nif (ready) run();",
    ],
    ["save();\r\nif (ready) run();", "save();\r\n\r\nif (ready) run();"],
    [
      "switch (kind) { case 1: save();\nif (ready) run(); }",
      "switch (kind) { case 1: save();\n\nif (ready) run(); }",
    ],
  ]) {
    assert.equal(boundaries(input).length, 1, input);
    assert.equal(format(input), expected, input);
    assert.equal(boundaries(expected).length, 0, expected);
    assert.equal(format(expected), expected);
    assert.equal(format(input).replace(/\s/g, ""), input.replace(/\s/g, ""));
  }
});

test("preserves first guards, existing blank lines, else if and non-statement text", () => {
  for (const code of [
    "if (ready) run();",
    "function f() {\n  if (ready) run();\n}",
    "if (outer) {\n  if (inner) run();\n} else if (other) {\n  if (last) run();\n}",
    "save();\n\nif (ready) run();",
    "save();\n\n\nif (ready) run();",
    "save();\n\n// attached comment\nif (ready) run();",
    "save();\n// attached comment\n\nif (ready) run();",
    "const text = 'if (ready) run();';\nconst other = `if (other)`;",
    "// if (ready) run();\nconst value = 1;",
    "const view = <div>if (ready) run();</div>;",
    "const view = <div>{ready ? <span>if</span> : null}</div>;",
    "if (\n  ready &&\n  other\n) run();",
    "if (outer)\n  if (inner) run();\n  else if (other) run();",
    "function f() {\n  // first guard\n  if (ready) run();\n}",
  ]) {
    assert.equal(boundaries(code).length, 0, code);
    assert.equal(format(code), code);
  }
});

test("separates complete control-flow statements from both siblings in TSX", () => {
  for (const control of [
    "if (ready) { run(); } else if (wait) { pause(); } else { stop(); }",
    "try { run(); } catch (error) { handle(error); } finally { cleanup(); }",
    "for (;;) { break; }",
    "for (const item of items) { run(item); }",
    "for (const key in items) { run(key); }",
    "while (ready) { run(); }",
    "do { run(); } while (ready);",
    "switch (kind) { case 1: break; default: stop(); }",
  ]) {
    const before =
      "  const view: React.ReactNode = render(\n    <main />,\n  ); // prepared";
    const after = "  // return the original view\n  return view;";
    const code = `function View() {\n${before}\n  ${control}\n${after}\n}`;
    const expected = `function View() {\n${before}\n\n  ${control}\n\n${after}\n}`;

    assert.equal(boundaries(code).length, 2, control);
    assert.equal(format(code), expected);
    assert.equal(boundaries(expected).length, 0);
  }
});

test("separates multiline operation stages and preserves related declarations", () => {
  const mediaQuery = `const mediaIds = parsed.pageDocument
  ? pageMediaIds(parsed.pageDocument)
  : [];

const mediaCount = await tx.media.count({
  where: {
    id: { in: mediaIds },
  },
});`;

  for (const [valid, gap] of [
    [mediaQuery, "[];\n\nconst mediaCount"],
    [
      "const response = await fetch(url, {\n  signal,\n}); // request\n\n// Decode the response.\nconst body = await response.json();",
      "// request\n\n// Decode",
    ],
    [
      "async function save() {\n  const input = derive(\n    payload,\n  );\n\n  const saved = await (service.save(input) as Promise<Record>);\n}",
      ");\n\n  const saved",
    ],
    [
      "const url = suppliedUrl\n  ?? defaultUrl;\n\nconst endpoint = resolveEndpoint(url);",
      "defaultUrl;\n\nconst endpoint",
    ],
    [
      "const result = await lookup(id);\n\nconst summary = result\n  ? summarize(result)\n  : null;",
      "lookup(id);\n\nconst summary",
    ],
  ]) {
    const invalid = valid.replace(gap, gap.replace("\n\n", "\n"));
    assert.equal(boundaries(invalid).length, 1, invalid);
    assert.equal(format(invalid), valid);
    assert.equal(boundaries(valid).length, 0, valid);
  }

  for (const valid of [
    "const options = {\n  limit: 10,\n};\nconst result = await service.list(options);",
    "const [value, setValue] = useState<string | null>(\n  null,\n);\nconst ref = useRef(null);",
    "const response = await fetch(url);\nconst data = await response.json();",
    "const { id } = await params;\nconst result = await service.get({\n  id,\n});",
    "const first = Math.min(\n  start,\n  limit,\n);\nconst last = Math.max(end, limit);",
    "const request = buildRequest(\n  input,\n);\nconst id = request.id;",
  ]) {
    assert.equal(boundaries(valid).length, 0, valid);
  }
});
