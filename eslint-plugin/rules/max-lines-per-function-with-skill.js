/**
 * Custom ESLint rule based on the official max-lines-per-function rule.
 *
 * Adds two features over the built-in:
 *  1. A configurable `message` option — lets you embed skill-run instructions
 *     directly in the lint error so developers (and AI agents) know exactly
 *     what to do. Supports the same {{name}}, {{lineCount}}, {{maxLines}}
 *     template variables as the built-in messageId.
 *  2. A configurable `skillPath` option used in the default message.
 *
 * Source reference: https://github.com/eslint/eslint/blob/main/lib/rules/max-lines-per-function.js
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce a maximum number of lines of code in a function',
      recommended: false,
      url: 'https://github.com/CosticaPuntaru/agenTica/tree/main/eslint-plugin#max-lines-per-function-with-skill',
    },
    schema: [
      {
        oneOf: [
          {
            type: 'object',
            properties: {
              max: {
                type: 'integer',
                minimum: 0,
                description: 'Maximum number of lines allowed per function.',
              },
              skipComments: {
                type: 'boolean',
                description: 'Ignore full-line comments when counting lines.',
              },
              skipBlankLines: {
                type: 'boolean',
                description: 'Ignore blank lines when counting lines.',
              },
              IIFEs: {
                type: 'boolean',
                description: 'Also enforce the limit on immediately-invoked function expressions.',
              },
              message: {
                type: 'string',
                description:
                  'Custom error message. Supports {{name}}, {{lineCount}}, and {{maxLines}} template variables. ' +
                  'Use this to embed skill-invocation instructions. ' +
                  'Example: "{{name}} is too long ({{lineCount}} lines, max {{maxLines}}). ' +
                  'Run: skill react-component-structure".',
              },
            },
            additionalProperties: false,
          },
          {
            type: 'integer',
            minimum: 1,
          },
        ],
      },
    ],
    messages: {
      exceed:
        '{{name}} has too many lines ({{lineCount}}). Maximum allowed is {{maxLines}}.',
      exceedCustom: '{{customMessage}}',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    const lines = sourceCode.lines
    const option = context.options[0]

    let maxLines = 50
    let skipComments = false
    let skipBlankLines = false
    let IIFEs = false
    let customMessage = null

    if (typeof option === 'object') {
      maxLines = typeof option.max === 'number' ? option.max : 50
      skipComments = !!option.skipComments
      skipBlankLines = !!option.skipBlankLines
      IIFEs = !!option.IIFEs
      if (option.message) customMessage = option.message
    } else if (typeof option === 'number') {
      maxLines = option
    }

    /**
     * Interpolates {{name}}, {{lineCount}}, {{maxLines}} in a template string.
     * @param {string} template
     * @param {{ name: string; lineCount: number; maxLines: number }} data
     * @returns {string}
     */
    function interpolate(template, data) {
      return template
        .replaceAll('{{name}}', data.name)
        .replaceAll('{{lineCount}}', String(data.lineCount))
        .replaceAll('{{maxLines}}', String(data.maxLines))
    }

    /**
     * Given a list of comment nodes, return a map with numeric keys (source
     * code line numbers) and comment token values.
     * @param {import('eslint').AST.Token[]} comments
     * @returns {Map<number, import('eslint').AST.Token>}
     */
    function getCommentLineNumbers(comments) {
      const map = new Map()
      comments.forEach((comment) => {
        for (let i = comment.loc.start.line; i <= comment.loc.end.line; i++) {
          map.set(i, comment)
        }
      })
      return map
    }

    const commentLineNumbers = getCommentLineNumbers(sourceCode.getAllComments())

    /**
     * Tells if a comment encompasses the entire line.
     * @param {string} line
     * @param {number} lineNumber
     * @param {import('eslint').AST.Token} comment
     * @returns {boolean}
     */
    function isFullLineComment(line, lineNumber, comment) {
      const { start, end } = comment.loc
      const isFirstTokenOnLine =
        start.line === lineNumber && !line.slice(0, start.column).trim()
      const isLastTokenOnLine =
        end.line === lineNumber && !line.slice(end.column).trim()
      return (
        comment &&
        (start.line < lineNumber || isFirstTokenOnLine) &&
        (end.line > lineNumber || isLastTokenOnLine)
      )
    }

    /**
     * @param {import('eslint').Rule.Node} node
     * @returns {boolean}
     */
    function isIIFE(node) {
      return (
        (node.type === 'FunctionExpression' ||
          node.type === 'ArrowFunctionExpression') &&
        node.parent?.type === 'CallExpression' &&
        node.parent.callee === node
      )
    }

    /**
     * @param {import('eslint').Rule.Node} node
     * @returns {boolean}
     */
    function isEmbedded(node) {
      if (!node.parent) return false
      if (node !== node.parent.value) return false
      if (node.parent.type === 'MethodDefinition') return true
      if (node.parent.type === 'Property') {
        return (
          node.parent.method === true ||
          node.parent.kind === 'get' ||
          node.parent.kind === 'set'
        )
      }
      return false
    }

    /**
     * @param {import('eslint').Rule.Node} node
     * @returns {string}
     */
    function getFunctionNameWithKind(node) {
      const parent = node.parent
      let prefix = ''
      if (parent.type === 'MethodDefinition' || parent.type === 'Property') {
        if (parent.method) prefix = 'method'
        else if (parent.kind === 'get') prefix = 'getter'
        else if (parent.kind === 'set') prefix = 'setter'
        else prefix = 'function'
      } else if (node.type === 'ArrowFunctionExpression') {
        prefix = 'arrow function'
      } else {
        prefix = 'function'
      }
      const name = node.id?.name
        ? `'${node.id.name}'`
        : parent?.type === 'MethodDefinition'
          ? `'${parent.key.name}'`
          : parent?.type === 'Property' && parent.key
            ? `'${parent.key.name}'`
            : ''
      return name ? `${prefix} ${name}` : prefix
    }

    /** @param {string} str */
    function upperCaseFirst(str) {
      if (!str) return str
      return str.charAt(0).toUpperCase() + str.slice(1)
    }

    /** @param {import('eslint').Rule.Node} funcNode */
    function processFunction(funcNode) {
      const node = isEmbedded(funcNode) ? funcNode.parent : funcNode
      if (!IIFEs && isIIFE(node)) return

      let lineCount = 0
      for (let i = node.loc.start.line - 1; i < node.loc.end.line; ++i) {
        const line = lines[i]
        if (!line) continue
        if (skipComments && commentLineNumbers.has(i + 1)) {
          if (isFullLineComment(line, i + 1, commentLineNumbers.get(i + 1))) continue
        }
        if (skipBlankLines && /^\s*$/u.test(line)) continue
        lineCount++
      }

      if (lineCount <= maxLines) return

      const name = upperCaseFirst(getFunctionNameWithKind(funcNode))

      if (customMessage) {
        context.report({
          node,
          messageId: 'exceedCustom',
          data: { customMessage: interpolate(customMessage, { name, lineCount, maxLines }) },
        })
      } else {
        context.report({
          node,
          messageId: 'exceed',
          data: { name, lineCount, maxLines },
        })
      }
    }

    return {
      FunctionDeclaration: processFunction,
      FunctionExpression: processFunction,
      ArrowFunctionExpression: processFunction,
    }
  },
}
