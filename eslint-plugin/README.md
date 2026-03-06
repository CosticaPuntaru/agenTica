# eslint-plugin-agentica

Custom ESLint rules for AI-assisted codebases. Enforces function size limits
and React component complexity constraints — with a `message` option that lets
you embed **agentic skill-invocation instructions** directly in the lint error.

When the `message` option is set, developers and AI agents immediately know
which skill to run to fix the violation — without leaving the terminal or the
editor.

## Installation

```bash
npm install --save-dev eslint-plugin-agentica
# or
pnpm add -D eslint-plugin-agentica
```

> **Peer dependency**: `eslint >= 8`

---

## Quick start (flat config)

```js
// eslint.config.js
import agentica from 'eslint-plugin-agentica'

export default [
  ...agentica.configs.recommended,
]
```

The `recommended` preset uses sensible defaults with **no project-specific
messages**. To add skill instructions, override the `message` option as shown
below.

---

## Adding skill instructions to error messages

The `message` option accepts a template string that is interpolated and shown
directly in the lint error. Point it at whichever agentic skill your team uses.

### Example — with [skill.sh](https://skill.sh)-style skills

```js
// eslint.config.js
import agentica from 'eslint-plugin-agentica'

export default [
  {
    plugins: { agentica },
    files: ['**/*.tsx'],
    rules: {

      /**
       * Flag functions over 300 meaningful lines.
       * Template variables: {{name}}, {{lineCount}}, {{maxLines}}
       */
      'agentica/max-lines-per-function-with-skill': [
        'error',
        {
          max: 300,
          skipBlankLines: true,
          skipComments: true,
          message:
            '{{name}} has too many lines ({{lineCount}} / max {{maxLines}}).\n' +
            'Run the following skill to split it into smaller pieces:\n' +
            '  skill react-component-structure',
        },
      ],

      /**
       * Flag React components with more than 10 top-level statements.
       * Template variables: {{name}}, {{count}}, {{max}}
       */
      'agentica/max-statements-react-component': [
        'error',
        {
          max: 10,
          message:
            '{{name}} has {{count}} statements (max {{max}}).\n' +
            'This React component is too complex. Run:\n' +
            '  skill react-doctor',
        },
      ],

    },
  },
]
```

The lint errors will look like:

```
error  MyComponent has too many lines (320 / max 300).
       Run the following skill to split it into smaller pieces:
         skill react-component-structure

error  MyModal has 14 statements (max 10).
       This React component is too complex. Run:
         skill react-doctor
```

### Example — pointing to local SKILL.md files

If your skills are committed to the repo rather than installed globally:

```js
message:
  '{{name}} has too many lines ({{lineCount}} / max {{maxLines}}).\n' +
  'See .agent/skills/react-component-structure/SKILL.md\n' +
  'or ask your AI agent to apply it.',
```

---

## Rules

### `agentica/max-lines-per-function-with-skill`

An enhanced version of ESLint's built-in [`max-lines-per-function`](https://eslint.org/docs/rules/max-lines-per-function) rule.

| Option | Type | Default | Description |
|---|---|---|---|
| `max` | `number` | `50` | Maximum allowed lines per function |
| `skipBlankLines` | `boolean` | `false` | Ignore blank lines when counting |
| `skipComments` | `boolean` | `false` | Ignore full-line comments when counting |
| `IIFEs` | `boolean` | `false` | Also check immediately-invoked function expressions |
| `message` | `string` | *(generic)* | Custom error message. Supports `{{name}}`, `{{lineCount}}`, `{{maxLines}}` |

**Default message:**
```
Arrow function 'MyComponent' has too many lines (320). Maximum allowed is 300.
```

---

### `agentica/max-statements-react-component`

Applies a statement limit exclusively to React components (identified by
**PascalCase** naming). Encourages moving logic into custom hooks.

| Option | Type | Default | Description |
|---|---|---|---|
| `max` | `number` | `10` | Maximum number of top-level statements allowed in a component |
| `message` | `string` | *(generic)* | Custom error message. Supports `{{name}}`, `{{count}}`, `{{max}}` |

**Default message:**
```
MyModal has too many statements (14). Maximum allowed is 10.
This is a React component and should be kept small.
```

---

## License

MIT © [CosticaPuntaru](https://github.com/CosticaPuntaru)
