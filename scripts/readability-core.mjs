import ts from "typescript";

function boundaries(text, filename = "fixture.tsx") {
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
  );

  if (source.parseDiagnostics.length) {
    const diagnostic = source.parseDiagnostics[0];
    const location = source.getLineAndCharacterOfPosition(
      diagnostic.start ?? 0,
    );
    throw Object.assign(
      new SyntaxError(
        `Cannot inspect invalid syntax in ${filename}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
      ),
      { line: location.line + 1, column: location.character + 1 },
    );
  }

  const gaps = [];

  function functionValue(node) {
    if (!node) {
      return false;
    }

    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      return true;
    }

    if (ts.isParenthesizedExpression(node)) {
      return functionValue(node.expression);
    }

    if (!ts.isCallExpression(node)) {
      return false;
    }

    const name = ts.isIdentifier(node.expression)
      ? node.expression.text
      : ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : undefined;

    if (name === "useCallback") {
      return functionValue(node.arguments[0]);
    }

    if (name !== "useMemo") {
      return false;
    }

    const factory = node.arguments[0];

    if (
      !factory ||
      (!ts.isArrowFunction(factory) && !ts.isFunctionExpression(factory))
    ) {
      return false;
    }

    if (!ts.isBlock(factory.body)) {
      return functionValue(factory.body);
    }

    return factory.body.statements.some(
      (statement) =>
        ts.isReturnStatement(statement) && functionValue(statement.expression),
    );
  }

  function ifBoundary(previous, node) {
    const end = node.getStart(source);
    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      false,
      ts.LanguageVariant.Standard,
      text,
      undefined,
      previous.end,
      end - previous.end,
    );
    const whitespace = [];
    let start = previous.end;
    let attachedComment;

    while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
      const kind = scanner.getToken();

      if (
        kind !== ts.SyntaxKind.SingleLineCommentTrivia &&
        kind !== ts.SyntaxKind.MultiLineCommentTrivia
      ) {
        continue;
      }
      const commentStart = scanner.getTokenPos();
      const gap = { start, end: commentStart };
      whitespace.push(gap);

      // Keep trailing comments with the previous statement and leading comments
      // with the guard. Never treat a blank line inside a comment as spacing.
      if (
        !attachedComment &&
        source.getLineAndCharacterOfPosition(commentStart).line >
          source.getLineAndCharacterOfPosition(previous.end).line
      ) {
        attachedComment = gap;
      }
      start = scanner.getTextPos();
    }
    const beforeIf = { start, end };
    whitespace.push(beforeIf);

    if (
      whitespace.some((gap) =>
        /\n[^\S\r\n]*\r?\n/.test(text.slice(gap.start, gap.end)),
      )
    ) {
      return;
    }

    return attachedComment ?? beforeIf;
  }

  function inspect(nodes) {
    nodes.forEach((node, index) => {
      if (!index) {
        return;
      }

      const previous = nodes[index - 1];

      if (ts.isIfStatement(node)) {
        const gap = ifBoundary(previous, node);

        if (gap) {
          gaps.push(gap);
        }

        return;
      }

      if (
        ts.isFunctionDeclaration(node) &&
        ts.isFunctionDeclaration(previous) &&
        !previous.body &&
        node.name?.text === previous.name?.text
      ) {
        return;
      }
      const importBoundary =
        ts.isImportDeclaration(node) &&
        ts.isImportDeclaration(previous) &&
        node.importClause &&
        previous.importClause &&
        node.moduleSpecifier.text.startsWith(".") !==
          previous.moduleSpecifier.text.startsWith(".");
      const functionVariable =
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(({ initializer }) =>
          functionValue(initializer),
        );
      const required =
        importBoundary ||
        functionVariable ||
        (ts.isFunctionDeclaration(node) && !!node.body) ||
        (ts.isFunctionDeclaration(previous) && !!previous.body) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isReturnStatement(node) ||
        (ts.isVariableStatement(previous) &&
          (ts.isTryStatement(node) ||
            ts.isIterationStatement(node, false) ||
            ts.isSwitchStatement(node)));

      if (!required) {
        return;
      }

      const start = previous.end;
      const end = node.getStart(source);
      const gap = text.slice(start, end);

      // Comments and same-line statements need contextual review. Never move them.
      if (!/^\s*$/.test(gap) || !gap.includes("\n")) {
        return;
      }

      if (gap.split("\n").length !== 3) {
        gaps.push({ start, end });
      }
    });
  }

  function visit(node) {
    if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) {
      inspect(node.statements);
    }

    if (ts.isCaseClause(node) || ts.isDefaultClause(node)) {
      inspect(node.statements);
    }

    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      inspect(node.members);
    }

    ts.forEachChild(node, visit);
  }

  visit(source);

  return gaps;
}

function format(text, filename) {
  return boundaries(text, filename)
    .sort((a, b) => b.start - a.start)
    .reduce((result, gap) => {
      const whitespace = result.slice(gap.start, gap.end);
      const newline = whitespace.includes("\r\n") ? "\r\n" : "\n";
      const indent = whitespace.includes("\n")
        ? whitespace.slice(whitespace.lastIndexOf("\n") + 1)
        : result
            .slice(result.lastIndexOf("\n", gap.start - 1) + 1)
            .match(/^[\t ]*/)[0];

      return (
        result.slice(0, gap.start) +
        newline +
        newline +
        indent +
        result.slice(gap.end)
      );
    }, text);
}

export { boundaries, format };
