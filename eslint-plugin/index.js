import maxLinesPerFunctionWithSkill from './rules/max-lines-per-function-with-skill.js'
import maxStatementsReactComponent from './rules/max-statements-react-component.js'

/** @type {import('eslint').Linter.Plugin} */
const plugin = {
  meta: {
    name: 'eslint-plugin-agentica',
    version: '0.1.0',
  },
  rules: {
    'max-lines-per-function-with-skill': maxLinesPerFunctionWithSkill,
    'max-statements-react-component': maxStatementsReactComponent,
  },
}

/**
 * Recommended flat-config preset.
 *
 * Ships with sensible defaults — no project-specific paths or skill references.
 * Override the `message` option per-project to embed your own skill instructions.
 *
 * Usage (eslint.config.js):
 *   import agentica from 'eslint-plugin-agentica'
 *   export default [...agentica.configs.recommended]
 */
plugin.configs = {
  recommended: [
    {
      plugins: { agentica: plugin },
      rules: {
        'agentica/max-lines-per-function-with-skill': [
          'error',
          {
            max: 300,
            skipBlankLines: true,
            skipComments: true,
          },
        ],
        'agentica/max-statements-react-component': [
          'error',
          { max: 10 },
        ],
      },
    },
  ],
}

export default plugin
