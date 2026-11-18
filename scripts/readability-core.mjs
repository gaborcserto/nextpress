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

  function controlFlow(node) {
    return (
      ts.isIfStatement(node) ||
      ts.isIterationStatement(node, false) ||
      ts.isSwitchStatement(node) ||
      ts.isTryStatement(node)
    );
  }

  function operationInitializer(statement) {
    if (!ts.isVariableStatement(statement)) {
      return;
    }

    const declarations = statement.declarationList.declarations;

    if (declarations.length !== 1 || !declarations[0].initializer) {
      return;
    }

    const initializer = ts.skipOuterExpressions(declarations[0].initializer);

    if (ts.isAwaitExpression(initializer)) {
      const expression = ts.skipOuterExpressions(initializer.expression);

      if (
        ts.isCallExpression(expression) ||
        ts.isTaggedTemplateExpression(expression)
      ) {
        return initializer;
      }
    }

    if (
      ts.isCallExpression(initializer) ||
      ts.isConditionalExpression(initializer) ||
      ts.isBinaryExpression(initializer)
    ) {
      return initializer;
    }
  }

  function requiresOperationGap(previous, node) {
    const completed = operationInitializer(previous);
    const next = operationInitializer(node);

    if (!completed || !next) {
      return false;
    }

    const isMultiline = (initializer) =>
      source.getLineAndCharacterOfPosition(initializer.getStart(source))
        .line !== source.getLineAndCharacterOfPosition(initializer.end).line;

    if (ts.isAwaitExpression(completed) || ts.isAwaitExpression(next)) {
      return isMultiline(completed) || isMultiline(next);
    }

    return (
      !ts.isCallExpression(completed) &&
      isMultiline(completed) &&
      ts.isCallExpression(next)
    );
  }

  function siblingBoundary(previous, node) {
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
      // with the next statement. A blank line inside a comment is not spacing.
      if (
        !attachedComment &&
        source.getLineAndCharacterOfPosition(commentStart).line >
          source.getLineAndCharacterOfPosition(previous.end).line
      ) {
        attachedComment = gap;
      }

      start = scanner.getTextPos();
    }

    const beforeStatement = { start, end };
    whitespace.push(beforeStatement);

    if (
      whitespace.some((gap) =>
        /\n[^\S\r\n]*\r?\n/.test(text.slice(gap.start, gap.end)),
      )
    ) {
      return;
    }

    return attachedComment ?? beforeStatement;
  }

  function inspect(nodes) {
    nodes.forEach((node, index) => {
      if (!index) {
        return;
      }

      const previous = nodes[index - 1];

      if (
        controlFlow(previous) ||
        controlFlow(node) ||
        requiresOperationGap(previous, node)
      ) {
        const gap = siblingBoundary(previous, node);

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

      const functionVariable =
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(({ initializer }) =>
          functionValue(initializer),
        );
      const required =
        functionVariable ||
        (ts.isFunctionDeclaration(node) && !!node.body) ||
        (ts.isFunctionDeclaration(previous) && !!previous.body) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isReturnStatement(node);

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
