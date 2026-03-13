/**
 * Custom ESLint rule to enforce max-statements only on React components
 * identified by PascalCase naming convention.
 *
 * Adds a configurable `message` option over the built-in max-statements rule:
 *  - Supports {{name}}, {{count}}, {{max}} template variables.
 *  - Ideal for embedding skill-invocation instructions so developers and AI
 *    agents know exactly what command to run to fix the issue.
 *    Example: "{{name}} has {{count}} statements (max {{max}}).
 *             Run: skill react-doctor"
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce a maximum number of statements in a React component',
      recommended: false,
      url: 'https://github.com/CosticaPuntaru/agenTica/tree/main/eslint-plugin#max-statements-react-component',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: {
            type: 'integer',
            minimum: 0,
            description:
              'Maximum number of top-level statements allowed in a component.',
          },
          message: {
            type: 'string',
            description:
              'Custom error message. Supports {{name}}, {{count}}, and {{max}} template variables. ' +
              'Use this to embed skill-invocation instructions. ' +
              'Example: "{{name}} has {{count}} statements (max {{max}}). ' +
              'Run: skill react-doctor".',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      exceed:
        '{{name}} has too many statements ({{count}}). Maximum allowed is {{max}}. ' +
        'This is a React component and should be kept small.',
      exceedCustom: '{{customMessage}}',
    },
  },

  create(context) {
    const option = context.options[0]
    const maxStatements = option?.max ?? 10
    const customMessage = option?.message ?? null

    /**
     * Interpolates {{name}}, {{count}}, {{max}} in a template string.
     * @param {string} template
     * @param {{ name: string; count: number; max: number }} data
     * @returns {string}
     */
    function interpolate(template, data) {
      return template
        .replaceAll('{{name}}', data.name)
        .replaceAll('{{count}}', String(data.count))
        .replaceAll('{{max}}', String(data.max))
    }

    /**
     * Reports a node that exceeds the statement limit.
     * @param {import('eslint').Rule.Node} node
     * @param {number} count
     */
    function report(node, count) {
      const name = node.id ? node.id.name : 'Component'
      const data = { name, count, max: maxStatements }

      if (customMessage) {
        context.report({
          node,
          messageId: 'exceedCustom',
          data: { customMessage: interpolate(customMessage, data) },
        })
      } else {
        context.report({ node, messageId: 'exceed', data })
      }
    }

    /**
     * Returns true if the function node looks like a React component
     * (PascalCase name).
     * @param {import('eslint').Rule.Node} node
     * @returns {boolean}
     */
    function isLikelyComponent(node) {
      let name = ''
      if (node.id) {
        name = node.id.name
      } else if (node.parent?.type === 'VariableDeclarator') {
        name = node.parent.id.name
      }
      return !!name && /^[A-Z]/u.test(name)
    }

    /**
     * Counts the top-level statements in a function body.
     * Arrow functions with implicit return count as 1.
     * @param {import('eslint').Rule.Node} node
     * @returns {number}
     */
    function countStatements(node) {
      if (node.body.type === 'BlockStatement') {
        return node.body.body.length
      }
      return 1
    }

    /** @param {import('eslint').Rule.Node} node */
    function check(node) {
      if (!isLikelyComponent(node)) return
      const count = countStatements(node)
      if (count > maxStatements) report(node, count)
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    }
  },
}
